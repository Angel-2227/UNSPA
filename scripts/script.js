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

    // Reemplazar window.onclick por addEventListener para no sobrescribir otros handlers
    window.addEventListener('click', function (event) {
        const subjectModal = document.getElementById('subjectModal');
        const typologyModal = document.getElementById('typologySubjectsModal');
        const currentScheduleModal = document.getElementById('currentScheduleModal');

        if (event.target === subjectModal) closeSubjectModal();
        if (event.target === typologyModal) closeTypologyModal();
        if (event.target === currentScheduleModal) closeCurrentScheduleModal();
    });
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

    // FIX: Leer el total de créditos exigidos directamente del CSV
    // Busca la fila con "TOTAL DE CRÉDITOS EXIGIDOS AL ESTUDIANTE"
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

    // FIX: Eliminar semestres vacíos para no guardar datos innecesarios en Firestore
    Object.keys(studyPlan).forEach(key => {
        if (studyPlan[key].subjects.length === 0) {
            delete studyPlan[key];
        }
    });

    // FIX: Si no se encontró el total en el CSV, sumar manualmente
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
    saveConfig(false); // false = no mostrar alerta
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
}

function updateStats() {
    let completedCredits = 0;
    let currentCredits = 0;

    Object.values(studyPlan).forEach(semester => {
        const semesterCredits = semester.subjects.reduce((sum, s) => sum + s.credits, 0);
        if (semester.status === 'completed') completedCredits += semesterCredits;
        else if (semester.status === 'current') currentCredits += semesterCredits;
    });

    const total = config.totalCredits || 1; // evitar división por cero
    const pendingCredits = Math.max(0, total - completedCredits - currentCredits);
    const progressPercentage = Math.round((completedCredits / total) * 100);

    document.getElementById('totalCredits').textContent = config.totalCredits;
    document.getElementById('completedCredits').textContent = completedCredits;
    document.getElementById('currentCredits').textContent = currentCredits;
    document.getElementById('pendingCredits').textContent = pendingCredits;
    document.getElementById('progressPercentage').textContent = progressPercentage + '%';
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

    if (window.innerWidth <= 768) {
        return `<div class="subjects-cards-mobile">
            ${subjects.map((subject, index) => createSubjectCard(subject, semesterNum, index)).join('')}
        </div>`;
    }

    return `
        <table class="subjects-table">
            <thead>
                <tr>
                    <th>Materia</th>
                    <th>Tipo</th>
                    <th>Créditos</th>
                    <th>Código</th>
                    <th>Profesor</th>
                    <th>Grupo</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${subjects.map((subject, index) => createSubjectRow(subject, semesterNum, index)).join('')}
            </tbody>
        </table>`;
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
                        <input type="text" class="form-control" value="${subject.code || ''}"
                               onchange="updateSubjectField(${semesterNum}, ${index}, 'code', this.value)"
                               placeholder="Código">
                    </div>
                    <div class="info-item">
                        <label>Profesor:</label>
                        <input type="text" class="form-control" value="${subject.professor || ''}"
                               onchange="updateSubjectField(${semesterNum}, ${index}, 'professor', this.value)"
                               placeholder="Profesor">
                    </div>
                    <div class="info-item">
                        <label>Grupo:</label>
                        <input type="text" class="form-control" value="${subject.group || ''}"
                               onchange="updateSubjectField(${semesterNum}, ${index}, 'group', this.value)"
                               placeholder="Grupo">
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

    // FIX: Guardar localmente de inmediato, pero diferir Firestore con debounce
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

    const filteredSubjects = subjectBank.filter(subject =>
        subject.name.toLowerCase().includes(searchTerm) ||
        subject.type.toLowerCase().includes(searchTerm)
    );

    if (filteredSubjects.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No se encontraron materias</p></div>';
        return;
    }

    container.innerHTML = filteredSubjects.map(subject => `
        <div class="subject-item">
            <div class="subject-info">
                <h4>${subject.name}</h4>
                <p><span class="type-badge ${getTypeClass(subject.type)}">${subject.type}</span> • ${subject.credits} créditos</p>
            </div>
            <div>
                <button class="btn btn-primary btn-sm" onclick="editBankSubject('${subject.id}')">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="deleteBankSubject('${subject.id}')">🗑️</button>
            </div>
        </div>`).join('');
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
    typologyTypes.forEach(type => { typologyStats[type] = { credits: 0, count: 0 }; });

    Object.values(studyPlan).forEach(semester => {
        if (semester.subjects) {
            semester.subjects.forEach(subject => {
                if (typologyStats[subject.type]) {
                    typologyStats[subject.type].credits += subject.credits;
                    typologyStats[subject.type].count += 1;
                }
            });
        }
    });

    container.innerHTML = typologyTypes.map(type => {
        const stats = typologyStats[type];
        return `
            <div class="typology-card" onclick="showTypologySubjects('${type}')">
                <div class="typology-name">
                    <span class="type-badge ${getTypeClass(type)}" style="display: inline-block; margin-bottom: 4px;">
                        ${type}
                    </span>
                </div>
                <div class="typology-stats">
                    <div class="typology-credits">${stats.credits}</div>
                    <div class="typology-count">${stats.count} materias</div>
                </div>
            </div>`;
    }).join('');
}

