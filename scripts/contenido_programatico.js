// ============================================
// CONTENIDO PROGRAMÁTICO — contenido_programatico.js
// Versión dinámica: el usuario carga su propio CSV
// Compatible con SPA UNAL (script.js, grades.js, chat.js)
// ============================================

// ── Estado global ────────────────────────────────────────────────────────────
let contenidoProgramaticoData = [];   // Array de objetos parseados del CSV

// ── Normalización ────────────────────────────────────────────────────────────
function cpNorm(str) {
    return (str || '').toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ü/g, 'u').replace(/ñ/g, 'n');
}

// ── Persistencia local (localStorage) ───────────────────────────────────────
function saveCPToStorage() {
    try {
        localStorage.setItem('contenidoProgramatico', JSON.stringify(contenidoProgramaticoData));
    } catch (e) {
        console.warn('No se pudo guardar CP en localStorage (¿muy grande?):', e);
    }
}

function loadCPFromStorage() {
    try {
        const s = localStorage.getItem('contenidoProgramatico');
        if (s) contenidoProgramaticoData = JSON.parse(s);
    } catch { contenidoProgramaticoData = []; }
}

// ── Persistencia Firestore ───────────────────────────────────────────────────
async function saveCPToFirestore() {
    if (typeof currentUser === 'undefined' || !currentUser) return;
    try {
        await db.collection('users').doc(currentUser.uid)
            .set({ contenidoProgramatico: contenidoProgramaticoData }, { merge: true });
    } catch (e) {
        console.error('Error guardando CP en Firestore:', e);
    }
}

function loadCPFromFirestore(data) {
    if (data && data.contenidoProgramatico && data.contenidoProgramatico.length > 0) {
        contenidoProgramaticoData = data.contenidoProgramatico;
        saveCPToStorage();
    }
}

// ── Parseo del CSV ───────────────────────────────────────────────────────────
// Detecta automáticamente las columnas por su encabezado.
// Columnas esperadas (sin distinción de mayúsculas/tildes):
//   código, nombre, créditos, tipología, descripción, contenido, semestre, uab
function parseCPCSV(csvText) {
    return new Promise((resolve, reject) => {
        if (typeof Papa === 'undefined') {
            reject(new Error('PapaParse no disponible'));
            return;
        }

        Papa.parse(csvText, {
            header: false,
            skipEmptyLines: false,
            complete: (results) => {
                const rows = results.data;
                if (!rows || rows.length < 2) { resolve([]); return; }

                // Buscar la fila de encabezados (la primera que tenga "código" o "code")
                let headerIdx = -1;
                let colMap = {};

                for (let i = 0; i < Math.min(rows.length, 5); i++) {
                    const row = rows[i].map(c => cpNorm(c || ''));
                    const codeCol = row.findIndex(c =>
                        c.includes('odigo') || c === 'code' || c.includes('cod.')
                    );
                    if (codeCol >= 0) {
                        headerIdx = i;
                        // Mapear columnas por nombre
                        row.forEach((cell, j) => {
                            if (cell.includes('odigo') || cell === 'code') colMap.code = j;
                            else if (cell.includes('ombre')) colMap.name = j;
                            else if (cell.includes('edit') || cell.includes('cr')) colMap.credits = j;
                            else if (cell.includes('polog') || cell.includes('tipo')) colMap.type = j;
                            else if (cell.includes('escri') || cell.includes('desc')) colMap.description = j;
                            else if (cell.includes('onten')) colMap.content = j;
                            else if (cell.includes('emes') || cell.includes('sem')) colMap.semester = j;
                            else if (cell.includes('nidad') || cell.includes('uab') || cell.includes('escue')) colMap.uab = j;
                        });
                        break;
                    }
                }

                // Fallback: asumir orden fijo si no se encontró encabezado
                if (headerIdx === -1) {
                    headerIdx = 0;
                    colMap = { code: 0, name: 1, credits: 2, type: 3, description: 4, content: 5, semester: 6, uab: 7 };
                }

                // Índice por código para búsqueda rápida
                const parsed = [];
                for (let i = headerIdx + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.every(c => !c || !c.toString().trim())) continue;

                    const code = (row[colMap.code] || '').toString().trim();
                    const name = (row[colMap.name] || '').toString().trim();
                    const credits = (row[colMap.credits] || '').toString().trim();
                    const type = (row[colMap.type] || '').toString().trim();
                    const desc = (row[colMap.description] || '').toString().trim();
                    const content = (row[colMap.content] || '').toString().trim();
                    const sem = (row[colMap.semester] || '').toString().trim();
                    const uab = (row[colMap.uab] || '').toString().trim();

                    if (!name && !code) continue;

                    parsed.push({ code, name, credits, type, description: desc, content, semester: sem, uab });
                }

                resolve(parsed);
            },
            error: (err) => reject(err)
        });
    });
}

