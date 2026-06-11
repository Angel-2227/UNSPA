// ============================================
// VARIABLES GLOBALES
// ============================================
let studyPlan = {};
let subjectBank = [];
let currentView = 'overview';
let currentEditingSubject = null;
let horariosData = [];
let schedules = [];
let currentPeriodConfig = {
    period: '',
    startDate: '',
    endDate: ''
};
let currentEditingSchedule = null;
let config = {
    programName: '',
    university: '',
    totalCredits: 0,
    creditsByType: {}
};

// ============================================
// UTILIDADES
// ============================================

function generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
}

// Debounce: evita escrituras a Firestore en cada keystroke
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}
const debouncedFirestoreSave = debounce(() => saveToFirestore(), 1500);


// ============================================
// INICIALIZACIÓN
// ============================================

function initApp() {
    console.log('🚀 Iniciando app...');
    loadConfig();
    loadData();
    initializeSubjectBank();
    updateUI();
    setupEventListeners();
    console.log('✅ App inicializada');
}

function loadConfig() {
    const savedConfig = localStorage.getItem('academicPlannerConfig');
    if (savedConfig) {
        config = { ...config, ...JSON.parse(savedConfig) };
    }
    _applyConfigToUI();
}

/** Refleja el objeto config actual en todos los elementos del DOM. */
function _applyConfigToUI() {
    const programNameInput = document.getElementById('configProgramName');
    const totalCreditsInput = document.getElementById('configTotalCredits');
    const universityInput = document.getElementById('configUniversity');
    const programNameDisplay = document.getElementById('programName');

    if (programNameInput) programNameInput.value = config.programName || '';
    if (totalCreditsInput) totalCreditsInput.value = config.totalCredits || 0;
    if (universityInput) universityInput.value = config.university || '';
    if (programNameDisplay) {
        programNameDisplay.textContent = `${config.programName || 'Plan de Estudios'} - ${config.university || 'Universidad'}`;
    }
}

function loadData() {
    const savedData = localStorage.getItem('academicPlannerData');
    if (savedData) {
        studyPlan = JSON.parse(savedData);
    }
}

function initializeSubjectBank() {
    const savedBank = localStorage.getItem('academicPlannerSubjects');
    if (savedBank) {
        subjectBank = JSON.parse(savedBank);
    } else {
        subjectBank = [];
        _saveSubjectBankLocal();
    }
}

function setupEventListeners() {
    document.getElementById('csvFile').addEventListener('change', handleCSVUpload);
    document.getElementById('searchSubjects').addEventListener('input', filterSubjects);

    window.addEventListener('click', function (event) {
        const subjectModal = document.getElementById('subjectModal');
        const typologyModal = document.getElementById('typologySubjectsModal');
        const currentScheduleModal = document.getElementById('currentScheduleModal');

        if (event.target === subjectModal) closeSubjectModal();
        if (event.target === typologyModal) closeTypologyModal();
        if (event.target === currentScheduleModal) closeCurrentScheduleModal();
    });
    // Listener CSV contenido programático en banco de materias
    const cpCsvInputBank = document.getElementById('cpCsvInputBank');
    if (cpCsvInputBank) {
        cpCsvInputBank.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const btn = document.getElementById('cpLoadBtnBank');
            if (btn) { btn.textContent = '⏳ Procesando...'; btn.disabled = true; }
            try {
                const text = await file.text();
                const parsed = await parseCPCSV(text);
                if (!parsed.length) { alert('⚠️ No se encontraron asignaturas en el CSV.'); return; }
                contenidoProgramaticoData = parsed;
                saveCPToStorage();
                saveCPToFirestore();
                renderSubjectsBank();
                alert(`✅ ${parsed.length} asignaturas cargadas.`);
            } catch (err) {
                alert('❌ Error al leer el archivo: ' + err.message);
            } finally {
                if (btn) { btn.textContent = '📖 Cargar programa'; btn.disabled = false; }
                e.target.value = '';
            }
        });
    }
}

// ============================================
// CARGA Y PARSEO DE CSV
// ============================================

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: false,
        complete: function (results) {
            parseCSVData(results.data);
        },
        encoding: 'UTF-8'
    });
}

function parseCSVData(data) {
    studyPlan = {};
    let currentSemester = 0;
    const typesFound = {};

    let totalCreditsFromCSV = 0;
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (row[1] && row[1].includes('TOTAL DE CRÉDITOS EXIGIDOS AL ESTUDIANTE')) {
            const parsed = parseInt(row[2]);
            if (!isNaN(parsed)) {
                totalCreditsFromCSV = parsed;
            }
            break;
        }
    }

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        if (row[1] && row[1].includes('Periodo académico')) {
            const semesterMatch = row[1].match(/Periodo académico (\d+)/);
            if (semesterMatch) {
                currentSemester = parseInt(semesterMatch[1]);
                studyPlan[currentSemester] = {
                    subjects: [],
                    status: 'completed'
                };
            }
        } else if (
            currentSemester > 0 &&
            row[1] && row[2] && row[3] &&
            !row[1].includes('ASIGNATURAS INSCRITAS') &&
            !row[1].includes('Total Créditos')
        ) {
            const credits = parseInt(row[3]) || parseInt(row[2]) || 0;
            if (credits > 0 && row[1].trim()) {
                const subjectType = row[2] ? row[2].trim() : 'DISCIPLINAR OBLIGATORIA';
                const subject = {
                    id: generateId(),
                    name: row[1].trim(),
                    type: subjectType,
                    credits: credits,
                    code: '',
                    professor: '',
                    group: ''
                };

                studyPlan[currentSemester].subjects.push(subject);

                if (!typesFound[subjectType]) typesFound[subjectType] = 0;
                typesFound[subjectType] += credits;

                const existingSubject = subjectBank.find(s => s.name === subject.name);
                if (!existingSubject) {
                    subjectBank.push({ ...subject, id: generateId() });
                }
            }
        }
    }

    Object.keys(studyPlan).forEach(key => {
        if (studyPlan[key].subjects.length === 0) {
            delete studyPlan[key];
        }
    });

    if (totalCreditsFromCSV === 0) {
        Object.values(studyPlan).forEach(semester => {
            semester.subjects.forEach(s => { totalCreditsFromCSV += s.credits; });
        });
    }

    config.totalCredits = totalCreditsFromCSV;
    config.creditsByType = typesFound;

    if (!config.programName) config.programName = 'Plan de Estudios';
    if (!config.university) config.university = 'Universidad';

    saveData();
    saveSubjectBank();
    saveConfig(false);
    updateUI();
}

// ============================================
// ACTUALIZACIÓN DE UI
// ============================================

function updateUI() {
    updateStats();
    updateSidebar();
    renderSemesters();
    renderSubjectsBank();
    renderTypologies();
    // Refrescar resumen general si está activo, para no depender de navegar al horario
    if (currentView === 'grades' && typeof renderGradesView === 'function') {
        renderGradesView();
    }
}

function updateStats() {
    let completedCredits = 0;
    let currentCredits = 0;

    Object.values(studyPlan).forEach(semester => {
        const semesterCredits = semester.subjects.reduce((sum, s) => sum + s.credits, 0);
        if (semester.status === 'completed') completedCredits += semesterCredits;
        else if (semester.status === 'current') currentCredits += semesterCredits;
    });

    const total = config.totalCredits || 1;
    const pendingCredits = Math.max(0, total - completedCredits - currentCredits);
    const progressPercentage = Math.round((completedCredits / total) * 100);

    document.getElementById('totalCredits').textContent = config.totalCredits;
    document.getElementById('completedCredits').textContent = completedCredits;
    document.getElementById('currentCredits').textContent = currentCredits;
    document.getElementById('pendingCredits').textContent = pendingCredits;
    document.getElementById('progressPercentage').textContent = progressPercentage + '%';

    // Actualizar tarjeta de tareas en el resumen
    _updateTasksStatCard();

    // Sincronizar promedio acumulado con el overview y el sidebar
    if (typeof refreshOverallAvg === 'function') {
        refreshOverallAvg();
    }
}

function _updateTasksStatCard() {
    const card = document.getElementById('tasksStatCard');
    if (!card) return;
    const tasks = (typeof tkTasks !== 'undefined') ? tkTasks : [];
    const pending = tasks.filter(t => !t.done);
    const urgent = pending.filter(t => t.priority === 1);
    const today = new Date().toISOString().slice(0, 10);
    const dueToday = pending.filter(t => t.due === today);
    const overdue = pending.filter(t => t.due && t.due < today);

    const numEl = card.querySelector('.stat-number');
    const labelEl = card.querySelector('.stat-label');
    const subEl = card.querySelector('.tasks-stat-sub');

    if (numEl) numEl.textContent = pending.length;
    if (subEl) {
        let parts = [];
        if (urgent.length) parts.push(`<span style="color:var(--unal-red)">🔥 ${urgent.length} urgente${urgent.length > 1 ? 's' : ''}</span>`);
        if (overdue.length) parts.push(`<span style="color:#e65100">⚠️ ${overdue.length} vencida${overdue.length > 1 ? 's' : ''}</span>`);
        if (dueToday.length) parts.push(`<span style="color:var(--unal-green)">📅 ${dueToday.length} hoy</span>`);
        subEl.innerHTML = parts.length ? parts.join(' · ') : '<span style="color:var(--text-secondary)">Sin pendientes urgentes</span>';
    }
}

