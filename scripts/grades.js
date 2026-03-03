// ============================================
// SISTEMA DE NOTAS — grades.js
// Archivo independiente: scripts/grades.js
// ============================================
//
// MATERIAS SIN NOTAS (solo aprobado/reprobado):
// Añade sus nombres exactos a esta lista:
const PASS_FAIL_SUBJECTS = [
    'Inglés',
    'Inglés I',
    'Inglés II',
    'Cátedra de Inducción',
    'Cátedra Universidad Nacional de Colombia',
    'Trabajo de Grado',
    'Trabajo de Grado I',
    'Trabajo de Grado II',
];

// ============================================
// ESTADO GLOBAL DE NOTAS
// ============================================

// Estructura: gradesData[semesterNum][subjectId] = {
//   type: 'graded' | 'pass_fail',
//   passFail: 'approved' | 'failed' | null,  (solo si type === 'pass_fail')
//   components: [                              (solo si type === 'graded')
//     { id, name, weight, grade }
//   ]
// }
let gradesData = {};

// ============================================
// INICIALIZACIÓN
// ============================================

function initGrades() {
    loadGradesFromStorage();
    ensureGradesStructure();
}

function loadGradesFromStorage() {
    const saved = localStorage.getItem('academicGradesData');
    if (saved) {
        try { gradesData = JSON.parse(saved); } catch (e) { gradesData = {}; }
    }
}

function saveGradesToStorage() {
    localStorage.setItem('academicGradesData', JSON.stringify(gradesData));
    // También sincronizar con Firestore si hay usuario
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid).update({ gradesData })
            .catch(() => db.collection('users').doc(currentUser.uid).set({ gradesData }, { merge: true }));
    }
}

function loadGradesFromFirestore(firestoreData) {
    if (firestoreData && firestoreData.gradesData) {
        gradesData = firestoreData.gradesData;
        localStorage.setItem('academicGradesData', JSON.stringify(gradesData));
    }
}

// Asegurar que exista entrada para cada materia del plan
function ensureGradesStructure() {
    if (typeof studyPlan === 'undefined') return;
    Object.entries(studyPlan).forEach(([semNum, sem]) => {
        if (!gradesData[semNum]) gradesData[semNum] = {};
        sem.subjects.forEach(subject => {
            if (!gradesData[semNum][subject.id]) {
                gradesData[semNum][subject.id] = createDefaultGradeEntry(subject);
            }
        });
    });
}

function createDefaultGradeEntry(subject) {
    const isPassFail = PASS_FAIL_SUBJECTS.some(pf =>
        subject.name.toLowerCase().includes(pf.toLowerCase())
    ) || subject.type === 'TRABAJO DE GRADO';

    if (isPassFail) {
        return { type: 'pass_fail', passFail: null };
    }
    return {
        type: 'graded',
        components: [
            { id: generateId(), name: 'Nota 1', weight: 33, grade: null },
            { id: generateId(), name: 'Nota 2', weight: 33, grade: null },
            { id: generateId(), name: 'Nota 3', weight: 34, grade: null }
        ]
    };
}

// ============================================
// CÁLCULOS
// ============================================

function calcSubjectAverage(entry) {
    if (!entry || entry.type === 'pass_fail') return null;
    const comps = entry.components || [];
    const filled = comps.filter(c => c.grade !== null && c.grade !== '');
    if (filled.length === 0) return null;

    const totalWeight = filled.reduce((s, c) => s + parseFloat(c.weight || 0), 0);
    if (totalWeight === 0) return null;

    const weighted = filled.reduce((s, c) => s + parseFloat(c.grade) * parseFloat(c.weight || 0), 0);
    return weighted / totalWeight;
}

