import { useEffect, useMemo, useState } from 'react';
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
import { overallAvg, ensureGrades } from './lib/grades';
import { planCredits } from './lib/plan';

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

function Shell({ user }) {
  const { data, update, discard } = useUserData(user);
  const [view, setView] = useState('overview');
  const [side, setSide] = useState(false);
  const [focus, setFocus] = useState(null);
  const g = useMemo(() => (data ? ensureGrades(data.studyPlan, data.gradesData || {}, data.subjectBank || []) : {}), [data]);
  if (!data) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando tus datos…</div>;

  const plan = data.studyPlan;
  let done = 0, cur = 0;
  Object.values(plan).forEach(s => { const c = planCredits(s); if (s.status === 'completed') done += c; if (s.status === 'current') cur += c; });
  const total = data.config.totalCredits || 1, pct = Math.round((done / total) * 100);
  const avg = overallAvg(plan, g);
  const nav = [['overview', '📊 Resumen General'], ['subjects', '📚 Banco de Materias'], ['schedule', '📅 Planificador de Horarios'], ['malla', '🗺️ Malla Curricular'], ['grades', '📝 Notas'], ['tasks', '✅ Tareas'], ['config', '⚙️ Configuración']];
  const toggleTheme = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
  const logout = () => confirm('¿Cerrar sesión? Tus datos están guardados en la nube.') && signOut(auth);
  const go = k => { setView(k); setSide(false); window.scrollTo(0, 0); };
  const active = Object.keys(plan).filter(n => plan[n].subjects?.length && plan[n].status !== 'pending').sort((a, b) => a - b);

  return (
    <>
      <button className="mobile-toggle" onClick={() => setSide(!side)}>☰</button>
      <div className={'sidebar-overlay' + (side ? ' open' : '')} onClick={() => setSide(false)} />
      <div className="app-container">
        <aside className={'sidebar' + (side ? ' open' : '')} id="sidebar">
          <div className="sidebar-header"><h1>SPA</h1><p>Sistema de Planificación Académica</p></div>
          <nav className="sidebar-nav">{nav.map(([k, l]) => <div key={k} className={'nav-item' + (view === k ? ' active' : '')} onClick={() => go(k)}>{l}</div>)}</nav>
          <div className="sidebar-section">
            <div className="section-title">Estadísticas Rápidas</div>
            <div style={{ fontSize: '.85rem' }}>
              <div style={{ marginBottom: 8 }}><strong>Progreso:</strong> {pct}%</div>
              <div style={{ marginBottom: 8 }}><strong>Completados:</strong> {done}</div>
              <div style={{ marginBottom: 8 }}><strong>Pendientes:</strong> {Math.max(0, total - done - cur)}</div>
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
          {view === 'overview' && <Overview data={data} update={update} user={user} focus={focus} goTasks={() => go('tasks')} toggleTheme={toggleTheme} logout={logout} />}
          {view === 'subjects' && <Bank data={data} update={update} />}
          {view === 'schedule' && <Schedule data={data} update={update} />}
          {view === 'malla' && <Malla data={data} update={update} user={user} />}
          {view === 'grades' && <Grades data={data} update={update} />}
          {view === 'tasks' && <Tasks data={data} update={update} />}
          {view === 'config' && <Settings data={data} update={update} user={user} discard={discard} />}
        </main>
      </div>
      <Chat data={data} />
    </>
  );
}

function InstallButton() {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    const on = e => { e.preventDefault(); setEv(e); }, off = () => setEv(null);
    addEventListener('beforeinstallprompt', on); addEventListener('appinstalled', off);
    return () => { removeEventListener('beforeinstallprompt', on); removeEventListener('appinstalled', off); };
  }, []);
  if (!ev) return null;
  return <button onClick={async () => { ev.prompt(); await ev.userChoice; setEv(null); }} style={{ position: 'fixed', bottom: 24, left: 24, background: 'linear-gradient(135deg,#2e7d32,#1b5e20)', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: 28, fontWeight: 700, cursor: 'pointer', zIndex: 9000, boxShadow: '0 6px 20px rgba(0,0,0,.35)' }}>📱 Instalar App</button>;
}

export default function App() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  if (user === undefined) return <div style={{ padding: 40, textAlign: 'center' }}>Cargando…</div>;
  return user ? <><Shell user={user} /><InstallButton /></> : <Login />;
}