function showTypologySubjects(typologyType) {
    const modal = document.getElementById('typologySubjectsModal');
    const title = document.getElementById('typologyModalTitle');
    const container = document.getElementById('typologySubjectsContainer');

    title.textContent = `Materias: ${typologyType}`;

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
        container.innerHTML = `
            <div style="margin-bottom: 16px;">
                <strong>Total: ${typologySubjects.length} materias | ${typologySubjects.reduce((sum, s) => sum + s.credits, 0)} créditos</strong>
            </div>
            <table class="subjects-table">
                <thead>
                    <tr>
                        <th>Materia</th>
                        <th>Créditos</th>
                        <th>Semestre</th>
                        <th>Estado</th>
                        <th>Código</th>
                        <th>Profesor</th>
                    </tr>
                </thead>
                <tbody>
                    ${typologySubjects.map(subject => `
                        <tr>
                            <td><strong>${subject.name}</strong></td>
                            <td>${subject.credits}</td>
                            <td>${subject.semester}</td>
                            <td><span class="type-badge status-${subject.status}">${getStatusLabel(subject.status)}</span></td>
                            <td>${subject.code || '-'}</td>
                            <td>${subject.professor || '-'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    }

    modal.style.display = 'block';
}

function closeTypologyModal() {
    document.getElementById('typologySubjectsModal').style.display = 'none';
}

// ============================================
// NAVEGACIÓN
// ============================================

// FIX: showView recibe el elemento clicado explícitamente
function showView(viewName, clickedEl) {
    document.querySelectorAll('.view-content').forEach(view => {
        view.style.display = 'none';
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const targetView = document.getElementById(viewName + 'View');
    if (targetView) targetView.style.display = 'block';

    // Marcar activo: usar el elemento pasado o buscar por viewName
    if (clickedEl) {
        clickedEl.classList.add('active');
    } else {
        // Si se llama programáticamente, buscar el nav-item correspondiente
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(`'${viewName}'`)) {
                item.classList.add('active');
            }
        });
    }

    currentView = viewName;
    closeSidebar();

    if (viewName === 'subjects') renderSubjectsBank();
    else if (viewName === 'config') renderTypologies();
    else if (viewName === 'schedule') {
        renderSchedules();
        loadPeriodConfig();
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

// FIX: saveConfig unificada, con parámetro para controlar la alerta
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

        studyPlan = {};
        subjectBank = [];
        schedules = [];
        config = { programName: '', university: '', totalCredits: 0, creditsByType: {} };

        const csvInput = document.getElementById('csvFile');
        if (csvInput) csvInput.value = '';

        // Limpiar también en Firestore
        if (currentUser) {
            db.collection('users').doc(currentUser.uid).delete().catch(console.error);
        }

        location.reload();
    }
}

// ============================================
// GUARDADO LOCAL (funciones privadas base)
// ============================================

function _saveDataLocal() {
    localStorage.setItem('academicPlannerData', JSON.stringify(studyPlan));
}