function updateSidebar() {
    const completedCredits = parseInt(document.getElementById('completedCredits').textContent) || 0;
    const pendingCredits = parseInt(document.getElementById('pendingCredits').textContent) || 0;
    const progressPercentage = document.getElementById('progressPercentage').textContent;

    document.getElementById('sidebarProgress').textContent = progressPercentage;
    document.getElementById('sidebarCompleted').textContent = completedCredits;
    document.getElementById('sidebarPending').textContent = pendingCredits;
    document.getElementById('sidebarProgressBar').style.width = progressPercentage;

    const activeSemestersList = document.getElementById('activeSemestersList');
    activeSemestersList.innerHTML = '';

    Object.keys(studyPlan)
        .filter(semesterNum => studyPlan[semesterNum].subjects && studyPlan[semesterNum].subjects.length > 0)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .forEach(semesterNum => {
            const semester = studyPlan[semesterNum];
            if (semester.status !== 'pending') {
                const div = document.createElement('div');
                div.style.cssText = 'font-size: 0.8rem; margin-bottom: 6px; padding: 4px 8px; background: var(--bg-secondary); border-radius: 4px; cursor: pointer;';
                div.innerHTML = `Semestre ${semesterNum} <span style="color: var(--text-secondary);">(${semester.subjects.length})</span>`;
                div.onclick = () => scrollToSemester(semesterNum);
                activeSemestersList.appendChild(div);
            }
        });
}

// ============================================
// RENDER DE SEMESTRES
// ============================================

function renderSemesters() {
    const container = document.getElementById('semestersContainer');

    const semestersWithSubjects = Object.keys(studyPlan).filter(semesterNum =>
        studyPlan[semesterNum].subjects && studyPlan[semesterNum].subjects.length > 0
    );

    if (semestersWithSubjects.length === 0) {
        container.innerHTML = `
            <div class="no-data">
                <h3>Bienvenido al Sistema de Planificación Académica</h3>
                <p>Importa tu archivo CSV para comenzar</p>
                <p style="margin-top: 12px;">El sistema detectará automáticamente:</p>
                <ul style="text-align: left; display: inline-block; margin-top: 8px;">
                    <li>Total de créditos del plan</li>
                    <li>Materias y sus tipologías</li>
                    <li>Distribución por semestres</li>
                </ul>
            </div>`;
        return;
    }

    container.innerHTML = '';
    semestersWithSubjects.sort((a, b) => parseInt(a) - parseInt(b)).forEach(semesterNum => {
        container.appendChild(createSemesterCard(semesterNum, studyPlan[semesterNum]));
    });
}

function createSemesterCard(semesterNum, semester) {
    const totalCredits = semester.subjects.reduce((sum, s) => sum + s.credits, 0);
    const statusClass = semester.status || 'pending';
    const statusLabel = getStatusLabel(semester.status);

    const card = document.createElement('div');
    card.className = `semester-card ${statusClass}`;
    card.id = `semester-${semesterNum}`;

    card.innerHTML = `
        <div class="semester-header" onclick="toggleSemester(${semesterNum})">
            <div>
                <div class="semester-title">
                    <span class="semester-status status-${statusClass}">${statusLabel}</span>
                    Semestre ${semesterNum}
                </div>
                <div class="semester-summary">
                    ${semester.subjects.length} materias • ${totalCredits} créditos
                </div>
            </div>
            <div class="semester-controls">
                <select class="btn btn-sm" onclick="event.stopPropagation()" onchange="changeSemesterStatus(${semesterNum}, this.value)">
                    <option value="pending" ${semester.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    <option value="current" ${semester.status === 'current' ? 'selected' : ''}>Cursando</option>
                    <option value="completed" ${semester.status === 'completed' ? 'selected' : ''}>Completado</option>
                </select>
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); addSubjectToSemester(${semesterNum})">+ Agregar</button>
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSemester(${semesterNum})">🗑️</button>
                <button class="semester-toggle" id="toggle-${semesterNum}">▶</button>
            </div>
        </div>
        <div class="semester-content" id="content-${semesterNum}">
            <div class="semester-body">
                ${createSubjectsTable(semester.subjects, semesterNum)}
            </div>
        </div>`;

    return card;
}

function createSubjectsTable(subjects, semesterNum) {
    if (subjects.length === 0) {
        return '<div class="no-data" style="margin: 0;"><p>No hay materias en este semestre</p></div>';
    }

    return `<div class="subjects-cards-mobile">
        ${subjects.map((subject, index) => createSubjectCard(subject, semesterNum, index)).join('')}
    </div>`;
}

function createSubjectCard(subject, semesterNum, index) {
    const typeClass = getTypeClass(subject.type);
    return `
        <div class="subject-card-mobile">
            <div class="subject-card-header">
                <h4>${subject.name}</h4>
                <span class="type-badge ${typeClass}">${subject.type}</span>
            </div>
            <div class="subject-card-body">
                <div class="subject-card-info">
                    <div class="info-item">
                        <label>Créditos:</label>
                        <strong>${subject.credits}</strong>
                    </div>
                    <div class="info-item">
                        <label>Código:</label>
                        <span class="subject-field-text">${subject.code || '<em style="color:var(--text-secondary)">—</em>'}</span>
                    </div>
                    <div class="info-item">
                        <label>Profesor:</label>
                        <span class="subject-field-text">${subject.professor || '<em style="color:var(--text-secondary)">—</em>'}</span>
                    </div>
                    <div class="info-item">
                        <label>Grupo:</label>
                        <span class="subject-field-text">${subject.group || '<em style="color:var(--text-secondary)">—</em>'}</span>
                    </div>
                </div>
                <div class="subject-card-actions">
                    <button class="btn btn-primary btn-sm" onclick="editSubject('${subject.id}', ${semesterNum}, ${index})">✏️ Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="removeSubjectFromSemester(${semesterNum}, ${index})">🗑️ Eliminar</button>
                    <button class="btn btn-secondary btn-sm" onclick="startMoveSubject(${semesterNum}, ${index})">🔄 Mover</button>
                </div>
            </div>
        </div>`;
}

function createSubjectRow(subject, semesterNum, index) {
    const typeClass = getTypeClass(subject.type);
    return `
        <tr>
            <td><strong>${subject.name}</strong></td>
            <td><span class="type-badge ${typeClass}">${subject.type}</span></td>
            <td><strong>${subject.credits}</strong></td>
            <td><input type="text" class="editable-field" value="${subject.code || ''}" onchange="updateSubjectField(${semesterNum}, ${index}, 'code', this.value)"></td>
            <td><input type="text" class="editable-field" value="${subject.professor || ''}" onchange="updateSubjectField(${semesterNum}, ${index}, 'professor', this.value)"></td>
            <td><input type="text" class="editable-field" value="${subject.group || ''}" onchange="updateSubjectField(${semesterNum}, ${index}, 'group', this.value)"></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="editSubject('${subject.id}', ${semesterNum}, ${index})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="removeSubjectFromSemester(${semesterNum}, ${index})">🗑️</button>
                <button class="btn btn-secondary btn-sm" onclick="startMoveSubject(${semesterNum}, ${index})">🔄</button>
            </td>
        </tr>`;
}

function getTypeClass(type) {
    const typeMap = {
        'DISCIPLINAR OBLIGATORIA': 'type-disciplinar-obligatoria',
        'DISCIPLINAR OPTATIVA': 'type-disciplinar-optativa',
        'FUNDAMENTACIÓN OBLIGATORIA': 'type-fundamentacion-obligatoria',
        'FUNDAMENTACIÓN OPTATIVA': 'type-fundamentacion-optativa',
        'LIBRE ELECCIÓN': 'type-libre-eleccion',
        'TRABAJO DE GRADO': 'type-trabajo-grado',
        'NIVELACIÓN': 'type-nivelacion'
    };
    return typeMap[type] || 'type-disciplinar-obligatoria';
}

function getStatusLabel(status) {
    const labels = {
        'completed': 'Completado',
        'current': 'Cursando',
        'pending': 'Pendiente'
    };
    return labels[status] || 'Pendiente';
}

function toggleSemester(semesterNum) {
    if (moveMode && movingSubject && movingSubject.fromSemester != semesterNum) {
        if (confirm(`¿Mover "${movingSubject.subject.name}" del Semestre ${movingSubject.fromSemester} al Semestre ${semesterNum}?`)) {
            moveSubjectToSemester(semesterNum);
        }
        return;
    }

    const content = document.getElementById(`content-${semesterNum}`);
    const toggle = document.getElementById(`toggle-${semesterNum}`);

    document.querySelectorAll('.semester-content').forEach(otherContent => {
        if (otherContent !== content && otherContent.classList.contains('expanded')) {
            otherContent.classList.remove('expanded');
        }
    });
    document.querySelectorAll('.semester-toggle').forEach(otherToggle => {
        if (otherToggle !== toggle && otherToggle.classList.contains('expanded')) {
            otherToggle.textContent = '▶';
            otherToggle.classList.remove('expanded');
        }
    });

    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        toggle.textContent = '▶';
        toggle.classList.remove('expanded');
    } else {
        content.classList.add('expanded');
        toggle.textContent = '▼';
        toggle.classList.add('expanded');
    }
}

