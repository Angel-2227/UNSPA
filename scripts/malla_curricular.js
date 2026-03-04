// ============================================
// MALLA CURRICULAR GENERADA — malla_curricular.js
// Genera la malla visualmente desde studyPlan (CSV)
// con soporte de prerrequisitos configurables
// ============================================

// ---- Colores por agrupación (tipología) ----
const MALLA_TYPE_COLORS = {
    'DISCIPLINAR OBLIGATORIA':     { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
    'DISCIPLINAR OPTATIVA':        { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
    'FUNDAMENTACIÓN OBLIGATORIA':  { bg: '#fff8e1', border: '#f9a825', text: '#e65100' },
    'FUNDAMENTACIÓN OPTATIVA':     { bg: '#fce4ec', border: '#e91e63', text: '#880e4f' },
    'LIBRE ELECCIÓN':              { bg: '#f3e5f5', border: '#7b1fa2', text: '#4a148c' },
    'TRABAJO DE GRADO':            { bg: '#e8eaf6', border: '#3f51b5', text: '#1a237e' },
    'NIVELACIÓN':                  { bg: '#fff3e0', border: '#ff6f00', text: '#bf360c' },
};

// ---- Estado de prereqs ----
let mallaPrereqs = {};         // { subjectId: [subjectId, ...] }
let mallaPrereqMode = false;   // true cuando se está eligiendo prereq
let mallaPrereqSource = null;  // id de la materia origen
let mallaGenerated = false;

// ---- Inicialización de la vista generada ----
function initMallaGenerada() {
    loadMallaPrereqs();
    renderMallaGenerada();
}

function loadMallaPrereqs() {
    try {
        const s = localStorage.getItem('mallaPrereqs');
        if (s) mallaPrereqs = JSON.parse(s);
    } catch { mallaPrereqs = {}; }
}

function saveMallaPrereqs() {
    localStorage.setItem('mallaPrereqs', JSON.stringify(mallaPrereqs));
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid)
          .set({ mallaPrereqs }, { merge: true })
          .catch(console.error);
    }
}