function _saveSubjectBankLocal() {
    localStorage.setItem('academicPlannerSubjects', JSON.stringify(subjectBank));
}

// ============================================
// FUNCIONES DE GUARDADO PÚBLICAS (con Firestore)
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
    const data = {
        studyPlan,
        subjectBank,
        config,
        exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plan_estudios_${config.programName}_${new Date().toISOString().split('T')[0]}.json`;
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
// HORARIOS
// ============================================

function updateScheduleButton() {
    const btn = document.getElementById('viewScheduleBtn');
    if (btn) btn.style.display = schedules.length > 0 ? 'inline-flex' : 'none';
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

function uploadHorarios() {
    document.getElementById('horariosFile').click();
}

function normalizeString(str) {
    return str.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, '')
        .trim();
}

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
            bankSubject.horariosInfo = horarioMateria.grupos;

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
        }
    });

    saveData();
    saveSubjectBank();
    updateUI();
    console.log(`✅ Actualizadas: ${updated} | ⚠️ No encontradas en banco: ${notFound}`);
}

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

function createNewSchedule() {
    if (horariosData.length === 0) {
        alert('⚠️ Primero debes cargar el archivo de horarios');
        return;
    }
    currentEditingSchedule = null;
    document.getElementById('scheduleName').value = `Horario ${currentPeriodConfig.period || ''}`;
    renderSubjectSelector();
    document.getElementById('scheduleModal').style.display = 'block';
}

function renderSubjectSelector() {
    const container = document.getElementById('subjectSelector');
    const availableSubjects = [];

    Object.entries(studyPlan).forEach(([semNum, semester]) => {
        if (semester.status === 'pending' || semester.status === 'current') {
            semester.subjects.forEach(subject => {
                if (subject.horariosInfo && subject.horariosInfo.length > 0) {
                    availableSubjects.push({ ...subject, semester: semNum });
                }
            });
        }
    });

    if (availableSubjects.length === 0) {
        container.innerHTML = '<p>No hay materias disponibles. Asegúrate de haber cargado los horarios.</p>';
        return;
    }

    container.innerHTML = availableSubjects.map(subject => `
        <div class="subject-select-card" id="subject-${subject.id}" onclick="toggleSubjectCard('${subject.id}')">
            <div class="subject-header-info">
                <div>
                    <strong>${subject.name}</strong>
                    <div style="font-size: 0.85rem; color: var(--text-secondary);">
                        Semestre ${subject.semester} • ${subject.credits} créditos • ${subject.code}
                    </div>
                </div>
                <span class="expand-icon" id="expand-${subject.id}">▼</span>
            </div>
            <div class="group-selector" id="groups-${subject.id}">
                ${subject.horariosInfo.map((grupo, idx) => `
                    <div class="group-option" onclick="event.stopPropagation(); selectGroup('${subject.id}', ${idx})">
                        <strong>Grupo ${grupo.numero}</strong><br>
                        <small>👨‍🏫 ${grupo.profesor}</small><br>
                        <small>📅 ${grupo.horarios.map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ')}</small>
                    </div>`).join('')}
            </div>
        </div>`).join('');
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

let selectedSubjects = {};

function selectGroup(subjectId, groupIndex) {
    const subjectCard = document.getElementById(`subject-${subjectId}`);
    const groupOptions = subjectCard.querySelectorAll('.group-option');

    if (selectedSubjects[subjectId] === groupIndex) {
        delete selectedSubjects[subjectId];
        subjectCard.classList.remove('selected');
        groupOptions[groupIndex].classList.remove('selected');
    } else {
        selectedSubjects[subjectId] = groupIndex;
        subjectCard.classList.add('selected');
        groupOptions.forEach(opt => opt.classList.remove('selected'));
        groupOptions[groupIndex].classList.add('selected');
    }

    updateSchedulePreview();
}

function updateSchedulePreview() {
    const preview = document.getElementById('schedulePreview');
    const allDays = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    const usedDays = new Set();

    Object.entries(selectedSubjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(h => usedDays.add(h.dia));
    });

    const days = usedDays.size > 0 ? allDays.filter(day => usedDays.has(day)) : allDays;

    let minHour = 18, maxHour = 7;
    Object.entries(selectedSubjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(h => {
            minHour = Math.min(minHour, parseInt(h.inicio.split(':')[0]));
            maxHour = Math.max(maxHour, parseInt(h.fin.split(':')[0]));
        });
    });

    const hours = Object.keys(selectedSubjects).length > 0
        ? Array.from({ length: maxHour - minHour }, (_, i) => minHour + i)
        : Array.from({ length: 14 }, (_, i) => 7 + i);

    let grid = `<div class="schedule-grid">`;
    grid += `<div class="schedule-cell header"></div>`;
    days.forEach(day => { grid += `<div class="schedule-cell header">${day}</div>`; });
    hours.forEach(hour => {
        grid += `<div class="schedule-cell time">${hour}:00</div>`;
        days.forEach(day => { grid += `<div class="schedule-cell" data-day="${day}" data-hour="${hour}"></div>`; });
    });
    grid += `</div>`;
    preview.innerHTML = grid;

    Object.entries(selectedSubjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        const grupo = subject.horariosInfo[groupIdx];
        grupo.horarios.forEach(horario => {
            const startHour = parseInt(horario.inicio.split(':')[0]);
            const endHour = parseInt(horario.fin.split(':')[0]);
            for (let h = startHour; h < endHour; h++) {
                const cell = preview.querySelector(`[data-day="${horario.dia}"][data-hour="${h}"]`);
                if (cell) {
                    cell.classList.add('class');
                    cell.innerHTML = `<div class="class-name">${subject.name}</div><div class="class-group">Grupo ${grupo.numero}</div>`;
                }
            }
        });
    });
}

function findSubjectById(id) {
    for (let semester of Object.values(studyPlan)) {
        const found = semester.subjects.find(s => s.id === id);
        if (found) return found;
    }
    return null;
}

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
        if (bankSubject) { bankSubject.group = grupo.numero.toString(); bankSubject.professor = grupo.profesor; }
    });

    saveData();
    saveSubjectBank();
    closeScheduleModal();
    renderSchedules();
    alert('✅ Horario guardado correctamente');
}

function renderSchedules() {
    const container = document.getElementById('schedulesContainer');
    if (!container) return;
    const saved = localStorage.getItem('savedSchedules');
    if (saved) schedules = JSON.parse(saved);

    if (schedules.length === 0) {
        container.innerHTML = '<div class="no-data"><p>No tienes horarios guardados</p></div>';
        updateScheduleButton();
        return;
    }

    container.innerHTML = schedules.map(schedule => `
        <div class="schedule-card">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                    <h3>${schedule.name}</h3>
                    <p style="color: var(--text-secondary);">Periodo: ${schedule.period}</p>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-sm" onclick="viewSchedule('${schedule.id}')">👁️ Ver</button>
                    <button class="btn btn-warning btn-sm" onclick="editSchedule('${schedule.id}')">✏️ Editar</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSchedule('${schedule.id}')">🗑️</button>
                </div>
            </div>
            <p><strong>${Object.keys(schedule.subjects).length}</strong> materias seleccionadas</p>
        </div>`).join('');

    updateScheduleButton();
}

function editSchedule(scheduleId) {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;
    selectedSubjects = { ...schedule.subjects };
    currentEditingSchedule = schedule;
    document.getElementById('scheduleName').value = schedule.name;
    renderSubjectSelector();
    updateSchedulePreview();
    document.getElementById('scheduleModal').style.display = 'block';
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

function deleteSchedule(scheduleId) {
    if (confirm('¿Eliminar este horario?')) {
        schedules = schedules.filter(s => s.id !== scheduleId);
        localStorage.setItem('savedSchedules', JSON.stringify(schedules));
        renderSchedules();
    }
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').style.display = 'none';
    selectedSubjects = {};
    currentEditingSchedule = null;
}

function renderCurrentScheduleView(schedule) {
    const container = document.getElementById('currentScheduleContent');
    const title = document.getElementById('currentScheduleTitle');
    title.textContent = schedule.name;

    const days = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
    let minHour = 20, maxHour = 7;

    Object.entries(schedule.subjects).forEach(([subjectId, groupIdx]) => {
        const subject = findSubjectById(subjectId);
        if (!subject || !subject.horariosInfo) return;
        subject.horariosInfo[groupIdx].horarios.forEach(horario => {
            minHour = Math.min(minHour, parseInt(horario.inicio.split(':')[0]));
            maxHour = Math.max(maxHour, parseInt(horario.fin.split(':')[0]));
        });
    });

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
            schedule_map[horario.dia][startHour] = { subject, grupo, duration, start: true };
            for (let h = startHour + 1; h < endHour; h++) {
                schedule_map[horario.dia][h] = { occupied: true };
            }
        });
    });

    const shortenProfessor = (name) => {
        if (!name) return '';
        const parts = name.trim().split(' ');
        return parts.length <= 2 ? name : `${parts[0]} ${parts[parts.length - 1]}`;
    };

    let grid = `<div class="schedule-grid-wrapper"><div class="schedule-grid-viewer">`;
    grid += `<div class="schedule-cell-viewer header"></div>`;
    days.forEach(day => { grid += `<div class="schedule-cell-viewer header" id="day-${day}">${day}</div>`; });

    hours.forEach(hour => {
        grid += `<div class="schedule-cell-viewer time" id="time-${hour}">${hour}:00</div>`;
        days.forEach(day => {
            const cell_data = schedule_map[day][hour];
            if (cell_data && cell_data.occupied) return;
            if (cell_data && cell_data.start) {
                const rowspan_style = cell_data.duration > 1 ? `grid-row: span ${cell_data.duration};` : '';
                grid += `<div class="schedule-cell-viewer class-block" style="${rowspan_style}"
                    data-day="${day}" data-hour="${hour}" data-duration="${cell_data.duration}">
                    <div class="class-block-name">${cell_data.subject.name}</div>
                    <div class="class-block-info">G${cell_data.grupo.numero} • ${shortenProfessor(cell_data.grupo.profesor)}</div>
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
    const headerControls = document.querySelector('.header-controls');
    if (headerControls && !document.getElementById('userInfo')) {
        const userInfoDiv = document.createElement('div');
        userInfoDiv.id = 'userInfo';
        userInfoDiv.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        userInfoDiv.innerHTML = `
            <img src="${currentUser.photoURL}" alt="User" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--unal-green);">
            <div style="text-align: left;">
                <div style="font-weight: 600; font-size: 0.9rem;">${currentUser.displayName}</div>
                <button onclick="logout()" style="font-size: 0.75rem; color: var(--unal-red); background: none; border: none; cursor: pointer; padding: 0;">
                    Cerrar sesión
                </button>
            </div>`;
        headerControls.appendChild(userInfoDiv);
    }
}

