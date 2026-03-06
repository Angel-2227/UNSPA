// ============================================
// SISTEMA DE NOTAS — grades.js  (v2 — rediseño)
// ============================================
//
// Materias que solo llevan Aprobado / Reprobado
// (se compara por subcadena, sin importar mayúsculas):
const PASS_FAIL_SUBJECTS = [
    'ingles',
    'catedra',
    'nacional de inducci',
    'trabajo de grado',
];

// ── Estado global ─────────────────────────────
let gradesData = {};

// ── Inicialización ────────────────────────────

function initGrades() {
    loadGradesFromStorage();
    ensureGradesStructure();
}

function loadGradesFromStorage() {
    try {
        const s = localStorage.getItem('academicGradesData');
        if (s) gradesData = JSON.parse(s);
    } catch { gradesData = {}; }
}

function saveGradesToStorage() {
    localStorage.setItem('academicGradesData', JSON.stringify(gradesData));
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid)
            .set({ gradesData }, { merge: true })
            .catch(console.error);
    }
}

function loadGradesFromFirestore(data) {
    if (data && data.gradesData) {
        gradesData = data.gradesData;
        localStorage.setItem('academicGradesData', JSON.stringify(gradesData));
    }
    // Re-sincronizar estructura con el studyPlan recién llegado de Firestore
    ensureGradesStructure();
    // Re-renderizar con pequeño delay para garantizar que studyPlan ya esté asignado
    setTimeout(() => {
        ensureGradesStructure();
        if (typeof currentView !== 'undefined' && currentView === 'grades') {
            renderGradesView();
        }
    }, 300);
}

function ensureGradesStructure() {
    if (typeof studyPlan === 'undefined') return;
    Object.entries(studyPlan).forEach(([sem, s]) => {
        if (!gradesData[sem]) gradesData[sem] = {};
        s.subjects.forEach(sub => {
            const expected = defaultEntry(sub);
            const existing = gradesData[sem][sub.id];

            // Si no existe, créala
            if (!existing) {
                gradesData[sem][sub.id] = expected;
                return;
            }

            // Si el tipo esperado no coincide con el guardado, corregirlo
            if (existing.type !== expected.type) {
                gradesData[sem][sub.id] = expected;
            }
        });
    });
}

function normalize(s) {
    return s.toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u');
}

function defaultEntry(subject) {
    const nameLower = normalize(subject.name);
    const isPF = PASS_FAIL_SUBJECTS.some(k => nameLower.includes(normalize(k))
    ) || subject.type === 'TRABAJO DE GRADO';
    if (isPF) return { type: 'pass_fail', passFail: null };
    return {
        type: 'graded',
        components: [
            { id: gid(), name: 'Corte 1', weight: 33, grade: null },
            { id: gid(), name: 'Corte 2', weight: 33, grade: null },
            { id: gid(), name: 'Corte 3', weight: 34, grade: null },
        ]
    };
}

function gid() { return '_' + Math.random().toString(36).slice(2, 9); }

// ── Cálculos ──────────────────────────────────

function calcSubjectAvg(entry) {
    if (!entry || entry.type === 'pass_fail') return null;
    const filled = (entry.components || []).filter(c => c.grade !== null && c.grade !== '');
    if (!filled.length) return null;
    const wSum = filled.reduce((s, c) => s + +c.weight, 0);
    if (!wSum) return null;
    return filled.reduce((s, c) => s + +c.grade * +c.weight, 0) / wSum;
}

function calcSemAvg(semNum) {
    const sem = studyPlan[semNum];
    if (!sem) return null;
    let wSum = 0, cSum = 0;
    sem.subjects.forEach(sub => {
        const e = (gradesData[semNum] || {})[sub.id];
        const avg = calcSubjectAvg(e);
        if (avg !== null) { wSum += avg * sub.credits; cSum += sub.credits; }
    });
    return cSum ? wSum / cSum : null;
}

