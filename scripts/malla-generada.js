// ============================================================
//  MALLA CURRICULAR GENERADA — scripts/malla-generada.js
//  Reemplaza el sistema de PDF. Dibuja la malla en un <canvas>
//  a partir de los datos hardcodeados + estado del studyPlan.
// ============================================================

// ── Paleta de colores por agrupación ──────────────────────
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

// ── Definición completa de la malla ──────────────────────
// Cada materia: { id, nombre, creditos, semestre, agrupacion, prerequisitos: [id, ...] }
const MALLA_DISENO_GRAFICO = [
    // Semestre 1
    { id: 'TM',   nombre: 'Teoría de la mirada',                             creditos: 3, semestre: 1, agrupacion: 'Teoría de la imagen' },
    { id: 'IPal', nombre: 'Historia DG: De la imagen a la palabra',          creditos: 3, semestre: 1, agrupacion: 'Historia y teoría del diseño gráfico' },
    { id: 'TFE',  nombre: 'Taller forma y estructura',                       creditos: 5, semestre: 1, agrupacion: 'Talleres de diseño' },
    { id: 'EVE',  nombre: 'Expresión visual y esquemática básica',           creditos: 2, semestre: 1, agrupacion: 'Medios de representación' },
    { id: 'FTF',  nombre: 'Fundamentos tecnológicos: Formatos y medidas',    creditos: 2, semestre: 1, agrupacion: 'Medios de producción' },

    // Semestre 2
    { id: 'PI',   nombre: 'Palabra e imagen',                                creditos: 3, semestre: 2, agrupacion: 'Teoría de la imagen',                          prerequisitos: ['TM'] },
    { id: 'ADis', nombre: 'Historia DG: De las artes al diseño',             creditos: 3, semestre: 2, agrupacion: 'Historia y teoría del diseño gráfico',          prerequisitos: ['IPal'] },
    { id: 'TSL',  nombre: 'Taller signo y letra',                            creditos: 5, semestre: 2, agrupacion: 'Talleres de diseño',                            prerequisitos: ['TFE'] },
    { id: 'FHR',  nombre: 'Figura humana y representación',                  creditos: 3, semestre: 2, agrupacion: 'Medios de representación',                      prerequisitos: ['EVE'] },
    { id: 'FTT',  nombre: 'Fundamentos tecnológicos: Tipometría',            creditos: 2, semestre: 2, agrupacion: 'Medios de producción',                          prerequisitos: ['FTF'] },

    // Semestre 3
    { id: 'ETI',  nombre: 'Estética y teoría de la imagen',                  creditos: 3, semestre: 3, agrupacion: 'Teoría de la imagen',                          prerequisitos: ['PI'] },
    { id: 'Ism',  nombre: 'Historia DG: De los ismos a los medios',          creditos: 3, semestre: 3, agrupacion: 'Historia y teoría del diseño gráfico',          prerequisitos: ['IPal'] },
    { id: 'ColD', nombre: 'Historia DG: Contextos del diseño en Colombia',   creditos: 3, semestre: 3, agrupacion: 'Historia y teoría del diseño gráfico',          prerequisitos: ['IPal'] },
    { id: 'TTCD', nombre: 'Taller tipografía, composición y diagramación',   creditos: 5, semestre: 3, agrupacion: 'Talleres de diseño',                            prerequisitos: ['TFE'] },
    { id: 'BoI',  nombre: 'Bocetación e ilustración',                        creditos: 3, semestre: 3, agrupacion: 'Medios de representación',                      prerequisitos: ['EVE'] },
    { id: 'FTC',  nombre: 'Fundamentos tecnológicos: Color y producción',    creditos: 2, semestre: 3, agrupacion: 'Medios de producción',                          prerequisitos: ['FTF'] },

    // Semestre 4
    { id: 'LatD', nombre: 'Historia DG: Sociedad, cultura y diseño en Latinoamérica', creditos: 3, semestre: 4, agrupacion: 'Historia y teoría del diseño gráfico', prerequisitos: ['IPal'] },
    { id: 'ODI',  nombre: 'Taller orientación y diseño de información',      creditos: 5, semestre: 4, agrupacion: 'Talleres de diseño',                            prerequisitos: ['TFE'] },
    { id: 'AG3D', nombre: 'Aplicaciones gráficas tridimensionales',          creditos: 3, semestre: 4, agrupacion: 'Medios de representación',                      prerequisitos: ['EVE'] },
    { id: 'F1',   nombre: 'Fotografía 1',                                    creditos: 3, semestre: 4, agrupacion: 'Imagen fotográfica' },
    { id: 'FTI',  nombre: 'Fundamentos tecnológicos: Producción en medios impresos', creditos: 3, semestre: 4, agrupacion: 'Medios de producción',                  prerequisitos: ['FTF'] },

    // Semestre 5
    { id: 'TCV1', nombre: 'Teoría de la comunicación visual 1',              creditos: 3, semestre: 5, agrupacion: 'Historia y teoría del diseño gráfico',          prerequisitos: ['ETI'] },
    { id: 'TIC',  nombre: 'Taller identidad e imagen coordinada',            creditos: 5, semestre: 5, agrupacion: 'Talleres de diseño',                            prerequisitos: ['TFE'] },
    { id: 'IDin', nombre: 'Imagen dinámica',                                 creditos: 3, semestre: 5, agrupacion: 'Medios de representación',                      prerequisitos: ['EVE'] },
    { id: 'F2',   nombre: 'Fotografía 2',                                    creditos: 3, semestre: 5, agrupacion: 'Imagen fotográfica',                            prerequisitos: ['F1'] },
    { id: 'FTPD', nombre: 'Fundamentos tecnológicos: Producción en medios digitales', creditos: 3, semestre: 5, agrupacion: 'Medios de producción',                 prerequisitos: ['FTF'] },

    // Semestre 6
    { id: 'GCA',  nombre: 'Gestión cultural y empresarial de las artes',     creditos: 3, semestre: 6, agrupacion: 'El contexto de las artes' },
    { id: 'SIP',  nombre: 'Seminario de investigación y proyecto de diseño', creditos: 3, semestre: 6, agrupacion: 'Teoría de la imagen',                          prerequisitos: ['ETI'] },
    { id: 'TCV2', nombre: 'Teoría de la comunicación visual 2',              creditos: 3, semestre: 6, agrupacion: 'Historia y teoría del diseño gráfico',          prerequisitos: ['ETI'] },
    { id: 'EM1',  nombre: 'Taller énfasis multimedia e imagen digital 1',    creditos: 3, semestre: 6, agrupacion: 'Medios de representación',                      prerequisitos: ['FTPD', 'FTI', 'FTC', 'FTT', 'FTF'] },
    { id: 'F3',   nombre: 'Fotografía 3',                                    creditos: 3, semestre: 6, agrupacion: 'Imagen fotográfica',                            prerequisitos: ['F1'] },

    // Semestre 7
    { id: 'PCA',  nombre: 'Problemas contemporáneos de las artes y herencias', creditos: 3, semestre: 7, agrupacion: 'El contexto de las artes' },
    { id: 'EM2',  nombre: 'Taller énfasis multimedia e imagen digital 2',    creditos: 3, semestre: 7, agrupacion: 'Medios de representación',                      prerequisitos: ['EM1'] },

    // Semestre 8
    { id: 'TG',   nombre: 'Trabajo de grado / Práctica profesional',         creditos: 6, semestre: 8, agrupacion: 'Trabajo de grado',
      prerequisitos: ['IPal','ADis','Ism','ColD','LatD','TCV1','TCV2','TFE','TSL','TTCD','ODI','TIC','EVE','FHR','BoI','AG3D','IDin','EM1','F1','FTF','FTT','FTC','FTI','FTPD'] }
];

