/** DOM helpers — يُحمَّل أولاً لجميع سكربتات الواجهة */
(function initDomUtils() {
  if (typeof window.$ === 'function') return;
  window.$ = (sel) => document.querySelector(sel);
  window.$$ = (sel) => document.querySelectorAll(sel);
})();
