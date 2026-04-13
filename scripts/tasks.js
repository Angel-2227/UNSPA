// ============================================
// TAREAS ACADÉMICAS — tasks.js
// Módulo independiente para el SPA UNAL
// ============================================
// Guarda en: localStorage('acadTasks') + Firestore (merge)
// Auto-limpia tareas completadas hace > 30 días
// ============================================

// ── Estado global ────────────────────────────
let tkTasks     = [];         // Array completo de tareas
let tkFilterBy  = 'all';      // all | p1 | p2 | p3 | p4 | today
let tkSortBy    = 'priority'; // priority | due | created
let tkEditingId = null;       // ID de tarea en edición
let tkShowDone  = false;      // toggle de sección completadas

const TK_STORAGE_KEY = 'acadTasks';
const TK_DONE_TTL    = 30 * 24 * 60 * 60 * 1000; // 30 días en ms

// ── Prioridades ───────────────────────────────
const TK_PRIORITIES = {
  1: { label: 'Urgente',   icon: '🔥', shortLabel: 'Urgente'   },
  2: { label: 'Alta',      icon: '⚡', shortLabel: 'Alta'      },
  3: { label: 'Media',     icon: '📘', shortLabel: 'Media'     },
  4: { label: 'Baja',      icon: '🌿', shortLabel: 'Baja'      },
};

// ── Persistencia local ────────────────────────
function tkSaveLocal() {
  localStorage.setItem(TK_STORAGE_KEY, JSON.stringify(tkTasks));
}

function tkLoadLocal() {
  try {
    const raw = localStorage.getItem(TK_STORAGE_KEY);
    if (raw) tkTasks = JSON.parse(raw);
  } catch { tkTasks = []; }
}

// ── Persistencia Firestore ───────────────────
async function tkSaveFirestore() {
  if (typeof currentUser === 'undefined' || !currentUser) return;
  try {
    await db.collection('users').doc(currentUser.uid)
      .set({ acadTasks: tkTasks }, { merge: true });
  } catch (e) {
    console.warn('[Tasks] Error guardando en Firestore:', e);
  }
}

function tkLoadFromFirestore(data) {
  if (data && data.acadTasks && Array.isArray(data.acadTasks)) {
    tkTasks = data.acadTasks;
    tkSaveLocal();
    console.log(`[Tasks] ${tkTasks.length} tareas cargadas desde Firestore`);
  }
}

// ── Limpieza automática de tareas completadas ─
function tkPurgeOldDone() {
  const before = tkTasks.length;
  const cutoff = Date.now() - TK_DONE_TTL;
  tkTasks = tkTasks.filter(t => {
    if (!t.done) return true;
    return (t.doneAt || 0) > cutoff;
  });
  const removed = before - tkTasks.length;
  if (removed > 0) {
    console.log(`[Tasks] Purgadas ${removed} tarea(s) completadas (> 30 días)`);
    tkSaveLocal();
  }
}

