// public/js/main.js — CASEV

// Evidenzia nav-item attivo in base all'URL
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.getAttribute('href');
    if (href && href !== '#' && path.startsWith(href) && href !== '/') {
      el.classList.add('active');
    } else if (href === '/' && path === '/') {
      el.classList.add('active');
    }
  });

  // Auto-dismiss alerts
  document.querySelectorAll('.alert').forEach(el => {
    setTimeout(() => el.style.transition = 'opacity 0.5s', 2500);
    setTimeout(() => el.style.opacity = '0', 3000);
    setTimeout(() => el.remove(), 3500);
  });
});