function calcSemesterAverage(semNum) {
    const sem = studyPlan[semNum];
    if (!sem) return null;
    const semGrades = gradesData[semNum] || {};

    let totalWeightedSum = 0;
    let totalCredits = 0;

    sem.subjects.forEach(subject => {
        const entry = semGrades[subject.id];
        if (!entry) return;

        if (entry.type === 'pass_fail') {
            // Las materias pass/fail no cuentan para promedio numérico
            return;
        }

        const avg = calcSubjectAverage(entry);
        if (avg !== null) {
            totalWeightedSum += avg * subject.credits;
            totalCredits += subject.credits;
        }
    });

    if (totalCredits === 0) return null;
    return totalWeightedSum / totalCredits;
}

function calcOverallAverage() {
    let totalWeightedSum = 0;
    let totalCredits = 0;

    Object.keys(studyPlan).forEach(semNum => {
        const sem = studyPlan[semNum];
        if (sem.status !== 'completed' && sem.status !== 'current') return;
        const semGrades = gradesData[semNum] || {};

        sem.subjects.forEach(subject => {
            const entry = semGrades[subject.id];
            if (!entry || entry.type === 'pass_fail') return;
            const avg = calcSubjectAverage(entry);
            if (avg !== null) {
                totalWeightedSum += avg * subject.credits;
                totalCredits += subject.credits;
            }
        });
    });

    if (totalCredits === 0) return null;
    return totalWeightedSum / totalCredits;
}

function calcNeededGrade(entry, targetFinal) {
    // Calcula cuánto necesitas en los componentes sin nota para llegar al objetivo
    if (!entry || entry.type === 'pass_fail') return null;
    const comps = entry.components || [];

    const filledWeight = comps
        .filter(c => c.grade !== null && c.grade !== '')
        .reduce((s, c) => s + parseFloat(c.weight), 0);
    const filledContrib = comps
        .filter(c => c.grade !== null && c.grade !== '')
        .reduce((s, c) => s + parseFloat(c.grade) * parseFloat(c.weight), 0);

    const pendingWeight = 100 - filledWeight;
    if (pendingWeight <= 0) return null;

    const needed = (targetFinal * 100 - filledContrib) / pendingWeight;
    return needed;
}

// ============================================
// RENDER PRINCIPAL — Vista de Notas
// ============================================

function renderGradesView() {
    ensureGradesStructure();
    const container = document.getElementById('gradesViewContainer');
    if (!container) return;

    const overallAvg = calcOverallAverage();
    const semNums = Object.keys(studyPlan)
        .filter(n => studyPlan[n].subjects && studyPlan[n].subjects.length > 0)
        .sort((a, b) => parseInt(a) - parseInt(b));

    // Header con promedio global
    container.innerHTML = `
        <div class="grades-overall-banner">
            <div class="grades-overall-left">
                <div class="grades-overall-label">Promedio Acumulado</div>
                <div class="grades-overall-value ${getGradeColorClass(overallAvg)}">
                    ${overallAvg !== null ? overallAvg.toFixed(2) : '—'}
                </div>
                <div class="grades-overall-sub">Ponderado por créditos (materias calificadas)</div>
            </div>
            <div class="grades-overall-right">
                <div style="font-size:0.8rem; color: var(--text-secondary); margin-bottom:6px;">
                    ESCALA: 0.0 – 5.0 &nbsp;|&nbsp; Mínimo aprobatorio: <strong>3.0</strong>
                </div>
                <div class="grades-scale-bar">
                    <div class="grades-scale-fill" style="width:${overallAvg !== null ? (overallAvg/5)*100 : 0}%;
                         background:${getGradeColor(overallAvg)}"></div>
                </div>
                ${overallAvg !== null ? `
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:4px;">
                    ${overallAvg >= 4.5 ? '🏆 Excelente' : overallAvg >= 4.0 ? '⭐ Muy bien' : overallAvg >= 3.5 ? '✅ Bien' : overallAvg >= 3.0 ? '⚠️ Aprobando' : '❌ En riesgo'}
                </div>` : ''}
            </div>
        </div>

        <div id="gradesSemestersContainer">
            ${semNums.map(n => renderGradesSemesterCard(n)).join('')}
        </div>
    `;
}

