import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import './tasks.css';
import './extra.css';
import './cronogramas.css';
import './double.css';
import './responsive.css';

document.documentElement.setAttribute('data-theme', localStorage.getItem('theme') || 'light');
createRoot(document.getElementById('root')).render(<App />);

// Este archivo reemplaza al service-worker viejo (mismo path) y limpia sus cachés
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(console.error));
}
