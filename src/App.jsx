import { Component, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  LayoutDashboard, ClipboardList, Network, Library, CalendarDays, ListChecks, Sparkles, Settings as Cog,
  Sun, Moon, LogOut, MoreHorizontal, GraduationCap, Lock, TriangleAlert, Download, BarChart3
} from 'lucide-react';
import { auth, provider } from './firebase';
import { useUserData } from './useUserData';
import Overview from './components/Overview.jsx';
import Grades from './components/Grades.jsx';
import Chat from './components/Chat.jsx';
import Bank from './components/Bank.jsx';
import Horarios from './components/Horarios.jsx';
import Malla from './components/Malla.jsx';
import Tasks from './components/Tasks.jsx';
import Settings from './components/Settings.jsx';
import { ClassAlerts } from './components/NextClass.jsx';
import { overallAvg, ensureGrades } from './lib/grades';
import { CareerSwitch } from './components/Homolog.jsx';
import { careerData, careerUpdate, mergedData, mergedUpdate, effStatus, makeDbl, summary } from './lib/double';
import { Toaster, Ring } from './ui.jsx';

const GoogleG = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z" />
    <path fill="#34A853" d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z" />
    <path fill="#FBBC05" d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z" />
    <path fill="#EA4335" d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z" />
  </svg>
);

function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await signInWithPopup(auth, provider); } catch (e) { alert('Error al iniciar sesión: ' + e.message); setBusy(false); }
  };
  return (
    <div className="login">
      <div className="login-card">
        <div className="login-logo"><GraduationCap /></div>
        <h1>Sistema de Planificación Académica</h1>
        <p className="login-sub">Organiza tu carrera universitaria</p>
        <ul className="login-feats">
          <li><BarChart3 /><span>Progreso de créditos y promedio</span></li>
          <li><CalendarDays /><span>Horarios y tareas en un solo lugar</span></li>
          <li><Sparkles /><span>Asistente con IA que conoce tu plan</span></li>
        </ul>
        <button className="login-google" disabled={busy} onClick={go}><GoogleG />{busy ? 'Iniciando sesión…' : 'Continuar con Google'}</button>
        <p className="login-note"><Lock />Tus datos se sincronizan de forma segura en la nube</p>
      </div>
    </div>
  );
}

class Boundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('Error en la interfaz:', err, info?.componentStack); }
  componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="card boundary">
        <div className="empty-ico"><TriangleAlert /></div>
        <h3>Algo salió mal en esta pantalla</h3>
        <p>Tus datos están a salvo. Puedes reintentar o recargar.</p>
        <pre>{String(this.state.err?.message || this.state.err)}</pre>
        <div className="row"><button className="btn btn-primary" onClick={() => this.setState({ err: null })}>Reintentar</button><button className="btn btn-secondary" onClick={() => location.reload()}>Recargar</button></div>
      </div>
    );
  }
}

// Navegación: grupos en el menú lateral; `tab` = pestañas de la barra inferior en celular
const NAV = [
  { id: 'overview', label: 'Mi plan', short: 'Inicio', icon: LayoutDashboard, group: 'Académico' },
  { id: 'grades', label: 'Notas', short: 'Notas', icon: ClipboardList, group: 'Académico' },
  { id: 'malla', label: 'Malla curricular', short: 'Malla', icon: Network, group: 'Académico' },
  { id: 'subjects', label: 'Banco de materias', short: 'Materias', icon: Library, group: 'Académico' },
  { id: 'schedule', label: 'Horarios', short: 'Horarios', icon: CalendarDays, group: 'Organización' },
  { id: 'tasks', label: 'Tareas', short: 'Tareas', icon: ListChecks, group: 'Organización' },
  { id: 'assistant', label: 'Asistente IA', short: 'Asistente', icon: Sparkles, group: 'Asistente' },
  { id: 'config', label: 'Ajustes', short: 'Ajustes', icon: Cog, group: null }
];
const TABS = ['overview', 'schedule', 'assistant', 'tasks'];
const GROUPS = ['Académico', 'Organización', 'Asistente'];
const PER_CAREER = ['overview', 'subjects', 'malla', 'grades', 'config'];

