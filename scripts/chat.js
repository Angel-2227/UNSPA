// ============================================
// ASISTENTE IA — CHAT FLOTANTE
// Archivo independiente: scripts/chat.js
// ============================================

// ⚠️ REEMPLAZA esta URL con la de tu Cloudflare Worker
const WORKER_URL = 'https://spa-unal-ai.mwp.workers.dev/';

let chatHistory = [];
let chatOpen = false;
let chatWidgetReady = false;

// ---- Construir contexto académico para enviar al Worker ----
function buildAcademicContext() {
    let completedCredits = 0, currentCredits = 0;

    const semestersArray = Object.entries(studyPlan).map(([num, sem]) => {
        const credits = sem.subjects.reduce((s, sub) => s + sub.credits, 0);
        if (sem.status === 'completed') completedCredits += credits;
        if (sem.status === 'current') currentCredits += credits;
        return {
            number: num,
            status: sem.status,
            subjects: sem.subjects.map(s => ({
                name: s.name, credits: s.credits, type: s.type,
                code: s.code || '', professor: s.professor || '', group: s.group || ''
                
            })),
            // Dentro del return de buildAcademicContext, añade esta línea:
contenidoProgramatico: (typeof buildContenidoContext === 'function') ? buildContenidoContext() : null,
        };
    }).sort((a, b) => parseInt(a.number) - parseInt(b.number));

    const total = config.totalCredits || 1;
    const pending = Math.max(0, total - completedCredits - currentCredits);
    const progress = Math.round((completedCredits / total) * 100);

    // ---- INCLUIR NOTAS si el módulo de grades está disponible ----
    const gradesContext = (typeof buildGradesContext === 'function') ? buildGradesContext() : null;

    return {
        programName: config.programName || 'No especificado',
        university: config.university || 'No especificada',
        totalCredits: config.totalCredits || 0,
        completedCredits, currentCredits,
        pendingCredits: pending,
        progressPercentage: progress,
        currentPeriod: currentPeriodConfig.period || '',
        semesters: semestersArray,
        subjectBank: subjectBank.map(s => ({
            name: s.name, credits: s.credits, type: s.type,
            code: s.code || '', horariosInfo: s.horariosInfo || []
        })),
        schedules: schedules.map(s => ({
            name: s.name, period: s.period, subjects: s.subjects
        })),
        mallaMarks,
        grades: gradesContext   // ← NUEVO: notas del estudiante
    };
}

// ---- Enviar mensaje al Worker ----
async function sendMessageToAI(userMessage) {
    chatHistory.push({ role: 'user', content: userMessage });
    const context = buildAcademicContext();

    const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, context })
    });

    if (!response.ok) throw new Error(`Error ${response.status}`);
    const data = await response.json();
    const aiMessage = data.response || 'No pude obtener una respuesta.';

    chatHistory.push({ role: 'assistant', content: aiMessage });
    if (chatHistory.length > 20) chatHistory = chatHistory.slice(chatHistory.length - 20);
    return aiMessage;
}

