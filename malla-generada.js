// ============================================================
//  MALLA CURRICULAR GENERADA — scripts/malla-generada.js  v2
// ============================================================

const GRUPO_COLORES = {
    'El contexto de las artes':               { bg: '#e8f5e9', border: '#2e7d32', text: '#1b5e20' },
    'Teoría de la imagen':                    { bg: '#e3f2fd', border: '#1565c0', text: '#0d47a1' },
    'Historia y teoría del diseño gráfico':   { bg: '#fff3e0', border: '#e65100', text: '#bf360c' },
    'Talleres de diseño':                     { bg: '#fce4ec', border: '#880e4f', text: '#880e4f' },
    'Medios de representación':               { bg: '#f3e5f5', border: '#6a1b9a', text: '#4a148c' },
    'Imagen fotográfica':                     { bg: '#e0f7fa', border: '#006064', text: '#004d40' },
    'Medios de producción':                   { bg: '#fff8e1', border: '#f57f17', text: '#e65100' },
    'Trabajo de grado':                       { bg: '#f1f8e9', border: '#33691e', text: '#1b5e20' },
};

const MALLA_DISENO_GRAFICO = [
    // Semestre 1
    { id: 'TM',   nombre: 'Teoría de la mirada',                                    creditos: 3, semestre: 1, agrupacion: 'Teoría de la imagen' },
    { id: 'IPal', nombre: 'Historia DG: De la imagen a la palabra',                 creditos: 3, semestre: 1, agrupacion: 'Historia y teoría del diseño gráfico' },
    { id: 'TFE',  nombre: 'Taller forma y estructura',                              creditos: 5, semestre: 1, agrupacion: 'Talleres de diseño' },
    { id: 'EVE',  nombre: 'Expresión visual y esquemática básica',                  creditos: 2, semestre: 1, agrupacion: 'Medios de representación' },
    { id: 'FTF',  nombre: 'Fund. tecnológicos: Formatos y medidas',                 creditos: 2, semestre: 1, agrupacion: 'Medios de producción' },
    // Semestre 2
    { id: 'PI',   nombre: 'Palabra e imagen',                                       creditos: 3, semestre: 2, agrupacion: 'Teoría de la imagen',                        prerequisitos: ['TM'] },
    { id: 'ADis', nombre: 'Historia DG: De las artes al diseño',                    creditos: 3, semestre: 2, agrupacion: 'Historia y teoría del diseño gráfico',        prerequisitos: ['IPal'] },
    { id: 'TSL',  nombre: 'Taller signo y letra',                                   creditos: 5, semestre: 2, agrupacion: 'Talleres de diseño',                          prerequisitos: ['TFE'] },
    { id: 'FHR',  nombre: 'Figura humana y representación',                         creditos: 3, semestre: 2, agrupacion: 'Medios de representación',                    prerequisitos: ['EVE'] },
    { id: 'FTT',  nombre: 'Fund. tecnológicos: Tipometría',                         creditos: 2, semestre: 2, agrupacion: 'Medios de producción',                        prerequisitos: ['FTF'] },
    // Semestre 3
    { id: 'ETI',  nombre: 'Estética y teoría de la imagen',                         creditos: 3, semestre: 3, agrupacion: 'Teoría de la imagen',                        prerequisitos: ['PI'] },
    { id: 'Ism',  nombre: 'Historia DG: De los ismos a los medios',                 creditos: 3, semestre: 3, agrupacion: 'Historia y teoría del diseño gráfico',        prerequisitos: ['IPal'] },
    { id: 'ColD', nombre: 'Historia DG: Contextos del diseño en Colombia',           creditos: 3, semestre: 3, agrupacion: 'Historia y teoría del diseño gráfico',        prerequisitos: ['IPal'] },
    { id: 'TTCD', nombre: 'Taller tipografía, composición y diagramación',          creditos: 5, semestre: 3, agrupacion: 'Talleres de diseño',                          prerequisitos: ['TFE'] },
    { id: 'BoI',  nombre: 'Bocetación e ilustración',                               creditos: 3, semestre: 3, agrupacion: 'Medios de representación',                    prerequisitos: ['EVE'] },
    { id: 'FTC',  nombre: 'Fund. tecnológicos: Color y producción',                 creditos: 2, semestre: 3, agrupacion: 'Medios de producción',                        prerequisitos: ['FTF'] },
    // Semestre 4
    { id: 'LatD', nombre: 'Historia DG: Sociedad, cultura y diseño en Latinoamérica', creditos: 3, semestre: 4, agrupacion: 'Historia y teoría del diseño gráfico',     prerequisitos: ['IPal'] },
    { id: 'ODI',  nombre: 'Taller orientación y diseño de información',             creditos: 5, semestre: 4, agrupacion: 'Talleres de diseño',                          prerequisitos: ['TFE'] },
    { id: 'AG3D', nombre: 'Aplicaciones gráficas tridimensionales',                 creditos: 3, semestre: 4, agrupacion: 'Medios de representación',                    prerequisitos: ['EVE'] },
    { id: 'F1',   nombre: 'Fotografía 1',                                           creditos: 3, semestre: 4, agrupacion: 'Imagen fotográfica' },
    { id: 'FTI',  nombre: 'Fund. tecnológicos: Prod. en medios impresos',           creditos: 3, semestre: 4, agrupacion: 'Medios de producción',                        prerequisitos: ['FTF'] },
    // Semestre 5
    { id: 'TCV1', nombre: 'Teoría de la comunicación visual 1',                     creditos: 3, semestre: 5, agrupacion: 'Historia y teoría del diseño gráfico',        prerequisitos: ['ETI'] },
    { id: 'TIC',  nombre: 'Taller identidad e imagen coordinada',                   creditos: 5, semestre: 5, agrupacion: 'Talleres de diseño',                          prerequisitos: ['TFE'] },
    { id: 'IDin', nombre: 'Imagen dinámica',                                        creditos: 3, semestre: 5, agrupacion: 'Medios de representación',                    prerequisitos: ['EVE'] },
    { id: 'F2',   nombre: 'Fotografía 2',                                           creditos: 3, semestre: 5, agrupacion: 'Imagen fotográfica',                          prerequisitos: ['F1'] },
    { id: 'FTPD', nombre: 'Fund. tecnológicos: Prod. en medios digitales',          creditos: 3, semestre: 5, agrupacion: 'Medios de producción',                        prerequisitos: ['FTF'] },
    // Semestre 6
    { id: 'GCA',  nombre: 'Gestión cultural y empresarial de las artes',            creditos: 3, semestre: 6, agrupacion: 'El contexto de las artes' },
    { id: 'SIP',  nombre: 'Seminario de investigación y proyecto de diseño',        creditos: 3, semestre: 6, agrupacion: 'Teoría de la imagen',                        prerequisitos: ['ETI'] },
    { id: 'TCV2', nombre: 'Teoría de la comunicación visual 2',                     creditos: 3, semestre: 6, agrupacion: 'Historia y teoría del diseño gráfico',        prerequisitos: ['ETI'] },
    { id: 'EM1',  nombre: 'Taller énfasis multimedia e imagen digital 1',           creditos: 3, semestre: 6, agrupacion: 'Medios de representación',                    prerequisitos: ['FTPD','FTI','FTC','FTT','FTF'] },
    { id: 'F3',   nombre: 'Fotografía 3',                                           creditos: 3, semestre: 6, agrupacion: 'Imagen fotográfica',                          prerequisitos: ['F1'] },
    // Semestre 7
    { id: 'PCA',  nombre: 'Problemas contemporáneos de las artes y herencias',      creditos: 3, semestre: 7, agrupacion: 'El contexto de las artes' },
    { id: 'EM2',  nombre: 'Taller énfasis multimedia e imagen digital 2',           creditos: 3, semestre: 7, agrupacion: 'Medios de representación',                    prerequisitos: ['EM1'] },
    // Semestre 8
    { id: 'TG',   nombre: 'Trabajo de grado / Práctica profesional',               creditos: 6, semestre: 8, agrupacion: 'Trabajo de grado',
      prerequisitos: ['IPal','ADis','Ism','ColD','LatD','TCV1','TCV2','TFE','TSL','TTCD','ODI','TIC','EVE','FHR','BoI','AG3D','IDin','EM1','F1','FTF','FTT','FTC','FTI','FTPD'] }
];