// ── Layout: posición de cada tarjeta ──────────────────────
// Se calculan dinámicamente al dibujar. Aquí guardamos coordenadas en px del canvas.
let mallaCoordenadas = {}; // id → { x, y, w, h }

// ── Estado de las materias ──────────────────────────────
// 'pending' | 'current' | 'completed'
let mallaEstados = {}; // id → estado

function loadMallaEstados() {
    const local = localStorage.getItem('mallaEstados_v2');
    if (local) {
        try { mallaEstados = JSON.parse(local); } catch { mallaEstados = {}; }
    }
    // Sincronizar con studyPlan si existe
    if (typeof studyPlan !== 'undefined') {
        Object.values(studyPlan).forEach(sem => {
            (sem.subjects || []).forEach(s => {
                const match = MALLA_DISENO_GRAFICO.find(m =>
                    m.nombre.toLowerCase().includes(s.name?.toLowerCase()?.substring(0, 10) || '')
                );
                if (match && !mallaEstados[match.id]) {
                    mallaEstados[match.id] = s.status === 'approved' ? 'completed'
                        : s.status === 'enrolled' ? 'current' : 'pending';
                }
            });
        });
    }
}

function saveMallaEstados() {
    localStorage.setItem('mallaEstados_v2', JSON.stringify(mallaEstados));
    if (typeof currentUser !== 'undefined' && currentUser) {
        db.collection('users').doc(currentUser.uid)
            .set({ mallaEstados }, { merge: true })
            .catch(console.error);
    }
}