// ── Búsquedas ────────────────────────────────────────────────────────────────
function cpFindSubject(query) {
    const q = cpNorm(query);
    return contenidoProgramaticoData.find(s =>
        s.code === query ||
        cpNorm(s.name).includes(q) ||
        cpNorm(s.description).includes(q)
    ) || null;
}

function cpSearchSubjects(query) {
    const q = cpNorm(query);
    return contenidoProgramaticoData.filter(s =>
        cpNorm(s.name).includes(q) ||
        s.code.includes(q) ||
        cpNorm(s.type).includes(q) ||
        cpNorm(s.description).includes(q) ||
        cpNorm(s.content).includes(q)
    );
}

// ── Contexto para el chat IA ─────────────────────────────────────────────────
function buildContenidoContext() {
    if (!contenidoProgramaticoData.length) return null;
    return contenidoProgramaticoData.map(s => ({
        code: s.code,
        name: s.name,
        credits: s.credits,
        type: s.type,
        semester: s.semester,
        description: (s.description || '').slice(0, 200),
        contentSummary: (s.content || '').slice(0, 300)
    }));
}

// ── Badge de tipología ────────────────────────────────────────────────────────
function cpTypeBadge(type) {
    const t = cpNorm(type || '');
    if (t.includes('disc') && t.includes('oblig')) return 'type-disciplinar-obligatoria';
    if (t.includes('disc') && t.includes('optati')) return 'type-disciplinar-optativa';
    if (t.includes('fund') && t.includes('oblig')) return 'type-fundamentacion-obligatoria';
    if (t.includes('fund') && t.includes('optati')) return 'type-fundamentacion-optativa';
    if (t.includes('libre')) return 'type-libre-eleccion';
    if (t.includes('grado')) return 'type-trabajo-grado';
    if (t.includes('nivel')) return 'type-nivelacion';
    return 'type-disciplinar-obligatoria';
}