function changeSemesterStatus(semesterNum, newStatus) {
    studyPlan[semesterNum].status = newStatus;
    saveData();
    updateUI();
}

// ============================================
// GESTIÓN DE MATERIAS
// ============================================

function saveSubject(event) {
    event.preventDefault();

    const subjectData = {
        id: currentEditingSubject?.subject?.id || generateId(),
        name: document.getElementById('subjectName').value,
        type: document.getElementById('subjectType').value,
        credits: parseInt(document.getElementById('subjectCredits').value),
        code: document.getElementById('subjectCode').value,
        professor: document.getElementById('subjectProfessor').value,
        group: document.getElementById('subjectGroup').value
    };

    const oldSubject = currentEditingSubject?.subject;
    const isNewSubject = !oldSubject;

    if (isNewSubject) {
        subjectBank.push(subjectData);
    } else {
        const bankIndex = subjectBank.findIndex(s => s.id === oldSubject.id || s.name === oldSubject.name);
        if (bankIndex >= 0) {
            subjectBank[bankIndex] = { ...subjectBank[bankIndex], ...subjectData };
        }
        Object.keys(studyPlan).forEach(semesterNum => {
            studyPlan[semesterNum].subjects.forEach((subject, index) => {
                if (subject.id === oldSubject.id || subject.name === oldSubject.name) {
                    studyPlan[semesterNum].subjects[index] = { ...subjectData, id: subject.id || subjectData.id };
                }
            });
        });
    }

    saveData();
    saveSubjectBank();
    updateUI();
    closeSubjectModal();
}

function addSubjectToSemester(semesterNum) {
    if (subjectBank.length === 0) {
        alert('No hay materias en el banco. Agrega materias primero.');
        return;
    }

    const availableSubjects = subjectBank.filter(bankSubject =>
        !Object.values(studyPlan).some(semester =>
            semester.subjects.some(s => s.name === bankSubject.name)
        )
    );

    if (availableSubjects.length === 0) {
        alert('Todas las materias del banco ya están asignadas a semestres.');
        return;
    }

    const options = availableSubjects.map((subject, index) =>
        `${index + 1}. ${subject.name} (${subject.type} - ${subject.credits} créditos)`
    ).join('\n');

    const selection = prompt(`Selecciona una materia para añadir al Semestre ${semesterNum}:\n\n${options}\n\nEscribe el número:`);

    if (selection) {
        const index = parseInt(selection) - 1;
        if (index >= 0 && index < availableSubjects.length) {
            studyPlan[semesterNum].subjects.push({ ...availableSubjects[index] });
            saveData();
            updateUI();
        } else {
            alert('Selección inválida');
        }
    }
}

function removeSubjectFromSemester(semesterNum, subjectIndex) {
    if (confirm('¿Estás seguro de que quieres eliminar esta materia del semestre?')) {
        studyPlan[semesterNum].subjects.splice(subjectIndex, 1);
        saveData();
        updateUI();
    }
}

function editSubject(subjectId, semesterNum, subjectIndex) {
    const subject = studyPlan[semesterNum].subjects[subjectIndex];
    currentEditingSubject = { subject, semesterNum, subjectIndex, isEdit: true };
    openSubjectModal(subject);
}

function syncSubjectEverywhere(updatedSubject, originalName = null) {
    const nameToMatch = originalName || updatedSubject.name;

    const bankIndex = subjectBank.findIndex(s => s.name === nameToMatch || s.id === updatedSubject.id);
    if (bankIndex >= 0) {
        subjectBank[bankIndex] = { ...subjectBank[bankIndex], ...updatedSubject };
    }

    Object.keys(studyPlan).forEach(semesterNum => {
        studyPlan[semesterNum].subjects.forEach((subject, index) => {
            if (subject.name === nameToMatch || subject.id === updatedSubject.id) {
                studyPlan[semesterNum].subjects[index] = {
                    ...studyPlan[semesterNum].subjects[index],
                    ...updatedSubject
                };
            }
        });
    });

    _saveDataLocal();
    _saveSubjectBankLocal();
    updateUI();
    debouncedFirestoreSave();
}

function updateSubjectField(semesterNum, subjectIndex, field, value) {
    const subject = studyPlan[semesterNum].subjects[subjectIndex];
    const originalSubject = { ...subject };
    subject[field] = value;
    syncSubjectEverywhere(subject, originalSubject.name);
}

// ============================================
// BANCO DE MATERIAS
// ============================================

function renderSubjectsBank() {
    const container = document.getElementById('subjectsBankContainer');
    if (!container) return;
    const searchTerm = document.getElementById('searchSubjects').value.toLowerCase();

    // Helper: normaliza texto para comparar nombres
    function normName(s) {
        return (s || '').toLowerCase()
            .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
            .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
            .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n').trim();
    }

    // Obtener semestre asignado de una materia del banco
    function getSemesterFor(subject) {
        for (const [num, sem] of Object.entries(studyPlan)) {
            if (sem.subjects && sem.subjects.some(s => s.id === subject.id || s.name === subject.name)) {
                return num;
            }
        }
        return null;
    }

    // Cruzar materia del banco con CP data por nombre o código
    function getCpData(subject) {
        if (typeof contenidoProgramaticoData === 'undefined' || !contenidoProgramaticoData.length) return null;
        const normSubj = normName(subject.name);
        return contenidoProgramaticoData.find(cp =>
            normName(cp.name) === normSubj ||
            (subject.code && cp.code && subject.code === cp.code)
        ) || null;
    }

    // ── Materias del banco filtradas ──
    const filteredBank = subjectBank.filter(subject =>
        subject.name.toLowerCase().includes(searchTerm) ||
        subject.type.toLowerCase().includes(searchTerm)
    );

    // ── Materias del CP que NO están en el banco ──
    let unassignedCP = [];
    if (typeof contenidoProgramaticoData !== 'undefined' && contenidoProgramaticoData.length) {
        unassignedCP = contenidoProgramaticoData.filter(cp => {
            if (searchTerm && !normName(cp.name).includes(normName(searchTerm)) &&
                !(cp.code || '').toLowerCase().includes(searchTerm)) return false;
            return !subjectBank.some(s =>
                normName(s.name) === normName(cp.name) ||
                (s.code && cp.code && s.code === cp.code)
            );
        });
    }

    if (filteredBank.length === 0 && unassignedCP.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No se encontraron materias</p></div>';
        return;
    }

    // ── Renderizar materias del banco ──
    const bankHTML = filteredBank.map(subject => {
        const cp = getCpData(subject);
        const semNum = getSemesterFor(subject);
        const semBadge = semNum
            ? `<span style="font-size:0.75rem;background:var(--unal-blue);color:#fff;padding:2px 7px;border-radius:10px;margin-left:6px;">Sem. ${semNum}</span>`
            : `<span style="font-size:0.75rem;background:var(--bg-secondary);color:var(--text-secondary);padding:2px 7px;border-radius:10px;border:1px solid var(--border-color);margin-left:6px;">Sin semestre</span>`;
        const cpBtn = cp
            ? `<button class="btn btn-secondary btn-sm" title="Ver programa" onclick="cpShowModal('${cp.code}')">📖</button>`
            : `<button class="btn btn-secondary btn-sm" title="Sin programa cargado" style="opacity:0.4;cursor:default;">📖</button>`;
        const desc = cp && cp.description
            ? `<p style="font-size:0.78rem;color:var(--text-secondary);margin-top:4px;line-height:1.4;">${cp.description.slice(0, 100)}${cp.description.length > 100 ? '…' : ''}</p>`
            : '';

        return `
        <div class="subject-item" style="align-items:flex-start;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                <div class="subject-info">
                    <h4>${subject.name} ${semBadge}</h4>
                    <p><span class="type-badge ${getTypeClass(subject.type)}">${subject.type}</span> • ${subject.credits} créditos${subject.code ? ` • <span style="font-size:0.78rem;color:var(--text-secondary);">${subject.code}</span>` : ''}</p>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;margin-left:10px;">
                    ${cpBtn}
                    <button class="btn btn-primary btn-sm" onclick="editBankSubject('${subject.id}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteBankSubject('${subject.id}')">🗑️</button>
                </div>
            </div>
            ${desc}
        </div>`;
    }).join('');

    // ── Renderizar materias del CP sin asignar ──
    const unassignedHTML = unassignedCP.length ? `
        <div style="margin-top:18px;padding-top:14px;border-top:2px dashed var(--border-color);">
            <p style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:10px;font-weight:600;">
                📋 En el programa pero sin agregar al banco (${unassignedCP.length})
            </p>
            ${unassignedCP.map(cp => `
            <div class="subject-item" style="align-items:flex-start;flex-direction:column;gap:6px;opacity:0.8;border-style:dashed;">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                    <div class="subject-info">
                        <h4>${cp.name} <span style="font-size:0.72rem;background:#fff3cd;color:#856404;padding:2px 7px;border-radius:10px;margin-left:6px;">No en banco</span></h4>
                        <p><span class="type-badge ${getTypeClass(cp.type)}">${cp.type || '—'}</span> • ${cp.credits || '?'} créditos${cp.code ? ` • <span style="font-size:0.78rem;color:var(--text-secondary);">${cp.code}</span>` : ''}</p>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;margin-left:10px;">
                        <button class="btn btn-secondary btn-sm" title="Ver programa" onclick="cpShowModal('${cp.code}')">📖</button>
                    </div>
                </div>
                ${cp.description ? `<p style="font-size:0.78rem;color:var(--text-secondary);margin-top:2px;line-height:1.4;">${cp.description.slice(0, 100)}${cp.description.length > 100 ? '…' : ''}</p>` : ''}
            </div>`).join('')}
        </div>` : '';

    container.innerHTML = bankHTML + unassignedHTML;
}