// ── Estado ───────────────────────────────────────────────
let mallaEstados     = {};
let mallaCoordenadas = {};
let mallaGenCanvas   = null;
let mallaGenCtx      = null;
let mallaGenScale    = 1.0;
let mallaGenInited   = false;

const CARD_W = 165, CARD_H = 82, COL_GAP = 36, ROW_GAP = 18, PAD = 20, SEM_H = 26;

function loadMallaEstados() {
    const local = localStorage.getItem('mallaEstados_v2');
    if (local) { try { mallaEstados = JSON.parse(local); } catch { mallaEstados = {}; } }
}

function saveMallaEstados() {
    localStorage.setItem('mallaEstados_v2', JSON.stringify(mallaEstados));
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid).set({ mallaEstados }, { merge: true }).catch(console.error);
    }
}

// ── Punto de entrada ─────────────────────────────────────
function onMallaViewOpen() {
    loadMallaEstados();

    mallaGenCanvas = document.getElementById('mallaGenCanvas');
    if (!mallaGenCanvas) { console.error('[Malla] #mallaGenCanvas no encontrado'); return; }
    mallaGenCtx = mallaGenCanvas.getContext('2d');

    calcularLayout();
    dibujarMalla();
    actualizarBarraMallaGen();

    if (!mallaGenInited) { attachMallaGenEvents(); mallaGenInited = true; }

    // Esperar 2 frames para que el wrapper tenga dimensiones reales
    requestAnimationFrame(() => requestAnimationFrame(mallaGenZoomFit));
}

