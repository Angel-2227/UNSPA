// ============================================
// MALLA CURRICULAR GENERADA — malla_curricular.js
// Las marcas se toman del estado real del studyPlan
// El PDF es solo lectura (sin marcas ni clics)
// ============================================

// Colores por tipología
const MALLA_TYPE_COLORS = {
    'DISCIPLINAR OBLIGATORIA': { bg: '#e3f2fd', border: '#1976d2', text: '#0d47a1' },
    'DISCIPLINAR OPTATIVA': { bg: '#e8f5e9', border: '#388e3c', text: '#1b5e20' },
    'FUNDAMENTACIÓN OBLIGATORIA': { bg: '#fff8e1', border: '#f9a825', text: '#e65100' },
    'FUNDAMENTACIÓN OPTATIVA': { bg: '#fce4ec', border: '#e91e63', text: '#880e4f' },
    'LIBRE ELECCIÓN': { bg: '#f3e5f5', border: '#7b1fa2', text: '#4a148c' },
    'TRABAJO DE GRADO': { bg: '#e8eaf6', border: '#3f51b5', text: '#1a237e' },
    'NIVELACIÓN': { bg: '#fff3e0', border: '#ff6f00', text: '#bf360c' },
};

// Prereqs configurables
let mallaPrereqs = {};
let mallaPrereqMode = false;
let mallaPrereqSource = null;
let selectedCardId = null;
let selectedCardSem = null;

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
            .set({ mallaPrereqs }, { merge: true }).catch(console.error);
    }
}

// ---- Inicialización ----
function initMallaGenerada() {
    loadMallaPrereqs();
    renderMallaGenerada();
}

// ---- Render ----
function renderMallaGenerada() {
    const container = document.getElementById('mallaGeneradaContainer');
    if (!container) return;

    // Inject card styles once
    if (!document.getElementById('mgcCardStyles')) {
        const s = document.createElement('style');
        s.id = 'mgcCardStyles';
        s.textContent = `
            .mgc-card {
                background: var(--tc-bg);
                border: 2px solid var(--tc-border);
                box-shadow: 0 2px 5px rgba(0,0,0,0.09);
            }
            .mgc-card--completed {
                border: 2.5px solid #2e7d32 !important;
                background: color-mix(in srgb, var(--tc-bg) 85%, #2e7d32 15%) !important;
            }
            .mgc-card--current {
                border: 2.5px solid #ffa000 !important;
                background: color-mix(in srgb, var(--tc-bg) 85%, #ffa000 15%) !important;
            }
            /* Dark mode: make sure card backgrounds stay visible */
            [data-theme="dark"] .mgc-card,
            .dark-mode .mgc-card,
            body.dark .mgc-card {
                background: color-mix(in srgb, var(--bg-secondary, #2a2a2a) 60%, var(--tc-border) 40%) !important;
                border-color: var(--tc-border) !important;
            }
            [data-theme="dark"] .mgc-card--completed,
            .dark-mode .mgc-card--completed,
            body.dark .mgc-card--completed {
                background: color-mix(in srgb, var(--bg-secondary, #2a2a2a) 55%, #2e7d32 45%) !important;
                border-color: #4caf50 !important;
            }
            [data-theme="dark"] .mgc-card--current,
            .dark-mode .mgc-card--current,
            body.dark .mgc-card--current {
                background: color-mix(in srgb, var(--bg-secondary, #2a2a2a) 55%, #ffa000 45%) !important;
                border-color: #ffb74d !important;
            }
            .mgc-card-name {
                font-size: 0.73rem;
                font-weight: 700;
                color: var(--text-primary);
                line-height: 1.25;
                position: relative;
            }
            .mgc-state-icon {
                margin-right: 3px;
                font-size: 0.8rem;
            }
            .mgc-card-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            }
            .mgc-cr-badge {
                font-size: 0.62rem;
                background: var(--tc-border);
                color: white;
                padding: 2px 7px;
                border-radius: 10px;
                font-weight: 700;
            }
            .mgc-prereq-badge {
                font-size: 0.6rem;
                color: var(--text-secondary);
            }
            .mgc-type-abbr {
                font-size: 0.58rem;
                color: var(--text-secondary);
                opacity: 0.8;
            }
        `;
        document.head.appendChild(s);
    }

    const semNums = Object.keys(studyPlan)
        .filter(n => studyPlan[n].subjects && studyPlan[n].subjects.length > 0)
        .sort((a, b) => +a - +b);

    if (semNums.length === 0) {
        container.innerHTML = `
            <div style="text-align:center; padding:60px 20px; color:var(--text-secondary);">
                <div style="font-size:3rem; margin-bottom:16px;">📋</div>
                <h3>No hay materias cargadas</h3>
                <p>Carga tu CSV desde Resumen General primero.</p>
            </div>`;
        return;
    }

    // Dimensiones adaptativas
    const CARD_W = 176;
    const CARD_H = 82;
    const COL_GAP = 32;
    const CARD_GAP = 10;
    const HEADER_H = 48;
    const PAD = 16;

    const maxSubjects = Math.max(...semNums.map(n => studyPlan[n].subjects.length));
    const totalWidth = semNums.length * (CARD_W + COL_GAP) - COL_GAP + PAD * 2;
    const totalHeight = HEADER_H + maxSubjects * (CARD_H + CARD_GAP) + PAD * 2;

    container.style.position = 'relative';
    container.style.width = totalWidth + 'px';
    container.style.height = totalHeight + 'px';

    const cols = semNums.map((n, i) => buildSemColumn(n, i, CARD_W, CARD_H, COL_GAP, CARD_GAP, HEADER_H, PAD)).join('');

    container.innerHTML = `
        <svg id="mgcArrows" style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;overflow:visible;"
             width="${totalWidth}" height="${totalHeight}"></svg>
        ${cols}
        <div id="mgcPrereqBar" style="display:none; position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
             background:#1a237e; color:white; padding:10px 20px; border-radius:24px; z-index:1000;
             font-size:0.85rem; font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,0.3);">
            🔗 Ahora haz clic en la materia que <strong>requiere</strong> la seleccionada como prereq
            <button onclick="exitPrereqMode()" style="margin-left:12px; background:rgba(255,255,255,0.2); border:none; color:white; padding:3px 10px; border-radius:12px; cursor:pointer;">✕ Cancelar</button>
        </div>`;

    setTimeout(() => drawAllArrows(), 50);
    updateMallaStatsFromPlan();
}