function filterSubjects() {
    renderSubjectsBank();
}

function openSubjectModal(subject = null) {
    const modal = document.getElementById('subjectModal');
    const title = document.getElementById('subjectModalTitle');
    const typeSelect = document.getElementById('subjectType');
    const currentTypes = new Set();

    Object.keys(config.creditsByType || {}).forEach(type => currentTypes.add(type));
    if (currentTypes.size === 0) {
        ['DISCIPLINAR OBLIGATORIA', 'DISCIPLINAR OPTATIVA', 'FUNDAMENTACIÓN OBLIGATORIA',
            'FUNDAMENTACIÓN OPTATIVA', 'LIBRE ELECCIÓN', 'TRABAJO DE GRADO', 'NIVELACIÓN'
        ].forEach(type => currentTypes.add(type));
    }

    typeSelect.innerHTML = Array.from(currentTypes).sort().map(type =>
        `<option value="${type}">${type}</option>`
    ).join('');

    if (subject) {
        title.textContent = 'Editar Materia';
        document.getElementById('subjectName').value = subject.name;
        document.getElementById('subjectType').value = subject.type;
        document.getElementById('subjectCredits').value = subject.credits;
        document.getElementById('subjectCode').value = subject.code || '';
        document.getElementById('subjectProfessor').value = subject.professor || '';
        document.getElementById('subjectGroup').value = subject.group || '';
    } else {
        title.textContent = 'Nueva Materia';
        document.getElementById('subjectForm').reset();
    }

    modal.style.display = 'block';
}

function closeSubjectModal() {
    document.getElementById('subjectModal').style.display = 'none';
    currentEditingSubject = null;
}

function editBankSubject(subjectId) {
    const subject = subjectBank.find(s => s.id === subjectId);
    if (subject) {
        currentEditingSubject = { subject, isBank: true };
        openSubjectModal(subject);
    }
}

function deleteBankSubject(subjectId) {
    if (confirm('¿Estás seguro de que quieres eliminar esta materia del banco?')) {
        const subjectToDelete = subjectBank.find(s => s.id === subjectId);
        const subjectName = subjectToDelete ? subjectToDelete.name : null;

        subjectBank = subjectBank.filter(s => s.id !== subjectId);

        if (subjectName) {
            Object.keys(studyPlan).forEach(semesterNum => {
                studyPlan[semesterNum].subjects = studyPlan[semesterNum].subjects.filter(
                    subject => subject.name !== subjectName && subject.id !== subjectId
                );
            });
        }

        saveData();
        saveSubjectBank();
        updateUI();
        renderSubjectsBank();
    }
}

// ============================================
// TIPOLOGÍAS
// ============================================

function renderTypologies() {
    const container = document.getElementById('typologiesGrid');
    if (!container) return;

    const typologyTypes = [
        'DISCIPLINAR OBLIGATORIA',
        'DISCIPLINAR OPTATIVA',
        'FUNDAMENTACIÓN OBLIGATORIA',
        'FUNDAMENTACIÓN OPTATIVA',
        'LIBRE ELECCIÓN',
        'TRABAJO DE GRADO',
        'NIVELACIÓN'
    ];

    const typologyStats = {};
    typologyTypes.forEach(type => {
        typologyStats[type] = { credits: 0, count: 0, completedCredits: 0, completedCount: 0 };
    });

    Object.values(studyPlan).forEach(semester => {
        if (semester.subjects) {
            semester.subjects.forEach(subject => {
                if (typologyStats[subject.type]) {
                    typologyStats[subject.type].credits += subject.credits;
                    typologyStats[subject.type].count += 1;
                    if (semester.status === 'completed') {
                        typologyStats[subject.type].completedCredits += subject.credits;
                        typologyStats[subject.type].completedCount += 1;
                    }
                }
            });
        }
    });

    container.innerHTML = typologyTypes.map(type => {
        const stats = typologyStats[type];
        if (stats.count === 0) return '';
        const pendingCredits = stats.credits - stats.completedCredits;
        const pendingCount = stats.count - stats.completedCount;
        const progressPct = stats.credits > 0 ? Math.round((stats.completedCredits / stats.credits) * 100) : 0;
        const isComplete = pendingCredits === 0 && stats.count > 0;

        return `
            <div class="typology-card ${isComplete ? 'typology-card--complete' : ''}" onclick="showTypologySubjects('${type}')">
                <div class="typology-name">
                    <span class="type-badge ${getTypeClass(type)}" style="display:inline-block; margin-bottom:6px;">
                        ${type}
                    </span>
                </div>
                <div class="typology-progress-bar">
                    <div class="typology-progress-fill ${getTypeClass(type)}" style="width:${progressPct}%"></div>
                </div>
                <div class="typology-stats">
                    <div>
                        <div class="typology-credits">${stats.completedCredits}<span style="font-size:0.85rem;font-weight:400;color:var(--text-secondary);">/${stats.credits}</span></div>
                        <div class="typology-count">créditos cursados</div>
                    </div>
                    <div class="typology-pending ${isComplete ? 'typology-pending--done' : ''}">
                        ${isComplete
                            ? `<span style="font-size:1.3rem;">✅</span><div style="font-size:0.72rem;margin-top:2px;">¡Completo!</div>`
                            : `<div class="typology-pending-num">${pendingCredits}</div><div class="typology-count">créd. pendientes</div><div class="typology-count" style="margin-top:2px;">(${pendingCount} mat.)</div>`
                        }
                    </div>
                </div>
            </div>`;
    }).join('');
}

function showTypologySubjects(typologyType) {
    const modal = document.getElementById('typologySubjectsModal');
    const title = document.getElementById('typologyModalTitle');
    const container = document.getElementById('typologySubjectsContainer');

    title.textContent = typologyType;

    const typologySubjects = [];

    Object.entries(studyPlan).forEach(([semesterNum, semester]) => {
        semester.subjects.forEach(subject => {
            if (subject.type === typologyType) {
                typologySubjects.push({ ...subject, semester: semesterNum, status: semester.status });
            }
        });
    });

    subjectBank.forEach(subject => {
        if (subject.type === typologyType) {
            const isInPlan = Object.values(studyPlan).some(semester =>
                semester.subjects.some(s => s.name === subject.name)
            );
            if (!isInPlan) {
                typologySubjects.push({ ...subject, semester: 'No asignado', status: 'available' });
            }
        }
    });

    if (typologySubjects.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No hay materias de esta tipología</p></div>';
    } else {
        const totalCredits = typologySubjects.reduce((sum, s) => sum + s.credits, 0);
        const completedCredits = typologySubjects.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.credits, 0);
        const completedCount = typologySubjects.filter(s => s.status === 'completed').length;
        const pendingCredits = totalCredits - completedCredits;
        const pendingCount = typologySubjects.length - completedCount;
        const progressPct = totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0;

        // Group by status for sorting: completed last so pending appear first
        const sorted = [...typologySubjects].sort((a, b) => {
            const order = { 'current': 0, 'pending': 1, 'available': 2, 'completed': 3 };
            return (order[a.status] ?? 2) - (order[b.status] ?? 2);
        });

        container.innerHTML = `
            <div class="typo-modal-summary">
                <div class="typo-summary-row">
                    <div class="typo-summary-stat">
                        <span class="typo-summary-num">${completedCredits}<span class="typo-summary-total">/${totalCredits}</span></span>
                        <span class="typo-summary-label">créditos cursados</span>
                    </div>
                    <div class="typo-summary-stat typo-summary-stat--pending">
                        <span class="typo-summary-num">${pendingCredits}</span>
                        <span class="typo-summary-label">créditos pendientes</span>
                    </div>
                    <div class="typo-summary-stat">
                        <span class="typo-summary-num">${pendingCount}<span class="typo-summary-total">/${typologySubjects.length}</span></span>
                        <span class="typo-summary-label">materias pendientes</span>
                    </div>
                </div>
                <div class="typo-progress-bar">
                    <div class="typo-progress-fill ${getTypeClass(typologyType)}" style="width:${progressPct}%"></div>
                </div>
                <div style="text-align:right;font-size:0.75rem;color:var(--text-secondary);margin-top:4px;">${progressPct}% completado</div>
            </div>

            <div class="typo-subjects-grid">
                ${sorted.map(subject => `
                    <div class="typo-subject-card typo-subject-card--${subject.status}">
                        <div class="typo-subject-header">
                            <span class="typo-subject-name">${subject.name}</span>
                            <span class="typo-subject-credits">${subject.credits} cr.</span>
                        </div>
                        <div class="typo-subject-meta">
                            ${subject.code ? `<span class="typo-meta-item">🔢 ${subject.code}</span>` : ''}
                            <span class="typo-meta-item">📅 Sem. ${subject.semester}</span>
                            ${subject.professor ? `<span class="typo-meta-item">👤 ${subject.professor}</span>` : ''}
                        </div>
                        <div class="typo-subject-status">
                            <span class="type-badge status-${subject.status}">${getStatusLabel(subject.status)}</span>
                        </div>
                    </div>`).join('')}
            </div>`;
    }

    modal.style.display = 'block';
}

