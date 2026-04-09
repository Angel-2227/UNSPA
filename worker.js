// ============================================
// CLOUDFLARE WORKER — Proxy seguro para Groq
// Con soporte para notas académicas
// ============================================

export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { messages, context } = body;

      if (!messages || !Array.isArray(messages)) {
        return new Response('Invalid request', { status: 400 });
      }

      const systemPrompt = buildSystemPrompt(context);

      const groqMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        }))
      ];

      const groqResponse = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.GROQ_API_KEY}`
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            temperature: 0.7,
            max_tokens: 1024,
          })
        }
      );

      if (!groqResponse.ok) {
        const err = await groqResponse.text();
        console.error('Groq error:', err);
        return new Response(JSON.stringify({ error: 'Error al contactar Groq' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const groqData = await groqResponse.json();
      const text = groqData?.choices?.[0]?.message?.content || 'No pude generar una respuesta.';

      return new Response(JSON.stringify({ response: text }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

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
    grades = null
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
        const horarios = g.horarios.map(h => `${h.dia} ${h.inicio}-${h.fin}`).join(', ');
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
${gradesInfo}

═══════════════════════════════════════
INSTRUCCIONES GENERALES:
- Si pregunta por notas, usa los datos de NOTAS ACADÉMICAS para responder con precisión
- Si pregunta qué necesita sacarse, haz el cálculo mostrando la fórmula
- Si pregunta cuánto puede bajar y seguir aprobando, calcula el peor caso
- Si el promedio está en riesgo (< 3.0 en alguna materia), mencionalo proactivamente
- Si no tienes suficiente información, dilo claramente
═══════════════════════════════════════`;
}