function buildSemColumn(semNum, colIdx, CARD_W, CARD_H, COL_GAP, CARD_GAP, HEADER_H, PAD) {
    const sem = studyPlan[semNum];
    const left = PAD + colIdx * (CARD_W + COL_GAP);

    const statusBg = {
        completed: '#2e7d32', current: '#f9a825', pending: '#90a4ae'
    }[sem.status] || '#90a4ae';

    const header = `
        <div style="position:absolute; left:${left}px; top:${PAD}px; width:${CARD_W}px;
                    background:${statusBg}; color:white; border-radius:8px 8px 0 0;
                    padding:8px 10px; display:flex; justify-content:space-between;
                    align-items:center; font-size:0.78rem; font-weight:700;
                    box-shadow:0 2px 4px rgba(0,0,0,0.15); z-index:2;">
            <span>Semestre ${semNum}</span>
            <span style="opacity:0.9;">${sem.subjects.reduce((s, x) => s + x.credits, 0)} cr</span>
        </div>`;

    const cards = sem.subjects.map((sub, i) => {
        const top = PAD + HEADER_H + i * (CARD_H + CARD_GAP);
        return buildMallaCard(sub, semNum, left, top, CARD_W, CARD_H);
    }).join('');

    return header + cards;
}

function buildMallaCard(sub, semNum, left, top, w, h) {
    const sem = studyPlan[semNum];
    const tc = MALLA_TYPE_COLORS[sub.type] || MALLA_TYPE_COLORS['DISCIPLINAR OBLIGATORIA'];

    let stateIcon = '', statusClass = '';
    if (sem.status === 'completed') { stateIcon = '✓'; statusClass = 'mgc-card--completed'; }
    else if (sem.status === 'current') { stateIcon = '▶'; statusClass = 'mgc-card--current'; }

    const prereqCount = (mallaPrereqs[sub.id] || []).length;
    const shortName = sub.name.length > 44 ? sub.name.slice(0, 42) + '\u2026' : sub.name;
    const typeAbbr = sub.type.split(' ').map(w => w[0]).join('');

    return `
        <div id="mgc-${sub.id}"
             data-id="${sub.id}" data-sem="${semNum}"
             class="mgc-card ${statusClass}"
             onclick="handleMallaCardClick(event,'${sub.id}','${semNum}')"
             title="${sub.name} · ${sub.type} · ${sub.credits} créditos"
             style="
                position:absolute; left:${left}px; top:${top}px;
                width:${w}px; height:${h}px;
                --tc-bg:${tc.bg}; --tc-border:${tc.border}; --tc-text:${tc.text};
                border-radius:6px; padding:7px 9px;
                cursor:pointer; z-index:2;
                display:flex; flex-direction:column; justify-content:space-between;
                transition:transform 0.15s, box-shadow 0.15s;
                overflow:hidden;
             "
             onmouseenter="this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 14px rgba(0,0,0,0.22)';this.style.zIndex='10'"
             onmouseleave="this.style.transform='';this.style.boxShadow='';this.style.zIndex='2'">
            <div class="mgc-card-name">
                ${stateIcon ? `<span class="mgc-state-icon">${stateIcon}</span>` : ''}${shortName}
            </div>
            <div class="mgc-card-footer">
                <span class="mgc-cr-badge">${sub.credits} cr</span>
                ${prereqCount ? `<span class="mgc-prereq-badge">📌${prereqCount}</span>` : ''}
                <span class="mgc-type-abbr">${typeAbbr}</span>
            </div>
        </div>`;
}