function calcOverallAvg() {
    // Solo semestres COMPLETADOS cuentan para el promedio acumulado oficial.
    // Si un semestre completado no tiene notas ingresadas, se omite de la ponderación
    // pero el banner mostrará advertencia de datos incompletos.
    let wSum = 0, cSum = 0;
    Object.keys(studyPlan).forEach(sem => {
        if (studyPlan[sem].status !== 'completed') return;
        studyPlan[sem].subjects.forEach(sub => {
            const e = (gradesData[sem] || {})[sub.id];
            const avg = calcSubjectAvg(e);
            if (avg !== null) { wSum += avg * sub.credits; cSum += sub.credits; }
        });
    });
    return cSum ? wSum / cSum : null;
}

// Cuántos semestres completados tienen al menos una nota incompleta
function completedSemsWithMissingData() {
    return Object.keys(studyPlan).filter(sem => {
        if (studyPlan[sem].status !== 'completed') return false;
        return studyPlan[sem].subjects.some(sub => {
            const e = (gradesData[sem] || {})[sub.id];
            if (!e || e.type === 'pass_fail') return false;
            return calcSubjectAvg(e) === null;
        });
    }).length;
}

function neededFor(entry, target) {
    if (!entry || entry.type === 'pass_fail') return null;
    const comps = entry.components || [];
    const donePct = comps.filter(c => c.grade !== null && c.grade !== '').reduce((s, c) => s + +c.weight, 0);
    const doneVal = comps.filter(c => c.grade !== null && c.grade !== '').reduce((s, c) => s + +c.grade * +c.weight, 0);
    const pending = comps.filter(c => c.grade === null || c.grade === '').reduce((s, c) => s + +c.weight, 0);
    if (pending <= 0) return null;
    const totalW = donePct + pending;
    return (target * totalW - doneVal) / pending;
}

// ── Colores ───────────────────────────────────

function gradeClass(g) {
    if (g === null || g === undefined) return '';
    if (g >= 4.5) return 'gn-excel';
    if (g >= 4.0) return 'gn-good';
    if (g >= 3.5) return 'gn-ok';
    if (g >= 3.0) return 'gn-pass';
    return 'gn-fail';
}
function gradeColor(g) {
    if (g === null) return '#adb5bd';
    if (g >= 4.5) return '#2e7d32';
    if (g >= 4.0) return '#388e3c';
    if (g >= 3.5) return '#f9a825';
    if (g >= 3.0) return '#ffa000';
    return '#d32f2f';
}
function gradeEmoji(g) {
    if (g === null) return '';
    if (g >= 4.5) return '🏆';
    if (g >= 4.0) return '⭐';
    if (g >= 3.5) return '✅';
    if (g >= 3.0) return '⚠️';
    return '❌';
}

// ── Render principal ──────────────────────────

