// ============================================
// HORARIO.JS — Módulo de Horarios
// Depende de las variables globales de script.js:
//   studyPlan, subjectBank, schedules, currentPeriodConfig,
//   horariosData, currentEditingSchedule, generateId,
//   saveData, saveSubjectBank, saveToFirestore, db, currentUser
// ============================================

// ── Estado local del módulo ──────────────────
let selectedSubjects = {};

// ============================================
// UTILIDADES
// ============================================

function normalizeString(str) {
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, '')
        .trim();
}

/**
 * Busca una materia por ID primero en studyPlan y luego en subjectBank.
 * De esta forma siempre encuentra la materia aunque haya venido del banco.
 */
function findSubjectById(id) {
    for (let semester of Object.values(studyPlan)) {
        const found = semester.subjects.find(s => s.id === id);
        if (found) return found;
    }
    // Fallback al banco (por si no está en ningún semestre activo)
    return subjectBank.find(s => s.id === id) || null;
}

// ============================================
// CARGA DEL ARCHIVO DE HORARIOS
// ============================================

/**
 * Cruza horariosData contra studyPlan y subjectBank,
 * guarda horariosInfo en ambos y persiste en Firestore.
 * 
 * FIX PRINCIPAL: horariosInfo se guarda en subjectBank y studyPlan
 * para que sobreviva recargas (no queda solo en memoria).
 */
function updateSubjectBankFromHorarios() {
    let updated = 0;
    let notFound = 0;

    horariosData.forEach(horarioMateria => {
        const bankSubject = subjectBank.find(s =>
            normalizeString(s.name) === normalizeString(horarioMateria.nombre)
        );

        if (bankSubject) {
            if (!bankSubject.code || bankSubject.code === '') {
                bankSubject.code = horarioMateria.codigo;
                updated++;
            }
            // Persistir en el banco → sobrevive recargas
            bankSubject.horariosInfo = horarioMateria.grupos;

            // Sincronizar también en cada semestre del plan
            Object.keys(studyPlan).forEach(semesterNum => {
                studyPlan[semesterNum].subjects.forEach(subject => {
                    if (normalizeString(subject.name) === normalizeString(horarioMateria.nombre)) {
                        subject.code = horarioMateria.codigo;
                        subject.horariosInfo = horarioMateria.grupos;
                    }
                });
            });
        } else {
            notFound++;
            console.warn(`⚠️ No encontrada en banco: "${horarioMateria.nombre}"`);
        }
    });

    // Guardar ambos con horariosInfo incluido
    saveData();
    saveSubjectBank();
    updateUI();
    console.log(`✅ Actualizadas: ${updated} | ⚠️ No encontradas en banco: ${notFound}`);
}

/**
 * Intenta restaurar horariosInfo desde el banco para una materia
 * de studyPlan que lo haya perdido (ej: recarga sin reargar el archivo).
 */
function restoreHorariosInfoFromBank(subject) {
    if (subject.horariosInfo && subject.horariosInfo.length > 0) return subject.horariosInfo;
    const bankMatch = subjectBank.find(s => s.id === subject.id || s.name === subject.name);
    if (bankMatch && bankMatch.horariosInfo && bankMatch.horariosInfo.length > 0) {
        subject.horariosInfo = bankMatch.horariosInfo; // restaurar en studyPlan también
        return bankMatch.horariosInfo;
    }
    return null;
}

function uploadHorarios() {
    document.getElementById('horariosFile').click();
}

// ============================================
// CONFIGURACIÓN DEL PERIODO
// ============================================

function savePeriodConfig() {
    currentPeriodConfig = {
        period: document.getElementById('currentPeriod').value,
        startDate: document.getElementById('periodStart').value,
        endDate: document.getElementById('periodEnd').value
    };
    localStorage.setItem('currentPeriod', JSON.stringify(currentPeriodConfig));
    alert('✅ Configuración del periodo guardada');
}

function loadPeriodConfig() {
    const saved = localStorage.getItem('currentPeriod');
    if (saved) {
        currentPeriodConfig = JSON.parse(saved);
        const pEl = document.getElementById('currentPeriod');
        const sEl = document.getElementById('periodStart');
        const eEl = document.getElementById('periodEnd');
        if (pEl) pEl.value = currentPeriodConfig.period;
        if (sEl) sEl.value = currentPeriodConfig.startDate;
        if (eEl) eEl.value = currentPeriodConfig.endDate;
    }
}

// ============================================
// CREAR / EDITAR HORARIO
// ============================================

