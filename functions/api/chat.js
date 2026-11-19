// Cloudflare Pages Function: POST /api/chat
// Variables en Cloudflare: GROQ_API_KEY (secret), GROQ_MODEL, FIREBASE_API_KEY
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }) {
  try {
    // 1) Solo usuarios autenticados con Firebase pueden gastar tu cuota de Groq
    const idToken = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!idToken || !env.FIREBASE_API_KEY) return json({ error: 'No autorizado' }, 401);
    const v = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_API_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
    });
    if (!v.ok) return json({ error: 'No autorizado' }, 401);

    // 2) Validar entrada
    const { messages, context } = await request.json();
    if (!Array.isArray(messages) || !messages.length) return json({ error: 'Solicitud inválida' }, 400);
    const history = messages.slice(-20).map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content || '').slice(0, 4000)
    }));

    // 3) Groq
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [{ role: 'system', content: buildSystemPrompt(context) }, ...history],
        temperature: 0.5,
        max_completion_tokens: 2000,
        reasoning_effort: 'low'
      })
    });
    if (!r.ok) { console.error('Groq error:', r.status, await r.text()); return json({ error: 'Error al contactar Groq' }, 502); }
    const d = await r.json();
    return json({ response: d?.choices?.[0]?.message?.content || 'No pude generar una respuesta.' });
  } catch (e) {
    console.error(e);
    return json({ error: 'Error interno' }, 500);
  }
}

