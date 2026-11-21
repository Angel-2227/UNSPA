import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Bell, BellOff, Clock } from 'lucide-react';
import { toast } from '../ui.jsx';
import { DAY_BY_INDEX, canonDay, startMin, roomText } from '../lib/schedule';
import { activeSchedule, sessions, nextClass, whenLabel, inText } from '../lib/rooms';

const KEY = 'spa-class-alerts', SEEN = 'spa-class-alerts-seen', LEAD = 15; // minutos de anticipación
const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };

function useNow(ms = 30000) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

async function notify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) return await reg.showNotification(title, { body, tag, icon: '/img/icon-192.png', badge: '/img/icon-192.png' });
  } catch {}
  try { new Notification(title, { body, tag, icon: '/img/icon-192.png' }); } catch {}
}

// Aviso permanente en "Mi plan": clase en curso o próxima clase, con salón y edificio
export function NextClassCard({ data, schedule, onOpen }) {
  const now = useNow(), [on, setOn] = useState(ls.get(KEY) === '1');
  const blocks = useMemo(() => sessions(data, schedule), [data, schedule]);
  const { current, next } = useMemo(() => nextClass(blocks, now), [blocks, now]);
  const b = current || next;
  if (!b) return null;

  async function toggle() {
    if (on) { ls.set(KEY, '0'); setOn(false); return toast('Avisos de clase desactivados'); }
    ls.set(KEY, '1'); setOn(true);
    let perm = 'unsupported';
    if ('Notification' in window) perm = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    toast(perm === 'granted' ? `Te aviso ${LEAD} min antes de cada clase` : `Avisos activados dentro de la app (sin notificaciones del sistema)`);
  }

  const room = roomText(b), when = current ? `hasta ${b.fin}` : `${whenLabel(b.start, now)}${inText(b.start - now) ? ` · ${inText(b.start - now)}` : ''}`;
  return (
    <section className={'nextclass card' + (current ? ' is-now' : '')} style={{ '--class-color': b.color }}>
      <span className="nc-ico"><Clock /></span>
      <div className="nc-body">
        <div className="nc-kicker">{current ? 'Ahora en clase' : 'Próxima clase'} · {when}</div>
        <div className="nc-title">{b.subject.name}</div>
        <div className="nc-where">
          {room ? <span className="nc-room"><MapPin />{room}</span>
            : <button className="nc-add" onClick={onOpen}><MapPin />Agregar salón y edificio</button>}
          {b.grupo?.numero ? <span className="nc-meta">Grupo {b.grupo.numero}</span> : null}
          <span className="nc-meta">{b.inicio}–{b.fin}</span>
        </div>
      </div>
      <button className={'icon-btn nc-bell' + (on ? ' on' : '')} onClick={toggle} title={on ? 'Desactivar avisos' : `Avisarme ${LEAD} min antes`} aria-label={on ? 'Desactivar avisos de clase' : 'Activar avisos de clase'}>
        {on ? <Bell /> : <BellOff />}
      </button>
    </section>
  );
}

// Sin interfaz: vive en toda la app y avisa (aviso en pantalla + notificación) LEAD min antes de cada clase
export function ClassAlerts({ data }) {
  const blocks = useMemo(() => sessions(data, activeSchedule(data.schedules)), [data]);
  const ref = useRef(blocks); ref.current = blocks;
  useEffect(() => {
    const tick = () => {
      if (ls.get(KEY) !== '1') return;
      const now = new Date(), today = canonDay(DAY_BY_INDEX[now.getDay()]), nm = now.getHours() * 60 + now.getMinutes();
      let seen; try { seen = JSON.parse(ls.get(SEEN) || '[]'); } catch { seen = []; }
      ref.current.forEach(b => {
        const left = startMin(b.inicio) - nm;
        if (b.dia !== today || left < 0 || left > LEAD) return;
        const k = `${now.toDateString()}|${b.id}|${b.dia}|${b.inicio}`;
        if (seen.includes(k)) return;
        seen.push(k); ls.set(SEEN, JSON.stringify(seen.slice(-60)));
        const title = `${b.subject.name} ${left === 0 ? 'empieza ahora' : `empieza en ${left} min`}`, body = roomText(b) || 'Salón sin definir';
        toast(`${title} · ${body}`); notify(title, body, k);
      });
    };
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t);
  }, []);
  return null;
}
