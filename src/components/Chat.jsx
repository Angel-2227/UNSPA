import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sparkles, SendHorizontal, Plus, TrendingUp, Target, BookOpen, ClipboardCheck, User, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import { buildContext } from '../lib/context';
import { PageHeader } from '../ui.jsx';

const SUGGESTIONS = [
  { icon: Target, title: '¿Cuánto necesito para aprobar?', text: 'Calcula la nota que me falta en cada materia que estoy cursando.' },
  { icon: TrendingUp, title: 'Analiza mi progreso', text: 'Un resumen de mis créditos, mi promedio y lo que viene.' },
  { icon: BookOpen, title: '¿Qué materias tomar?', text: 'Recomiéndame materias para el próximo semestre.' },
  { icon: ClipboardCheck, title: '¿Cuál es mi promedio?', text: 'Promedio por semestre y acumulado.' }
];

// La conversación vive en App (msgs/setMsgs) para que no se pierda al cambiar de pantalla
export default function Chat({ data, msgs, setMsgs }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const end = useRef(), box = useRef();
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);
  useEffect(() => { const el = box.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'; } }, [text]);

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
        body: JSON.stringify({ messages: next.filter(m => !m.error).slice(-20), context: buildContext(data) })
      });
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      setMsgs([...next, { role: 'assistant', content: j.response || 'No pude obtener una respuesta.' }]);
    } catch (e) {
      console.error(e);
      setMsgs([...next, { role: 'assistant', error: true, content: 'No pude conectarme. Intenta de nuevo en unos segundos.' }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="chat">
      <PageHeader title="Asistente académico" subtitle="Conoce tu plan, tus notas y tus horarios">
        {msgs.length > 0 && <button className="btn btn-secondary" onClick={() => setMsgs([])}><Plus />Nueva conversación</button>}
      </PageHeader>

      <div className="chat-scroll">
        {!msgs.length ? (
          <div className="chat-welcome">
            <div className="chat-welcome-ico"><Sparkles /></div>
            <h2>¿En qué te ayudo hoy?</h2>
            <p>Pregúntame por tus notas, créditos pendientes o cómo organizar tu próximo semestre.</p>
            <div className="chat-sugs">
              {SUGGESTIONS.map(s => (
                <button key={s.title} className="chat-sug" onClick={() => send(s.title)}>
                  <s.icon /><div><strong>{s.title}</strong><span>{s.text}</span></div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="chat-thread">
            {msgs.map((m, i) => (
              <div key={i} className={'chat-row ' + (m.role === 'user' ? 'user' : 'ai')}>
                <span className="chat-av">{m.role === 'user' ? <User /> : <Sparkles />}</span>
                <div className={'chat-bubble' + (m.error ? ' chat-error' : '')}>
                  {m.error && <AlertCircle />}
                  {m.role === 'user' ? m.content : <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>}
                </div>
              </div>
            ))}
            {busy && <div className="chat-row ai"><span className="chat-av"><Sparkles /></span><div className="chat-bubble chat-loading"><span /><span /><span /></div></div>}
            <div ref={end} />
          </div>
        )}
      </div>

      <div className="chat-composer">
        <textarea ref={box} rows={1} value={text} disabled={busy} placeholder="Escribe tu pregunta…" aria-label="Mensaje"
          onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="chat-send" disabled={busy || !text.trim()} onClick={() => send()} aria-label="Enviar"><SendHorizontal /></button>
      </div>
    </div>
  );
}