async function loadUserDataFromFirestore() {
    if (!currentUser) return;
    try {
        const docRef = db.collection('users').doc(currentUser.uid);
        const doc = await docRef.get();

        if (doc.exists) {
            const data = doc.data();
            if (data.studyPlan) studyPlan = data.studyPlan;
            if (data.subjectBank) subjectBank = data.subjectBank;
            if (data.config) config = { ...config, ...data.config };
            if (data.schedules) schedules = data.schedules;
            if (data.currentPeriodConfig) currentPeriodConfig = data.currentPeriodConfig;
            console.log('✅ Datos cargados desde Firestore');
        } else {
            console.log('⚠️ Primera vez del usuario, intentando migrar desde localStorage...');
            await migrateFromLocalStorage();
        }

        updateUI();
    } catch (error) {
        console.error('Error cargando datos de Firestore:', error);
        // FIX: Fallback a localStorage si Firestore falla (sin internet, etc.)
        console.warn('⚠️ Usando datos locales como fallback...');
        loadData();
        initializeSubjectBank();
        loadConfig();
        updateUI();
    }
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
// DOMContentLoaded: cargar horarios file listener y schedules
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    updateScheduleButton();
    loadPeriodConfig();
    renderSchedules();

    // Listener para cargar archivo de horarios JSON
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