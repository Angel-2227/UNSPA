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