// ── Canvas y contexto ─────────────────────────────────────
let mallaGenCanvas = null;
let mallaGenCtx    = null;
let mallaGenScale  = 1.0;
const CARD_W  = 160;
const CARD_H  = 80;
const COL_GAP = 40;
const ROW_GAP = 20;
const PADDING = 24;

// ── Inicialización ────────────────────────────────────────
function initMallaGenerada() {
    loadMallaEstados();

    mallaGenCanvas = document.getElementById('mallaGenCanvas');
    if (!mallaGenCanvas) return;

    mallaGenCtx = mallaGenCanvas.getContext('2d');

    // Calcular tamaño del canvas
    calcularLayout();
    dibujarMalla();
    attachMallaGenEvents();
}

function calcularLayout() {
    // Agrupar por semestre
    const sems = {};
    MALLA_DISENO_GRAFICO.forEach(m => {
        if (!sems[m.semestre]) sems[m.semestre] = [];
        sems[m.semestre].push(m);
    });

    const numSems = 8;
    const maxRows = Math.max(...Object.values(sems).map(s => s.length));

    const totalW = PADDING * 2 + numSems * CARD_W + (numSems - 1) * COL_GAP;
    const totalH = PADDING * 2 + 30 + maxRows * CARD_H + (maxRows - 1) * ROW_GAP + 60; // 30 header semestre

    mallaGenCanvas.width  = totalW;
    mallaGenCanvas.height = totalH;

    mallaCoordenadas = {};
    for (let s = 1; s <= numSems; s++) {
        const materias = sems[s] || [];
        const colX = PADDING + (s - 1) * (CARD_W + COL_GAP);
        materias.forEach((m, idx) => {
            const cardY = PADDING + 30 + idx * (CARD_H + ROW_GAP);
            mallaCoordenadas[m.id] = { x: colX, y: cardY, w: CARD_W, h: CARD_H };
        });
    }
}