function renderGradesView() {
    ensureGradesStructure();
    const container = document.getElementById('gradesViewContainer');
    if (!container) return;

    const semNums = Object.keys(studyPlan)
        .filter(n => studyPlan[n].subjects && studyPlan[n].subjects.length)
        .sort((a, b) => +a - +b);

    // Si no hay materias todavía, mostrar estado vacío
    if (!semNums.length) {
        const hasLocalData = localStorage.getItem('academicPlannerData');
        const isLoading = hasLocalData && Object.keys(studyPlan).length === 0;
        container.innerHTML = `
            <div style="text-align:center;padding:3rem 1rem;color:var(--text-secondary);">
                <div style="font-size:2.5rem;margin-bottom:1rem;">${isLoading ? '⏳' : '📋'}</div>
                <p style="font-size:1rem;font-weight:500;">${isLoading ? 'Cargando materias...' : 'No hay materias cargadas todavía.'}</p>
                <p style="font-size:0.85rem;margin-top:0.5rem;">
                    ${isLoading
                        ? 'Tus datos se están sincronizando. Si esto no cambia, recarga la página.'
                        : 'Importa tu plan de estudios desde la sección <strong>Materias</strong> para comenzar a registrar notas.'
                    }
                </p>
            </div>`;
        // Si parece que está cargando, reintentar en 1.5s
        if (isLoading) {
            setTimeout(() => {
                if (typeof currentView !== 'undefined' && currentView === 'grades') {
                    ensureGradesStructure();
                    renderGradesView();
                }
            }, 1500);
        }
        return;
    }

    const overall = calcOverallAvg();

    container.innerHTML = `
        <div class="gn-banner" id="gn-banner">
            <div class="gn-banner-left">
                <div class="gn-banner-label">Promedio acumulado</div>
                <div class="gn-banner-value ${gradeClass(overall)}" id="gn-overall-val">
                    ${overall !== null ? overall.toFixed(2) : '—'}
                </div>
                <div class="gn-banner-sub">ponderado por créditos ${gradeEmoji(overall)}</div>
                ${completedSemsWithMissingData() > 0 ? `<div class="gn-banner-warn">⚠️ ${completedSemsWithMissingData()} semestre(s) completado(s) sin notas completas</div>` : ''}
            </div>
            <div class="gn-banner-bar-wrap">
                <div class="gn-banner-bar-labels">
                    <span>0</span><span>1</span><span>2</span>
                    <span class="gn-min-mark">3 mín</span><span>4</span><span>5</span>
                </div>
                <div class="gn-banner-track">
                    <div class="gn-min-line"></div>
                    <div class="gn-banner-fill" id="gn-overall-fill"
                         style="width:${overall !== null ? (overall / 5) * 100 : 0}%;background:${gradeColor(overall)}">
                    </div>
                </div>
            </div>
        </div>
        <div id="gn-semesters">
            ${semNums.map(n => gnBuildSemesterBlock(n)).join('')}
        </div>`;

    attachAllListeners();
}

// ── Semestre ──────────────────────────────────

function gnBuildSemesterBlock(semNum) {
    const sem = studyPlan[semNum];
    const avg = calcSemAvg(semNum);
    const label = { completed: 'Completado', current: 'Cursando', pending: 'Pendiente' }[sem.status] || 'Pendiente';
    const open = sem.status === 'current';

    return `
    <div class="gn-sem-block ${sem.status}" id="gn-sem-${semNum}">
        <div class="gn-sem-header${sem.status === 'current' ? ' gn-sem-header--current' : ''}" data-sem="${semNum}">
            <div class="gn-sem-left">
                <span class="semester-status status-${sem.status}">${label}</span>
                <span class="gn-sem-title">Semestre ${semNum}</span>
                <span class="gn-sem-count">${sem.subjects.length} materias</span>
            </div>
            <div class="gn-sem-right">
                <span class="gn-sem-avg ${gradeClass(avg)}" id="gn-sem-avg-${semNum}">
                    ${avg !== null ? 'Promedio ' + avg.toFixed(2) : 'Sin notas'}
                </span>
                <span class="gn-chevron" id="gn-chev-${semNum}">${open ? '▼' : '▶'}</span>
            </div>
        </div>
        <div class="gn-sem-body ${open ? 'open' : ''}" id="gn-body-${semNum}">
            <div class="gn-cards-grid">
                ${sem.subjects.map(sub => gnBuildSubjectCard(semNum, sub)).join('')}
            </div>
        </div>
    </div>`;
}

// ── Tarjeta de materia ────────────────────────

function gnBuildSubjectCard(semNum, sub) {
    const entry = (gradesData[semNum] || {})[sub.id];
    if (!entry) return '';
    if (entry.type === 'pass_fail') return gnBuildPassFailCard(semNum, sub, entry);
    return gnBuildGradedCard(semNum, sub, entry);
}

