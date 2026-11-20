import { Component, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, provider } from './firebase';
import { useUserData } from './useUserData';
import Overview from './components/Overview.jsx';
import Grades from './components/Grades.jsx';
import Chat from './components/Chat.jsx';
import Bank from './components/Bank.jsx';
import Schedule from './components/Schedule.jsx';
import Malla from './components/Malla.jsx';
import Tasks from './components/Tasks.jsx';
import Settings from './components/Settings.jsx';
import Cronogramas from './components/Cronogramas.jsx';
import { overallAvg, ensureGrades } from './lib/grades';
import { CareerSwitch } from './components/Homolog.jsx';
import { careerData, careerUpdate, mergedData, mergedUpdate, effStatus, makeDbl, summary } from './lib/double';

function Login() {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try { await signInWithPopup(auth, provider); } catch (e) { alert('Error al iniciar sesión: ' + e.message); setBusy(false); }
  };
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#2e7d32,#1b5e20)', padding: 20 }}>
      <div style={{ background: '#fff', padding: 40, borderRadius: 20, maxWidth: 400, width: '100%', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ width: 80, height: 80, background: 'linear-gradient(135deg,#2e7d32,#66bb6a)', borderRadius: 20, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', color: '#fff', fontWeight: 700 }}>SPA</div>
        <h1 style={{ color: '#2e7d32', fontSize: '1.6rem', marginBottom: 8 }}>Sistema de Planificación Académica</h1>
        <p style={{ color: '#6c757d', marginBottom: 32 }}>Organiza tu carrera universitaria</p>
        <button disabled={busy} onClick={go} style={{ width: '100%', padding: '14px 24px', background: '#fff', border: '2px solid #e0e0e0', borderRadius: 8, fontSize: '1rem', fontWeight: 600, cursor: 'pointer', color: '#212529' }}>
          {busy ? 'Iniciando sesión...' : 'Continuar con Google'}
        </button>
        <p style={{ marginTop: 24, fontSize: '.85rem', color: '#6c757d' }}>🔒 Tus datos se sincronizan de forma segura en la nube</p>
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
      <div style={{ margin: '40px auto', maxWidth: 520, padding: 24, borderRadius: 14, border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
        <h3 style={{ marginBottom: 8 }}>⚠️ Algo salió mal en esta pantalla</h3>
        <p style={{ fontSize: '.88rem', color: 'var(--text-secondary)', marginBottom: 12 }}>Tus datos están a salvo. Puedes reintentar o recargar.</p>
        <pre style={{ fontSize: '.72rem', whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', padding: 10, borderRadius: 8, marginBottom: 14 }}>{String(this.state.err?.message || this.state.err)}</pre>
        <div style={{ display: 'flex', gap: 10 }}><button className="btn btn-primary" onClick={() => this.setState({ err: null })}>Reintentar</button><button className="btn btn-secondary" onClick={() => location.reload()}>Recargar</button></div>
      </div>
    );
  }
}

const NAV = [['overview', '📊', 'Resumen General', 'Resumen'], ['subjects', '📚', 'Banco de Materias', 'Banco'], ['schedule', '📅', 'Planificador de Horarios', 'Horarios'], ['cronos', '🗓️', 'Cronogramas', 'Cronos'],
  ['malla', '🗺️', 'Malla Curricular', 'Malla'], ['grades', '📝', 'Notas', 'Notas'], ['tasks', '✅', 'Tareas', 'Tareas'], ['config', '⚙️', 'Configuración', 'Ajustes']];
const BOTTOM = ['overview', 'grades', 'schedule', 'tasks'];

// Toda la interfaz, recibe los datos por props (así se puede probar sin Firebase)
export function Main({ user, data: root, update: rootUpdate, discard, logout }) {
  const [view, setView] = useState('overview');
  const [side, setSide] = useState(false), [more, setMore] = useState(false);
  const [focus, setFocus] = useState(null);
  const [career, setCareer] = useState('main');
  const act = root.doble ? career : 'main';

  // Cada pantalla recibe los datos de UNA carrera (la activa); Horarios, Tareas y Cronogramas ven las dos juntas
  const eff = useMemo(() => effStatus(root), [root.studyPlan, root.doble, root.homologaciones]); // eslint-disable-line
  const data = useMemo(() => careerData(root, act), [root, act]);
  const update = useMemo(() => careerUpdate(rootUpdate, act), [rootUpdate, act]);
  const shared = useMemo(() => mergedData(root), [root]);
  const sharedUpdate = useMemo(() => mergedUpdate(rootUpdate), [rootUpdate]);
  const dbl = makeDbl(root, rootUpdate, act, eff, setCareer);

  const g = useMemo(() => ensureGrades(data.studyPlan, data.gradesData || {}, data.subjectBank || []), [data]);
  const plan = data.studyPlan;
  const sm = summary(root, act, eff);
  const done = sm.done, cur = sm.cur, total = sm.req || 1, pct = sm.pct;
  const avg = overallAvg(plan, g);
  const toggleTheme = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
  const go = k => { setView(k); setSide(false); setMore(false); window.scrollTo(0, 0); };
  const active = Object.keys(plan).filter(n => plan[n].subjects?.length && plan[n].status !== 'pending').sort((a, b) => a - b);
  const cur_ = NAV.find(n => n[0] === view);
  const perCareer = ['overview', 'subjects', 'malla', 'grades', 'config'].includes(view);

  return (
    <>
      <div className="m-topbar"><div className="m-topbar-title"><span className="m-topbar-logo">SPA</span>{cur_[1]} {cur_[3]}</div><button className="m-topbar-btn" onClick={toggleTheme} aria-label="Cambiar tema">🌓</button></div>
      <button className="mobile-toggle" onClick={() => setSide(!side)}>☰</button>
      <div className={'sidebar-overlay' + (side ? ' open' : '')} onClick={() => setSide(false)} />
      <div className="app-container">
        <aside className={'sidebar' + (side ? ' open' : '')} id="sidebar">
          <div className="sidebar-header"><h1>SPA</h1><p>Sistema de Planificación Académica</p></div>
          <nav className="sidebar-nav">{NAV.map(([k, i, l]) => <div key={k} className={'nav-item' + (view === k ? ' active' : '')} onClick={() => go(k)}>{i} {l}</div>)}</nav>
          <div className="sidebar-section">
            <div className="section-title">Estadísticas Rápidas</div>
            <div style={{ fontSize: '.85rem' }}>
              <div style={{ marginBottom: 8 }}><strong>Progreso:</strong> {pct}%</div>
              <div style={{ marginBottom: 8 }}><strong>Completados:</strong> {done}</div>
              <div style={{ marginBottom: 8 }}><strong>Pendientes:</strong> {sm.pending}</div>
              <div style={{ marginBottom: 8 }}><strong>Promedio:</strong> {avg !== null ? avg.toFixed(2) : 'N/A'}</div>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: pct + '%' }} /></div>
          </div>
          <div className="sidebar-section">
            <div className="section-title">Semestres Activos</div>
            {active.map(n => <div key={n} onClick={() => { setView('overview'); setSide(false); setFocus({ n, t: Date.now() }); }} style={{ fontSize: '.8rem', marginBottom: 6, padding: '4px 8px', background: 'var(--bg-secondary)', borderRadius: 4, cursor: 'pointer' }}>Semestre {n} <span style={{ color: 'var(--text-secondary)' }}>({plan[n].subjects.length})</span></div>)}
          </div>
        </aside>
        <main className="main-content">
          <Boundary resetKey={view + act}>
          {dbl.enabled && perCareer && <CareerSwitch dbl={dbl} />}
          {view === 'overview' && <Overview key={act} data={data} update={update} user={user} focus={focus} goTasks={() => go('tasks')} goCronos={() => go('cronos')} toggleTheme={toggleTheme} logout={logout} dbl={dbl} viewData={shared} />}
          {view === 'subjects' && <Bank key={act} data={data} update={update} />}
          {view === 'schedule' && <Schedule data={shared} update={sharedUpdate} />}
          {view === 'cronos' && <Cronogramas data={shared} update={sharedUpdate} goSchedule={() => go('schedule')} />}
          {view === 'malla' && <Malla key={act} data={data} update={update} user={user} dbl={dbl} />}
          {view === 'grades' && <Grades key={act} data={data} update={update} />}
          {view === 'tasks' && <Tasks data={shared} update={sharedUpdate} />}
          {view === 'config' && <Settings key={act} data={data} update={update} user={user} discard={discard} dbl={dbl} />}
          </Boundary>
        </main>
      </div>

      {/* Navegación inferior para celular/tablet */}
      {more && <div className="m-more-overlay" onClick={() => setMore(false)} />}
      {more && <div className="m-more-sheet">
        <div className="m-more-handle" />
        <div className="m-more-grid">{NAV.filter(n => !BOTTOM.includes(n[0])).map(([k, i, l]) => <button key={k} className={view === k ? 'active' : ''} onClick={() => go(k)}><span>{i}</span>{l}</button>)}</div>
        <div className="m-more-foot"><button onClick={toggleTheme}>🌓 Cambiar tema</button><button onClick={logout}>🚪 Cerrar sesión</button></div>
      </div>}
      <nav className="m-bottom-nav">
        {BOTTOM.map(k => { const n = NAV.find(x => x[0] === k); return <button key={k} className={view === k ? 'active' : ''} onClick={() => go(k)}><span className="m-ico">{n[1]}</span><span className="m-lbl">{n[3]}</span></button>; })}
        <button className={more || !BOTTOM.includes(view) ? 'active' : ''} onClick={() => setMore(!more)}><span className="m-ico">☰</span><span className="m-lbl">Más</span></button>
      </nav>
      <Chat data={root} />
    </>
  );
}

export function Shell({ user }) {
  const { data, update, discard } = useUserData(user);
  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando tus datos…</div>;
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
  return <button className="install-btn" onClick={async () => { ev.prompt(); await ev.userChoice; setEv(null); }}>📱 Instalar App</button>;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>;
  return user ? <><Boundary><Shell user={user} /></Boundary><InstallButton /></> : <Login />;
}