function renderGradesSemesterCard(semNum) {
    const sem = studyPlan[semNum];
    const semGrades = gradesData[semNum] || {};
    const semAvg = calcSemesterAverage(semNum);
    const statusLabel = { completed: 'Completado', current: 'Cursando', pending: 'Pendiente' }[sem.status] || 'Pendiente';
    const isExpanded = sem.status === 'current' || sem.status === 'completed';

    return `
        <div class="grades-semester-card ${sem.status}" id="grades-sem-${semNum}">
            <div class="grades-semester-header" onclick="toggleGradesSemester(${semNum})">
                <div class="grades-semester-title-group">
                    <span class="semester-status status-${sem.status}">${statusLabel}</span>
                    <span class="grades-semester-title">Semestre ${semNum}</span>
                    <span class="grades-semester-count">${sem.subjects.length} materias</span>
                </div>
                <div class="grades-semester-avg-group">
                    ${semAvg !== null ? `
                        <div class="grades-sem-avg-badge ${getGradeColorClass(semAvg)}">
                            Promedio: ${semAvg.toFixed(2)}
                        </div>` : `<div class="grades-sem-avg-badge empty">Sin notas</div>`
                    }
                    <span class="semester-toggle" id="grades-toggle-${semNum}">${isExpanded ? '▼' : '▶'}</span>
                </div>
            </div>
            <div class="grades-semester-content ${isExpanded ? 'expanded' : ''}" id="grades-content-${semNum}">
                ${sem.subjects.map(subject => renderGradesSubjectRow(semNum, subject)).join('')}
            </div>
        </div>`;
}

function renderGradesSubjectRow(semNum, subject) {
    const entry = (gradesData[semNum] || {})[subject.id];
    if (!entry) return '';

    if (entry.type === 'pass_fail') {
        return renderPassFailRow(semNum, subject, entry);
    }
    return renderGradedRow(semNum, subject, entry);
}

function renderPassFailRow(semNum, subject, entry) {
    return `
        <div class="grades-subject-row pass-fail-row" id="grades-row-${subject.id}">
            <div class="grades-subject-info">
                <div class="grades-subject-name">${subject.name}</div>
                <div class="grades-subject-meta">${subject.credits} cr · Solo aprobado/reprobado</div>
            </div>
            <div class="grades-subject-controls">
                <select class="grades-pf-select ${entry.passFail === 'approved' ? 'pf-approved' : entry.passFail === 'failed' ? 'pf-failed' : ''}"
                        onchange="updatePassFail('${semNum}', '${subject.id}', this.value)">
                    <option value="" ${!entry.passFail ? 'selected' : ''}>— Sin registrar —</option>
                    <option value="approved" ${entry.passFail === 'approved' ? 'selected' : ''}>✅ Aprobado</option>
                    <option value="failed" ${entry.passFail === 'failed' ? 'selected' : ''}>❌ Reprobado</option>
                </select>
            </div>
        </div>`;
}