function dibujarMalla() {
    const ctx = mallaGenCtx;
    const cw  = mallaGenCanvas.width;
    const ch  = mallaGenCanvas.height;

    // Fondo
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, cw, ch);

    // Líneas de semestre
    for (let s = 1; s <= 8; s++) {
        const colX = PADDING + (s - 1) * (CARD_W + COL_GAP);
        // Cabecera semestre
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        roundRect(ctx, colX, PADDING, CARD_W, 24, 6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Semestre ${s}`, colX + CARD_W / 2, PADDING + 12);
    }

    // Dibujar flechas de prerequisito PRIMERO (detrás de tarjetas)
    dibujarFlechas(ctx);

    // Dibujar tarjetas
    MALLA_DISENO_GRAFICO.forEach(m => {
        dibujarTarjeta(ctx, m);
    });
}

function dibujarFlechas(ctx) {
    MALLA_DISENO_GRAFICO.forEach(m => {
        if (!m.prerequisitos || m.prerequisitos.length === 0) return;
        const destCoord = mallaCoordenadas[m.id];
        if (!destCoord) return;

        m.prerequisitos.forEach(pid => {
            const srcCoord = mallaCoordenadas[pid];
            if (!srcCoord) return;

            // Origen: lado derecho del centro de la tarjeta fuente
            const x1 = srcCoord.x + srcCoord.w;
            const y1 = srcCoord.y + srcCoord.h / 2;
            // Destino: lado izquierdo del centro de la tarjeta destino
            const x2 = destCoord.x;
            const y2 = destCoord.y + destCoord.h / 2;

            // Solo dibujar si son semestres consecutivos (no líneas muy largas)
            const srcMat  = MALLA_DISENO_GRAFICO.find(mm => mm.id === pid);
            const destMat = m;
            if (!srcMat) return;

            const color = GRUPO_COLORES[srcMat.agrupacion]?.border || '#999';

            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth   = destMat.semestre - srcMat.semestre > 1 ? 1 : 1.5;
            ctx.globalAlpha = 0.45;
            ctx.setLineDash([4, 3]);

            ctx.beginPath();
            const cpx = (x1 + x2) / 2;
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cpx, y1, cpx, y2, x2, y2);
            ctx.stroke();

            // Punta de flecha
            ctx.globalAlpha = 0.7;
            ctx.setLineDash([]);
            dibujarPuntaFlecha(ctx, x2, y2, color);
            ctx.restore();
        });
    });
}

function dibujarPuntaFlecha(ctx, x, y, color) {
    const size = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - size, y - size / 2);
    ctx.lineTo(x - size, y + size / 2);
    ctx.closePath();
    ctx.fill();
}

function dibujarTarjeta(ctx, materia) {
    const coord  = mallaCoordenadas[materia.id];
    if (!coord) return;
    const { x, y, w, h } = coord;
    const estado = mallaEstados[materia.id] || 'pending';
    const colores = GRUPO_COLORES[materia.agrupacion] || { bg: '#fff', border: '#ccc', text: '#333' };

    // Fondo
    ctx.fillStyle = estado === 'completed' ? '#c8e6c9'
                  : estado === 'current'   ? '#fff9c4'
                  : colores.bg;

    // Sombra
    ctx.shadowColor   = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur    = 6;
    ctx.shadowOffsetY = 2;

    ctx.beginPath();
    tarjetaPath(ctx, x, y, w, h);
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Borde
    ctx.strokeStyle = estado === 'completed' ? '#2e7d32'
                    : estado === 'current'   ? '#f9a825'
                    : colores.border;
    ctx.lineWidth = estado !== 'pending' ? 2.5 : 1.5;
    ctx.beginPath();
    tarjetaPath(ctx, x, y, w, h);
    ctx.stroke();

    // Franja superior de color de agrupación
    ctx.fillStyle = colores.border;
    ctx.beginPath();
    // Solo la franja superior (con esquina cortada)
    ctx.rect(x, y, w - 14, 5);
    ctx.fill();

    // Ícono de estado
    if (estado === 'completed') {
        ctx.fillStyle = '#2e7d32';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('✓', x + w - 16, y + 7);
    } else if (estado === 'current') {
        ctx.fillStyle = '#f57f17';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText('▶', x + w - 16, y + 7);
    }

    // Nombre de la materia
    ctx.fillStyle = colores.text;
    ctx.font = 'bold 9.5px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    wrapText(ctx, materia.nombre, x + 7, y + 10, w - 14, 11, 4);

    // Créditos
    ctx.fillStyle = '#666';
    ctx.font = '9px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${materia.creditos}c`, x + w - 5, y + h - 4);

    // Agrupación (mini)
    ctx.fillStyle = colores.border;
    ctx.font = '7.5px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const grupoCorto = materia.agrupacion.replace('Historia y teoría del diseño gráfico', 'Historia DG')
                                         .replace('Medios de representación', 'Medios repr.')
                                         .replace('El contexto de las artes', 'Contexto artes')
                                         .replace('Talleres de diseño', 'Talleres')
                                         .replace('Medios de producción', 'Medios prod.')
                                         .replace('Imagen fotográfica', 'Fotografía')
                                         .replace('Teoría de la imagen', 'Teoría imagen')
                                         .replace('Trabajo de grado', 'Trabajo grado');
    ctx.fillText(grupoCorto, x + 5, y + h - 3);
}

// ── Utilidades de dibujo ──────────────────────────────────
function tarjetaPath(ctx, x, y, w, h) {
    // Rectángulo con esquina superior derecha cortada (como el original)
    const cut = 14;
    const r   = 5;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - cut, y);
    ctx.lineTo(x + w, y + cut);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    const words = text.split(' ');
    let line = '';
    let lineCount = 0;
    for (let i = 0; i < words.length; i++) {
        const test = line + words[i] + ' ';
        if (ctx.measureText(test).width > maxW && i > 0) {
            if (lineCount < maxLines - 1) {
                ctx.fillText(line.trim(), x, y + lineCount * lineH);
                line = words[i] + ' ';
                lineCount++;
            } else {
                ctx.fillText(line.trim() + '…', x, y + lineCount * lineH);
                return;
            }
        } else {
            line = test;
        }
    }
    ctx.fillText(line.trim(), x, y + lineCount * lineH);
}