// ── Layout ────────────────────────────────────────────────
function calcularLayout() {
    const sems = {};
    MALLA_DISENO_GRAFICO.forEach(m => { if (!sems[m.semestre]) sems[m.semestre] = []; sems[m.semestre].push(m); });

    const maxRows = Math.max(...Object.values(sems).map(s => s.length));
    mallaGenCanvas.width  = PAD * 2 + 8 * CARD_W + 7 * COL_GAP;
    mallaGenCanvas.height = PAD * 2 + SEM_H + 8 + maxRows * CARD_H + (maxRows - 1) * ROW_GAP;

    mallaCoordenadas = {};
    for (let s = 1; s <= 8; s++) {
        (sems[s] || []).forEach((m, idx) => {
            mallaCoordenadas[m.id] = {
                x: PAD + (s - 1) * (CARD_W + COL_GAP),
                y: PAD + SEM_H + 8 + idx * (CARD_H + ROW_GAP),
                w: CARD_W, h: CARD_H
            };
        });
    }
}

// ── Dibujo ───────────────────────────────────────────────
function dibujarMalla() {
    const ctx = mallaGenCtx, cw = mallaGenCanvas.width, ch = mallaGenCanvas.height;

    // Fondo
    ctx.fillStyle = '#ebebeb';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.03)';
    for (let x = 0; x < cw; x += 20) ctx.fillRect(x, 0, 1, ch);
    for (let y = 0; y < ch; y += 20) ctx.fillRect(0, y, cw, 1);

    // Cabeceras semestre
    for (let s = 1; s <= 8; s++) {
        const cx2 = PAD + (s - 1) * (CARD_W + COL_GAP);
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath(); pathRR(ctx, cx2, PAD, CARD_W, SEM_H, 6); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px system-ui,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`Semestre ${s}`, cx2 + CARD_W / 2, PAD + SEM_H / 2);
    }

    dibujarFlechas(ctx);
    MALLA_DISENO_GRAFICO.forEach(m => dibujarTarjeta(ctx, m));
}