function renderGradedRow(semNum, subject, entry) {
    const avg = calcSubjectAverage(entry);
    const comps = entry.components || [];
    const totalWeight = comps.reduce((s, c) => s + parseFloat(c.weight || 0), 0);
    const weightOk = Math.abs(totalWeight - 100) < 0.5;

    // Calcular qué necesito para aprobar con 3.0
    const neededFor3 = calcNeededGrade(entry, 3.0);
    const neededFor35 = calcNeededGrade(entry, 3.5);
    const neededFor4 = calcNeededGrade(entry, 4.0);

    return `
        <div class="grades-subject-row" id="grades-row-${subject.id}">
            <div class="grades-subject-header-row">
                <div class="grades-subject-info">
                    <div class="grades-subject-name">${subject.name}</div>
                    <div class="grades-subject-meta">${subject.credits} cr · ${subject.type}</div>
                </div>
                <div class="grades-subject-summary">
                    ${avg !== null ? `
                        <div class="grades-final-avg ${getGradeColorClass(avg)}">${avg.toFixed(2)}</div>
                        <div class="grades-final-label">Promedio actual</div>
                    ` : `<div class="grades-final-avg empty">—</div><div class="grades-final-label">Sin notas</div>`}
                </div>
            </div>

            <!-- Tabla de componentes -->
            <div class="grades-components-table">
                <div class="grades-comp-header">
                    <span>Componente</span>
                    <span>% Peso</span>
                    <span>Nota (0–5)</span>
                    <span>Aporte</span>
                    <span></span>
                </div>
                ${comps.map((comp, idx) => `
                    <div class="grades-comp-row">
                        <input class="grades-comp-name" type="text" value="${comp.name}"
                               onchange="updateComponent('${semNum}', '${subject.id}', '${comp.id}', 'name', this.value)"
                               placeholder="Nombre">
                        <div class="grades-weight-cell">
                            <input class="grades-comp-weight" type="number" min="0" max="100" step="1"
                                   value="${comp.weight}"
                                   onchange="updateComponent('${semNum}', '${subject.id}', '${comp.id}', 'weight', this.value)">
                            <span>%</span>
                        </div>
                        <input class="grades-comp-grade ${comp.grade !== null && comp.grade !== '' ? getGradeColorClass(parseFloat(comp.grade)) : ''}"
                               type="number" min="0" max="5" step="0.01"
                               value="${comp.grade !== null && comp.grade !== '' ? comp.grade : ''}"
                               placeholder="—"
                               onchange="updateComponent('${semNum}', '${subject.id}', '${comp.id}', 'grade', this.value)"
                               oninput="liveUpdateComponent('${semNum}', '${subject.id}', '${comp.id}', 'grade', this.value)">
                        <span class="grades-comp-contrib">
                            ${comp.grade !== null && comp.grade !== '' ? ((parseFloat(comp.grade) * parseFloat(comp.weight)) / 100).toFixed(3) : '—'}
                        </span>
                        <button class="grades-remove-comp" onclick="removeComponent('${semNum}', '${subject.id}', '${comp.id}')"
                                title="Eliminar componente">×</button>
                    </div>`).join('')}

                <!-- Fila de totales -->
                <div class="grades-comp-totals">
                    <span>Total</span>
                    <span class="${weightOk ? 'weight-ok' : 'weight-warn'}">${totalWeight.toFixed(0)}%${!weightOk ? ' ⚠️' : ' ✓'}</span>
                    <span></span>
                    <span class="${avg !== null ? getGradeColorClass(avg) : ''}">${avg !== null ? avg.toFixed(3) : '—'}</span>
                    <span></span>
                </div>
            </div>

            <!-- Acciones -->
            <div class="grades-subject-actions">
                <button class="btn btn-sm btn-secondary" onclick="addComponent('${semNum}', '${subject.id}')">
                    ＋ Agregar componente
                </button>
                ${neededFor3 !== null ? `
                <div class="grades-needed-group">
                    <span class="grades-needed-label">Para llegar a:</span>
                    ${neededFor3 <= 5 && neededFor3 >= 0 ? `<span class="grades-needed-chip ${neededFor3 > 5 ? 'impossible' : ''}">3.0 → necesitas <strong>${neededFor3.toFixed(2)}</strong></span>` : '<span class="grades-needed-chip impossible">3.0 → imposible</span>'}
                    ${neededFor35 !== null && neededFor35 <= 5 && neededFor35 >= 0 ? `<span class="grades-needed-chip">3.5 → <strong>${neededFor35.toFixed(2)}</strong></span>` : ''}
                    ${neededFor4 !== null && neededFor4 <= 5 && neededFor4 >= 0 ? `<span class="grades-needed-chip">4.0 → <strong>${neededFor4.toFixed(2)}</strong></span>` : ''}
                </div>` : ''}
            </div>
        </div>`;
}

// ============================================
// ACTUALIZACIÓN EN TIEMPO REAL
// ============================================

