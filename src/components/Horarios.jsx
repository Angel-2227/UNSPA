import { useState } from 'react';
import { CalendarDays, FolderOpen } from 'lucide-react';
import Schedule from './Schedule.jsx';
import Cronogramas from './Cronogramas.jsx';
import { Seg } from '../ui.jsx';

// Horarios + Cronogramas en una sola sección con pestañas
export default function Horarios({ data, update }) {
  const [tab, setTab] = useState('mine');
  return (
    <>
      <Seg className="seg-block" value={tab} onChange={setTab} options={[{ value: 'mine', label: 'Mis horarios', icon: CalendarDays }, { value: 'cronos', label: 'Cronogramas', icon: FolderOpen }]} />
      {tab === 'mine' ? <Schedule data={data} update={update} goCronos={() => setTab('cronos')} /> : <Cronogramas data={data} update={update} goSchedule={() => setTab('mine')} />}
    </>
  );
}
