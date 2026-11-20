# SPA UNAL — Vite + React (versión completa)

Mismo Firebase (proyecto `unalspa`, documento `users/{uid}`) y los mismos nombres de campos:
`studyPlan, subjectBank, config, schedules, currentPeriodConfig, horariosData, gradesData, acadTasks,
mallaPrereqs, mallaMarks, mallaPdfURL, mallaPdfFileName, contenidoProgramatico`.

## Variables en Cloudflare Pages (Production y Preview)
| Nombre | Tipo | Valor |
|---|---|---|
| `GROQ_API_KEY` | Secret | tu NUEVA key de Groq |
| `GROQ_MODEL` | Texto | `openai/gpt-oss-120b` |
| `FIREBASE_API_KEY` | Texto | la apiKey web de Firebase (`AIzaSy...`) |

Build: framework Vite · comando `npm run build` · salida `dist`.

## Local
`npm install` · `npm run dev` (interfaz) · chat: copia `.dev.vars.example` a `.dev.vars` y `npm run pages:dev`.

## Módulos
Resumen (+ FAB, mover materias, tarjeta de tareas) · Banco de materias (+ programa CSV) · Planificador de horarios
(carpetas por semestre, archivar, conflictos, visor con HOY/AHORA) · Malla (generada + PDF) · Notas · Tareas · Configuración · Chat IA.

## Cronogramas (integrado)
La vista **Cronogramas** usa el proyecto Firebase `cronogramas-general-unal` (colecciones `carreras/{id}/semestres/{id}`) con login anónimo,
como la página independiente. Desde un semestre, **"Usar en mi planificador"** carga sus horarios (reemplazar o combinar, útil para doble programa).

## Responsive
Menú inferior en celular/tablet (con "Más"), vista Lista/Mapa con zoom en la malla, rejillas que nunca superan el ancho de la pantalla.

## Doble titulación
Configuración → "Doble titulación" → activar (nombre de la segunda carrera). Aparece un selector de carrera arriba; cada carrera tiene su plan, malla, banco, notas y configuración
(`doble` en Firestore). Las homologaciones (`homologaciones`: [{main, second}]) enlazan la misma materia en las dos carreras: si se ve en una, queda vista en la otra (créditos, no nota).
Horarios, Tareas y Cronogramas ven las materias de las dos carreras. Carga el plan de la segunda carrera con Resumen → ⚙️ → Cargar CSV (empieza en "Pendiente").