function closeTypologyModal() {
    document.getElementById('typologySubjectsModal').style.display = 'none';
}

// ============================================
// NAVEGACIÓN
// ============================================

function showView(viewName, clickedEl) {
    if (typeof closeFabIfOpen === 'function') closeFabIfOpen();
    document.querySelectorAll('.view-content').forEach(view => {
        view.style.display = 'none';
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) targetView.style.display = 'block';

    if (clickedEl) {
        clickedEl.classList.add('active');
    } else {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${viewName}'`)) {
                item.classList.add('active');
            }
        });
    }

    currentView = viewName;
    closeSidebar();

    if (viewName === 'subjects') renderSubjectsBank();
    else if (viewName === 'contenido') { showView('subjects'); return; }
    else if (viewName === 'config') renderTypologies();
    else if (viewName === 'schedule') {
        renderSchedules();
        loadPeriodConfig();
    } else if (viewName === 'malla') {
        // Pequeño delay para que el DOM esté listo
        setTimeout(() => {
            initMallaGenerada();
            buildMgcTypeLegend();
            // PDF se carga solo si el usuario activa esa pestaña
        }, 100);
    }
    else if (viewName === 'grades') {
        renderGradesView();
        // Si studyPlan aún no tiene materias (datos de Firestore no llegaron todavía),
        // reintentamos en intervalos crecientes hasta que lleguen los datos
        const hasSubjects = Object.values(studyPlan).some(s => s.subjects && s.subjects.length > 0);
        if (!hasSubjects) {
            [800, 1800, 3500].forEach(delay => {
                setTimeout(() => {
                    if (currentView === 'grades') {
                        const nowHas = Object.values(studyPlan).some(s => s.subjects && s.subjects.length > 0);
                        if (nowHas) {
                            ensureGradesStructure();
                            renderGradesView();
                        }
                    }
                }, delay);
            });
        }
    }
    else if (viewName === 'contenido') {
        initContenidoView();
    }
    else if (viewName === 'tasks') {
        if (typeof initTasksView === 'function') initTasksView();
    }
}

function scrollToSemester(semesterNum) {
    closeSidebar();
    expandSemester(semesterNum);
    setTimeout(() => {
        const element = document.getElementById(`semester-${semesterNum}`);
        if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

function expandSemester(semesterNum) {
    const content = document.getElementById(`content-${semesterNum}`);
    const toggle = document.getElementById(`toggle-${semesterNum}`);
    if (content && !content.classList.contains('expanded')) {
        content.classList.add('expanded');
        if (toggle) { toggle.textContent = '▼'; toggle.classList.add('expanded'); }
    }
}

// ============================================
// CONFIGURACIÓN
// ============================================

async function saveConfig(showAlert = true) {
    const programNameInput = document.getElementById('configProgramName');
    const totalCreditsInput = document.getElementById('configTotalCredits');
    const universityInput = document.getElementById('configUniversity');

    if (programNameInput) config.programName = programNameInput.value;
    if (totalCreditsInput) config.totalCredits = parseInt(totalCreditsInput.value) || 0;
    if (universityInput) config.university = universityInput.value;

    localStorage.setItem('academicPlannerConfig', JSON.stringify(config));

    const programNameDisplay = document.getElementById('programName');
    if (programNameDisplay) {
        programNameDisplay.textContent = `${config.programName} - ${config.university}`;
    }

    updateUI();
    await saveToFirestore();

    if (showAlert) alert('✅ Configuración guardada correctamente');
}

function resetData() {
    if (confirm('¿Estás seguro de que quieres reiniciar todo el sistema? Esta acción no se puede deshacer.')) {
        localStorage.removeItem('academicPlannerData');
        localStorage.removeItem('academicPlannerSubjects');
        localStorage.removeItem('academicPlannerConfig');
        localStorage.removeItem('theme');
        localStorage.removeItem('savedSchedules');
        localStorage.removeItem('currentPeriod');
        localStorage.removeItem('mallaMarks');
        localStorage.removeItem('mallaPrereqs');

        studyPlan = {};
        subjectBank = [];
        schedules = [];
        mallaMarks = {};
        mallaPrereqs = {};
        config = { programName: '', university: '', totalCredits: 0, creditsByType: {} };

        const csvInput = document.getElementById('csvFile');
        if (csvInput) csvInput.value = '';

        if (currentUser) {
            db.collection('users').doc(currentUser.uid).delete().catch(console.error);
        }

        location.reload();
    }
}

// ============================================
// GUARDADO LOCAL
// ============================================

function _saveDataLocal() {
    localStorage.setItem('academicPlannerData', JSON.stringify(studyPlan));
}

function _saveSubjectBankLocal() {
    localStorage.setItem('academicPlannerSubjects', JSON.stringify(subjectBank));
}

// ============================================
// FUNCIONES DE GUARDADO PÚBLICAS
// ============================================

async function saveData() {
    _saveDataLocal();
    await saveToFirestore();
}

async function saveSubjectBank() {
    _saveSubjectBankLocal();
    await saveToFirestore();
}

function exportData() {
    const rows = [];

    // Fila de créditos totales — parseCSVData la detecta por este texto
    rows.push(['', 'TOTAL DE CRÉDITOS EXIGIDOS AL ESTUDIANTE', config.totalCredits || 0, '']);

    // Semestres en orden
    const semNums = Object.keys(studyPlan).map(Number).sort((a, b) => a - b);
    for (const semNum of semNums) {
        const semester = studyPlan[semNum];
        rows.push(['', `Periodo académico ${semNum}`, '', '']);
        rows.push(['', 'ASIGNATURAS INSCRITAS', 'Tipología', 'Créditos']);
        for (const subject of semester.subjects) {
            rows.push(['', subject.name, subject.type, subject.credits]);
        }
        const semCredits = semester.subjects.reduce((s, sub) => s + sub.credits, 0);
        rows.push(['', `Total Créditos Semestre ${semNum}`, '', semCredits]);
        rows.push(['', '', '', '']);
    }

    function escapeField(val) {
        const str = String(val ?? '');
        return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
    }
    const csvContent = rows.map(r => r.map(escapeField).join(',')).join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan_estudios_${config.programName || 'carrera'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
}

// ============================================
// MODO MOVER MATERIAS
// ============================================

let moveMode = false;
let movingSubject = null;

function addNewSemester() {
    const allSemesters = Object.keys(studyPlan).map(n => parseInt(n)).filter(n => !isNaN(n)).sort((a, b) => a - b);
    const emptySemesters = allSemesters.filter(num =>
        !studyPlan[num].subjects || studyPlan[num].subjects.length === 0
    );

    let targetSemester;
    if (emptySemesters.length > 0) {
        targetSemester = emptySemesters[0];
        alert(`Activando Semestre ${targetSemester} (estaba vacío)`);
    } else {
        targetSemester = allSemesters.length > 0 ? Math.max(...allSemesters) + 1 : 1;
        studyPlan[targetSemester] = { subjects: [], status: 'pending' };
    }

    setTimeout(() => {
        if (confirm(`¿Deseas añadir una materia al Semestre ${targetSemester}?`)) {
            addSubjectToSemester(targetSemester);
        } else {
            saveData();
            updateUI();
        }
    }, 100);

    saveData();
    updateUI();
}

function deleteSemester(semesterNum) {
    const semester = studyPlan[semesterNum];
    const msg = semester.subjects.length > 0
        ? `¿Estás seguro de eliminar el Semestre ${semesterNum}? Tiene ${semester.subjects.length} materias que se perderán.`
        : `¿Eliminar el Semestre ${semesterNum}?`;
    if (!confirm(msg)) return;

    delete studyPlan[semesterNum];
    saveData();
    updateUI();
}

function toggleMoveMode() {
    moveMode = !moveMode;
    const btn = document.getElementById('moveBtn');
    const container = document.getElementById('semestersContainer');

    if (moveMode) {
        btn.textContent = '❌ Cancelar Mover';
        btn.className = 'btn btn-danger';
        container.classList.add('move-mode');
        showMoveInstructions();
    } else {
        btn.textContent = '🔄 Mover Materias';
        btn.className = 'btn btn-warning';
        container.classList.remove('move-mode');
        hideMoveInstructions();
        movingSubject = null;
    }
}

function showMoveInstructions() {
    const container = document.getElementById('semestersContainer');
    const instructions = document.createElement('div');
    instructions.id = 'moveInstructions';
    instructions.className = 'move-instructions';
    instructions.innerHTML = '📋 Modo Mover Materias: Haz clic en 🔄 de una materia para seleccionarla, luego haz clic en el encabezado del semestre destino.';
    container.insertBefore(instructions, container.firstChild);
}

function hideMoveInstructions() {
    const instructions = document.getElementById('moveInstructions');
    if (instructions) instructions.remove();
}

function startMoveSubject(semesterNum, subjectIndex) {
    if (!moveMode) return;

    movingSubject = {
        subject: studyPlan[semesterNum].subjects[subjectIndex],
        fromSemester: semesterNum,
        fromIndex: subjectIndex
    };

    document.querySelectorAll('.subjects-table tr').forEach(row => { row.style.background = ''; });
    const rows = document.querySelectorAll(`#semester-${semesterNum} .subjects-table tbody tr`);
    if (rows[subjectIndex]) rows[subjectIndex].style.background = 'var(--unal-yellow)';

    alert(`Materia "${movingSubject.subject.name}" seleccionada. Ahora haz clic en el encabezado del semestre destino.`);
}

function moveSubjectToSemester(targetSemester) {
    if (!movingSubject) return;

    studyPlan[movingSubject.fromSemester].subjects.splice(movingSubject.fromIndex, 1);

    if (!studyPlan[targetSemester]) {
        studyPlan[targetSemester] = { subjects: [], status: 'pending' };
    }
    studyPlan[targetSemester].subjects.push(movingSubject.subject);

    movingSubject = null;
    toggleMoveMode();
    saveData();
    updateUI();
}



// ============================================
// TEMA Y RESIZE
// ============================================

const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);

let resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (currentView === 'overview') renderSemesters();
    }, 250);
});