// ---- Crear widget en el DOM ----
function initChatWidget() {
    if (chatWidgetReady) return;
    chatWidgetReady = true;

    // Estilos
    const style = document.createElement('style');
    style.textContent = `
        #chatToggleBtn {
            position: fixed;
            bottom: 28px;
            right: 28px;
            z-index: 9000;
            width: 58px;
            height: 58px;
            border-radius: 50%;
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
            color: white;
            border: none;
            font-size: 1.6rem;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(46,125,50,0.45);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #chatToggleBtn:hover { transform: scale(1.1); }
        #chatToggleBtn.active { background: linear-gradient(135deg, #555, #333); }

        #chatPanel {
            position: fixed;
            bottom: 100px;
            right: 28px;
            z-index: 8999;
            width: 380px;
            max-width: calc(100vw - 32px);
            height: 560px;
            max-height: calc(100vh - 120px);
            background: var(--bg-primary, #fff);
            border-radius: 16px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.2);
            border: 1px solid var(--border-color, #dee2e6);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            transform: translateY(20px) scale(0.95);
            pointer-events: none;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        #chatPanel.open {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }
        #chatHeader {
            background: linear-gradient(135deg, #2e7d32, #1b5e20);
            color: white;
            padding: 14px 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        #chatCloseBtn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 0.9rem;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #chatCloseBtn:hover { background: rgba(255,255,255,0.35); }

        #chatMessages {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            scroll-behavior: smooth;
        }
        .chat-msg { display: flex; }
        .chat-msg.user { justify-content: flex-end; }
        .chat-msg.ai   { justify-content: flex-start; }

        .chat-bubble {
            max-width: 82%;
            padding: 10px 14px;
            border-radius: 16px;
            font-size: 0.875rem;
            line-height: 1.5;
            word-wrap: break-word;
        }
        .chat-msg.user .chat-bubble {
            background: #2e7d32;
            color: white;
            border-bottom-right-radius: 4px;
        }
        .chat-msg.ai .chat-bubble {
            background: var(--bg-secondary, #f8f9fa);
            color: var(--text-primary, #212529);
            border: 1px solid var(--border-color, #dee2e6);
            border-bottom-left-radius: 4px;
        }

        .chat-loading { display: flex; align-items: center; gap: 5px; padding: 12px 16px; }
        .chat-loading span {
            width: 8px; height: 8px;
            background: #2e7d32;
            border-radius: 50%;
            animation: chatDot 1.2s infinite;
        }
        .chat-loading span:nth-child(2) { animation-delay: 0.2s; }
        .chat-loading span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes chatDot {
            0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
            40%           { transform: scale(1);   opacity: 1;   }
        }

        #chatSuggestions {
            padding: 0 12px 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            flex-shrink: 0;
        }
        .chat-suggestion {
            background: var(--bg-secondary, #f8f9fa);
            border: 1px solid var(--border-color, #dee2e6);
            border-radius: 20px;
            padding: 5px 12px;
            font-size: 0.75rem;
            cursor: pointer;
            color: #2e7d32;
            font-weight: 500;
            transition: all 0.2s;
        }
        .chat-suggestion:hover { background: #2e7d32; color: white; border-color: #2e7d32; }

        #chatInputArea {
            display: flex;
            align-items: flex-end;
            gap: 8px;
            padding: 12px 14px;
            border-top: 1px solid var(--border-color, #dee2e6);
            flex-shrink: 0;
            background: var(--bg-primary, #fff);
        }
        #chatInput {
            flex: 1;
            border: 1px solid var(--border-color, #dee2e6);
            border-radius: 20px;
            padding: 8px 14px;
            font-size: 0.875rem;
            resize: none;
            outline: none;
            background: var(--bg-secondary, #f8f9fa);
            color: var(--text-primary, #212529);
            max-height: 120px;
            line-height: 1.4;
            font-family: inherit;
            transition: border-color 0.2s;
        }
        #chatInput:focus { border-color: #2e7d32; }

        #chatSendBtn {
            width: 38px; height: 38px;
            border-radius: 50%;
            background: #2e7d32;
            color: white;
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            transition: all 0.2s;
        }
        #chatSendBtn:hover   { background: #1b5e20; transform: scale(1.05); }
        #chatSendBtn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        @media (max-width: 480px) {
            #chatPanel      { right: 12px; bottom: 90px; width: calc(100vw - 24px); }
            #chatToggleBtn  { right: 16px; bottom: 20px; }
        }
    `;
    document.head.appendChild(style);

    // HTML del widget
    const widget = document.createElement('div');
    widget.id = 'aiChatWidget';
    widget.innerHTML = `
        <button id="chatToggleBtn" onclick="toggleChat()" title="Asistente IA académico">
            <span id="chatBtnIcon">🤖</span>
        </button>

        <div id="chatPanel">
            <div id="chatHeader">
                <div style="display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.4rem;">🤖</span>
                    <div>
                        <div style="font-weight:700;font-size:0.95rem;">Asistente Académico</div>
                        <div style="font-size:0.72rem;opacity:0.85;">Powered by Groq · Plan de estudios y notas</div>
                    </div>
                </div>
                <button onclick="toggleChat()" id="chatCloseBtn">✕</button>
            </div>

            <div id="chatMessages">
                <div class="chat-msg ai">
                    <div class="chat-bubble">
                        👋 ¡Hola! Soy tu asistente académico.<br><br>
                        Tengo acceso a tu plan de estudios, notas y progreso. Puedo ayudarte con:<br>
                        • ¿Cuánto necesito sacarme en X para aprobar?<br>
                        • ¿Cuál es mi promedio acumulado?<br>
                        • ¿Qué materias ver el próximo semestre?<br>
                        • ¿Cuántos créditos me faltan?<br><br>
                        ¿En qué te ayudo?
                    </div>
                </div>
            </div>

            <div id="chatSuggestions">
                <button class="chat-suggestion" onclick="useSuggestion(this)">¿Cuánto necesito para aprobar?</button>
                <button class="chat-suggestion" onclick="useSuggestion(this)">¿Cuál es mi promedio?</button>
                <button class="chat-suggestion" onclick="useSuggestion(this)">Analiza mi progreso</button>
                <button class="chat-suggestion" onclick="useSuggestion(this)">¿Qué materias tomar?</button>
            </div>

            <div id="chatInputArea">
                <textarea id="chatInput"
                    placeholder="Pregúntame sobre tus notas o plan de estudios..."
                    rows="1"
                    onkeydown="handleChatKey(event)"
                    oninput="autoResizeTextarea(this)"></textarea>
                <button id="chatSendBtn" onclick="handleChatSend()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2.5">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);
}

// ---- Funciones del chat ----
function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatPanel');
    const icon  = document.getElementById('chatBtnIcon');
    const btn   = document.getElementById('chatToggleBtn');

    if (chatOpen) {
        panel.classList.add('open');
        btn.classList.add('active');
        icon.textContent = '✕';
        setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
    } else {
        panel.classList.remove('open');
        btn.classList.remove('active');
        icon.textContent = '🤖';
    }
}

function useSuggestion(btn) {
    document.getElementById('chatInput').value = btn.textContent;
    document.getElementById('chatSuggestions').style.display = 'none';
    handleChatSend();
}

function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
}

function autoResizeTextarea(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function handleChatSend() {
    const input   = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;

    document.getElementById('chatSuggestions').style.display = 'none';
    input.value = '';
    input.style.height = 'auto';

    appendChatMessage('user', message);
    const loadingId = appendLoadingMessage();
    input.disabled = true;
    document.getElementById('chatSendBtn').disabled = true;

    try {
        const aiResponse = await sendMessageToAI(message);
        removeLoadingMessage(loadingId);
        appendChatMessage('ai', aiResponse);
    } catch (error) {
        removeLoadingMessage(loadingId);
        console.error('Error IA:', error);
        const msg = WORKER_URL.includes('TU_WORKER')
            ? '⚙️ Configura primero el Worker: actualiza <code>WORKER_URL</code> en <code>scripts/chat.js</code>.'
            : '❌ No pude conectarme. Intenta de nuevo en unos segundos.';
        appendChatMessage('ai', msg);
    } finally {
        input.disabled = false;
        document.getElementById('chatSendBtn').disabled = false;
        input.focus();
    }
}

function appendChatMessage(role, content) {
    const messages  = document.getElementById('chatMessages');
    const div       = document.createElement('div');
    div.className   = `chat-msg ${role}`;
    const formatted = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g,     '<em>$1</em>')
        .replace(/`(.*?)`/g,       '<code>$1</code>')
        .replace(/\n/g,            '<br>');
    div.innerHTML = `<div class="chat-bubble">${formatted}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
}

function appendLoadingMessage() {
    const messages = document.getElementById('chatMessages');
    const id  = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.className = 'chat-msg ai';
    div.id = id;
    div.innerHTML = `<div class="chat-bubble chat-loading"><span></span><span></span><span></span></div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return id;
}

function removeLoadingMessage(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

// ---- Auto-inicializar cuando el usuario esté autenticado ----
(function waitForAuth() {
    const interval = setInterval(() => {
        if (typeof currentUser !== 'undefined' && currentUser && typeof studyPlan !== 'undefined') {
            initChatWidget();
            clearInterval(interval);
        }
    }, 600);

    if (typeof firebase !== 'undefined') {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                clearInterval(interval);
                setTimeout(() => initChatWidget(), 1500);
            }
        });
    }
})();