function gnBuildPassFailCard(semNum, sub, entry) {
    const pf = entry.passFail;
    return `
    <div class="gn-card pf-card" id="gn-card-${sub.id}">
        <div class="gn-card-top">
            <div>
                <div class="gn-sub-name">${sub.name}</div>
                <div class="gn-sub-meta">${sub.credits} cr · Solo aprobado/reprobado</div>
            </div>
            <select class="gn-pf-select ${pf === 'approved' ? 'pf-yes' : pf === 'failed' ? 'pf-no' : ''}"
                    data-sem="${semNum}" data-subid="${sub.id}">
                <option value=""         ${!pf ? 'selected' : ''}>— Sin registrar —</option>
                <option value="approved" ${pf === 'approved' ? 'selected' : ''}>✅ Aprobado</option>
                <option value="failed"   ${pf === 'failed' ? 'selected' : ''}>❌ Reprobado</option>
            </select>
        </div>
    </div>`;
}

function gnBuildGradedCard(semNum, sub, entry) {
    const comps = entry.components || [];
    const avg = calcSubjectAvg(entry);
    const totalW = comps.reduce((s, c) => s + +c.weight, 0);
    const warnW = Math.abs(totalW - 100) > 0.5;
    const n3 = neededFor(entry, 3.0);
    const n35 = neededFor(entry, 3.5);
    const n4 = neededFor(entry, 4.0);

    const chipHtml = (val, label) => {
        if (val === null) return '';
        if (val > 5) return `<span class="gn-chip gn-chip-impossible">${label} → imposible 😞</span>`;
        if (val < 0) return `<span class="gn-chip gn-chip-done">${label} → ya está ✓</span>`;
        return `<span class="gn-chip">${label} → <strong>${val.toFixed(2)}</strong></span>`;
    };

    return `
    <div class="gn-card" id="gn-card-${sub.id}" data-sem="${semNum}" data-subid="${sub.id}">
        <div class="gn-card-top gn-card-toggle" data-subid="${sub.id}">
            <div class="gn-card-top-left">
                <div class="gn-sub-name">${sub.name}</div>
                <div class="gn-sub-meta">${sub.credits} cr · ${sub.type}</div>
            </div>
            <div class="gn-card-top-right">
                <div class="gn-avg-big ${gradeClass(avg)}" id="gn-avg-${sub.id}">
                    ${avg !== null ? avg.toFixed(2) : '—'}
                </div>
                <div class="gn-avg-label">${avg !== null ? gradeEmoji(avg) + ' promedio' : 'sin notas'}</div>
                <span class="gn-expand-icon" id="gn-exp-${sub.id}">▼</span>
            </div>
        </div>
        <div class="gn-card-body" id="gn-cbody-${sub.id}">
            <div class="gn-comps-header">
                <span>Corte</span><span>Peso</span><span>Nota</span><span>Aporte</span><span></span>
            </div>
            <div class="gn-comps" id="gn-comps-${sub.id}">
                ${comps.map(c => gnBuildCompRow(semNum, sub.id, c)).join('')}
            </div>
            <div class="gn-totals-row" id="gn-totals-${sub.id}">
                <span class="gn-totals-label">Total</span>
                <span class="gn-totals-weight ${warnW ? 'gn-warn' : 'gn-ok'}" id="gn-tw-${sub.id}">
                    ${totalW.toFixed(0)}%${warnW ? ' ⚠️' : ' ✓'}
                </span>
                <span></span>
                <span class="gn-totals-avg ${gradeClass(avg)}" id="gn-ta-${sub.id}">
                    ${avg !== null ? avg.toFixed(3) : '—'}
                </span>
                <span></span>
            </div>
            <div class="gn-card-actions">
                <button class="btn btn-sm btn-secondary gn-add-comp"
                        data-sem="${semNum}" data-subid="${sub.id}">＋ Agregar corte</button>
                <div class="gn-chips" id="gn-chips-${sub.id}">
                    ${(n3 !== null || avg !== null) ? `
                        <span class="gn-chips-label">Para llegar a:</span>
                        ${chipHtml(n3, '3.0')}
                        ${chipHtml(n35, '3.5')}
                        ${chipHtml(n4, '4.0')}` : ''}
                </div>
            </div>
        </div>
    </div>`;
}