// ---- Flechas SVG prereqs ----
function drawAllArrows() {
    const svg = document.getElementById('mgcArrows');
    if (!svg) return;
    svg.innerHTML = `
        <defs>
            <marker id="arr" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                <path d="M0,0 L0,7 L7,3.5 z" fill="#e91e63" opacity="0.85"/>
            </marker>
        </defs>`;

    const container = document.getElementById('mallaGeneradaContainer');
    const cRect = container.getBoundingClientRect();

    Object.entries(mallaPrereqs).forEach(([tgtId, srcIds]) => {
        srcIds.forEach(srcId => {
            const s = document.getElementById(`mgc-${srcId}`);
            const t = document.getElementById(`mgc-${tgtId}`);
            if (!s || !t) return;

            const sR = s.getBoundingClientRect();
            const tR = t.getBoundingClientRect();

            const x1 = sR.right - cRect.left + container.parentElement.scrollLeft;
            const y1 = sR.top - cRect.top + container.parentElement.scrollTop + sR.height / 2;
            const x2 = tR.left - cRect.left + container.parentElement.scrollLeft;
            const y2 = tR.top - cRect.top + container.parentElement.scrollTop + tR.height / 2;

            const dx = Math.abs(x2 - x1) * 0.45;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`);
            path.setAttribute('stroke', '#e91e63');
            path.setAttribute('stroke-width', '1.8');
            path.setAttribute('fill', 'none');
            path.setAttribute('opacity', '0.75');
            path.setAttribute('marker-end', 'url(#arr)');
            svg.appendChild(path);
        });
    });
}

// ---- Clic en tarjeta ----
function handleMallaCardClick(e, subId, semNum) {
    e.stopPropagation();

    if (mallaPrereqMode && !mallaPrereqSource) {
        mallaPrereqSource = subId;
        document.querySelectorAll('.mgc-highlighted').forEach(el => el.classList.remove('mgc-highlighted'));
        const el = document.getElementById(`mgc-${subId}`);
        if (el) el.style.outline = '3px solid #e91e63';
        document.getElementById('mgcPrereqBar').style.display = 'block';
        return;
    }

    if (mallaPrereqMode && mallaPrereqSource) {
        if (mallaPrereqSource === subId) return;
        if (!mallaPrereqs[subId]) mallaPrereqs[subId] = [];
        if (!mallaPrereqs[subId].includes(mallaPrereqSource)) {
            mallaPrereqs[subId].push(mallaPrereqSource);
            saveMallaPrereqs();
        }
        exitPrereqMode();
        renderMallaGenerada();
        return;
    }

    // Modo normal: tooltip / panel info
    showMgcTooltip(subId, semNum);
}

function showMgcTooltip(subId, semNum) {
    selectedCardId = subId;
    selectedCardSem = semNum;

    const sem = studyPlan[semNum];
    if (!sem) return;
    const sub = sem.subjects.find(s => s.id === subId);
    if (!sub) return;

    const prereqIds = mallaPrereqs[subId] || [];
    const prereqNames = prereqIds.map(pid => {
        for (const s of Object.values(studyPlan)) {
            const f = s.subjects.find(x => x.id === pid);
            if (f) return f.name;
        }
        return pid;
    });

    // ── Si existe contenido programático, abrir ese modal (el bueno) ──
    if (typeof cpShowModal === 'function' && sub.code &&
        typeof contenidoProgramaticoData !== 'undefined' &&
        contenidoProgramaticoData.find(x =>
            x.code && sub.code &&
            x.code.trim().toLowerCase() === sub.code.trim().toLowerCase()
        )) {

        cpShowModal(sub.code.trim());


        // Inyectar sección de prereqs al final del modal de contenido
        setTimeout(() => {
            const cpBody = document.getElementById('cpModalBody');
            if (!cpBody) return;
            let prereqPanel = document.getElementById('mgcCpPrereqPanel');
            if (!prereqPanel) {
                prereqPanel = document.createElement('div');
                prereqPanel.id = 'mgcCpPrereqPanel';
                prereqPanel.style.cssText = 'margin-top:16px;padding-top:14px;border-top:1px solid var(--border-color);';
                cpBody.appendChild(prereqPanel);
            }
            prereqPanel.innerHTML = `
                <div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.05em;margin-bottom:8px;">
                    🔗 Prerrequisitos en la malla
                </div>
                ${prereqNames.length
                    ? prereqNames.map(n => `<span style="display:inline-block;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:2px 8px;margin:2px 3px 2px 0;font-size:0.78rem;color:var(--text-primary);">${n}</span>`).join('')
                    : `<span style="font-size:0.78rem;color:var(--text-secondary);">Sin prerrequisitos asignados.</span>`
                }
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
                    <button type="button"
                        onclick="cpCloseModal();addPrereqFor('${subId}')"
                        style="font-size:0.78rem;padding:4px 12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;color:var(--text-primary);">
                        🔗 + Agregar prereq
                    </button>
                    ${prereqIds.length ? `
                    <button type="button"
                        onclick="cpCloseModal();removeAllPrereqsOf('${subId}')"
                        style="font-size:0.78rem;padding:4px 12px;background:#ffebee;border:1px solid #d32f2f;color:#d32f2f;border-radius:6px;cursor:pointer;">
                        🗑 Quitar prereqs
                    </button>` : ''}
                </div>`;
        }, 30);
        return;
    }

    // ── Fallback: tooltip pequeño con info básica + prereqs ──
    const oldTip = document.getElementById('mgcTooltip');
    if (oldTip) oldTip.remove();
    const cardEl = document.getElementById(`mgc-${subId}`);
    if (!cardEl) return;
    const cardRect = cardEl.getBoundingClientRect();
    const tooltip = document.createElement('div');
    tooltip.id = 'mgcTooltip';
    tooltip.style.cssText = `position:fixed;z-index:9999;background:var(--bg-primary);border:1px solid var(--border-color);border-radius:10px;padding:14px 16px;box-shadow:0 6px 24px rgba(0,0,0,0.18);max-width:300px;font-size:0.82rem;`;
    tooltip.innerHTML = `
        <div style="font-weight:700;margin-bottom:4px;color:var(--text-primary);">${sub.name}</div>
        <div style="color:var(--text-secondary);font-size:0.78rem;margin-bottom:10px;">${sub.credits} créditos · ${sub.type} · Sem. ${semNum}</div>
        ${prereqNames.length ? `
        <div style="font-size:0.75rem;color:var(--text-secondary);margin-bottom:8px;">
            <strong>Prereqs:</strong> ${prereqNames.join(', ')}
        </div>` : ''}
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="addPrereqFor('${subId}')" style="font-size:0.72rem;padding:3px 9px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;color:var(--text-primary);">🔗 + Prereq</button>
            ${prereqIds.length ? `<button onclick="removeAllPrereqsOf('${subId}')" style="font-size:0.72rem;padding:3px 9px;background:#ffebee;border:1px solid #d32f2f;color:#d32f2f;border-radius:6px;cursor:pointer;">🗑 Quitar prereqs</button>` : ''}
            <button onclick="closeTooltip()" style="font-size:0.72rem;padding:3px 9px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;color:var(--text-primary);">✕</button>
        </div>`;
    tooltip.style.top = Math.min(cardRect.bottom + 6, window.innerHeight - 200) + 'px';
    tooltip.style.left = Math.min(cardRect.left, window.innerWidth - 316) + 'px';
    document.body.appendChild(tooltip);
    setTimeout(() => document.addEventListener('click', closeTooltip, { once: true }), 50);
}

function closeTooltip() {
    const t = document.getElementById('mgcTooltip');
    if (t) t.remove();
}

function addPrereqFor(subId) {
    closeTooltip();
    mallaPrereqMode = true;
    mallaPrereqSource = null;
    // Highlight the target card lightly
    const el = document.getElementById(`mgc-${subId}`);
    if (el) el.style.outline = '3px dashed #e91e63';
    // Store target so second click assigns correctly
    // Override: first click = source, auto-target = subId
    // Hacemos que el primer clic sea la fuente, y asignamos como target subId
    mallaPrereqTarget = subId;
    document.getElementById('mgcPrereqBar').style.display = 'block';
}

let mallaPrereqTarget = null;

// Sobrescribir handleMallaCardClick para modo con target
const _origClick = handleMallaCardClick;

function handleMallaCardClick(e, subId, semNum) {
    e.stopPropagation();

    if (mallaPrereqMode && mallaPrereqTarget) {
        // subId es la FUENTE (prereq)
        if (subId === mallaPrereqTarget) return;
        if (!mallaPrereqs[mallaPrereqTarget]) mallaPrereqs[mallaPrereqTarget] = [];
        if (!mallaPrereqs[mallaPrereqTarget].includes(subId)) {
            mallaPrereqs[mallaPrereqTarget].push(subId);
            saveMallaPrereqs();
        }
        exitPrereqMode();
        renderMallaGenerada();
        return;
    }

    // Modo normal: tooltip
    showMgcTooltip(subId, semNum);
}

function exitPrereqMode() {
    mallaPrereqMode = false;
    mallaPrereqSource = null;
    mallaPrereqTarget = null;
    const bar = document.getElementById('mgcPrereqBar');
    if (bar) bar.style.display = 'none';
    document.querySelectorAll('[id^="mgc-"]').forEach(el => el.style.outline = '');
}

function removeAllPrereqsOf(subId) {
    closeTooltip();
    delete mallaPrereqs[subId];
    saveMallaPrereqs();
    renderMallaGenerada();
}

function clearAllPrereqs() {
    if (!confirm('¿Borrar todos los prerrequisitos?')) return;
    mallaPrereqs = {};
    saveMallaPrereqs();
    renderMallaGenerada();
}

// ---- Stats automáticas ----
function updateMallaStatsFromPlan() {
    let done = 0, inProgress = 0, total = 0;
    Object.values(studyPlan).forEach(sem => {
        sem.subjects.forEach(() => {
            total++;
            if (sem.status === 'completed') done++;
            else if (sem.status === 'current') inProgress++;
        });
    });
    const el = document.getElementById('mallaStatsText');
    if (el) el.textContent = `✅ ${done} completadas  •  ▶ ${inProgress} en curso  •  ${total - done - inProgress} pendientes`;
}