function dibujarFlechas(ctx) {
    MALLA_DISENO_GRAFICO.forEach(dest => {
        if (!dest.prerequisitos?.length) return;
        const dc = mallaCoordenadas[dest.id]; if (!dc) return;
        dest.prerequisitos.forEach(pid => {
            const sc = mallaCoordenadas[pid]; if (!sc) return;
            const src = MALLA_DISENO_GRAFICO.find(m => m.id === pid); if (!src) return;
            const color = GRUPO_COLORES[src.agrupacion]?.border || '#999';
            const diff  = dest.semestre - src.semestre;
            const x1 = sc.x + sc.w, y1 = sc.y + sc.h / 2;
            const x2 = dc.x,        y2 = dc.y + dc.h / 2;
            const cpx = (x1 + x2) / 2;

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth   = diff > 1 ? 1 : 1.8;
            ctx.globalAlpha = diff > 1 ? 0.2 : 0.45;
            ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(x1, y1); ctx.bezierCurveTo(cpx, y1, cpx, y2, x2, y2); ctx.stroke();

            ctx.setLineDash([]); ctx.globalAlpha = diff > 1 ? 0.3 : 0.7; ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2-6, y2-3); ctx.lineTo(x2-6, y2+3); ctx.closePath(); ctx.fill();
            ctx.restore();
        });
    });
}

function dibujarTarjeta(ctx, m) {
    const c = mallaCoordenadas[m.id]; if (!c) return;
    const { x, y, w, h } = c;
    const estado = mallaEstados[m.id] || 'pending';
    const col    = GRUPO_COLORES[m.agrupacion] || { bg: '#fff', border: '#999', text: '#333' };

    ctx.shadowColor = 'rgba(0,0,0,0.14)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
    ctx.fillStyle   = estado === 'completed' ? '#c8e6c9' : estado === 'current' ? '#fff9c4' : col.bg;
    ctx.beginPath(); pathCard(ctx, x, y, w, h); ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.strokeStyle = estado === 'completed' ? '#2e7d32' : estado === 'current' ? '#f9a825' : col.border;
    ctx.lineWidth   = estado !== 'pending' ? 2.5 : 1.5;
    ctx.beginPath(); pathCard(ctx, x, y, w, h); ctx.stroke();

    ctx.fillStyle = col.border; ctx.fillRect(x, y, w - 14, 4);

    if (estado !== 'pending') {
        ctx.fillStyle = estado === 'completed' ? '#2e7d32' : '#e65100';
        ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText(estado === 'completed' ? '✓' : '▶', x + w - 4, y + 6);
    }

    ctx.fillStyle = col.text; ctx.font = 'bold 9.5px system-ui,sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    wrapText(ctx, m.nombre, x + 6, y + 10, w - 14, 11, 4);

    ctx.fillStyle = '#555'; ctx.font = '9px system-ui'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillText(`${m.creditos}c`, x + w - 4, y + h - 3);

    ctx.fillStyle = col.border; ctx.font = '7.5px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(grupoCorto(m.agrupacion), x + 5, y + h - 2);
}

// ── Paths ─────────────────────────────────────────────────
function pathCard(ctx, x, y, w, h) {
    const cut = 14, r = 5;
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - cut, y); ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function pathRR(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}
function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' '); let line = '', count = 0;
    for (let i = 0; i < words.length; i++) {
        const test = line + words[i] + ' ';
        if (ctx.measureText(test).width > maxW && i > 0) {
            if (count < maxLines - 1) { ctx.fillText(line.trim(), x, y + count * lineH); line = words[i] + ' '; count++; }
            else { ctx.fillText(line.trim() + '…', x, y + count * lineH); return; }
        } else line = test;
    }
    ctx.fillText(line.trim(), x, y + count * lineH);
}
function grupoCorto(g) {
    return g.replace('Historia y teoría del diseño gráfico','Historia DG')
            .replace('Medios de representación','Medios repr.')
            .replace('El contexto de las artes','Contexto artes')
            .replace('Talleres de diseño','Talleres DG')
            .replace('Medios de producción','Medios prod.')
            .replace('Imagen fotográfica','Fotografía')
            .replace('Teoría de la imagen','Teoría img.')
            .replace('Trabajo de grado','Trabajo grado');
}