// ── ID único ──────────────────────────────────
function tkGenId() {
  return 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Formateo de fecha ─────────────────────────
function tkFmtDue(dateStr) {
  if (!dateStr) return null;
  const due  = new Date(dateStr + 'T23:59:59');
  const now  = new Date();
  const diff = due - now;
  const days = Math.ceil(diff / 86400000);

  if (days < 0)  return { label: `Venció hace ${Math.abs(days)}d`, cls: 'overdue' };
  if (days === 0) return { label: 'Hoy 🔔', cls: 'today' };
  if (days === 1) return { label: 'Mañana', cls: 'soon' };
  if (days <= 5)  return { label: `En ${days} días`, cls: 'soon' };
  return { label: new Date(dateStr).toLocaleDateString('es-CO', { day:'numeric', month:'short' }), cls: '' };
}

// ── Obtener materias del semestre actual ───────
function tkGetCurrentSubjects() {
  if (typeof studyPlan === 'undefined') return [];
  const subjects = [];
  Object.entries(studyPlan).forEach(([sem, s]) => {
    if (s.status === 'current') {
      s.subjects.forEach(sub => {
        subjects.push({ id: sub.id, name: sub.name, semester: sem });
      });
    }
  });
  // Si no hay "current", incluir todas
  if (subjects.length === 0) {
    Object.entries(studyPlan).forEach(([sem, s]) => {
      s.subjects.forEach(sub => {
        subjects.push({ id: sub.id, name: sub.name, semester: sem });
      });
    });
  }
  return subjects;
}

// ── Filtrar y ordenar tareas ──────────────────
function tkGetVisible(includeAll = false) {
  let tasks = tkTasks.filter(t => !t.done);

  // Filtro
  if (!includeAll) {
    if (tkFilterBy === 'today') {
      const today = new Date().toISOString().slice(0, 10);
      tasks = tasks.filter(t => t.due === today);
    } else if (['1','2','3','4'].includes(String(tkFilterBy))) {
      tasks = tasks.filter(t => String(t.priority) === String(tkFilterBy));
    }
  }

  // Orden
  tasks.sort((a, b) => {
    if (tkSortBy === 'priority') {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (a.due && b.due) return new Date(a.due) - new Date(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    if (tkSortBy === 'due') {
      if (a.due && b.due) return new Date(a.due) - new Date(b.due);
      if (a.due && !b.due) return -1;
      if (!a.due && b.due) return 1;
      return a.priority - b.priority;
    }
    if (tkSortBy === 'created') {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }
    return 0;
  });

  return tasks;
}

function tkGetDone() {
  return tkTasks.filter(t => t.done)
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
}

// ── Estadísticas ──────────────────────────────
function tkGetStats() {
  const pending  = tkTasks.filter(t => !t.done);
  const today    = new Date().toISOString().slice(0, 10);
  const urgent   = pending.filter(t => t.priority === 1).length;
  const dueToday = pending.filter(t => t.due === today).length;
  const overdue  = pending.filter(t => t.due && t.due < today).length;
  const doneCount = tkTasks.filter(t => t.done).length;
  return { total: pending.length, urgent, dueToday, overdue, done: doneCount };
}

// ── RENDER PRINCIPAL ──────────────────────────
function renderTasksView() {
  tkLoadLocal();
  tkPurgeOldDone();

  const root = document.getElementById('tasksRoot');
  if (!root) return;

  const stats = tkGetStats();
  const visibleTasks = tkGetVisible();
  const doneTasks = tkGetDone();

  // ── Agrupar por materia ──
  const subjects = tkGetCurrentSubjects();
  const subjectMap = {};
  subjects.forEach(s => { subjectMap[s.id] = s; });

  // Tareas sin materia específica → "General"
  const groups = {}; // subjectId → { subject, tasks[] }

  visibleTasks.forEach(t => {
    const key = t.subjectId || '__general__';
    if (!groups[key]) {
      groups[key] = {
        subject: subjectMap[key] || { id: key, name: key === '__general__' ? 'General' : key, semester: '' },
        tasks: []
      };
    }
    groups[key].tasks.push(t);
  });

  // Si no hay grupos, mostrar vacío
  const groupEntries = Object.entries(groups);

  root.innerHTML = `
    <!-- Barra de resumen -->
    <div class="tk-summary-bar">
      <div class="tk-summary-pill ${stats.urgent > 0 ? 'urgent' : ''}">
        🔥 <strong>${stats.urgent}</strong> urgentes
      </div>
      <div class="tk-summary-pill ${stats.dueToday > 0 ? 'today' : ''}">
        📅 <strong>${stats.dueToday}</strong> para hoy
      </div>
      ${stats.overdue > 0 ? `<div class="tk-summary-pill urgent">⚠️ <strong>${stats.overdue}</strong> vencida${stats.overdue>1?'s':''}</div>` : ''}
      <div class="tk-summary-pill">
        ✅ <strong>${stats.done}</strong> completada${stats.done!==1?'s':''}
      </div>
    </div>

    <!-- Topbar -->
    <div class="tk-topbar">
      <div class="tk-topbar-left">
        <button class="tk-filter-chip ${tkFilterBy==='all'?'active':''}" onclick="tkSetFilter('all')">
          Todas <span style="font-size:0.72rem;opacity:0.8;">${stats.total}</span>
        </button>
        <button class="tk-filter-chip ${tkFilterBy==='1'?'active':''}" onclick="tkSetFilter('1')">
          <span class="tk-chip-dot" style="background:#ef5350;"></span> Urgente
        </button>
        <button class="tk-filter-chip ${tkFilterBy==='2'?'active':''}" onclick="tkSetFilter('2')">
          <span class="tk-chip-dot" style="background:#ffa000;"></span> Alta
        </button>
        <button class="tk-filter-chip ${tkFilterBy==='3'?'active':''}" onclick="tkSetFilter('3')">
          <span class="tk-chip-dot" style="background:#1976d2;"></span> Media
        </button>
        <button class="tk-filter-chip ${tkFilterBy==='today'?'active':''}" onclick="tkSetFilter('today')">
          📅 Hoy
        </button>
      </div>
      <button class="tk-add-btn" onclick="tkOpenModal()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva tarea
      </button>
    </div>

    <!-- Ordenar por -->
    <div class="tk-sort-bar">
      <span class="tk-sort-label">Ordenar:</span>
      <button class="tk-sort-chip ${tkSortBy==='priority'?'active':''}" onclick="tkSetSort('priority')">Prioridad</button>
      <button class="tk-sort-chip ${tkSortBy==='due'?'active':''}" onclick="tkSetSort('due')">Fecha límite</button>
      <button class="tk-sort-chip ${tkSortBy==='created'?'active':''}" onclick="tkSetSort('created')">Recientes</button>
    </div>

    <!-- Grupos de tareas -->
    <div id="tkGroupsContainer">
      ${groupEntries.length === 0 ? renderTasksEmpty() : groupEntries.map(([key, g], i) => renderSubjectGroup(key, g, i)).join('')}
    </div>

    <!-- Sección completadas -->
    ${doneTasks.length > 0 ? `
    <div class="tk-done-section">
      <button class="tk-done-toggle" onclick="tkToggleDone()">
        ${tkShowDone ? '▼' : '▶'} Completadas (${doneTasks.length}) — se borran automáticamente a los 30 días
      </button>
      <div class="tk-done-list ${tkShowDone ? 'open' : ''}">
        ${doneTasks.map(t => renderTaskCard(t, true)).join('')}
      </div>
    </div>` : ''}
  `;
}

function renderTasksEmpty() {
  return `
    <div class="tk-empty">
      <span class="tk-empty-icon">📝</span>
      <h3>${tkFilterBy === 'today' ? 'Ninguna tarea para hoy 🎉' : 'Sin tareas pendientes'}</h3>
      <p>${tkFilterBy !== 'all' ? 'Prueba otro filtro o ' : ''}Toca <strong>Nueva tarea</strong> para agregar una.</p>
    </div>`;
}

function renderSubjectGroup(key, { subject, tasks }, idx) {
  const hasUrgent = tasks.some(t => t.priority === 1);
  const isOpen = idx < 4; // primeros 4 abiertos por defecto

  return `
    <div class="tk-subject-group" id="tkGroup-${key}">
      <div class="tk-subject-header" onclick="tkToggleGroup('${key}')">
        <div class="tk-subject-title">
          📚 ${subject.name}
          ${subject.semester ? `<span class="tk-subject-sem">Sem. ${subject.semester}</span>` : ''}
        </div>
        <div class="tk-subject-meta">
          <span class="tk-task-count ${hasUrgent ? 'has-urgent' : ''}">${tasks.length} tarea${tasks.length!==1?'s':''}</span>
          <span class="tk-subject-chevron ${isOpen ? 'open' : ''}" id="tkChev-${key}">▶</span>
        </div>
      </div>
      <div class="tk-task-list ${isOpen ? 'open' : ''}" id="tkList-${key}">
        ${tasks.map(t => renderTaskCard(t, false)).join('')}
        ${tasks.length === 0 ? '<p style="font-size:0.8rem;color:var(--text-secondary);text-align:center;padding:12px;">Sin tareas en esta materia</p>' : ''}
      </div>
    </div>`;
}

function renderTaskCard(task, isDoneSection) {
  const pInfo = TK_PRIORITIES[task.priority] || TK_PRIORITIES[3];
  const due   = task.due ? tkFmtDue(task.due) : null;

  return `
    <div class="tk-task-card ${task.done ? 'done' : ''}" data-id="${task.id}" data-priority="${task.priority}">
      <div class="tk-check ${task.done ? 'checked' : ''}"
           onclick="tkToggleDone_Task('${task.id}')"
           title="${task.done ? 'Marcar como pendiente' : 'Marcar como completada'}">
        ${task.done ? '✓' : ''}
      </div>
      <div class="tk-task-body">
        <div class="tk-task-title">${escHtml(task.title)}</div>
        <div class="tk-task-meta">
          <span class="tk-priority-badge" data-priority="${task.priority}">
            ${pInfo.icon} ${pInfo.shortLabel}
          </span>
          ${due ? `<span class="tk-due-badge ${due.cls}">📅 ${due.label}</span>` : ''}
        </div>
        ${task.description ? `<div class="tk-task-desc">${escHtml(task.description)}</div>` : ''}
      </div>
      ${!isDoneSection ? `
      <div class="tk-task-actions">
        <button class="tk-icon-btn" onclick="tkEditTask('${task.id}')" title="Editar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="tk-icon-btn delete" onclick="tkDeleteTask('${task.id}')" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>` : ''}
    </div>`;
}

// ── Escape HTML ───────────────────────────────
function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Toggle group ──────────────────────────────
function tkToggleGroup(key) {
  const list = document.getElementById(`tkList-${key}`);
  const chev = document.getElementById(`tkChev-${key}`);
  if (!list) return;
  list.classList.toggle('open');
  if (chev) chev.classList.toggle('open');
}

// ── Filtros y orden ───────────────────────────
function tkSetFilter(f) {
  tkFilterBy = f;
  renderTasksView();
}

function tkSetSort(s) {
  tkSortBy = s;
  renderTasksView();
}

function tkToggleDone() {
  tkShowDone = !tkShowDone;
  renderTasksView();
}

// ── Toggle tarea completada ───────────────────
function tkToggleDone_Task(id) {
  const task = tkTasks.find(t => t.id === id);
  if (!task) return;

  const card = document.querySelector(`.tk-task-card[data-id="${id}"]`);
  const check = card?.querySelector('.tk-check');

  if (!task.done) {
    // Marcar como hecha: animación → actualizar → re-render
    if (check) {
      check.classList.add('checking');
      setTimeout(() => {
        task.done   = true;
        task.doneAt = Date.now();
        tkSaveLocal();
        tkSaveFirestore();
        renderTasksView();
        tkShowToast('✅ Tarea completada · Se borrará en 30 días');
      }, 350);
    }
  } else {
    // Restaurar
    task.done   = false;
    task.doneAt = null;
    tkSaveLocal();
    tkSaveFirestore();
    renderTasksView();
    tkShowToast('↩️ Tarea restaurada');
  }
}

// ── Eliminar ──────────────────────────────────
function tkDeleteTask(id) {
  const task = tkTasks.find(t => t.id === id);
  if (!task) return;

  const card = document.querySelector(`.tk-task-card[data-id="${id}"]`);
  if (card) {
    card.classList.add('vanishing');
    setTimeout(() => {
      tkTasks = tkTasks.filter(t => t.id !== id);
      tkSaveLocal();
      tkSaveFirestore();
      renderTasksView();
    }, 300);
  } else {
    tkTasks = tkTasks.filter(t => t.id !== id);
    tkSaveLocal();
    tkSaveFirestore();
    renderTasksView();
  }
}

// ── Editar ────────────────────────────────────
function tkEditTask(id) {
  const task = tkTasks.find(t => t.id === id);
  if (!task) return;
  tkEditingId = id;
  tkOpenModal(task);
}

// ── Toast ─────────────────────────────────────
function tkShowToast(msg) {
  let toast = document.getElementById('tkToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tkToast';
    toast.className = 'tk-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ── MODAL ─────────────────────────────────────
function tkOpenModal(editTask = null) {
  // Asegurarse de que el modal existe
  let modal = document.getElementById('tkModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'tkModal';
    document.body.appendChild(modal);
  }

  const subjects = tkGetCurrentSubjects();
  const today    = new Date().toISOString().slice(0, 10);

  // Valores por defecto o de edición
  const title       = editTask ? editTask.title       : '';
  const description = editTask ? editTask.description : '';
  const due         = editTask ? (editTask.due || '')  : '';
  const priority    = editTask ? editTask.priority    : 2;
  const subjectId   = editTask ? (editTask.subjectId || '') : '';

  const subjectOptions = subjects.map(s =>
    `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${s.name} (Sem. ${s.semester})</option>`
  ).join('');

  const priorityOptions = [1,2,3,4].map(p => {
    const info = TK_PRIORITIES[p];
    return `
      <div class="tk-prio-option ${priority === p ? 'selected-prio' : ''}" data-value="${p}" onclick="tkSelectPriority(${p})">
        <span class="tk-prio-icon">${info.icon}</span>
        <span class="tk-prio-label">${info.label}</span>
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="tk-modal-sheet" onclick="event.stopPropagation()">
      <div class="tk-modal-handle"></div>
      <div class="tk-modal-title">${editTask ? '✏️ Editar tarea' : '📝 Nueva tarea'}</div>

      <div class="tk-form-group">
        <label class="tk-label">Título <span style="color:var(--unal-red)">*</span></label>
        <input class="tk-input" id="tkInputTitle" type="text"
               placeholder="ej: Parcial 2 capítulos 4-7"
               value="${escHtml(title)}" maxlength="120" autocomplete="off">
      </div>

      <div class="tk-form-group">
        <label class="tk-label">Materia</label>
        <select class="tk-select" id="tkInputSubject">
          <option value="">— Sin materia específica —</option>
          ${subjectOptions}
        </select>
      </div>

      <div class="tk-form-group">
        <label class="tk-label">Prioridad</label>
        <div class="tk-priority-grid" id="tkPriorityGrid">
          ${priorityOptions}
        </div>
        <input type="hidden" id="tkInputPriority" value="${priority}">
      </div>

      <div class="tk-form-group">
        <label class="tk-label">Fecha límite (opcional)</label>
        <input class="tk-input" id="tkInputDue" type="date"
               value="${due}" min="${today}">
      </div>

      <div class="tk-form-group">
        <label class="tk-label">Descripción / notas (opcional)</label>
        <textarea class="tk-textarea" id="tkInputDesc"
                  placeholder="Detalles, páginas, recursos...">${escHtml(description)}</textarea>
      </div>

      <div class="tk-modal-actions">
        <button class="tk-btn-cancel" onclick="tkCloseModal()">Cancelar</button>
        <button class="tk-btn-save" onclick="tkSaveTask()">
          ${editTask ? '💾 Guardar cambios' : '➕ Agregar tarea'}
        </button>
      </div>
    </div>`;

  modal.className = '';
  modal.style.display = 'flex';
  requestAnimationFrame(() => modal.classList.add('open'));

  // Cerrar al hacer clic en el fondo
  modal.onclick = (e) => {
    if (e.target === modal) tkCloseModal();
  };

  // Focus en el título
  setTimeout(() => {
    const inp = document.getElementById('tkInputTitle');
    if (inp) inp.focus();
  }, 350);
}

function tkCloseModal() {
  const modal = document.getElementById('tkModal');
  if (!modal) return;
  modal.classList.remove('open');
  setTimeout(() => { modal.style.display = 'none'; modal.className = ''; }, 300);
  tkEditingId = null;
}

function tkSelectPriority(p) {
  // Actualizar UI
  document.querySelectorAll('.tk-prio-option').forEach(el => el.classList.remove('selected-prio'));
  const selected = document.querySelector(`.tk-prio-option[data-value="${p}"]`);
  if (selected) selected.classList.add('selected-prio');
  // Actualizar valor oculto
  const input = document.getElementById('tkInputPriority');
  if (input) input.value = p;
}

function tkSaveTask() {
  const title = (document.getElementById('tkInputTitle')?.value || '').trim();
  if (!title) {
    const inp = document.getElementById('tkInputTitle');
    if (inp) { inp.focus(); inp.style.borderColor = '#ef5350'; }
    return;
  }

  const taskData = {
    id:          tkEditingId || tkGenId(),
    title,
    description: (document.getElementById('tkInputDesc')?.value || '').trim(),
    subjectId:   document.getElementById('tkInputSubject')?.value || '',
    priority:    parseInt(document.getElementById('tkInputPriority')?.value || '2'),
    due:         document.getElementById('tkInputDue')?.value || '',
    done:        false,
    doneAt:      null,
    createdAt:   tkEditingId
                    ? (tkTasks.find(t => t.id === tkEditingId)?.createdAt || Date.now())
                    : Date.now(),
  };

  if (tkEditingId) {
    // Preservar estado done
    const existing = tkTasks.find(t => t.id === tkEditingId);
    if (existing) { taskData.done = existing.done; taskData.doneAt = existing.doneAt; }
    tkTasks = tkTasks.map(t => t.id === tkEditingId ? taskData : t);
    tkShowToast('✏️ Tarea actualizada');
  } else {
    tkTasks.unshift(taskData);
    tkShowToast('✅ Tarea agregada');
  }

  tkSaveLocal();
  tkSaveFirestore();
  tkCloseModal();
  renderTasksView();
}

// ── Cerrar modal con ESC ──────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modal = document.getElementById('tkModal');
    if (modal && modal.classList.contains('open')) tkCloseModal();
  }
});

// ── initTasksView — llamada desde script.js ────
function initTasksView() {
  renderTasksView();
}

// ── Integración con loadUserDataFromFirestore ──
// Llamar tkLoadFromFirestore(data) desde script.js cuando cargas datos de Firestore
// Ejemplo en loadUserDataFromFirestore:
//   if (typeof tkLoadFromFirestore === 'function') tkLoadFromFirestore(data);

// ── Auto-init si studyPlan ya existe ──────────
(function waitForTasksInit() {
  const t = setInterval(() => {
    if (typeof studyPlan !== 'undefined' && typeof currentUser !== 'undefined') {
      tkLoadLocal();
      tkPurgeOldDone();
      clearInterval(t);
    }
  }, 600);
})();