function _hasAnyHorariosInfo() {
    return (
        Object.values(studyPlan).some(sem =>
            sem.subjects && sem.subjects.some(s => {
                const info = restoreHorariosInfoFromBank(s);
                return info && info.length > 0;
            })
        ) ||
        subjectBank.some(s => s.horariosInfo && s.horariosInfo.length > 0)
    );
}

function createNewSchedule() {
    if (!_hasAnyHorariosInfo() && horariosData.length === 0) {
        alert('⚠️ Primero debes cargar el archivo de horarios');
        return;
    }
    currentEditingSchedule = null;
    selectedSubjects = {};
    document.getElementById('scheduleName').value = `Horario ${currentPeriodConfig.period || ''}`;
    renderSubjectSelector();
    document.getElementById('scheduleModal').style.display = 'block';
}

function editSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    if (!_hasAnyHorariosInfo() && horariosData.length === 0) {
        alert('⚠️ Para editar el horario necesitas cargar el archivo de horarios. Los grupos y horarios viven en ese archivo.');
        return;
    }

    selectedSubjects = { ...schedule.subjects };
    currentEditingSchedule = schedule;
    document.getElementById('scheduleName').value = schedule.name;
    renderSubjectSelector();
    updateSchedulePreview();
    document.getElementById('scheduleModal').style.display = 'block';
}

// ============================================
// SELECTOR DE MATERIAS
// ============================================

