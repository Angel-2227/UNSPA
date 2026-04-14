// ============================================
// FAB — Botón de acciones del Resumen General
// fab.js · Sistema de Planificación Académica
// ============================================

(function () {
  // ── Referencias ───────────────────────────
  let fabBtn   = null;
  let fabMenu  = null;
  let overlay  = null;
  let _isOpen  = false;

  // ── Inicializar al cargar el DOM ──────────
  function initFab() {
    fabBtn  = document.getElementById('overviewFabBtn');
    fabMenu = document.getElementById('overviewFabMenu');

    if (!fabBtn || !fabMenu) return;

    // Crear overlay para cerrar al hacer clic fuera
    overlay = document.createElement('div');
    overlay.className = 'fab-overlay';
    overlay.addEventListener('click', closeFab);
    document.body.appendChild(overlay);

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _isOpen) closeFab();
    });
  }

  // ── Toggle ────────────────────────────────
  window.toggleOverviewFab = function () {
    // Inicialización lazy: por si se llama antes de DOMContentLoaded
    if (!fabBtn || !fabMenu) initFab();
    if (_isOpen) closeFab();
    else openFab();
  };

  function openFab() {
    if (!fabBtn || !fabMenu) return;
    _isOpen = true;
    fabMenu.classList.add('is-open');
    fabBtn.classList.add('is-open');
    if (overlay) overlay.classList.add('is-open');

    // Alternar iconos
    const iconOpen  = fabBtn.querySelector('.fab-icon-open');
    const iconClose = fabBtn.querySelector('.fab-icon-close');
    if (iconOpen)  iconOpen.style.display  = 'none';
    if (iconClose) iconClose.style.display = 'inline';
  }

  function closeFab() {
    if (!fabBtn || !fabMenu) return;
    _isOpen = false;
    fabMenu.classList.remove('is-open');
    fabBtn.classList.remove('is-open');
    if (overlay) overlay.classList.remove('is-open');

    const iconOpen  = fabBtn.querySelector('.fab-icon-open');
    const iconClose = fabBtn.querySelector('.fab-icon-close');
    if (iconOpen)  iconOpen.style.display  = 'inline';
    if (iconClose) iconClose.style.display = 'none';
  }

  // ── Cerrar también al navegar a otra sección ──
  // Se llama desde showView() en script.js
  window.closeFabIfOpen = function () {
    if (_isOpen) closeFab();
  };

  // ── Arrancar cuando el DOM esté listo ────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFab);
  } else {
    // DOM ya listo (script cargado al final del body)
    initFab();
  }
})();