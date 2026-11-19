import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { auth } from '../firebase';
import { buildContext } from '../lib/context';

const SUGGESTIONS = ['¿Cuánto necesito para aprobar?', '¿Cuál es mi promedio?', 'Analiza mi progreso', '¿Qué materias tomar?'];

export default function Chat({ data }) {
  const [open, setOpen] = useState(false), [msgs, setMsgs] = useState([]), [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const end = useRef();
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  async function send(t = text) {
    t = t.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: 'user', content: t }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: next.slice(-20), context: buildContext(data) })
      });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      setMsgs([...next, { role: 'assistant', content: j.response || 'No pude obtener una respuesta.' }]);
    } catch (e) {
      console.error(e);
      setMsgs([...next, { role: 'assistant', content: '❌ No pude conectarme. Intenta de nuevo en unos segundos.' }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <button id="chatToggleBtn" className={open ? 'active' : ''} onClick={() => setOpen(!open)} title="Asistente IA académico">{open ? '✕' : '🤖'}</button>
      <div id="chatPanel" className={open ? 'open' : ''}>
        <div id="chatHeader">
          <div><div style={{ fontWeight: 700 }}>🤖 Asistente Académico</div><div style={{ fontSize: '.72rem', opacity: .85 }}>Plan de estudios y notas</div></div>
          <button id="chatCloseBtn" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div id="chatMessages">
          <div className="chat-msg ai"><div className="chat-bubble">👋 ¡Hola! Tengo acceso a tu plan de estudios y notas. Pregúntame cuánto necesitas para aprobar, tu promedio, créditos pendientes…</div></div>
          {msgs.map((m, i) => <div key={i} className={'chat-msg ' + (m.role === 'user' ? 'user' : 'ai')}><div className="chat-bubble">{m.role === 'user' ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>}</div></div>)}
          {busy && <div className="chat-msg ai"><div className="chat-bubble chat-loading"><span /><span /><span /></div></div>}
          <div ref={end} />
        </div>
        {!msgs.length && <div id="chatSuggestions">{SUGGESTIONS.map(s => <button key={s} className="chat-suggestion" onClick={() => send(s)}>{s}</button>)}</div>}
        <div id="chatInputArea">
          <textarea id="chatInput" rows={1} value={text} disabled={busy} placeholder="Pregúntame sobre tus notas o plan de estudios..." onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
          <button id="chatSendBtn" disabled={busy} onClick={() => send()}>➤</button>
        </div>
      </div>
    </>
  );
}