// ---- Render principal ----
function renderMallaGenerada() {
    const container = document.getElementById('mallaGeneradaContainer');
    if (!container) return;

    const semNums = Object.keys(studyPlan)
        .filter(n => studyPlan[n].subjects && studyPlan[n].subjects.length > 0)
        .sort((a, b) => +a - +b);

    if (semNums.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-secondary);">
                <div style="font-size:3rem; margin-bottom:16px;">📋</div>
                <h3 style="margin-bottom:8px;">No hay materias cargadas</h3>
                <p>Carga tu CSV desde la vista de Resumen General primero.</p>
            </div>`;
        return;
    }

    // Calcular ancho total de la malla
    const COL_WIDTH = 200;
    const COL_GAP   = 40;
    const totalWidth = semNums.length * (COL_WIDTH + COL_GAP) - COL_GAP + 40;

    // Calcular altura máxima
    const maxSubjects = Math.max(...semNums.map(n => studyPlan[n].subjects.length));
    const CARD_H = 90;
    const CARD_GAP = 12;
    const HEADER_H = 52;
    const totalHeight = HEADER_H + maxSubjects * (CARD_H + CARD_GAP) + 40;

    container.innerHTML = `
        <div class="mgc-wrapper" id="mgcWrapper">
            <svg class="mgc-arrows" id="mgcArrows"
                 width="${totalWidth}" height="${totalHeight}"
                 style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;">
            </svg>
            <div class="mgc-grid" id="mgcGrid" style="width:${totalWidth}px; min-height:${totalHeight}px; position:relative; z-index:2;">
                ${semNums.map((n, colIdx) => buildSemColumn(n, colIdx, COL_WIDTH, COL_GAP, CARD_H, CARD_GAP, HEADER_H)).join('')}
            </div>
        </div>
        ${buildPrereqPanel()}`;

    attachMallaGenListeners();
    drawAllArrows();
    mallaGenerated = true;
}

function buildSemColumn(semNum, colIdx, COL_WIDTH, COL_GAP, CARD_H, CARD_GAP, HEADER_H) {
    const sem = studyPlan[semNum];
    const left = colIdx * (COL_WIDTH + COL_GAP) + 20;
    const statusColors = {
        completed: { bg: '#2e7d32', text: 'white' },
        current:   { bg: '#f9a825', text: 'white' },
        pending:   { bg: '#90a4ae', text: 'white' },
    };
    const sc = statusColors[sem.status] || statusColors.pending;

    const cards = sem.subjects.map((sub, i) => {
        const top = HEADER_H + i * (CARD_H + CARD_GAP);
        return buildSubjectBlock(sub, semNum, left, top, COL_WIDTH, CARD_H);
    }).join('');

    return `
        <div class="mgc-sem-col" style="position:absolute; left:${left}px; top:0; width:${COL_WIDTH}px;">
            <div class="mgc-sem-header" style="background:${sc.bg}; color:${sc.text};">
                <span class="mgc-sem-num">Semestre ${semNum}</span>
                <span class="mgc-sem-cr">${sem.subjects.reduce((s,x)=>s+x.credits,0)} cr</span>
            </div>
        </div>
        ${cards}`;
}

function buildSubjectBlock(sub, semNum, left, top, width, height) {
    const sem = studyPlan[semNum];
    const tc = MALLA_TYPE_COLORS[sub.type] || MALLA_TYPE_COLORS['DISCIPLINAR OBLIGATORIA'];

    // Estado de la materia según el semestre + marcas de la malla
    let stateIcon = '';
    let stateClass = '';
    const mark = mallaMarks && mallaMarks[sub.id];
    if (mark === 'completed' || sem.status === 'completed') {
        stateIcon = '✓'; stateClass = 'mgc-state-done';
    } else if (mark === 'current' || sem.status === 'current') {
        stateIcon = '▶'; stateClass = 'mgc-state-current';
    }

    const prereqIds = mallaPrereqs[sub.id] || [];
    const hasPrereq = prereqIds.length > 0;

    const shortName = sub.name.length > 48 ? sub.name.slice(0, 46) + '…' : sub.name;

    return `
        <div class="mgc-card ${stateClass}"
             id="mgc-${sub.id}"
             data-id="${sub.id}"
             data-sem="${semNum}"
             style="
                position: absolute;
                left: ${left}px;
                top: ${top}px;
                width: ${width}px;
                height: ${height}px;
                background: ${tc.bg};
                border: 2px solid ${tc.border};
                border-radius: 8px;
                padding: 8px 10px;
                box-shadow: 0 2px 6px rgba(0,0,0,0.1);
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                z-index: 2;
             "
             title="${sub.name}"
             onclick="handleMallaCardClick(event, '${sub.id}', '${semNum}')">
            <div style="font-size:0.78rem; font-weight:700; color:${tc.text}; line-height:1.2;">
                ${stateIcon ? `<span style="margin-right:4px;">${stateIcon}</span>` : ''}${shortName}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span style="font-size:0.65rem; background:${tc.border}; color:white; padding:2px 6px; border-radius:10px; font-weight:600;">
                    ${sub.credits} cr
                </span>
                ${hasPrereq ? `<span style="font-size:0.65rem; color:${tc.text}; opacity:0.8;">📌 ${prereqIds.length} prereq</span>` : ''}
                <span style="font-size:0.6rem; color:${tc.text}; opacity:0.7; text-align:right; max-width:90px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${sub.type.split(' ').map(w=>w[0]).join('')}
                </span>
            </div>
        </div>`;
}

function buildPrereqPanel() {
    return `
        <div id="mgcPrereqInfo" style="
            margin-top: 12px;
            padding: 10px 14px;
            background: var(--bg-secondary);
            border-radius: 8px;
            border: 1px solid var(--border-color);
            font-size: 0.82rem;
            color: var(--text-secondary);
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        ">
            <span id="mgcPrereqMsg">💡 Haz clic en una materia para marcarla. Usa el botón <strong>+ Prereq</strong> para asignar prerrequisitos.</span>
            <button class="btn btn-sm btn-secondary" id="mgcPrereqModeBtn" onclick="togglePrereqMode()">🔗 + Prereq</button>
            <button class="btn btn-sm btn-danger" onclick="clearAllPrereqs()">🗑 Borrar prereqs</button>
        </div>
        <!-- Panel flotante de materia seleccionada -->
        <div id="mgcCardPanel" style="display:none; margin-top:8px; padding:12px 16px; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:10px; box-shadow:var(--shadow-light);">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div>
                    <div style="font-weight:700; font-size:0.95rem;" id="mgcPanelName"></div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;" id="mgcPanelMeta"></div>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn btn-sm btn-success" onclick="markSelectedCard('completed')">✅ Completada</button>
                    <button class="btn btn-sm btn-warning" onclick="markSelectedCard('current')">▶ En curso</button>
                    <button class="btn btn-sm btn-secondary" onclick="markSelectedCard('none')">✕ Quitar</button>
                    <button class="btn btn-sm btn-danger" onclick="closeMgcPanel()">Cerrar</button>
                </div>
            </div>
            <div style="margin-top:8px; font-size:0.8rem;" id="mgcPanelPrereqs"></div>
        </div>`;
}

// ---- Flechas SVG de prereqs ----
function drawAllArrows() {
    const svg = document.getElementById('mgcArrows');
    if (!svg) return;
    svg.innerHTML = '';

    // defs para marcadores
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#e91e63" opacity="0.8"/>
        </marker>`;
    svg.appendChild(defs);

    Object.entries(mallaPrereqs).forEach(([targetId, sourceIds]) => {
        sourceIds.forEach(srcId => {
            const srcEl  = document.getElementById(`mgc-${srcId}`);
            const tgtEl  = document.getElementById(`mgc-${targetId}`);
            if (!srcEl || !tgtEl) return;

            const wrapper = document.getElementById('mgcWrapper');
            const wRect   = wrapper.getBoundingClientRect();
            const sRect   = srcEl.getBoundingClientRect();
            const tRect   = tgtEl.getBoundingClientRect();

            // Coordenadas relativas al wrapper
            const x1 = sRect.right  - wRect.left;
            const y1 = sRect.top    - wRect.top + sRect.height / 2;
            const x2 = tRect.left   - wRect.left;
            const y2 = tRect.top    - wRect.top + tRect.height / 2;

            const cx1 = x1 + Math.abs(x2 - x1) * 0.4;
            const cx2 = x2 - Math.abs(x2 - x1) * 0.4;

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}`);
            path.setAttribute('stroke', '#e91e63');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.7');
            path.setAttribute('marker-end', 'url(#arrow)');
            svg.appendChild(path);
        });
    });
}

// ---- Interacción con tarjetas ----
let selectedCardId = null;
let selectedCardSem = null;

function handleMallaCardClick(e, subId, semNum) {
    e.stopPropagation();

    if (mallaPrereqMode && mallaPrereqSource) {
        // Asignar prereq
        if (mallaPrereqSource === subId) {
            alert('Una materia no puede ser prereq de sí misma.');
            return;
        }
        if (!mallaPrereqs[subId]) mallaPrereqs[subId] = [];
        if (!mallaPrereqs[subId].includes(mallaPrereqSource)) {
            mallaPrereqs[subId].push(mallaPrereqSource);
            saveMallaPrereqs();
        }
        exitPrereqMode();
        renderMallaGenerada();
        return;
    }

    if (mallaPrereqMode) {
        // Primera materia seleccionada como fuente de prereq
        mallaPrereqSource = subId;
        document.getElementById('mgcPrereqMsg').innerHTML =
            `🔗 Ahora haz clic en la materia que <strong>requiere</strong> esta como prerrequisito.`;
        // Highlight source
        document.querySelectorAll('.mgc-card').forEach(c => c.style.opacity = '0.5');
        document.getElementById(`mgc-${subId}`).style.opacity = '1';
        document.getElementById(`mgc-${subId}`).style.outline = '3px solid #e91e63';
        return;
    }

    // Modo normal: mostrar panel
    selectedCardId  = subId;
    selectedCardSem = semNum;
    showMgcPanel(subId, semNum);
}

function showMgcPanel(subId, semNum) {
    const sem = studyPlan[semNum];
    if (!sem) return;
    const sub = sem.subjects.find(s => s.id === subId);
    if (!sub) return;

    const panel   = document.getElementById('mgcCardPanel');
    const nameEl  = document.getElementById('mgcPanelName');
    const metaEl  = document.getElementById('mgcPanelMeta');
    const prereqEl= document.getElementById('mgcPanelPrereqs');

    nameEl.textContent = sub.name;
    metaEl.textContent = `${sub.credits} créditos · ${sub.type} · Semestre ${semNum}`;

    // Prereqs de esta materia
    const prereqIds = mallaPrereqs[subId] || [];
    if (prereqIds.length > 0) {
        const prereqNames = prereqIds.map(pid => {
            for (const s of Object.values(studyPlan)) {
                const f = s.subjects.find(x => x.id === pid);
                if (f) return f.name;
            }
            return pid;
        });
        prereqEl.innerHTML = `📌 <strong>Prerrequisitos:</strong> ${prereqNames.join(' • ')}
            <button class="btn btn-sm btn-danger" style="margin-left:8px;" onclick="removeAllPrereqsOf('${subId}')">🗑 Quitar todos</button>`;
    } else {
        prereqEl.innerHTML = `<em style="color:var(--text-secondary)">Sin prerrequisitos asignados</em>`;
    }

    panel.style.display = 'block';
}

function closeMgcPanel() {
    document.getElementById('mgcCardPanel').style.display = 'none';
    selectedCardId = null;
    selectedCardSem = null;
}

function markSelectedCard(state) {
    if (!selectedCardId) return;
    if (state === 'none') {
        delete mallaMarks[selectedCardId];
    } else {
        mallaMarks[selectedCardId] = state;
    }
    saveMallaMarks();
    closeMgcPanel();
    renderMallaGenerada();
}

function removeAllPrereqsOf(subId) {
    delete mallaPrereqs[subId];
    saveMallaPrereqs();
    renderMallaGenerada();
}

function clearAllPrereqs() {
    if (!confirm('¿Borrar todos los prerrequisitos configurados?')) return;
    mallaPrereqs = {};
    saveMallaPrereqs();
    renderMallaGenerada();
}

// ---- Modo prerrequisito ----
function togglePrereqMode() {
    mallaPrereqMode = !mallaPrereqMode;
    const btn = document.getElementById('mgcPrereqModeBtn');
    if (mallaPrereqMode) {
        mallaPrereqSource = null;
        if (btn) { btn.textContent = '❌ Cancelar prereq'; btn.className = 'btn btn-sm btn-danger'; }
        document.getElementById('mgcPrereqMsg').innerHTML =
            `🔗 Haz clic en la materia que <strong>es prerrequisito</strong> (la que se debe ver antes).`;
    } else {
        exitPrereqMode();
    }
}

function exitPrereqMode() {
    mallaPrereqMode = false;
    mallaPrereqSource = null;
    const btn = document.getElementById('mgcPrereqModeBtn');
    if (btn) { btn.textContent = '🔗 + Prereq'; btn.className = 'btn btn-sm btn-secondary'; }
    document.getElementById('mgcPrereqMsg').innerHTML =
        `💡 Haz clic en una materia para marcarla. Usa el botón <strong>+ Prereq</strong> para asignar prerrequisitos.`;
    document.querySelectorAll('.mgc-card').forEach(c => {
        c.style.opacity = '';
        c.style.outline = '';
    });
}

function attachMallaGenListeners() {
    // Cerrar panel al hacer clic fuera
    const wrapper = document.getElementById('mgcWrapper');
    if (wrapper) {
        wrapper.addEventListener('click', (e) => {
            if (!e.target.closest('.mgc-card') && !mallaPrereqMode) {
                closeMgcPanel();
            }
        });
    }
}

// ---- Estadísticas para la malla generada ----
function getMallaGenStats() {
    let done = 0, inProgress = 0, total = 0;
    Object.values(studyPlan).forEach(sem => {
        sem.subjects.forEach(sub => {
            total++;
            const mark = mallaMarks && mallaMarks[sub.id];
            if (mark === 'completed' || sem.status === 'completed') done++;
            else if (mark === 'current' || sem.status === 'current') inProgress++;
        });
    });
    return { done, inProgress, total, pending: total - done - inProgress };
}