function updateComponent(semNum, subjectId, compId, field, value) {
    if (!gradesData[semNum]) gradesData[semNum] = {};
    const entry = gradesData[semNum][subjectId];
    if (!entry || !entry.components) return;

    const comp = entry.components.find(c => c.id === compId);
    if (!comp) return;

    if (field === 'grade') {
        comp.grade = value === '' ? null : Math.min(5, Math.max(0, parseFloat(value)));
    } else if (field === 'weight') {
        comp.weight = Math.min(100, Math.max(0, parseFloat(value) || 0));
    } else {
        comp[field] = value;
    }

    saveGradesToStorage();
    refreshGradesSubjectRow(semNum, subjectId);
    refreshSemesterAvgBadge(semNum);
    refreshOverallBanner();
}

function liveUpdateComponent(semNum, subjectId, compId, field, value) {
    // Actualización visual instantánea sin guardar (guarda el onchange)
    updateComponent(semNum, subjectId, compId, field, value);
}

function addComponent(semNum, subjectId) {
    if (!gradesData[semNum]) gradesData[semNum] = {};
    const entry = gradesData[semNum][subjectId];
    if (!entry || !entry.components) return;

    const usedWeight = entry.components.reduce((s, c) => s + parseFloat(c.weight || 0), 0);
    const remaining = Math.max(0, 100 - usedWeight);

    entry.components.push({
        id: generateId(),
        name: `Nota ${entry.components.length + 1}`,
        weight: remaining,
        grade: null
    });

    saveGradesToStorage();
    refreshGradesSubjectRow(semNum, subjectId);
}

function removeComponent(semNum, subjectId, compId) {
    if (!gradesData[semNum]) return;
    const entry = gradesData[semNum][subjectId];
    if (!entry || !entry.components) return;
    if (entry.components.length <= 1) { alert('Debe haber al menos 1 componente.'); return; }

    entry.components = entry.components.filter(c => c.id !== compId);
    saveGradesToStorage();
    refreshGradesSubjectRow(semNum, subjectId);
    refreshSemesterAvgBadge(semNum);
    refreshOverallBanner();
}

function updatePassFail(semNum, subjectId, value) {
    if (!gradesData[semNum]) gradesData[semNum] = {};
    const entry = gradesData[semNum][subjectId];
    if (!entry) return;
    entry.passFail = value || null;
    saveGradesToStorage();
    // Actualizar clase visual del select
    const sel = document.querySelector(`#grades-row-${subjectId} .grades-pf-select`);
    if (sel) {
        sel.className = `grades-pf-select ${value === 'approved' ? 'pf-approved' : value === 'failed' ? 'pf-failed' : ''}`;
    }
}

// ============================================
// REFRESH PARCIAL (sin re-render completo)
// ============================================

function refreshGradesSubjectRow(semNum, subjectId) {
    const rowEl = document.getElementById(`grades-row-${subjectId}`);
    if (!rowEl) return;
    const subject = findSubjectById(semNum, subjectId);
    if (!subject) return;
    const newHtml = renderGradesSubjectRow(semNum, subject);
    const temp = document.createElement('div');
    temp.innerHTML = newHtml;
    rowEl.replaceWith(temp.firstChild);
}

function refreshSemesterAvgBadge(semNum) {
    const semAvg = calcSemesterAverage(semNum);
    const badge = document.querySelector(`#grades-sem-${semNum} .grades-sem-avg-badge`);
    if (!badge) return;
    if (semAvg !== null) {
        badge.className = `grades-sem-avg-badge ${getGradeColorClass(semAvg)}`;
        badge.textContent = `Promedio: ${semAvg.toFixed(2)}`;
    } else {
        badge.className = 'grades-sem-avg-badge empty';
        badge.textContent = 'Sin notas';
    }
}