// ── MODAL DE DETALLE ──────────────────────────────────────────────────────────
function cpShowModal(code) {
    const s = contenidoProgramaticoData.find(x =>
        x.code && code &&
        x.code.trim().toLowerCase() === code.trim().toLowerCase()
    );
    if (!s) return;

    let modal = document.getElementById('cpDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cpDetailModal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:720px;">
                <div class="modal-header">
                    <h3 class="modal-title" id="cpModalTitle">—</h3>
                    <button class="close-btn" onclick="cpCloseModal()">&times;</button>
                </div>
                <div id="cpModalBody"></div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', e => { if (e.target === modal) cpCloseModal(); });
    }

    document.getElementById('cpModalTitle').textContent = s.name;
    document.getElementById('cpModalBody').innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
            <span class="type-badge ${cpTypeBadge(s.type)}">${s.type || 'Sin tipología'}</span>
            ${s.code ? `<span style="font-size:0.82rem;color:var(--text-secondary);">Código: <strong>${s.code}</strong></span>` : ''}
            ${s.credits ? `<span style="font-size:0.82rem;color:var(--text-secondary);">${s.credits} créditos</span>` : ''}
            ${s.semester && s.semester !== 'N/A' ? `<span style="font-size:0.82rem;color:var(--text-secondary);">Semestre ${s.semester}</span>` : ''}
        </div>

        ${s.description ? `
        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px;margin-bottom:14px;border-left:4px solid var(--unal-green);">
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.05em;margin-bottom:6px;">Descripción</div>
            <p style="font-size:0.88rem;line-height:1.65;color:var(--text-primary);white-space:pre-wrap;">${s.description}</p>
        </div>` : ''}

        ${s.content ? `
        <div style="background:var(--bg-secondary);border-radius:8px;padding:14px;border-left:4px solid var(--unal-blue);">
            <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.05em;margin-bottom:6px;">Contenido programático</div>
            <p style="font-size:0.85rem;line-height:1.7;color:var(--text-primary);white-space:pre-wrap;">${s.content}</p>
        </div>` : ''}

        ${s.uab ? `<p style="font-size:0.72rem;color:var(--text-secondary);margin-top:14px;">📍 ${s.uab}</p>` : ''}`;

    modal.style.display = 'flex';
    modal.style.alignItems = 'flex-start';
    modal.style.justifyContent = 'center';
    modal.style.padding = '2vh 0';
}

function cpCloseModal() {
    const m = document.getElementById('cpDetailModal');
    if (m) m.style.display = 'none';
}

// ── Render de tarjetas ────────────────────────────────────────────────────────
function renderContenidoView() {
    const container = document.getElementById('contenidoViewContainer');
    if (!container) return;

    if (!contenidoProgramaticoData.length) {
        container.innerHTML = `
            <div class="cp-empty-state">
                <div style="font-size:3.5rem;margin-bottom:16px;">📂</div>
                <h3>Aún no has cargado tu contenido programático</h3>
                <p>Sube un archivo CSV con las columnas:<br>
                <strong>Código, Nombre, Créditos, Tipología, Descripción, Contenido, Semestre, UAB</strong></p>
                <button class="btn btn-primary" style="margin-top:16px;"
                    onclick="document.getElementById('cpCsvInput').click()">
                    📁 Cargar CSV de contenido programático
                </button>
            </div>`;
        return;
    }

    const searchVal = (document.getElementById('cpSearch') || {}).value || '';
    const semFilter = (document.getElementById('cpSemFilter') || {}).value || 'all';
    const typeFilter = (document.getElementById('cpTypeFilter') || {}).value || 'all';

    // ── Construir grupos desde studyPlan (igual que la malla) ──────────────
    // Índice rápido del CSV por código y por nombre normalizado
    const cpByCode = {};
    const cpByName = {};
    contenidoProgramaticoData.forEach(s => {
        if (s.code) cpByCode[s.code.trim()] = s;
        if (s.name) cpByName[cpNorm(s.name)] = s;
    });

    // Si studyPlan existe y tiene materias, agrupar por sus semestres
    const hasPlan = typeof studyPlan !== 'undefined' &&
        Object.keys(studyPlan).some(k => studyPlan[k].subjects && studyPlan[k].subjects.length);

    let groups = {};   // { 'Semestre 1': [cpEntry, ...], ... }

    if (hasPlan) {
        const semNums = Object.keys(studyPlan)
            .filter(n => studyPlan[n].subjects && studyPlan[n].subjects.length > 0)
            .sort((a, b) => +a - +b);

        semNums.forEach(semNum => {
            const key = `Semestre ${semNum}`;
            studyPlan[semNum].subjects.forEach(subj => {
                // Buscar la entrada en el CSV: primero por código, luego por nombre
                let cpEntry = (subj.code && cpByCode[subj.code.trim()])
                    || cpByName[cpNorm(subj.name)]
                    || null;

                // Si no hay entrada en el CSV, crear una mínima con los datos del plan
                if (!cpEntry) {
                    cpEntry = {
                        code: subj.code || '',
                        name: subj.name,
                        credits: subj.credits || '',
                        type: subj.type || '',
                        description: '',
                        content: '',
                        semester: semNum,
                        uab: ''
                    };
                }

                if (!groups[key]) groups[key] = [];
                groups[key].push(cpEntry);
            });
        });

        // Materias del CSV sin semestre en studyPlan → "Sin asignar"
        contenidoProgramaticoData.forEach(s => {
            const enPlan = Object.values(studyPlan).some(sem =>
                sem.subjects && sem.subjects.some(subj =>
                    (subj.code && s.code && subj.code.trim() === s.code.trim()) ||
                    cpNorm(subj.name) === cpNorm(s.name)
                )
            );
            if (!enPlan) {
                const key = 'Sin asignar en malla';
                if (!groups[key]) groups[key] = [];
                groups[key].push(s);
            }
        });
    } else {
        // Fallback: agrupar por campo semester del CSV
        contenidoProgramaticoData.forEach(s => {
            const key = (s.semester && s.semester !== 'N/A' && s.semester.trim() !== '')
                ? `Semestre ${s.semester}`
                : 'Electivas / Sin semestre';
            if (!groups[key]) groups[key] = [];
            groups[key].push(s);
        });
    }

    // ── Aplicar filtros de búsqueda/semestre/tipo ──────────────────────────
    if (semFilter !== 'all') {
        const keep = `Semestre ${semFilter}`;
        groups = Object.fromEntries(Object.entries(groups).filter(([k]) => k === keep));
    }

    Object.keys(groups).forEach(k => {
        let arr = groups[k];
        if (searchVal.trim()) {
            const q = cpNorm(searchVal.trim());
            arr = arr.filter(s =>
                cpNorm(s.name).includes(q) ||
                (s.code && s.code.includes(searchVal.trim())) ||
                cpNorm(s.description).includes(q) ||
                cpNorm(s.content).includes(q)
            );
        }
        if (typeFilter !== 'all') arr = arr.filter(s => s.type === typeFilter);
        if (arr.length) groups[k] = arr;
        else delete groups[k];
    });

    if (Object.keys(groups).length === 0) {
        container.innerHTML = `<div class="no-data"><p>No se encontraron asignaturas con esos criterios.</p></div>`;
        return;
    }

    const semOrder = k => {
        if (k.startsWith('Semestre')) return parseInt(k.replace('Semestre ', '')) || 99;
        if (k === 'Sin asignar en malla') return 98;
        return 100;
    };

    container.innerHTML = Object.entries(groups)
        .sort(([a], [b]) => semOrder(a) - semOrder(b))
        .map(([group, subs]) => `
            <div class="cp-group">
                <div class="cp-group-title">
                    ${group}
                    <span class="cp-group-count">${subs.length} asignaturas</span>
                </div>
                <div class="cp-cards-grid">
                    ${subs.map(s => `
                        <div class="cp-card" onclick="cpShowModal('${(s.code || s.name).replace(/'/g, "\\'")}')">
                            <div class="cp-card-top">
                                <span class="type-badge ${cpTypeBadge(s.type)}">${s.type || '—'}</span>
                                ${s.credits ? `<span class="cp-credits">${s.credits} cr</span>` : ''}
                            </div>
                            <div class="cp-card-name">${s.name}</div>
                            ${s.code ? `<div class="cp-card-code">${s.code}</div>` : ''}
                            ${s.description
                ? `<div class="cp-card-desc">${s.description.slice(0, 120)}${s.description.length > 120 ? '…' : ''}</div>`
                : '<div class="cp-card-desc" style="color:var(--text-secondary);font-style:italic;font-size:0.75rem;">Sin descripción en CSV</div>'}
                            <div class="cp-card-footer">📖 Ver contenido</div>
                        </div>`).join('')}
                </div>
            </div>`).join('');
}

// ── Inicialización de la vista ────────────────────────────────────────────────
function initContenidoView() {
    loadCPFromStorage();
    injectCpStyles();

    const root = document.getElementById('contenidoView');
    if (!root) return;

    // Construir header si no existe
    let header = document.getElementById('cpHeader');
    if (header) {
        // Ya existe: solo actualizar filtros y render
        _updateCpFilters();
        renderContenidoView();
        return;
    }

    header = document.createElement('div');
    header.id = 'cpHeader';
    root.appendChild(header);

    _buildCpHeader(header);
    renderContenidoView();
}

function _buildCpHeader(header) {
    const total = contenidoProgramaticoData.length;
    const sems = [...new Set(contenidoProgramaticoData.map(s => s.semester).filter(s => s && s !== 'N/A' && s.trim()))]
        .sort((a, b) => +a - +b);
    const types = [...new Set(contenidoProgramaticoData.map(s => s.type).filter(Boolean))].sort();

    header.innerHTML = `
        <div class="header-bar">
            <div class="header-controls">
                <div>
                    <h2 style="margin-bottom:4px;">Contenido Programático</h2>
                    <p class="text-secondary" style="font-size:0.85rem;" id="cpSubtitle">
                        ${total ? `${total} asignaturas cargadas` : 'Sube tu CSV para consultar el contenido de cada materia'}
                    </p>
                </div>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <button class="btn btn-primary" onclick="document.getElementById('cpCsvInput').click()">
                        📁 ${total ? 'Reemplazar CSV' : 'Cargar CSV'}
                    </button>
                    ${total ? `<button class="btn btn-danger btn-sm" onclick="cpClearData()">🗑 Borrar datos</button>` : ''}
                </div>
            </div>
        </div>

        <!-- Input oculto para CSV -->
        <input type="file" id="cpCsvInput" accept=".csv" style="display:none">

        ${total ? `
        <div class="cp-stat-bar">
            <span class="cp-stat-pill"><strong>${total}</strong> asignaturas</span>
            <span class="cp-stat-pill"><strong>${sems.length}</strong> semestres</span>
            <span class="cp-stat-pill"><strong>${types.length}</strong> tipologías</span>
        </div>
        <div class="cp-search-bar">
            <input type="text" id="cpSearch" placeholder="🔍 Buscar por nombre, código o contenido..."
                oninput="renderContenidoView()">
            <select id="cpSemFilter" onchange="renderContenidoView()">
                <option value="all">Todos los semestres</option>
                ${sems.map(s => `<option value="${s}">Semestre ${s}</option>`).join('')}
                ${contenidoProgramaticoData.some(s => !s.semester || s.semester === 'N/A' || !s.semester.trim())
                ? '<option value="N/A">Electivas / Sin semestre</option>' : ''}
            </select>
            <select id="cpTypeFilter" onchange="renderContenidoView()">
                <option value="all">Todas las tipologías</option>
                ${types.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
        </div>` : ''}

        <div id="contenidoViewContainer"></div>`;

    // Listener del input de CSV
    const input = header.querySelector('#cpCsvInput');
    if (input) {
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const btn = header.querySelector('.btn-primary');
            if (btn) { btn.textContent = '⏳ Procesando...'; btn.disabled = true; }

            try {
                const text = await file.text();
                const parsed = await parseCPCSV(text);

                if (!parsed.length) {
                    alert('⚠️ No se encontraron asignaturas en el CSV. Revisa que tenga encabezados con: Código, Nombre, Créditos, Tipología, etc.');
                    return;
                }

                contenidoProgramaticoData = parsed;
                saveCPToStorage();
                saveCPToFirestore();

                // Reconstruir el header con los nuevos datos
                header.innerHTML = '';
                _buildCpHeader(header);
                renderContenidoView();

                alert(`✅ ${parsed.length} asignaturas cargadas correctamente.`);
            } catch (err) {
                console.error('Error al parsear CP:', err);
                alert('❌ Error al leer el archivo: ' + err.message);
            } finally {
                if (btn) { btn.disabled = false; }
                e.target.value = '';
            }
        });
    }
}

function _updateCpFilters() {
    // Actualizar subtítulo
    const sub = document.getElementById('cpSubtitle');
    if (sub) sub.textContent = contenidoProgramaticoData.length
        ? `${contenidoProgramaticoData.length} asignaturas cargadas`
        : 'Sube tu CSV para consultar el contenido de cada materia';
}

function cpClearData() {
    if (!confirm('¿Borrar el contenido programático cargado? Podrás subir uno nuevo.')) return;
    contenidoProgramaticoData = [];
    localStorage.removeItem('contenidoProgramatico');
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid)
            .set({ contenidoProgramatico: [] }, { merge: true })
            .catch(console.error);
    }
    // Reconstruir la vista
    const header = document.getElementById('cpHeader');
    if (header) { header.innerHTML = ''; _buildCpHeader(header); }
    renderContenidoView();
}

// ── Estilos CSS inyectados ────────────────────────────────────────────────────
function injectCpStyles() {
    if (document.getElementById('cpStyles')) return;
    const style = document.createElement('style');
    style.id = 'cpStyles';
    style.textContent = `
/* ── Contenido Programático view ── */
.cp-empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-secondary);
    background: var(--bg-secondary);
    border-radius: 12px;
    border: 2px dashed var(--border-color);
    margin-top: 8px;
}
.cp-empty-state h3 { color: var(--text-primary); margin-bottom: 10px; }
.cp-empty-state p  { font-size: 0.9rem; line-height: 1.6; }