// ── Eventos ───────────────────────────────────────────────
function attachMallaGenEvents() {
    const canvas = document.getElementById('mallaGenCanvas');
    if (!canvas) return;

    canvas.addEventListener('click', e => {
        const { cx, cy } = cxy(canvas, e);
        const mat = matEnPunto(cx, cy);
        if (!mat) return;
        const ciclo = { pending: 'current', current: 'completed', completed: 'pending' };
        mallaEstados[mat.id] = ciclo[mallaEstados[mat.id] || 'pending'];
        saveMallaEstados(); dibujarMalla(); actualizarBarraMallaGen();
    });

    canvas.addEventListener('mousemove', e => {
        const { cx, cy } = cxy(canvas, e);
        const mat = matEnPunto(cx, cy);
        canvas.style.cursor = mat ? 'pointer' : 'default';
        const tip = document.getElementById('mallaGenTooltip');
        if (!tip) return;
        if (mat) {
            const lbl = { pending:'Pendiente', current:'En curso', completed:'Aprobada' }[mallaEstados[mat.id] || 'pending'];
            const pre = (mat.prerequisitos||[]).map(pid => MALLA_DISENO_GRAFICO.find(m => m.id===pid)?.nombre||pid).join(', ')||'Ninguno';
            tip.innerHTML = `<strong>${mat.nombre}</strong><br>${mat.agrupacion} · ${mat.creditos}c<br>Estado: <em>${lbl}</em><br>Prereq.: ${pre}`;
            tip.style.cssText = `display:block;left:${e.clientX+14}px;top:${e.clientY-10}px`;
        } else tip.style.display = 'none';
    });

    canvas.addEventListener('mouseleave', () => {
        const t = document.getElementById('mallaGenTooltip'); if (t) t.style.display='none';
    });

    canvas.addEventListener('touchend', e => {
        e.preventDefault();
        const t = e.changedTouches[0];
        canvas.dispatchEvent(new MouseEvent('click', { clientX: t.clientX, clientY: t.clientY }));
    }, { passive: false });
}

function cxy(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { cx: (e.clientX - r.left) * (canvas.width / r.width), cy: (e.clientY - r.top) * (canvas.height / r.height) };
}
function matEnPunto(cx, cy) {
    return MALLA_DISENO_GRAFICO.find(m => { const c = mallaCoordenadas[m.id]; return c && cx>=c.x && cx<=c.x+c.w && cy>=c.y && cy<=c.y+c.h; }) || null;
}

// ── Stats ─────────────────────────────────────────────────
function actualizarBarraMallaGen() {
    const total = MALLA_DISENO_GRAFICO.length;
    const ap = MALLA_DISENO_GRAFICO.filter(m => mallaEstados[m.id]==='completed').length;
    const ec = MALLA_DISENO_GRAFICO.filter(m => mallaEstados[m.id]==='current').length;
    const cr = MALLA_DISENO_GRAFICO.filter(m => mallaEstados[m.id]==='completed').reduce((s,m)=>s+m.creditos,0);
    const el = document.getElementById('mallaGenStats');
    if (el) el.textContent = `✅ ${ap}/${total} aprobadas  •  ▶ ${ec} en curso  •  🎓 ${cr} créditos`;
}

// ── Zoom ─────────────────────────────────────────────────
function mallaGenZoomIn()  { mallaGenScale = Math.min(2.5, mallaGenScale+0.15); _zoom(); }
function mallaGenZoomOut() { mallaGenScale = Math.max(0.3, mallaGenScale-0.15); _zoom(); }
function mallaGenZoomFit() {
    const w = document.getElementById('mallaGenWrapper');
    if (!w || !mallaGenCanvas || mallaGenCanvas.width===0) return;
    const aw = w.clientWidth - 20;
    if (aw <= 0) return;
    mallaGenScale = aw / mallaGenCanvas.width;
    _zoom();
}
function _zoom() {
    const c = document.getElementById('mallaGenCanvas'); if (!c) return;
    c.style.width  = (mallaGenCanvas.width  * mallaGenScale) + 'px';
    c.style.height = (mallaGenCanvas.height * mallaGenScale) + 'px';
    const l = document.getElementById('mallaGenZoomLabel'); if (l) l.textContent = Math.round(mallaGenScale*100)+'%';
}

// ── Reset ─────────────────────────────────────────────────
function resetMallaEstados() {
    if (!confirm('¿Reiniciar todos los estados de la malla?')) return;
    mallaEstados = {}; saveMallaEstados(); dibujarMalla(); actualizarBarraMallaGen();
}