const Avatar = ({ user, size = 36 }) => user.photoURL
  ? <img className="avatar" style={{ width: size, height: size }} src={user.photoURL} alt="" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.display = 'none'; }} />
  : <span className="avatar avatar-fallback" style={{ width: size, height: size }}>{(user.displayName || user.email || '?')[0].toUpperCase()}</span>;

// Toda la interfaz recibe los datos por props (así se puede probar sin Firebase)
export function Main({ user, data: root, update: rootUpdate, discard, logout }) {
  const [view, setView] = useState('overview');
  const [more, setMore] = useState(false);
  const [career, setCareer] = useState('main');
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const [chat, setChat] = useState([]); // la conversación sobrevive al cambiar de pantalla
  const act = root.doble ? career : 'main';

  // Cada pantalla recibe los datos de UNA carrera (la activa); Horarios y Tareas ven las dos juntas
  const eff = useMemo(() => effStatus(root), [root.studyPlan, root.doble, root.homologaciones]); // eslint-disable-line
  const data = useMemo(() => careerData(root, act), [root, act]);
  const update = useMemo(() => careerUpdate(rootUpdate, act), [rootUpdate, act]);
  const shared = useMemo(() => mergedData(root), [root]);
  const sharedUpdate = useMemo(() => mergedUpdate(rootUpdate), [rootUpdate]);
  const dbl = makeDbl(root, rootUpdate, act, eff, setCareer);

  const g = useMemo(() => ensureGrades(data.studyPlan, data.gradesData || {}, data.subjectBank || []), [data]);
  const sm = summary(root, act, eff);
  const avg = overallAvg(data.studyPlan, g);

  const toggleTheme = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); setTheme(t);
  };
  const go = k => { setView(k); setMore(false); window.scrollTo(0, 0); };
  const cur = NAV.find(n => n.id === view);
  const ThemeIco = theme === 'dark' ? Sun : Moon;
  const chatView = view === 'assistant';

  return (
    <div className={'shell' + (chatView ? ' shell-chat' : '')}>
      {/* ── Barra superior (celular / tablet) ── */}
      <div className="topbar">
        <div className="topbar-title"><span className="topbar-logo"><GraduationCap /></span><span>{cur.label}</span></div>
        <button className="icon-btn" onClick={toggleTheme} aria-label="Cambiar tema"><ThemeIco /></button>
      </div>

      {/* ── Menú lateral (escritorio) ── */}
      <aside className="side">
        <div className="side-brand">
          <span className="side-logo"><GraduationCap /></span>
          <div><strong>SPA</strong><small>Planificación Académica</small></div>
        </div>
        <nav className="side-nav">
          {GROUPS.map(gr => (
            <div key={gr} className="side-group">
              <div className="side-group-title">{gr}</div>
              {NAV.filter(n => n.group === gr).map(n => (
                <button key={n.id} className={'side-link' + (view === n.id ? ' active' : '') + (n.id === 'assistant' ? ' side-link-ai' : '')} onClick={() => go(n.id)}>
                  <n.icon /><span>{n.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="side-foot">
          <div className="side-progress" onClick={() => go('overview')} role="button" tabIndex={0}>
            <Ring pct={sm.pct} size={52} stroke={6}><b>{sm.pct}%</b></Ring>
            <div>
              <strong>{sm.done}<span>/{sm.req} cr.</span></strong>
              <small>Promedio {avg !== null ? avg.toFixed(2) : '—'}</small>
            </div>
          </div>
          <button className={'side-link' + (view === 'config' ? ' active' : '')} onClick={() => go('config')}><Cog /><span>Ajustes</span></button>
          <div className="side-user">
            <Avatar user={user} size={34} />
            <div className="side-user-name"><strong>{user.displayName || user.email || 'Usuario'}</strong></div>
            <button className="icon-btn" onClick={toggleTheme} title="Cambiar tema" aria-label="Cambiar tema"><ThemeIco /></button>
            <button className="icon-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"><LogOut /></button>
          </div>
        </div>
      </aside>

      {/* ── Contenido ── */}
      <main className="content">
        <div className="content-inner">
          <Boundary resetKey={view + act}>
            {dbl.enabled && PER_CAREER.includes(view) && <CareerSwitch dbl={dbl} />}
            {view === 'overview' && <Overview key={act} data={data} update={update} dbl={dbl} viewData={shared} goTasks={() => go('tasks')} goGrades={() => go('grades')} goSchedule={() => go('schedule')} />}
            {view === 'subjects' && <Bank key={act} data={data} update={update} />}
            {view === 'schedule' && <Horarios data={shared} update={sharedUpdate} />}
            {view === 'malla' && <Malla key={act} data={data} update={update} user={user} dbl={dbl} />}
            {view === 'grades' && <Grades key={act} data={data} update={update} />}
            {view === 'tasks' && <Tasks data={shared} update={sharedUpdate} />}
            {view === 'assistant' && <Chat data={root} msgs={chat} setMsgs={setChat} />}
            {view === 'config' && <Settings key={act} data={data} update={update} user={user} discard={discard} dbl={dbl} theme={theme} toggleTheme={toggleTheme} logout={logout} />}
          </Boundary>
        </div>
      </main>

      {/* ── Navegación inferior (celular / tablet) ── */}
      {more && <div className="sheet-overlay" onClick={() => setMore(false)} />}
      {more && (
        <div className="sheet" role="dialog" aria-label="Más secciones">
          <div className="sheet-handle" />
          <div className="sheet-user"><Avatar user={user} size={40} /><div><strong>{user.displayName || 'Usuario'}</strong><small>{user.email}</small></div></div>
          <div className="sheet-grid">
            {NAV.filter(n => !TABS.includes(n.id)).map(n => (
              <button key={n.id} className={view === n.id ? 'active' : ''} onClick={() => go(n.id)}><n.icon /><span>{n.label}</span></button>
            ))}
          </div>
          <div className="sheet-foot">
            <button onClick={toggleTheme}><ThemeIco /><span>{theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}</span></button>
            <button onClick={logout}><LogOut /><span>Cerrar sesión</span></button>
          </div>
        </div>
      )}
      <nav className="tabbar">
        {TABS.map(k => {
          const n = NAV.find(x => x.id === k);
          return (
            <button key={k} className={(view === k ? 'active' : '') + (k === 'assistant' ? ' tab-ai' : '')} onClick={() => go(k)} aria-label={n.label}>
              <span className="tab-ico"><n.icon /></span><span className="tab-lbl">{n.short}</span>
            </button>
          );
        })}
        <button className={more || !TABS.includes(view) ? 'active' : ''} onClick={() => setMore(!more)} aria-label="Más">
          <span className="tab-ico"><MoreHorizontal /></span><span className="tab-lbl">Más</span>
        </button>
      </nav>
      <ClassAlerts data={shared} />
      <Toaster />
    </div>
  );
}

export function Shell({ user }) {
  const { data, update, discard } = useUserData(user);
  if (!data) return <div className="boot"><div className="boot-spin" /><span>Cargando tus datos…</span></div>;
  const logout = () => confirm('¿Cerrar sesión? Tus datos están guardados en la nube.') && signOut(auth);
  return <Main user={user} data={data} update={update} discard={discard} logout={logout} />;
}

function InstallButton() {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    const on = e => { e.preventDefault(); setEv(e); }, off = () => setEv(null);
    addEventListener('beforeinstallprompt', on); addEventListener('appinstalled', off);
    return () => { removeEventListener('beforeinstallprompt', on); removeEventListener('appinstalled', off); };
  }, []);
  if (!ev) return null;
  return <button className="install-btn" onClick={async () => { ev.prompt(); await ev.userChoice; setEv(null); }}><Download />Instalar app</button>;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div className="boot"><div className="boot-spin" /><span>Cargando…</span></div>;
  return user ? <><Boundary><Shell user={user} /></Boundary><InstallButton /></> : <Login />;
}