function gnBuildCompRow(semNum, subId, comp) {
    const contrib = (comp.grade !== null && comp.grade !== '')
        ? ((+comp.grade * +comp.weight) / 100).toFixed(3) : '—';
    return `
    <div class="gn-comp-row" id="gn-comp-${comp.id}"
         data-sem="${semNum}" data-subid="${subId}" data-compid="${comp.id}">
        <input class="gn-in gn-in-name" type="text"
               value="${comp.name}" placeholder="Nombre" data-field="name">
        <div class="gn-weight-wrap">
            <input class="gn-in gn-in-weight" type="number"
                   min="0" max="100" step="1" value="${comp.weight}" data-field="weight">
            <span class="gn-pct">%</span>
        </div>
        <input class="gn-in gn-in-grade ${comp.grade !== null && comp.grade !== '' ? gradeClass(+comp.grade) : ''}"
               type="number" min="0" max="5" step="0.01"
               value="${comp.grade !== null && comp.grade !== '' ? comp.grade : ''}"
               placeholder="—" data-field="grade">
        <span class="gn-contrib" id="gn-ctb-${comp.id}">${contrib}</span>
        <button class="gn-del-comp" data-compid="${comp.id}"
                data-sem="${semNum}" data-subid="${subId}" title="Eliminar corte">×</button>
    </div>`;
}

// ── Event listeners ───────────────────────────

function attachAllListeners() {
    const root = document.getElementById('gradesViewContainer');
    if (!root) return;

    root.querySelectorAll('.gn-sem-header').forEach(h =>
        h.addEventListener('click', () => toggleSemBlock(h.dataset.sem))
    );

    root.querySelectorAll('.gn-card-toggle').forEach(t =>
        t.addEventListener('click', () => toggleCard(t.dataset.subid))
    );

    root.querySelectorAll('.gn-pf-select').forEach(sel =>
        sel.addEventListener('change', () => {
            const { sem, subid } = sel.dataset;
            gradesData[sem][subid].passFail = sel.value || null;
            sel.className = `gn-pf-select ${sel.value === 'approved' ? 'pf-yes' : sel.value === 'failed' ? 'pf-no' : ''}`;
            saveGradesToStorage();
        })
    );

    // Delegación en cada contenedor de componentes
    root.querySelectorAll('.gn-comps').forEach(compsEl => {
        compsEl.addEventListener('input', e => {
            const row = e.target.closest('.gn-comp-row');
            if (!row) return;
            handleCompInput(row.dataset.sem, row.dataset.subid, row.dataset.compid,
                e.target.dataset.field, e.target.value, e.target);
        });
        compsEl.addEventListener('change', e => {
            const row = e.target.closest('.gn-comp-row');
            if (!row) return;
            handleCompChange(row.dataset.sem, row.dataset.subid);
        });
    });

    root.querySelectorAll('.gn-del-comp').forEach(btn =>
        btn.addEventListener('click', () =>
            deleteComp(btn.dataset.sem, btn.dataset.subid, btn.dataset.compid))
    );

    root.querySelectorAll('.gn-add-comp').forEach(btn =>
        btn.addEventListener('click', () => addComp(btn.dataset.sem, btn.dataset.subid))
    );
}

// ── Lógica de edición ─────────────────────────

function handleCompInput(sem, subId, compId, field, rawVal, inputEl) {
    const entry = gradesData[sem] && gradesData[sem][subId];
    const comp = entry && entry.components && entry.components.find(c => c.id === compId);
    if (!comp) return;

    if (field === 'grade') {
        const val = rawVal === '' ? null : Math.min(5, Math.max(0, +rawVal));
        comp.grade = val;
        inputEl.className = `gn-in gn-in-grade ${val !== null ? gradeClass(val) : ''}`;
        const ctb = document.getElementById(`gn-ctb-${compId}`);
        if (ctb) ctb.textContent = val !== null ? ((val * +comp.weight) / 100).toFixed(3) : '—';
    } else if (field === 'weight') {
        comp.weight = Math.min(100, Math.max(0, +rawVal || 0));
    } else if (field === 'name') {
        comp.name = rawVal;
    }

    refreshCardSummary(sem, subId);
}