// ============================================
// AUTENTICACIÓN Y FIRESTORE
// ============================================

let currentUser = null;
let appInitialized = false;

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        showApp();
        loadUserDataFromFirestore();
    } else {
        currentUser = null;
        showLogin();
    }
});

function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'block';
    if (appContainer) appContainer.style.display = 'none';
}

function showApp() {
    const loginScreen = document.getElementById('loginScreen');
    const appContainer = document.getElementById('appContainer');
    if (loginScreen) loginScreen.style.display = 'none';
    if (appContainer) appContainer.style.display = 'block';

    if (!appInitialized) {
        initApp();
        appInitialized = true;
    }
    updateUserInfo();
}

const googleLoginBtn = document.getElementById('googleLoginBtn');
if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
        const loginBtn = document.getElementById('googleLoginBtn');
        const loginLoading = document.getElementById('loginLoading');
        try {
            loginBtn.style.display = 'none';
            loginLoading.style.display = 'block';
            const provider = new firebase.auth.GoogleAuthProvider();
            await auth.signInWithPopup(provider);
        } catch (error) {
            console.error('Error en login:', error);
            alert('Error al iniciar sesión: ' + error.message);
            loginBtn.style.display = 'flex';
            loginLoading.style.display = 'none';
        }
    });
}

function logout() {
    if (confirm('¿Cerrar sesión? Tus datos están guardados en la nube.')) {
        auth.signOut();
    }
}

function updateUserInfo() {
    if (!currentUser) return;
    // Inyectar info de usuario en el FAB del resumen
    const fabUserInfo = document.getElementById('fabUserInfo');
    if (fabUserInfo) {
        fabUserInfo.innerHTML = `
            <div class="fab-user-row">
                <img src="${currentUser.photoURL || ''}" alt="User" class="fab-user-avatar"
                     onerror="this.style.display='none'">
                <div class="fab-user-details">
                    <span class="fab-user-name">${currentUser.displayName || currentUser.email || 'Usuario'}</span>
                    <button onclick="logout()" class="fab-user-logout">Cerrar sesión</button>
                </div>
            </div>`;
    }
}

async function loadUserDataFromFirestore() {
    if (!currentUser) return;

    // Mostrar UID en consola para depuración
    console.log('👤 UID del usuario:', currentUser.uid);
    console.log('📧 Email:', currentUser.email);

    try {
        const docRef = db.collection('users').doc(currentUser.uid);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data.studyPlan) studyPlan = data.studyPlan;
            if (data.subjectBank) subjectBank = data.subjectBank;
            if (data.config) {
                config = { ...config, ...data.config };
                // Persistir en localStorage y reflejar en los inputs del DOM
                localStorage.setItem('academicPlannerConfig', JSON.stringify(config));
                _applyConfigToUI();
            }
            if (data.schedules) schedules = data.schedules;
            if (data.currentPeriodConfig) currentPeriodConfig = data.currentPeriodConfig;
            // Restaurar JSON de horarios (evita tener que re-subirlo cada sesión)
            if (data.horariosData && data.horariosData.length > 0) {
                horariosData = data.horariosData;
                _restoreHorariosInfoFromRaw();
            } else {
                // Fallback a localStorage si Firestore no tiene horariosData
                try {
                    const saved = localStorage.getItem('academicHorariosData');
                    if (saved) {
                        const parsed = JSON.parse(saved);
                        if (parsed && parsed.length > 0) {
                            horariosData = parsed;
                            _restoreHorariosInfoFromRaw();
                        }
                    }
                } catch (e) { /* ignorar */ }
            }
            // Cargar marcas de la malla desde Firestore
            if (data.mallaMarks) {
                mallaMarks = data.mallaMarks;
                localStorage.setItem('mallaMarks', JSON.stringify(mallaMarks));
            }
            if (data.mallaPrereqs) {
                mallaPrereqs = data.mallaPrereqs;
                localStorage.setItem('mallaPrereqs', JSON.stringify(mallaPrereqs));
            }
            if (data.mallaPdfURL) {
                localStorage.setItem('mallaPdfURL', data.mallaPdfURL);
                localStorage.setItem('mallaPdfFileName', data.mallaPdfFileName || 'malla.pdf');
            }
            if (typeof loadCPFromFirestore === 'function') loadCPFromFirestore(data);
            // Cargar notas DESPUÉS de que studyPlan ya está asignado
            if (typeof loadGradesFromFirestore === 'function') {
                loadGradesFromFirestore(data);
            }
            if (typeof tkLoadFromFirestore === 'function') {
                tkLoadFromFirestore(data);
            }
            console.log('✅ Datos cargados desde Firestore');
        } else {
            console.log('⚠️ Primera vez del usuario, intentando migrar desde localStorage...');
            await migrateFromLocalStorage();
        }

        updateUI();

        // Suscripción en tiempo real para detectar cambios desde otras pestañas/dispositivos
        _subscribeToFirestoreChanges();
    } catch (error) {
        console.error('Error cargando datos de Firestore:', error);
        console.warn('⚠️ Usando datos locales como fallback...');
        loadData();
        initializeSubjectBank();
        loadConfig();
        updateUI();
    }
}

let _firestoreUnsubscribe = null;

/**
 * Suscripción en tiempo real a Firestore.
 * Detecta cambios desde otras pestañas o dispositivos y actualiza la UI.
 */
function _subscribeToFirestoreChanges() {
    if (_firestoreUnsubscribe) return;
    if (!currentUser) return;
    const docRef = db.collection('users').doc(currentUser.uid);
    let firstSnapshot = true;
    _firestoreUnsubscribe = docRef.onSnapshot(doc => {
        if (firstSnapshot) { firstSnapshot = false; return; }
        if (!doc.exists) return;
        const data = doc.data();
        console.log('🔄 Cambio en Firestore detectado');
        if (data.studyPlan) studyPlan = data.studyPlan;
        if (data.subjectBank) subjectBank = data.subjectBank;
        if (data.config) { config = { ...config, ...data.config }; _applyConfigToUI(); }
        if (data.schedules) schedules = data.schedules;
        if (data.horariosData && data.horariosData.length > 0) {
            horariosData = data.horariosData;
            _restoreHorariosInfoFromRaw();
        }
        if (data.mallaMarks) mallaMarks = data.mallaMarks;
        if (typeof loadGradesFromFirestore === 'function') loadGradesFromFirestore(data);
        updateUI();
    }, err => console.warn('Error en onSnapshot:', err));
}

/**
 * Re-aplica horariosInfo desde horariosData crudo al subjectBank y studyPlan.
 */
function _restoreHorariosInfoFromRaw() {
    if (!horariosData || !horariosData.length) return;
    horariosData.forEach(horarioMateria => {
        subjectBank.forEach(s => {
            if (typeof normalizeString === 'function' &&
                normalizeString(s.name) === normalizeString(horarioMateria.nombre)) {
                s.horariosInfo = horarioMateria.grupos;
                if (!s.code) s.code = horarioMateria.codigo;
            }
        });
        Object.values(studyPlan).forEach(sem => {
            (sem.subjects || []).forEach(s => {
                if (typeof normalizeString === 'function' &&
                    normalizeString(s.name) === normalizeString(horarioMateria.nombre)) {
                    s.horariosInfo = horarioMateria.grupos;
                    if (!s.code) s.code = horarioMateria.codigo;
                }
            });
        });
    });
}