.cp-search-bar {
    display: flex; gap: 10px; flex-wrap: wrap;
    margin-bottom: 20px;
}
.cp-search-bar input, .cp-search-bar select {
    flex: 1; min-width: 160px;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-size: 0.88rem;
}
.cp-search-bar input:focus, .cp-search-bar select:focus {
    outline: none; border-color: var(--unal-green);
}
.cp-group { margin-bottom: 28px; }
.cp-group-title {
    font-weight: 700; font-size: 1rem;
    color: var(--unal-green);
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 2px solid var(--unal-green);
    display: flex; align-items: center; gap: 10px;
}
.cp-group-count {
    font-size: 0.75rem; font-weight: 500;
    background: rgba(46,125,50,0.1);
    padding: 2px 8px; border-radius: 10px;
    color: var(--unal-green);
}
.cp-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
}
.cp-card {
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 14px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex; flex-direction: column; gap: 6px;
    box-shadow: var(--shadow-light);
}
.cp-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-medium);
    border-color: var(--unal-green);
}
.cp-card-top {
    display: flex; justify-content: space-between; align-items: flex-start; gap: 6px;
}
.cp-credits {
    font-size: 0.78rem; font-weight: 700;
    color: var(--unal-blue);
    white-space: nowrap;
    background: rgba(25,118,210,0.08);
    padding: 2px 7px; border-radius: 10px;
    flex-shrink: 0;
}
.cp-card-name {
    font-weight: 700; font-size: 0.88rem;
    color: var(--text-primary); line-height: 1.3;
}
.cp-card-code {
    font-size: 0.72rem; color: var(--text-secondary);
    font-family: monospace;
}
.cp-card-desc {
    font-size: 0.78rem; color: var(--text-secondary);
    line-height: 1.5; flex: 1;
}
.cp-card-footer {
    font-size: 0.74rem; color: var(--unal-green);
    font-weight: 600; margin-top: 4px;
}
.cp-stat-bar {
    display: flex; gap: 12px; flex-wrap: wrap;
    margin-bottom: 16px;
}
.cp-stat-pill {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 20px;
    padding: 4px 14px;
    font-size: 0.78rem; color: var(--text-secondary);
}
.cp-stat-pill strong { color: var(--unal-green); }
@media (max-width: 600px) {
    .cp-cards-grid { grid-template-columns: 1fr; }
    .cp-search-bar { flex-direction: column; }
}`;
    document.head.appendChild(style);
}

// ── Auto-carga al iniciar la app ──────────────────────────────────────────────
(function initCPModule() {
    loadCPFromStorage();
})();
