window.addEventListener('load', function () {
  const loader = document.getElementById('loadingScreen');
  if (!loader) return;

  setTimeout(() => {
    loader.classList.add('fade-out');
  }, 500);
});