function handleCompChange(sem, subId) {
    saveGradesToStorage();
    refreshSemAvgBadge(sem);
    refreshOverallBanner();
}

function addComp(sem, subId) {
    const entry = gradesData[sem] && gradesData[sem][subId];
    if (!entry || !entry.components) return;

    const used = entry.components.reduce((s, c) => s + +c.weight, 0);
    const rem = Math.max(0, Math.round(100 - used));
    const num = entry.components.length + 1;
    const newC = { id: gid(), name: `Corte ${num}`, weight: rem, grade: null };
    entry.components.push(newC);

    const compsEl = document.getElementById(`gn-comps-${subId}`);
    if (compsEl) {
        compsEl.insertAdjacentHTML('beforeend', gnBuildCompRow(sem, subId, newC));
        const newRow = document.getElementById(`gn-comp-${newC.id}`);
        if (newRow) {
            newRow.querySelector('.gn-del-comp').addEventListener('click', () =>
                deleteComp(sem, subId, newC.id));
        }
        // listeners de input/change ya en el padre por delegación ✓
    }

    saveGradesToStorage();
    refreshCardSummary(sem, subId);
}

function deleteComp(sem, subId, compId) {
    const entry = gradesData[sem] && gradesData[sem][subId];
    if (!entry || !entry.components) return;
    if (entry.components.length <= 1) { alert('Debe haber al menos 1 corte.'); return; }
    entry.components = entry.components.filter(c => c.id !== compId);
    const rowEl = document.getElementById(`gn-comp-${compId}`);
    if (rowEl) rowEl.remove();
    saveGradesToStorage();
    refreshCardSummary(sem, subId);
    refreshSemAvgBadge(sem);
    refreshOverallBanner();
}

// ── Refrescos parciales ───────────────────────

function refreshCardSummary(sem, subId) {
    const entry = gradesData[sem] && gradesData[sem][subId];
    if (!entry) return;
    const comps = entry.components || [];
    const avg = calcSubjectAvg(entry);
    const totalW = comps.reduce((s, c) => s + +c.weight, 0);
    const warnW = Math.abs(totalW - 100) > 0.5;

    const avgEl = document.getElementById(`gn-avg-${subId}`);
    if (avgEl) { avgEl.className = `gn-avg-big ${gradeClass(avg)}`; avgEl.textContent = avg !== null ? avg.toFixed(2) : '—'; }

    const twEl = document.getElementById(`gn-tw-${subId}`);
    if (twEl) { twEl.className = `gn-totals-weight ${warnW ? 'gn-warn' : 'gn-ok'}`; twEl.textContent = `${totalW.toFixed(0)}%${warnW ? ' ⚠️' : ' ✓'}`; }

    const taEl = document.getElementById(`gn-ta-${subId}`);
    if (taEl) { taEl.className = `gn-totals-avg ${gradeClass(avg)}`; taEl.textContent = avg !== null ? avg.toFixed(3) : '—'; }

    const chipsEl = document.getElementById(`gn-chips-${subId}`);
    if (chipsEl) {
        const n3 = neededFor(entry, 3.0), n35 = neededFor(entry, 3.5), n4 = neededFor(entry, 4.0);
        const chipHtml = (val, label) => {
            if (val === null) return '';
            if (val > 5) return `<span class="gn-chip gn-chip-impossible">${label} → imposible 😞</span>`;
            if (val < 0) return `<span class="gn-chip gn-chip-done">${label} → ya está ✓</span>`;
            return `<span class="gn-chip">${label} → <strong>${val.toFixed(2)}</strong></span>`;
        };
        chipsEl.innerHTML = (n3 !== null || avg !== null) ? `
            <span class="gn-chips-label">Para llegar a:</span>
            ${chipHtml(n3, '3.0')}${chipHtml(n35, '3.5')}${chipHtml(n4, '4.0')}` : '';
    }
}