// ---- Construir system prompt con contexto académico + notas ----
function buildSystemPrompt(context) {
  if (!context) {
    return `Eres un asistente académico amigable para el Sistema de Planificación Académica (SPA).
Ayuda a los estudiantes con preguntas sobre su carrera, materias y notas.
Responde siempre en español, de forma concisa y útil.`;
  }

  const {
    programName = 'Programa no especificado',
    university = 'Universidad',
    totalCredits = 0,
    completedCredits = 0,
    currentCredits = 0,
    pendingCredits = 0,
    progressPercentage = 0,
    semesters = [],
    subjectBank = [],
    schedules = [],
    currentPeriod = '',
    mallaMarks = {},
    grades = null,
    contenidoProgramatico = null,
    _ui_hint = ''
  } = context;

  // ---- Semestres ----
  let semestersInfo = '';
  semesters.forEach(sem => {
    const subjects = sem.subjects.map(s =>
      `    - ${s.name} (${s.credits}cr, ${s.type})${s.code ? ` [${s.code}]` : ''}${s.professor ? ` — Profe: ${s.professor}` : ''}${s.group ? ` Grupo: ${s.group}` : ''}`
    ).join('\n');
    semestersInfo += `\n  Semestre ${sem.number} [${sem.status}]:\n${subjects}`;
  });

  // ---- Horarios ----
  let horariosInfo = '';
  const subjectsWithHorarios = subjectBank.filter(s => s.horariosInfo && s.horariosInfo.length > 0);
  if (subjectsWithHorarios.length > 0) {
    horariosInfo = '\n\nMATERIAS CON HORARIOS DISPONIBLES:\n';
    subjectsWithHorarios.forEach(s => {
      horariosInfo += `\n  ${s.name} [${s.code || 'sin código'}]:\n`;
      s.horariosInfo.forEach(g => {
        const horarios = (g.horarios || []).map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ');
        horariosInfo += `    • Grupo ${g.numero} — ${g.profesor} — ${horarios}\n`;
      });
    });
  }

  let schedulesInfo = '';
  if (schedules.length > 0) {
    schedulesInfo = '\n\nHORARIOS GUARDADOS:\n';
    schedules.forEach(sch => {
      schedulesInfo += `  - ${sch.name} (Periodo: ${sch.period}, ${Object.keys(sch.subjects).length} materias)\n`;
    });
  }

  // Topes de tamaño para no pasarse del límite de tokens de Groq
  horariosInfo = horariosInfo.slice(0, 7000);

  let cpInfo = '';
  if (Array.isArray(contenidoProgramatico) && contenidoProgramatico.length) {
    cpInfo = '\n\nCONTENIDO PROGRAMÁTICO DE LAS ASIGNATURAS:\n' + contenidoProgramatico.map(c =>
      `- ${c.name}${c.code ? ` [${c.code}]` : ''} (${c.credits || '?'}cr${c.semester && c.semester !== 'N/A' ? `, sem. ${c.semester}` : ''}): ${c.description || ''} ${c.contentSummary || ''}`.slice(0, 420)
    ).join('\n');
    cpInfo = cpInfo.slice(0, 9000);
  }
  const uiHint = String(_ui_hint || '').slice(0, 400);

  const completedInMalla = Object.values(mallaMarks).filter(m => m && m.state === 'completed').length;
  const currentInMalla = Object.values(mallaMarks).filter(m => m && m.state === 'current').length;

  // ---- NOTAS ----
  let gradesInfo = '';
  if (grades) {
    gradesInfo = '\n\n═══════════════════════════════════════\nNOTAS ACADÉMICAS DEL ESTUDIANTE\n═══════════════════════════════════════\n';

    if (grades.overallAverage !== null) {
      gradesInfo += `\nPROMEDIO ACUMULADO PONDERADO: ${grades.overallAverage.toFixed(2)} / 5.00`;
      if (grades.overallAverage >= 4.5) gradesInfo += ' (Excelente)';
      else if (grades.overallAverage >= 4.0) gradesInfo += ' (Muy bien)';
      else if (grades.overallAverage >= 3.5) gradesInfo += ' (Bien)';
      else if (grades.overallAverage >= 3.0) gradesInfo += ' (Aprobando)';
      else gradesInfo += ' (En riesgo)';
    } else {
      gradesInfo += '\nPROMEDIO ACUMULADO: Sin datos suficientes';
    }

    gradesInfo += '\n\nDETALLE POR SEMESTRE:\n';

    (grades.semestersSummary || []).forEach(semSummary => {
      gradesInfo += `\n  Semestre ${semSummary.semester} [${semSummary.status}]`;
      if (semSummary.semesterAverage !== null) {
        gradesInfo += ` — Promedio semestre: ${semSummary.semesterAverage.toFixed(2)}`;
      }
      gradesInfo += '\n';

      semSummary.subjects.forEach(subj => {
        if (subj.type === 'pass_fail') {
          gradesInfo += `    • ${subj.name} (${subj.credits}cr): ${subj.status === 'approved' ? '✅ Aprobado' : subj.status === 'failed' ? '❌ Reprobado' : 'Sin registrar'}\n`;
        } else {
          const avgStr = subj.average !== null ? subj.average.toFixed(2) : 'sin notas';
          const approvedStr = subj.average !== null ? (subj.approved ? '✅' : '❌') : '';
          gradesInfo += `    • ${subj.name} (${subj.credits}cr): ${avgStr} ${approvedStr}\n`;

          // Mostrar componentes solo si hay algunos con nota
          const filledComps = (subj.components || []).filter(c => c.grade !== null);
          if (filledComps.length > 0) {
            filledComps.forEach(comp => {
              gradesInfo += `        – ${comp.name} (${comp.weight}%): ${comp.grade}\n`;
            });
            const emptyComps = (subj.components || []).filter(c => c.grade === null);
            if (emptyComps.length > 0) {
              const pendingWeight = emptyComps.reduce((s, c) => s + c.weight, 0);
              gradesInfo += `        – Faltan: ${emptyComps.map(c => `${c.name} (${c.weight}%)`).join(', ')} [${pendingWeight}% pendiente]\n`;
            }
          }
        }
      });
    });

    gradesInfo += `
INSTRUCCIONES PARA CÁLCULOS DE NOTAS:
- Escala: 0.0 a 5.0. Mínimo para aprobar: 3.0
- Para calcular qué nota necesita en un componente pendiente:
  Nota necesaria = (Objetivo × 100 - Suma(nota_i × peso_i)) / Peso_pendiente
  Ejemplo: si lleva 2.5 con 60% del peso usado y quiere 3.0:
  Necesita = (3.0×100 - 2.5×60) / 40 = (300 - 150) / 40 = 3.75
- Si la nota necesaria es > 5.0, ya no puede aprobar esa materia
- Promedio ponderado por créditos: Suma(promedio_materia × créditos) / Total_créditos`;
  }

  return `Eres un asistente académico personal inteligente y amigable para el Sistema de Planificación Académica (SPA).
Tienes acceso completo a la información académica y de notas del estudiante. Úsala para dar respuestas precisas y personalizadas.
Responde SIEMPRE en español, de forma clara y concisa. Usa emojis ocasionalmente para hacer la conversación más amena.
Cuando hagas cálculos de notas, muestra el procedimiento paso a paso para que el estudiante entienda.

═══════════════════════════════════════
INFORMACIÓN ACADÉMICA DEL ESTUDIANTE
═══════════════════════════════════════

PROGRAMA: ${programName} — ${university}
PERIODO ACTUAL: ${currentPeriod || 'No especificado'}

PROGRESO GENERAL:
  • Créditos totales requeridos: ${totalCredits}
  • Créditos completados: ${completedCredits} (${progressPercentage}%)
  • Créditos cursando actualmente: ${currentCredits}
  • Créditos pendientes: ${pendingCredits}
  • Materias completadas en malla: ${completedInMalla}
  • Materias en curso en malla: ${currentInMalla}

PLAN DE ESTUDIOS POR SEMESTRES:${semestersInfo}
${horariosInfo}
${schedulesInfo}
${gradesInfo}${cpInfo}

═══════════════════════════════════════
INSTRUCCIONES GENERALES:
- Si pregunta por notas, usa los datos de NOTAS ACADÉMICAS para responder con precisión
- Si pregunta qué necesita sacarse, haz el cálculo mostrando la fórmula
- Si pregunta cuánto puede bajar y seguir aprobando, calcula el peor caso
- Si el promedio está en riesgo (< 3.0 en alguna materia), mencionalo proactivamente
- Si no tienes suficiente información, dilo claramente
- Si preguntan por el contenido de una materia, usa CONTENIDO PROGRAMÁTICO
${uiHint ? `- ${uiHint}\n` : ''}═══════════════════════════════════════`;
}