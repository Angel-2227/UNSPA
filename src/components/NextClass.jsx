import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Bell, BellOff, Clock, Send } from 'lucide-react';
import { toast } from '../ui.jsx';
import { DAY_BY_INDEX, canonDay, startMin, roomText } from '../lib/schedule';
import { activeSchedule, sessions, nextClass, whenLabel, inText } from '../lib/rooms';
import { enablePush, disablePush, testPush, hasPushToken } from '../lib/push';

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
    if (on) { ls.set(KEY, '0'); setOn(false); await disablePush(); return toast('Avisos de clase desactivados en este dispositivo'); }
    ls.set(KEY, '1'); setOn(true);
    const r = await enablePush();
    toast(r.ok ? `Listo: este dispositivo te avisará ${LEAD} min antes de cada clase, aunque la app esté cerrada`
      : r.reason === 'config' ? 'Avisos activados solo con la app abierta (falta configurar las notificaciones push)'
      : r.reason === 'denied' ? 'Permiso de notificaciones denegado: actívalo en los ajustes del navegador o de la app'
      : r.reason === 'unsupported' ? 'Este navegador no admite notificaciones con la app cerrada (en iPhone, instala la app en la pantalla de inicio)'
      : 'Avisos activados solo con la app abierta (no se pudo registrar el dispositivo)', r.ok ? 'ok' : 'error');
  }
  async function probar() {
    try {
      const r = await testPush();
      toast(!r.devices ? 'Este dispositivo aún no está registrado: toca la campanita' : r.sent ? `Prueba enviada a ${r.sent} dispositivo${r.sent !== 1 ? 's' : ''}` : `No se pudo enviar (${r.errors?.[0] || 'error'})`, r.sent ? 'ok' : 'error');
    } catch (e) { toast('No se pudo enviar la prueba: ' + e.message, 'error'); }
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
      {on && <button className="icon-btn nc-bell" onClick={probar} title="Enviar notificación de prueba" aria-label="Enviar notificación de prueba"><Send /></button>}
      <button className={'icon-btn nc-bell' + (on ? ' on' : '')} onClick={toggle} title={on ? 'Desactivar avisos' : `Avisarme ${LEAD} min antes`} aria-label={on ? 'Desactivar avisos de clase' : 'Activar avisos de clase'}>
        {on ? <Bell /> : <BellOff />}
      </button>
    </section>
  );
}

// Sin interfaz: vive en toda la app.
// 1) Guarda en la nube tu agenda de clases (la lee el servidor que manda los push con la app cerrada).
// 2) Si ya activaste los avisos en este dispositivo, lo registra para recibir push.
// 3) Con la app abierta avisa en pantalla LEAD min antes (y notificación local si no hay push).
export function ClassAlerts({ data, update }) {
  const blocks = useMemo(() => sessions(data, activeSchedule(data.schedules)), [data]);
  const ref = useRef(blocks); ref.current = blocks;

  const agenda = useMemo(() => blocks.map(b => ({ k: `${b.id}|${b.dia}|${b.inicio}`, dia: b.dia, inicio: b.inicio, fin: b.fin, materia: b.subject.name, lugar: roomText(b) })), [blocks]);
  const agendaJson = JSON.stringify(agenda);
  useEffect(() => {
    if (!update) return;
    if (agendaJson === JSON.stringify(data.classAgenda || [])) return;
    update({ classAgenda: JSON.parse(agendaJson), classAgendaTz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota' });
  }, [agendaJson]); // eslint-disable-line

  useEffect(() => { if (ls.get(KEY) === '1' && 'Notification' in window && Notification.permission === 'granted') enablePush({ ask: false }); }, []);

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
        toast(`${title} · ${body}`);
        if (!hasPushToken()) notify(title, body, k); // con push registrado, la notificación la manda el servidor (evita duplicados)
      });
    };
    tick(); const t = setInterval(tick, 30000); return () => clearInterval(t);
  }, []);
  return null;
}