function buildSubjectCard(subject, isOtherSemester = false) {
    const semLabel = isOtherSemester
        ? `<span class="sem-badge other-sem">Sem. ${subject.semester}</span>`
        : `<span class="sem-badge current-sem">Sem. ${subject.semester} • Cursando</span>`;
    return `
        <div class="subject-select-card${isOtherSemester ? ' other-sem-card' : ''}" id="subject-${subject.id}" onclick="toggleSubjectCard('${subject.id}')" data-sem="${subject.semester}" data-other="${isOtherSemester}">
            <div class="subject-header-info">
                <div>
                    <strong>${subject.name}</strong>
                    <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">
                        ${semLabel}
                        <span>${subject.credits} créditos</span>
                        ${subject.code ? `<span style="opacity:0.7">${subject.code}</span>` : ''}
                    </div>
                </div>
                <span class="expand-icon" id="expand-${subject.id}">▼</span>
            </div>
            <div class="group-selector" id="groups-${subject.id}">
                ${subject.horariosInfo.map((grupo, idx) => `
                    <div class="group-option" onclick="event.stopPropagation(); selectGroup('${subject.id}', ${idx}, ${isOtherSemester})">
                        <strong>Grupo ${grupo.numero}</strong><br>
                        <small>👨‍🏫 ${grupo.profesor}</small><br>
                        <small>📅 ${grupo.horarios.map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</small>
                    </div>`).join('')}
            </div>
        </div>`;
}

function renderSubjectSelector() {
    const container = document.getElementById('subjectSelector');
    const currentSubjects = [];
    const otherSubjects = [];

    Object.entries(studyPlan).forEach(([semNum, semester]) => {
        semester.subjects.forEach(subject => {
            // FIX: restaurar horariosInfo desde el banco si se perdió
            const horariosInfo = restoreHorariosInfoFromBank(subject);
            if (!horariosInfo || horariosInfo.length === 0) return;

            const enriched = { ...subject, horariosInfo, semester: semNum };

            if (semester.status === 'current') {
                currentSubjects.push(enriched);
            } else if (semester.status === 'pending') {
                otherSubjects.push(enriched);
            }
        });
    });

    if (currentSubjects.length === 0 && otherSubjects.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
                <p style="margin-bottom: 8px;">No hay materias disponibles con información de horarios.</p>
                <p style="font-size: 0.85rem;">Asegúrate de haber cargado el archivo de horarios al menos una vez.</p>
            </div>`;
        return;
    }

    let html = '';

    if (currentSubjects.length > 0) {
        html += `<div class="sem-section-label">📚 Materias del semestre actual</div>`;
        html += currentSubjects.map(s => buildSubjectCard(s, false)).join('');
    } else {
        html += `<div class="sem-section-label" style="opacity:0.6;">Sin materias con horario para el semestre marcado como "Cursando"</div>`;
    }

    if (otherSubjects.length > 0) {
        html += `
        <div id="otherSubjectsToggle" class="other-sems-toggle" onclick="toggleOtherSubjects()">
            <span id="otherSubjectsToggleIcon">▶</span>
            Ver otras materias (${otherSubjects.length} de semestres pendientes)
        </div>
        <div id="otherSubjectsContainer" style="display:none;">
            <div class="sem-section-label other">📋 Otras materias disponibles
                <span style="font-size:0.78rem; font-weight:400; opacity:0.75; margin-left:6px;">Agregarlas actualizará su semestre en la malla</span>
            </div>
            ${otherSubjects.map(s => buildSubjectCard(s, true)).join('')}
        </div>`;
    }

    // Restaurar selecciones previas al editar
    container.innerHTML = html;
    _restoreSelections();
}

function _restoreSelections() {
    Object.entries(selectedSubjects).forEach(([subjectId, groupIdx]) => {
        const card = document.getElementById(`subject-${subjectId}`);
        if (!card) return;
        const groupOptions = card.querySelectorAll('.group-option');
        card.classList.add('selected');
        if (groupOptions[groupIdx]) groupOptions[groupIdx].classList.add('selected');
    });
}

function toggleOtherSubjects() {
    const cont = document.getElementById('otherSubjectsContainer');
    const icon = document.getElementById('otherSubjectsToggleIcon');
    const isOpen = cont.style.display !== 'none';
    cont.style.display = isOpen ? 'none' : 'block';
    icon.textContent = isOpen ? '▶' : '▼';
}

function toggleSubjectCard(subjectId) {
    const card = document.getElementById(`subject-${subjectId}`);
    const groups = document.getElementById(`groups-${subjectId}`);
    const icon = document.getElementById(`expand-${subjectId}`);
    card.classList.toggle('expanded');
    groups.classList.toggle('visible');
    icon.classList.toggle('expanded');
}

function filterSubjectSelector() {
    const searchSubject = document.getElementById('searchSubject').value.toLowerCase();
    const searchProfessor = document.getElementById('searchProfessor').value.toLowerCase();
    const searchSchedule = document.getElementById('searchSchedule').value.toLowerCase();

    document.querySelectorAll('.subject-select-card').forEach(card => {
        const subjectName = card.querySelector('strong').textContent.toLowerCase();
        const groupsDiv = card.querySelector('.group-selector');
        const groupOptions = groupsDiv.querySelectorAll('.group-option');

        let matchSubject = subjectName.includes(searchSubject);
        let hasMatchingGroup = false;

        groupOptions.forEach(option => {
            const optionText = option.textContent.toLowerCase();
            const matchProfessor = searchProfessor === '' || optionText.includes(searchProfessor);
            const matchSchedule = searchSchedule === '' || optionText.includes(searchSchedule);

            if (matchProfessor && matchSchedule) {
                option.style.display = 'block';
                hasMatchingGroup = true;
            } else {
                option.style.display = 'none';
            }
        });

        if (matchSubject && hasMatchingGroup) {
            card.style.display = 'block';
            if (searchProfessor || searchSchedule) {
                groupsDiv.classList.add('visible');
                card.querySelector('.expand-icon').classList.add('expanded');
            }
        } else if (matchSubject && !searchProfessor && !searchSchedule) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ============================================
// SELECCIÓN DE GRUPO
// ============================================

function selectGroup(subjectId, groupIndex, isOtherSemester = false) {
    const subjectCard = document.getElementById(`subject-${subjectId}`);
    const groupOptions = subjectCard.querySelectorAll('.group-option');

    // Deseleccionar si ya estaba seleccionado el mismo grupo
    if (selectedSubjects[subjectId] === groupIndex) {
        delete selectedSubjects[subjectId];
        subjectCard.classList.remove('selected');
        groupOptions[groupIndex].classList.remove('selected');
        updateSchedulePreview();
        return;
    }

    if (isOtherSemester) {
        const semNum = subjectCard.getAttribute('data-sem');
        const subjectName = subjectCard.querySelector('strong').textContent;
        const subj = findSubjectById(subjectId);
        const grupo = subj?.horariosInfo?.[groupIndex];
        const grupoDesc = grupo
            ? `Grupo ${grupo.numero} · ${grupo.profesor}\n${grupo.horarios.map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}`
            : '';
        showSyncConfirmModal(subjectId, groupIndex, subjectName, semNum, grupoDesc, subjectCard, groupOptions);
        return;
    }

    // Selección normal (semestre actual)
    selectedSubjects[subjectId] = groupIndex;
    subjectCard.classList.add('selected');
    groupOptions.forEach(opt => opt.classList.remove('selected'));
    groupOptions[groupIndex].classList.add('selected');
    updateSchedulePreview();
}

function showSyncConfirmModal(subjectId, groupIndex, subjectName, semNum, grupoDesc, subjectCard, groupOptions) {
    const old = document.getElementById('syncConfirmModal');
    if (old) old.remove();

    const modal = document.createElement('div');
    modal.id = 'syncConfirmModal';
    modal.className = 'modal';
    modal.style.cssText = 'display:flex; z-index:1200;';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:460px; padding:28px;">
            <div style="margin-bottom:18px;">
                <h3 style="margin:0 0 8px;">Agregar materia de otro semestre</h3>
                <p style="color:var(--text-secondary); font-size:0.9rem; margin:0;">
                    Estás agregando <strong>${subjectName}</strong> (Sem. ${semNum}) al horario actual.<br>
                    Esto <strong>marcará ese semestre como "Cursando"</strong> en tu malla.
                </p>
            </div>
            <div style="background:var(--bg-secondary); border-radius:8px; padding:12px; font-size:0.85rem; margin-bottom:20px; color:var(--text-secondary);">
                📌 ${grupoDesc}
            </div>
            <div style="display:flex; gap:10px; justify-content:flex-end;">
                <button class="btn btn-secondary" onclick="document.getElementById('syncConfirmModal').remove()">Cancelar</button>
                <button class="btn btn-success" onclick="confirmSyncAndSelect('${subjectId}', ${groupIndex}, ${semNum})">✅ Confirmar y agregar</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function confirmSyncAndSelect(subjectId, groupIndex, semNum) {
    document.getElementById('syncConfirmModal')?.remove();

    if (studyPlan[semNum]) {
        studyPlan[semNum].status = 'current';
        saveData();
    }

    const subjectCard = document.getElementById(`subject-${subjectId}`);
    const groupOptions = subjectCard?.querySelectorAll('.group-option');

    selectedSubjects[subjectId] = groupIndex;
    if (subjectCard) subjectCard.classList.add('selected');
    if (groupOptions) {
        groupOptions.forEach(opt => opt.classList.remove('selected'));
        groupOptions[groupIndex].classList.add('selected');
    }
    updateSchedulePreview();
}

// ============================================
// PREVISUALIZACIÓN DEL HORARIO
// ============================================

function updateSchedulePreview() {
    const preview = document.getElementById('schedulePreview');
    const allDays = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const usedDays = new Set();
    const subjectEntries = Object.entries(selectedSubjects);

    subjectEntries.forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(h => usedDays.add(h.dia));
    });

    const days = usedDays.size > 0 ? allDays.filter(d => usedDays.has(d)) : allDays;

    let minHour = 20, maxHour = 7;
    subjectEntries.forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(h => {
            minHour = Math.min(minHour, parseInt(h.inicio.split(':')[0]));
            maxHour = Math.max(maxHour, parseInt(h.fin.split(':')[0]));
        });
    });

    const hours = subjectEntries.length > 0
        ? Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)
        : Array.from({ length: 14 }, (_, i) => 7 + i);

    const SUBJECT_COLORS = [
        '#2e7d32','#1565c0','#6a1b9a','#c62828','#e65100',
        '#00695c','#283593','#558b2f','#4527a0','#00838f'
    ];
    const colorMap = {};
    subjectEntries.forEach(([subjectId], i) => {
        colorMap[subjectId] = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    });

    // Detectar conflictos
    const conflictSet = new Set();
    const timeSlots = {};
    subjectEntries.forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(h => {
            const startH = parseInt(h.inicio.split(':')[0]);
            const endH = parseInt(h.fin.split(':')[0]);
            for (let hr = startH; hr < endH; hr++) {
                const key = `${h.dia}-${hr}`;
                if (timeSlots[key]) conflictSet.add(key);
                timeSlots[key] = subjectId;
            }
        });
    });

    let grid = `<div class="schedule-preview-grid" style="grid-template-columns: 56px repeat(${days.length}, 1fr);">`;
    grid += `<div class="spg-cell spg-corner"></div>`;
    days.forEach(day => {
        grid += `<div class="spg-cell spg-header">${day.substring(0,3)}<span class="spg-day-full">${day.substring(3)}</span></div>`;
    });
    hours.forEach(hour => {
        grid += `<div class="spg-cell spg-time">${hour}:00</div>`;
        days.forEach(day => {
            const key = `${day}-${hour}`;
            grid += `<div class="spg-cell spg-slot${conflictSet.has(key) ? ' spg-conflict' : ''}" data-day="${day}" data-hour="${hour}"></div>`;
        });
    });
    grid += `</div>`;

    if (subjectEntries.length === 0) {
        grid += `<p class="spg-hint">Selecciona un grupo de una materia para ver la previsualización</p>`;
    }

    preview.innerHTML = grid;

    subjectEntries.forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        const grupo = subject.horariosInfo[groupIdx];
        const color = colorMap[subjectId];
        grupo.horarios.forEach(horario => {
            const startHour = parseInt(horario.inicio.split(':')[0]);
            const endHour = parseInt(horario.fin.split(':')[0]);
            const startCell = preview.querySelector(`[data-day="${horario.dia}"][data-hour="${startHour}"]`);
            if (!startCell) return;
            const span = endHour - startHour;
            startCell.style.gridRow = `span ${span}`;
            startCell.classList.add('spg-class');
            startCell.style.setProperty('--class-color', color);
            startCell.innerHTML = `
                <div class="spg-class-name">${subject.name}</div>
                <div class="spg-class-meta">G${grupo.numero} · ${horario.inicio}-${horario.fin}</div>`;
            for (let h = startHour + 1; h < endHour; h++) {
                const cell = preview.querySelector(`[data-day="${horario.dia}"][data-hour="${h}"]`);
                if (cell) cell.style.display = 'none';
            }
        });
    });

    if (conflictSet.size > 0) {
        const warn = document.createElement('div');
        warn.className = 'conflict-warning';
        warn.innerHTML = '⚠️ Hay conflictos de horario entre las materias seleccionadas';
        preview.prepend(warn);
    }

    // Resaltar hora/día actual en el preview también
    updateCurrentTimeIndicator();
}

// ============================================
// GUARDAR HORARIO
// ============================================

function saveSchedule() {
    const scheduleName = document.getElementById('scheduleName').value;
    if (!scheduleName) { alert('⚠️ Debes darle un nombre al horario'); return; }

    const scheduleData = {
        id: currentEditingSchedule?.id || generateId(),
        name: scheduleName,
        period: currentPeriodConfig.period,
        subjects: { ...selectedSubjects },
        createdAt: new Date().toISOString()
    };

    if (currentEditingSchedule) {
        const idx = schedules.findIndex(s => s.id === currentEditingSchedule.id);
        schedules[idx] = scheduleData;
    } else {
        schedules.push(scheduleData);
    }

    localStorage.setItem('savedSchedules', JSON.stringify(schedules));

    Object.entries(selectedSubjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        const grupo = subject.horariosInfo[groupIdx];
        subject.group = grupo.numero.toString();
        subject.professor = grupo.profesor;
        const bankSubject = subjectBank.find(s => s.id === subjectId || s.name === subject.name);
        if (bankSubject) {
            bankSubject.group = grupo.numero.toString();
            bankSubject.professor = grupo.profesor;
        }
    });

    saveData();
    saveSubjectBank();
    closeScheduleModal();
    renderSchedules();
    alert('✅ Horario guardado correctamente');
}

// ============================================
// LISTAR HORARIOS — Sistema de carpetas por semestre
// ============================================

/**
 * Devuelve el periodo actual configurado, o 'Sin periodo' si no hay.
 */
function getCurrentPeriod() {
    return currentPeriodConfig?.period || 'Sin periodo';
}

/**
 * Mueve un horario al archivo de semestres pasados.
 */
function archiveSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    if (!confirm(`¿Archivar el horario "${schedule.name}" en semestres anteriores?`)) return;
    schedule.archived = true;
    schedule.archivedAt = new Date().toISOString();
    localStorage.setItem('savedSchedules', JSON.stringify(schedules));
    if (typeof saveToFirestore === 'function') saveToFirestore();
    renderSchedules();
}

/**
 * Restaura un horario archivado al semestre actual.
 */
function unarchiveSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    schedule.archived = false;
    delete schedule.archivedAt;
    localStorage.setItem('savedSchedules', JSON.stringify(schedules));
    if (typeof saveToFirestore === 'function') saveToFirestore();
    renderSchedules();
}

function deleteSchedule(scheduleId) {
    if (confirm('¿Eliminar este horario permanentemente?')) {
        schedules = schedules.filter(s => s.id !== scheduleId);
        localStorage.setItem('savedSchedules', JSON.stringify(schedules));
        if (typeof saveToFirestore === 'function') saveToFirestore();
        renderSchedules();
    }
}

function renderSchedules() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;
    // NOTA: NO releer desde localStorage aquí — la variable `schedules` en memoria
    // siempre es la fuente de verdad. Releerla aquí revertía eliminaciones/archivados
    // antes de que Firestore los persistiera.

    const active = schedules.filter(s => !s.archived);
    const archived = schedules.filter(s => s.archived);

    if (schedules.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No tienes horarios guardados</p></div>';
        updateScheduleButton();
        return;
    }

    // ── Sección activa ──────────────────────────────
    let html = '';

    if (active.length === 0) {
        html += `<div class="no-data" style="margin-bottom:16px;"><p>No hay horarios para el semestre actual</p></div>`;
    } else {
        // Agrupar activos por periodo
        const byPeriod = {};
        active.forEach(s => {
            const key = s.period || 'Sin periodo';
            if (!byPeriod[key]) byPeriod[key] = [];
            byPeriod[key].push(s);
        });

        Object.entries(byPeriod).forEach(([period, list]) => {
            html += `
            <div class="semester-folder-header active-folder">
                <span class="folder-icon">📂</span>
                <span class="folder-title">Semestre actual · ${period}</span>
                <span class="folder-badge">${list.length} horario${list.length !== 1 ? 's' : ''}</span>
            </div>`;
            list.forEach(schedule => {
                html += _buildScheduleCard(schedule, false);
            });
        });
    }

    // ── Carpeta de semestres anteriores ────────────
    if (archived.length > 0) {
        // Agrupar archivados por periodo
        const byPeriod = {};
        archived.forEach(s => {
            const key = s.period || 'Sin periodo';
            if (!byPeriod[key]) byPeriod[key] = [];
            byPeriod[key].push(s);
        });

        const totalArchived = archived.length;
        html += `
        <div class="archived-section" id="archivedSection">
            <div class="semester-folder-header archived-folder" onclick="toggleArchivedSection()" style="cursor:pointer;">
                <span class="folder-icon">🗄️</span>
                <span class="folder-title">Semestres anteriores</span>
                <span class="folder-badge">${totalArchived} horario${totalArchived !== 1 ? 's' : ''}</span>
                <span class="folder-toggle-icon" id="archivedToggleIcon">▶</span>
            </div>
            <div id="archivedContent" style="display:none;">`;

        Object.entries(byPeriod).forEach(([period, list]) => {
            html += `<div class="archived-period-label">📅 ${period}</div>`;
            list.forEach(schedule => {
                html += _buildScheduleCard(schedule, true);
            });
        });

        html += `</div></div>`;
    }

    container.innerHTML = html;
    updateScheduleButton();
}

function _buildScheduleCard(schedule, isArchived) {
    const subjectCount = Object.keys(schedule.subjects).length;
    const archivedDate = schedule.archivedAt
        ? new Date(schedule.archivedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    return `
    <div class="schedule-card${isArchived ? ' schedule-card-archived' : ''}">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
            <div>
                <h3 style="margin:0 0 4px;">${schedule.name}</h3>
                <p style="color:var(--text-secondary); margin:0; font-size:0.85rem;">
                    Periodo: ${schedule.period || '—'}
                    ${isArchived && archivedDate ? ` · Archivado el ${archivedDate}` : ''}
                </p>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
                <button class="btn btn-primary btn-sm" onclick="viewSchedule('${schedule.id}')">👁️ Ver</button>
                ${!isArchived ? `
                <button class="btn btn-warning btn-sm" onclick="editSchedule('${schedule.id}')">✏️ Editar</button>
                <button class="btn btn-secondary btn-sm" onclick="archiveSchedule('${schedule.id}')" title="Archivar en semestres anteriores">🗄️ Archivar</button>
                ` : `
                <button class="btn btn-secondary btn-sm" onclick="unarchiveSchedule('${schedule.id}')" title="Mover a semestre actual">📂 Restaurar</button>
                `}
                <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">🗑️</button>
            </div>
        </div>
        <p style="margin:0; font-size:0.9rem;"><strong>${subjectCount}</strong> materia${subjectCount !== 1 ? 's' : ''} seleccionada${subjectCount !== 1 ? 's' : ''}</p>
    </div>`;
}

function toggleArchivedSection() {
    const content = document.getElementById('archivedContent');
    const icon = document.getElementById('archivedToggleIcon');
    if (!content || !icon) return;
    const isOpen = content.style.display !== 'none';
    content.style.display = isOpen ? 'none' : 'block';
    icon.textContent = isOpen ? '▶' : '▼';
}

function updateScheduleButton() {
    const btn = document.getElementById('viewScheduleBtn');
    if (btn) btn.style.display = schedules.length > 0 ? 'inline-flex' : 'none';
}

function viewSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    renderCurrentScheduleView(schedule);
    document.getElementById('currentScheduleModal').style.display = 'block';
    updateCurrentTimeIndicator();
    if (window.scheduleUpdateInterval) clearInterval(window.scheduleUpdateInterval);
    window.scheduleUpdateInterval = setInterval(updateCurrentTimeIndicator, 60000);
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').style.display = 'none';
    selectedSubjects = {};
    currentEditingSchedule = null;
}

function showCurrentScheduleModal() {
    if (schedules.length === 0) { alert('No tienes horarios guardados'); return; }
    const latestSchedule = schedules[schedules.length - 1];
    renderCurrentScheduleView(latestSchedule);
    document.getElementById('currentScheduleModal').style.display = 'block';
    updateCurrentTimeIndicator();
    if (window.scheduleUpdateInterval) clearInterval(window.scheduleUpdateInterval);
    window.scheduleUpdateInterval = setInterval(updateCurrentTimeIndicator, 60000);
}

function closeCurrentScheduleModal() {
    document.getElementById('currentScheduleModal').style.display = 'none';
    if (window.scheduleUpdateInterval) clearInterval(window.scheduleUpdateInterval);
}

// ============================================
// VISTA DEL HORARIO GUARDADO
// ============================================

function renderCurrentScheduleView(schedule) {
    const container = document.getElementById('currentScheduleContent');
    const title = document.getElementById('currentScheduleTitle');
    title.textContent = schedule.name;

    const SUBJECT_COLORS = [
        '#2e7d32','#1565c0','#6a1b9a','#c62828','#e65100',
        '#00695c','#283593','#558b2f','#4527a0','#00838f'
    ];
    const colorMap = {};
    Object.keys(schedule.subjects).forEach((subjectId, i) => {
        colorMap[subjectId] = SUBJECT_COLORS[i % SUBJECT_COLORS.length];
    });

    // Detect used days only
    const allDays = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const usedDays = new Set();
    let minHour = 20, maxHour = 7;

    Object.entries(schedule.subjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(horario => {
            usedDays.add(horario.dia);
            minHour = Math.min(minHour, parseInt(horario.inicio.split(':')[0]));
            maxHour = Math.max(maxHour, parseInt(horario.fin.split(':')[0]));
        });
    });

    const days = usedDays.size > 0 ? allDays.filter(d => usedDays.has(d)) : allDays;
    const hours = (minHour <= maxHour)
        ? Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)
        : Array.from({ length: 14 }, (_, i) => 7 + i);

    const schedule_map = {};
    days.forEach(day => {
        schedule_map[day] = {};
        hours.forEach(hour => { schedule_map[day][hour] = null; });
    });

    Object.entries(schedule.subjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        const grupo = subject.horariosInfo[groupIdx];
        grupo.horarios.forEach(horario => {
            const startHour = parseInt(horario.inicio.split(':')[0]);
            const endHour = parseInt(horario.fin.split(':')[0]);
            const duration = endHour - startHour;
            if (schedule_map[horario.dia]) {
                schedule_map[horario.dia][startHour] = {
                    subject, grupo, duration, start: true,
                    color: colorMap[subjectId],
                    startTime: horario.inicio, endTime: horario.fin
                };
                for (let h = startHour + 1; h < endHour; h++) {
                    schedule_map[horario.dia][h] = { occupied: true };
                }
            }
        });
    });

    const shortenProfessor = (name) => {
        if (!name) return '';
        const parts = name.trim().split(' ');
        return parts.length <= 2 ? name : `${parts[0]} ${parts[parts.length - 1]}`;
    };

    const numCols = days.length;
    let grid = `<div class="schedule-grid-wrapper"><div class="schedule-grid-viewer" style="grid-template-columns: 56px repeat(${numCols}, minmax(90px, 1fr));">`;
    grid += `<div class="schedule-cell-viewer header scv-corner"></div>`;
    days.forEach(day => {
        grid += `<div class="schedule-cell-viewer header" id="day-${day}">${day.substring(0,3)}<span class="scv-day-full">${day.substring(3).toLowerCase()}</span></div>`;
    });

    hours.forEach(hour => {
        grid += `<div class="schedule-cell-viewer time" id="time-${hour}">${hour}:00</div>`;
        days.forEach(day => {
            const cd = schedule_map[day][hour];
            if (cd && cd.occupied) return;
            if (cd && cd.start) {
                const rowspan_style = cd.duration > 1 ? `grid-row: span ${cd.duration};` : '';
                const color = cd.color || '#2e7d32';
                grid += `<div class="schedule-cell-viewer class-block"
                    style="${rowspan_style} --class-color:${color};"
                    data-day="${day}" data-hour="${hour}" data-duration="${cd.duration}">
                    <div class="class-block-name">${cd.subject.name}</div>
                    <div class="class-block-info">G${cd.grupo.numero} · ${cd.startTime}–${cd.endTime}</div>
                    <div class="class-block-prof">${shortenProfessor(cd.grupo.profesor)}</div>
                </div>`;
            } else {
                grid += `<div class="schedule-cell-viewer" data-day="${day}" data-hour="${hour}"></div>`;
            }
        });
    });

    grid += `</div></div>`;
    container.innerHTML = grid;
}

function updateCurrentTimeIndicator() {
    const now = new Date();
    const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const currentDay = dayNames[now.getDay()];
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const dateTimeEl = document.getElementById('currentDayTime');
    if (dateTimeEl) {
        dateTimeEl.textContent = `${currentDay}, ${now.toLocaleDateString('es-ES', {
            day: 'numeric', month: 'long', year: 'numeric'
        })} - ${currentHour}:${currentMinute.toString().padStart(2, '0')}`;
    }

    // ── Viewer (modal ver horario) ──────────────────
    document.querySelectorAll('.current-day-indicator').forEach(el => el.remove());
    document.querySelectorAll('.schedule-cell-viewer.current-time').forEach(el => el.classList.remove('current-time'));
    document.querySelectorAll('.schedule-cell-viewer.current-class').forEach(el => el.classList.remove('current-class'));

    const dayHeader = document.getElementById(`day-${currentDay}`);
    if (dayHeader) {
        const indicator = document.createElement('span');
        indicator.className = 'current-day-indicator';
        indicator.textContent = 'HOY';
        dayHeader.appendChild(indicator);
    }

    const timeCell = document.getElementById(`time-${currentHour}`);
    if (timeCell) timeCell.classList.add('current-time');

    document.querySelectorAll(`.schedule-cell-viewer.class-block[data-day="${currentDay}"]`).forEach(classBlock => {
        const hour = parseInt(classBlock.getAttribute('data-hour'));
        const duration = parseInt(classBlock.getAttribute('data-duration'));
        if (currentHour >= hour && currentHour < hour + duration) {
            classBlock.classList.add('current-class');
        }
    });

    // ── Preview (modal crear/editar horario) ────────
    document.querySelectorAll('.spg-header.spg-today').forEach(el => el.classList.remove('spg-today'));
    document.querySelectorAll('.spg-time.spg-now').forEach(el => el.classList.remove('spg-now'));
    document.querySelectorAll('.spg-class.spg-current-class').forEach(el => el.classList.remove('spg-current-class'));

    document.querySelectorAll('.spg-cell.spg-header').forEach(header => {
        if (header.textContent.trim().toUpperCase().startsWith(currentDay.substring(0, 3))) {
            header.classList.add('spg-today');
        }
    });

    document.querySelectorAll(`[data-day="${currentDay}"][data-hour]`).forEach(slot => {
        const hour = parseInt(slot.getAttribute('data-hour'));
        if (hour === currentHour && slot.classList.contains('spg-class')) {
            slot.classList.add('spg-current-class');
        }
    });

    // Mark current hour in time column of preview
    const previewGrid = document.getElementById('schedulePreview');
    if (previewGrid) {
        previewGrid.querySelectorAll('.spg-cell.spg-time').forEach(cell => {
            const txt = cell.textContent.trim();
            if (txt === `${currentHour}:00`) cell.classList.add('spg-now');
        });
    }
}

// ============================================
// INICIALIZACIÓN DEL LISTENER DEL ARCHIVO
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    updateScheduleButton();
    loadPeriodConfig();
    renderSchedules();

    const horariosFile = document.getElementById('horariosFile');
    if (horariosFile) {
        horariosFile.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    let content = e.target.result;
                    if (file.name.endsWith('.js')) {
                        const match = content.match(/const\s+materias\s*=\s*(\[[\s\S]*\]);?/);
                        if (match) content = match[1];
                    }
                    horariosData = JSON.parse(content);
                    updateSubjectBankFromHorarios();
                    alert(`✅ ${horariosData.length} materias cargadas correctamente`);
                } catch (error) {
                    alert('❌ Error al cargar el archivo: ' + error.message);
                }
            };
            reader.readAsText(file);
        });
    }
});