// ── Interacción: click sobre tarjeta ─────────────────────
function attachMallaGenEvents() {
    const canvas = document.getElementById('mallaGenCanvas');
    if (!canvas) return;

    canvas.addEventListener('click', (e) => {
        const rect  = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;

        // Buscar tarjeta clicada
        const materia = MALLA_DISENO_GRAFICO.find(m => {
            const c = mallaCoordenadas[m.id];
            return c && cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h;
        });

        if (materia) {
            const actual = mallaEstados[materia.id] || 'pending';
            const ciclo  = { pending: 'current', current: 'completed', completed: 'pending' };
            mallaEstados[materia.id] = ciclo[actual];
            saveMallaEstados();
            dibujarMalla();
            actualizarBarraMallaGen();
        }
    });

    // Tooltip
    canvas.addEventListener('mousemove', (e) => {
        const rect  = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const cx = (e.clientX - rect.left) * scaleX;
        const cy = (e.clientY - rect.top)  * scaleY;

        const materia = MALLA_DISENO_GRAFICO.find(m => {
            const c = mallaCoordenadas[m.id];
            return c && cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h;
        });

        canvas.style.cursor = materia ? 'pointer' : 'default';

        const tooltip = document.getElementById('mallaGenTooltip');
        if (!tooltip) return;

        if (materia) {
            const estado  = mallaEstados[materia.id] || 'pending';
            const estadoLabel = { pending: 'Pendiente', current: 'En curso', completed: 'Aprobada' }[estado];
            const prereqs = (materia.prerequisitos || [])
                .map(pid => MALLA_DISENO_GRAFICO.find(mm => mm.id === pid)?.nombre || pid)
                .join(', ') || 'Ninguno';

            tooltip.innerHTML = `
                <strong>${materia.nombre}</strong><br>
                ${materia.agrupacion} · ${materia.creditos} créditos<br>
                Estado: <em>${estadoLabel}</em><br>
                Prerrequisitos: ${prereqs}
            `;
            tooltip.style.display = 'block';
            tooltip.style.left    = (e.clientX + 14) + 'px';
            tooltip.style.top     = (e.clientY - 10) + 'px';
        } else {
            tooltip.style.display = 'none';
        }
    });

    canvas.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('mallaGenTooltip');
        if (tooltip) tooltip.style.display = 'none';
    });

    // Touch: mismo comportamiento que click
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        canvas.dispatchEvent(new MouseEvent('click', {
            clientX: touch.clientX, clientY: touch.clientY
        }));
    }, { passive: false });
}

// ── Estadísticas rápidas ─────────────────────────────────
function actualizarBarraMallaGen() {
    const total     = MALLA_DISENO_GRAFICO.length;
    const aprobadas = MALLA_DISENO_GRAFICO.filter(m => mallaEstados[m.id] === 'completed').length;
    const encurso   = MALLA_DISENO_GRAFICO.filter(m => mallaEstados[m.id] === 'current').length;

    const creditosAprobados = MALLA_DISENO_GRAFICO
        .filter(m => mallaEstados[m.id] === 'completed')
        .reduce((s, m) => s + m.creditos, 0);

    const el = document.getElementById('mallaGenStats');
    if (el) el.textContent =
        `✅ ${aprobadas}/${total} materias aprobadas  •  ▶ ${encurso} en curso  •  🎓 ${creditosAprobados} créditos aprobados`;
}

// ── Zoom ─────────────────────────────────────────────────
function mallaGenZoomIn() {
    mallaGenScale = Math.min(2.5, mallaGenScale + 0.15);
    aplicarZoomCanvas();
}
function mallaGenZoomOut() {
    mallaGenScale = Math.max(0.4, mallaGenScale - 0.15);
    aplicarZoomCanvas();
}
function mallaGenZoomFit() {
    const wrapper = document.getElementById('mallaGenWrapper');
    if (!wrapper || !mallaGenCanvas) return;
    mallaGenScale = (wrapper.clientWidth - 16) / mallaGenCanvas.width;
    aplicarZoomCanvas();
}
function aplicarZoomCanvas() {
    const canvas = document.getElementById('mallaGenCanvas');
    if (!canvas) return;
    canvas.style.width  = (mallaGenCanvas.width  * mallaGenScale) + 'px';
    canvas.style.height = (mallaGenCanvas.height * mallaGenScale) + 'px';
    const lbl = document.getElementById('mallaGenZoomLabel');
    if (lbl) lbl.textContent = Math.round(mallaGenScale * 100) + '%';
}

// ── Resetear estados ─────────────────────────────────────
function resetMallaEstados() {
    if (!confirm('¿Reiniciar todos los estados de la malla?')) return;
    mallaEstados = {};
    saveMallaEstados();
    dibujarMalla();
    actualizarBarraMallaGen();
}

// ── Hook al showView original ─────────────────────────────
// Se llama desde el nav cuando el usuario abre la vista "malla"
function onMallaViewOpen() {
    if (!mallaGenCanvas) {
        initMallaGenerada();
    } else {
        loadMallaEstados();
        dibujarMalla();
    }
    actualizarBarraMallaGen();
    setTimeout(mallaGenZoomFit, 50);
}
