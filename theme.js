// Theme toggling functionality
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  const darkIcon = themeToggle.querySelector('.dark-icon');
  const lightIcon = themeToggle.querySelector('.light-icon');
  
  // Check for saved theme preference or use preferred color scheme
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    darkIcon.style.display = 'none';
    lightIcon.style.display = 'block';
  } else if (savedTheme === 'dark') {
    document.body.classList.remove('light-theme');
    darkIcon.style.display = 'block';
    lightIcon.style.display = 'none';
  } else {
    // Default to dark theme or check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('light-theme');
      darkIcon.style.display = 'none';
      lightIcon.style.display = 'block';
    }
  }
  
  // Toggle theme on button click
  themeToggle.addEventListener('click', () => {
    if (document.body.classList.contains('light-theme')) {
      // Switch to dark theme
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      darkIcon.style.display = 'block';
      lightIcon.style.display = 'none';
    } else {
      // Switch to light theme
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      darkIcon.style.display = 'none';
      lightIcon.style.display = 'block';
    }
  });
});