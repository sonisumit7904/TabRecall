// Initialize icons after DOM content is loaded
document.addEventListener('DOMContentLoaded', () => {
  if (window.feather) {
    feather.replace();
  }
});