function refreshOverallBanner() {
    const overallAvg = calcOverallAverage();
    const valEl = document.querySelector('.grades-overall-value');
    const fillEl = document.querySelector('.grades-scale-fill');
    if (valEl) {
        valEl.className = `grades-overall-value ${getGradeColorClass(overallAvg)}`;
        valEl.textContent = overallAvg !== null ? overallAvg.toFixed(2) : '—';
    }
    if (fillEl) {
        fillEl.style.width = overallAvg !== null ? `${(overallAvg / 5) * 100}%` : '0%';
        fillEl.style.background = getGradeColor(overallAvg);
    }
}

function findSubjectById(semNum, subjectId) {
    return (studyPlan[semNum]?.subjects || []).find(s => s.id === subjectId);
}

// ============================================
// ACORDEÓN DE SEMESTRES
// ============================================

function toggleGradesSemester(semNum) {
    const content = document.getElementById(`grades-content-${semNum}`);
    const toggle = document.getElementById(`grades-toggle-${semNum}`);
    if (!content) return;
    const expanded = content.classList.contains('expanded');
    content.classList.toggle('expanded', !expanded);
    if (toggle) toggle.textContent = expanded ? '▶' : '▼';
}

// ============================================
// HELPERS DE COLOR
// ============================================

function getGradeColorClass(grade) {
    if (grade === null || grade === undefined) return '';
    if (grade >= 4.5) return 'grade-excellent';
    if (grade >= 4.0) return 'grade-good';
    if (grade >= 3.5) return 'grade-ok';
    if (grade >= 3.0) return 'grade-pass';
    return 'grade-fail';
}

function getGradeColor(grade) {
    if (grade === null || grade === undefined) return '#adb5bd';
    if (grade >= 4.5) return '#2e7d32';
    if (grade >= 4.0) return '#388e3c';
    if (grade >= 3.5) return '#f9a825';
    if (grade >= 3.0) return '#ffa000';
    return '#d32f2f';
}

// ============================================
// EXPORTAR NOTAS A CONTEXTO DEL CHAT IA
// ============================================

// Esta función es llamada desde chat.js en buildAcademicContext()
function buildGradesContext() {
    if (!gradesData || Object.keys(gradesData).length === 0) return null;
    ensureGradesStructure();

    const semestersSummary = [];

    Object.keys(studyPlan)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(semNum => {
            const sem = studyPlan[semNum];
            if (!sem || !sem.subjects) return;

            const semGrades = gradesData[semNum] || {};
            const semAvg = calcSemesterAverage(semNum);
            const subjectsSummary = [];

            sem.subjects.forEach(subject => {
                const entry = semGrades[subject.id];
                if (!entry) return;

                if (entry.type === 'pass_fail') {
                    subjectsSummary.push({
                        name: subject.name,
                        credits: subject.credits,
                        type: 'pass_fail',
                        status: entry.passFail || 'no registrado'
                    });
                } else {
                    const avg = calcSubjectAverage(entry);
                    const components = (entry.components || []).map(c => ({
                        name: c.name,
                        weight: c.weight,
                        grade: c.grade
                    }));
                    subjectsSummary.push({
                        name: subject.name,
                        credits: subject.credits,
                        type: 'graded',
                        average: avg !== null ? parseFloat(avg.toFixed(3)) : null,
                        components,
                        approved: avg !== null ? avg >= 3.0 : null
                    });
                }
            });

            semestersSummary.push({
                semester: semNum,
                status: sem.status,
                semesterAverage: semAvg !== null ? parseFloat(semAvg.toFixed(3)) : null,
                subjects: subjectsSummary
            });
        });

    return {
        overallAverage: (() => { const o = calcOverallAverage(); return o !== null ? parseFloat(o.toFixed(3)) : null; })(),
        semestersSummary
    };
}

// ============================================
// AUTO-INIT
// ============================================

(function waitForGradesInit() {
    const interval = setInterval(() => {
        if (typeof studyPlan !== 'undefined' && typeof currentUser !== 'undefined') {
            initGrades();
            clearInterval(interval);
        }
    }, 500);
})();