function refreshSemAvgBadge(semNum) {
    const avg = calcSemAvg(semNum);
    const el = document.getElementById(`gn-sem-avg-${semNum}`);
    if (el) { el.className = `gn-sem-avg ${gradeClass(avg)}`; el.textContent = avg !== null ? `Promedio ${avg.toFixed(2)}` : 'Sin notas'; }
}

function refreshOverallBanner() {
    const avg = calcOverallAvg();
    const v = document.getElementById('gn-overall-val');
    const f = document.getElementById('gn-overall-fill');
    if (v) { v.className = `gn-banner-value ${gradeClass(avg)}`; v.textContent = avg !== null ? avg.toFixed(2) : '—'; }
    if (f) { f.style.width = avg !== null ? `${(avg / 5) * 100}%` : '0%'; f.style.background = gradeColor(avg); }
}
function refreshOverallAvg() {
    const avg = calcOverallAvg();
    const v = document.getElementById('gn-overall-val');
    const f = document.getElementById('gn-overall-fill');
    if (v) { v.className = `gn-banner-value ${gradeClass(avg)}`; v.textContent = avg !== null ? avg.toFixed(2) : '—'; }
    if (f) { f.style.width = avg !== null ? `${(avg / 5) * 100}%` : '0%'; f.style.background = gradeColor(avg); }

    // Sincronizar con sidebar y stat card del overview
    const sa = document.getElementById('sidebarAverage');
    const oc = document.getElementById('overallAverageCard');
    if (sa) sa.textContent = avg !== null ? avg.toFixed(2) : 'N/A';
    if (oc) {
        if (avg !== null) {
            oc.textContent = avg.toFixed(2);
            oc.style.color = gradeColor(avg);
            oc.style.fontSize = '';
        } else {
            oc.textContent = 'N/A';
            oc.style.color = 'var(--text-secondary)';
            oc.style.fontSize = '1rem';
        }
    }
}
// ── Acordeón ──────────────────────────────────

function toggleSemBlock(semNum) {
    const body = document.getElementById(`gn-body-${semNum}`);
    const chev = document.getElementById(`gn-chev-${semNum}`);
    if (!body) return;
    const open = body.classList.toggle('open');
    if (chev) chev.textContent = open ? '▼' : '▶';
}

function toggleCard(subId) {
    const body = document.getElementById(`gn-cbody-${subId}`);
    const icon = document.getElementById(`gn-exp-${subId}`);
    if (!body) return;
    const open = body.classList.toggle('open');
    if (icon) icon.textContent = open ? '▼' : '▶';
}

// ── Contexto IA ───────────────────────────────

function buildGradesContext() {
    if (!gradesData || !Object.keys(gradesData).length) return null;
    ensureGradesStructure();
    const overall = calcOverallAvg();
    const semList = Object.keys(studyPlan).sort((a, b) => +a - +b).map(sem => {
        const semAvg = calcSemAvg(sem);
        const subjects = studyPlan[sem].subjects.map(sub => {
            const e = (gradesData[sem] || {})[sub.id];
            if (!e) return null;
            if (e.type === 'pass_fail')
                return { name: sub.name, credits: sub.credits, type: 'pass_fail', status: e.passFail || 'sin registrar' };
            const avg = calcSubjectAvg(e);
            return {
                name: sub.name, credits: sub.credits, type: 'graded',
                average: avg !== null ? +avg.toFixed(3) : null,
                approved: avg !== null ? avg >= 3.0 : null,
                components: e.components.map(c => ({ name: c.name, weight: c.weight, grade: c.grade }))
            };
        }).filter(Boolean);
        return {
            semester: sem, status: studyPlan[sem].status,
            semesterAverage: semAvg !== null ? +semAvg.toFixed(3) : null, subjects
        };
    });
    return { overallAverage: overall !== null ? +overall.toFixed(3) : null, semestersSummary: semList };
}

// ── Auto-init ─────────────────────────────────

(function waitForInit() {
    const t = setInterval(() => {
        if (typeof studyPlan !== 'undefined' && typeof currentUser !== 'undefined') {
            initGrades(); clearInterval(t);
        }
    }, 200);
})();