async function saveToFirestore() {
    if (!currentUser) return;
    try {
        const docRef = db.collection('users').doc(currentUser.uid);
        await docRef.set({
            studyPlan,
            subjectBank,
            config,
            schedules,
            currentPeriodConfig,
            mallaMarks,
            mallaPrereqs: (typeof mallaPrereqs !== 'undefined') ? mallaPrereqs : {},
            gradesData: (typeof gradesData !== 'undefined') ? gradesData : {},
            acadTasks: (typeof tkTasks !== 'undefined') ? tkTasks : [],
            horariosData: (typeof horariosData !== 'undefined' && horariosData.length > 0) ? horariosData : [],
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        console.log('✅ Datos guardados en Firestore');
    } catch (error) {
        console.error('Error guardando en Firestore:', error);
    }
}

async function migrateFromLocalStorage() {
    const localData = localStorage.getItem('academicPlannerData');
    const localSubjects = localStorage.getItem('academicPlannerSubjects');
    const localConfig = localStorage.getItem('academicPlannerConfig');
    const localSchedules = localStorage.getItem('savedSchedules');
    const localPeriod = localStorage.getItem('currentPeriod');

    if (localData || localSubjects || localConfig) {
        if (confirm('¿Deseas importar tus datos locales a la nube?')) {
            if (localData) studyPlan = JSON.parse(localData);
            if (localSubjects) subjectBank = JSON.parse(localSubjects);
            if (localConfig) config = { ...config, ...JSON.parse(localConfig) };
            if (localSchedules) schedules = JSON.parse(localSchedules);
            if (localPeriod) currentPeriodConfig = JSON.parse(localPeriod);
            await saveToFirestore();
            alert('✅ Datos migrados exitosamente a la nube');
        }
    }
}

window.addEventListener('beforeunload', () => {
    if (currentUser) saveToFirestore();
});




// ============================================
// MALLA — PESTAÑAS Y LEYENDA
// ============================================

function switchMallaTab(tab) {
    const genPanel = document.getElementById('mallaPanelGen');
    const pdfPanel = document.getElementById('mallaPanelPdf');
    const tabGen = document.getElementById('mallaTabGen');
    const tabPdf = document.getElementById('mallaTabPdf');

    if (tab === 'gen') {
        if (genPanel) genPanel.style.display = 'block';
        if (pdfPanel) pdfPanel.style.display = 'none';
        if (tabGen) tabGen.classList.add('active');
        if (tabPdf) tabPdf.classList.remove('active');
        // Re-render por si cambió el estado
        initMallaGenerada();
        buildMgcTypeLegend();
    } else {
        if (genPanel) genPanel.style.display = 'none';
        if (pdfPanel) pdfPanel.style.display = 'block';
        if (tabGen) tabGen.classList.remove('active');
        if (tabPdf) tabPdf.classList.add('active');
        // PDF: solo visualización, sin overlay interactivo
        setTimeout(() => {
            initMallaView();
            // NO llamar setupMallaOverlayEvents — PDF es de solo lectura
        }, 50);
    }
}

function buildMgcTypeLegend() {
    const el = document.getElementById('mgcLegendTypes');
    if (!el) return;
    const MALLA_TYPE_COLORS = {
        'DISCIPLINAR OBLIGATORIA': { border: '#1976d2' },
        'DISCIPLINAR OPTATIVA': { border: '#388e3c' },
        'FUNDAMENTACIÓN OBLIGATORIA': { border: '#f9a825' },
        'FUNDAMENTACIÓN OPTATIVA': { border: '#e91e63' },
        'LIBRE ELECCIÓN': { border: '#7b1fa2' },
        'TRABAJO DE GRADO': { border: '#3f51b5' },
        'NIVELACIÓN': { border: '#ff6f00' },
    };
    // Solo mostrar los tipos que existen en el plan
    const usedTypes = new Set();
    Object.values(studyPlan).forEach(sem => sem.subjects.forEach(s => usedTypes.add(s.type)));

    el.innerHTML = Array.from(usedTypes).map(type => {
        const color = (MALLA_TYPE_COLORS[type] || { border: '#90a4ae' }).border;
        return `<div class="malla-legend-item">
            <div class="malla-legend-dot" style="background:${color}33; border-color:${color};"></div>
            <span>${type}</span>
        </div>`;
    }).join('');
}

// ============================================
// MALLA CURRICULAR
// ============================================

let mallaMarks = {};
let mallaPdfDoc = null;
let mallaCurrentPage = 1;
let mallaScale = 1.0;
let mallaIsDragging = false;
let mallaOverlayEventsReady = false;
const CLOUDINARY_CLOUD_NAME = 'dlzdelkc2';   // ← pon el tuyo
const CLOUDINARY_UPLOAD_PRESET = 'malla_pdf';     // ← el que creaste

// ---- Inicializar vista ----
async function initMallaView() {
    loadMallaMarks();
    updateMallaStats();
    setupMallaPdfInput();
    if (!mallaPdfDoc) {
        await loadMallaPDF();
    } else {
        renderMallaPage(mallaCurrentPage);
    }
    updateMallaToolbar();
}

async function loadMallaPDF() {
    const loadingEl = document.getElementById('mallaLoading');
    const errorEl = document.getElementById('mallaError');
    const stackEl = document.getElementById('mallaCanvasStack');

    if (loadingEl) loadingEl.style.display = 'flex';
    if (errorEl) errorEl.style.display = 'none';
    if (stackEl) stackEl.style.display = 'none';

    // Buscar URL guardada: primero localStorage, luego Firestore
    let pdfURL = localStorage.getItem('mallaPdfURL');

    if (!pdfURL && typeof currentUser !== 'undefined' && currentUser) {
        try {
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists && doc.data().mallaPdfURL) {
                pdfURL = doc.data().mallaPdfURL;
                localStorage.setItem('mallaPdfURL', pdfURL);
                localStorage.setItem('mallaPdfFileName', doc.data().mallaPdfFileName || 'malla.pdf');
            }
        } catch (e) { console.warn('No se pudo leer URL de Firestore', e); }
    }

    // Actualizar nombre visible si ya había uno
    const savedName = localStorage.getItem('mallaPdfFileName');
    if (savedName) updateMallaPdfUI(savedName);

    if (!pdfURL) {
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'flex';
            errorEl.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <div style="font-size:3rem; margin-bottom:16px;">📄</div>
                    <p style="color:var(--text-secondary); margin-bottom:16px;">
                        Aún no has cargado tu malla curricular.
                    </p>
                    <p style="font-size:0.85rem; color:var(--text-secondary);">
                        Usa el botón <strong>📂 Cargar mi malla (PDF)</strong> para subir el PDF de tu carrera.
                    </p>
                </div>`;
        }
        return;
    }

    try {
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // Descargar el PDF como binario primero para evitar problemas CORS
        const response = await fetch(pdfURL);
        const arrayBuffer = await response.arrayBuffer();
        mallaPdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        if (loadingEl) loadingEl.style.display = 'none';
        if (stackEl) stackEl.style.display = 'block';

        renderMallaPage(mallaCurrentPage);
    } catch (err) {
        console.error('Error cargando PDF:', err);
        if (loadingEl) loadingEl.style.display = 'none';
        if (errorEl) {
            errorEl.style.display = 'flex';
            errorEl.innerHTML = `
                <div style="text-align:center; padding:40px;">
                    <div style="font-size:3rem;">⚠️</div>
                    <p style="color:var(--text-secondary);">Error al leer el PDF. Intenta cargarlo de nuevo.</p>
                </div>`;
        }
    }
}

// ---- Subida de PDF a Cloudinary ----
function setupMallaPdfInput() {
    const input = document.getElementById('mallaPdfInput');
    if (!input || input._ready) return;
    input._ready = true;

    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Mostrar estado de carga
        const nameEl = document.getElementById('mallaPdfName');
        if (nameEl) nameEl.textContent = '⏳ Subiendo...';

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            // Nota: presets unsigned no permiten overwrite ni access_mode.
            // El public_id lo genera Cloudinary; la URL se guarda en Firestore.

            const res = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
                { method: 'POST', body: formData }
            );

            if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData?.error?.message || 'Error al subir a Cloudinary');
}
            const data = await res.json();
            const pdfURL = data.secure_url;

            // Guardar URL en localStorage y Firestore
            localStorage.setItem('mallaPdfURL', pdfURL);
            localStorage.setItem('mallaPdfFileName', file.name);

            if (typeof currentUser !== 'undefined' && currentUser) {
                db.collection('users').doc(currentUser.uid)
                    .set({ mallaPdfURL: pdfURL, mallaPdfFileName: file.name }, { merge: true })
                    .catch(console.error);
            }

            updateMallaPdfUI(file.name);
            mallaPdfDoc = null; // forzar recarga
            await loadMallaPDF();


        } catch (err) {
            console.error('Error subiendo PDF:', err);
            if (nameEl) nameEl.textContent = '❌ Error al subir';
            alert('Error al subir el PDF. Revisa tu conexión e intenta de nuevo.');
        }
    });
}

function updateMallaPdfUI(name) {
    const nameEl = document.getElementById('mallaPdfName');
    const clearBtn = document.getElementById('mallaPdfClearBtn');
    if (nameEl) nameEl.textContent = name ? `📄 ${name}` : '';
    if (clearBtn) clearBtn.style.display = name ? 'inline-block' : 'none';
}

function clearMallaPDF() {
    if (!confirm('¿Quitar la malla cargada? Las marcas se conservarán.')) return;

    localStorage.removeItem('mallaPdfURL');
    localStorage.removeItem('mallaPdfFileName');

    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid)
            .set({ mallaPdfURL: null, mallaPdfFileName: null }, { merge: true })
            .catch(console.error);
    }

    mallaPdfDoc = null;
    updateMallaPdfUI('');

    const stackEl = document.getElementById('mallaCanvasStack');
    const errorEl = document.getElementById('mallaError');
    if (stackEl) stackEl.style.display = 'none';
    if (errorEl) {
        errorEl.style.display = 'flex';
        errorEl.innerHTML = `
            <div style="text-align:center; padding:40px;">
                <div style="font-size:3rem; margin-bottom:16px;">📄</div>
                <p style="color:var(--text-secondary);">Carga tu malla usando el botón de arriba.</p>
            </div>`;
    }
}

async function renderMallaPage(pageNum) {
    if (!mallaPdfDoc) return;

    const canvas = document.getElementById('mallaCanvas');
    const overlay = document.getElementById('mallaOverlay');
    if (!canvas || !overlay) return;

    const page = await mallaPdfDoc.getPage(pageNum);

    // Usar devicePixelRatio para pantallas Retina / HiDPI — el PDF siempre se ve nítido
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: mallaScale * dpr });

    // El canvas real tiene resolución física alta
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    overlay.width = viewport.width;
    overlay.height = viewport.height;

    // El tamaño CSS (visible) sigue siendo el lógico sin escalar por dpr
    const logicalW = Math.round(viewport.width / dpr);
    const logicalH = Math.round(viewport.height / dpr);
    canvas.style.width = logicalW + 'px';
    canvas.style.height = logicalH + 'px';
    overlay.style.width = logicalW + 'px';
    overlay.style.height = logicalH + 'px';

    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;

    redrawOverlay();
    updateMallaStats();
}

function redrawOverlay() {
    const overlay = document.getElementById('mallaOverlay');
    if (!overlay) return;
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    Object.entries(mallaMarks).forEach(([key, mark]) => {
        if (!mark || mark.state === 'none') return;
        const [x, y] = key.split('_').map(Number);

        const isCompleted = mark.state === 'completed';
        const fillColor = isCompleted ? 'rgba(46,125,50,0.5)' : 'rgba(255,160,0,0.5)';
        const strokeColor = isCompleted ? '#1b5e20' : '#e65100';
        const icon = isCompleted ? '✓' : '▶';

        // Sombra suave
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.arc(x, y, 24, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = strokeColor;
        ctx.font = 'bold 15px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, x, y);
    });
}

// ---- Eventos del canvas overlay ----
function setupMallaOverlayEvents() {
    // PDF es solo de lectura — no registrar eventos de clic
    return;
    if (mallaOverlayEventsReady) return;

    const overlay = document.getElementById('mallaOverlay');
    const wrapper = document.getElementById('mallaCanvasWrapper');
    if (!overlay || !wrapper) return;

    mallaOverlayEventsReady = true;

    // Clic → marcar/desmarcar
    overlay.addEventListener('click', (e) => {
        if (mallaIsDragging) return;

        const rect = overlay.getBoundingClientRect();
        const scaleX = overlay.width / rect.width;
        const scaleY = overlay.height / rect.height;
        const x = Math.round((e.clientX - rect.left) * scaleX);
        const y = Math.round((e.clientY - rect.top) * scaleY);

        const nearKey = findNearbyMark(x, y, 32);

        if (nearKey) {
            const states = ['completed', 'current', 'none'];
            const cur = mallaMarks[nearKey].state;
            const next = states[(states.indexOf(cur) + 1) % states.length];
            if (next === 'none') {
                delete mallaMarks[nearKey];
            } else {
                mallaMarks[nearKey].state = next;
            }
        } else {
            if (mallaCurrentTool !== 'erase') {
                mallaMarks[`${x}_${y}`] = { state: mallaCurrentTool };
            }
        }

        saveMallaMarks();
        redrawOverlay();
        updateMallaStats();
    });

    // ---- Drag para hacer scroll ----
    let dragStartX, dragStartY, scrollLeft, scrollTop, hasDragged;

    wrapper.addEventListener('mousedown', (e) => {
        hasDragged = false;
        dragStartX = e.pageX - wrapper.offsetLeft;
        dragStartY = e.pageY - wrapper.offsetTop;
        scrollLeft = wrapper.scrollLeft;
        scrollTop = wrapper.scrollTop;
        wrapper.style.cursor = 'grabbing';

        const onMove = (ev) => {
            const dx = ev.pageX - wrapper.offsetLeft - dragStartX;
            const dy = ev.pageY - wrapper.offsetTop - dragStartY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged = true;
            wrapper.scrollLeft = scrollLeft - dx;
            wrapper.scrollTop = scrollTop - dy;
        };

        const onUp = () => {
            wrapper.style.cursor = 'crosshair';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            // Bloquear el clic que dispara el overlay si hubo drag
            if (hasDragged) {
                setTimeout(() => { mallaIsDragging = false; }, 50);
                mallaIsDragging = true;
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    // ---- Touch scroll + pinch zoom ----
    let touchStartData = null;
    let lastPinchDist = 0;

    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartData = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                sl: wrapper.scrollLeft,
                st: wrapper.scrollTop
            };
        } else if (e.touches.length === 2) {
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && touchStartData) {
            wrapper.scrollLeft = touchStartData.sl - (e.touches[0].clientX - touchStartData.x);
            wrapper.scrollTop = touchStartData.st - (e.touches[0].clientY - touchStartData.y);
        } else if (e.touches.length === 2) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            mallaZoom((dist - lastPinchDist) * 0.003);
            lastPinchDist = dist;
        }
    }, { passive: false });
}

function findNearbyMark(x, y, radius) {
    for (const key of Object.keys(mallaMarks)) {
        const [mx, my] = key.split('_').map(Number);
        if (Math.hypot(x - mx, y - my) <= radius) return key;
    }
    return null;
}

// ---- Zoom ----
function mallaZoom(delta) {
    mallaScale = Math.min(4, Math.max(0.5, mallaScale + delta));
    const label = document.getElementById('mallaZoomLevel');
    if (label) label.textContent = Math.round(mallaScale * 100) + '%';
    renderMallaPage(mallaCurrentPage);
}

function mallaZoomIn() { mallaZoom(0.25); }
function mallaZoomOut() { mallaZoom(-0.25); }

function mallaZoomFit() {
    const wrapper = document.getElementById('mallaCanvasWrapper');
    if (!mallaPdfDoc || !wrapper) return;
    mallaPdfDoc.getPage(mallaCurrentPage).then(page => {
        const vp = page.getViewport({ scale: 1 });
        mallaScale = (wrapper.clientWidth - 40) / vp.width;
        const label = document.getElementById('mallaZoomLevel');
        if (label) label.textContent = Math.round(mallaScale * 100) + '%';
        renderMallaPage(mallaCurrentPage);
    });
}

// ---- Herramienta activa ----
let mallaCurrentTool = 'completed';

function setMallaTool(tool) {
    mallaCurrentTool = tool;
    updateMallaToolbar();
    const overlay = document.getElementById('mallaOverlay');
    if (overlay) overlay.style.cursor = tool === 'erase' ? 'not-allowed' : 'crosshair';
}

function updateMallaToolbar() {
    ['completed', 'current', 'erase'].forEach(t => {
        const btn = document.getElementById(`mallaTool_${t}`);
        if (btn) btn.classList.toggle('active', t === mallaCurrentTool);
    });
}

// ---- Persistencia de marcas ----
function saveMallaMarks() {
    localStorage.setItem('mallaMarks', JSON.stringify(mallaMarks));
    if (currentUser) {
        db.collection('users').doc(currentUser.uid)
            .set({ mallaMarks }, { merge: true })
            .catch(console.error);
    }
}

function loadMallaMarks() {
    const local = localStorage.getItem('mallaMarks');
    if (local) {
        try { mallaMarks = JSON.parse(local); } catch { mallaMarks = {}; }
    }
}

function clearAllMallaMarks() {
    if (!confirm('¿Borrar todas las marcas de la malla?')) return;
    mallaMarks = {};
    saveMallaMarks();
    redrawOverlay();
    updateMallaStats();
}

// ---- Estadísticas rápidas ----
function updateMallaStats() {
    const completed = Object.values(mallaMarks).filter(m => m && m.state === 'completed').length;
    const current = Object.values(mallaMarks).filter(m => m && m.state === 'current').length;
    const el = document.getElementById('mallaStatsText');
    if (el) el.textContent = `✅ ${completed} completadas  •  ▶ ${current} en curso`;
}