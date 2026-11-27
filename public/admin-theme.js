(function () {
  var STORAGE_KEY = 'midnightx_theme';

  function getStoredTheme() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'dark';
    } catch (_) {
      return 'dark';
    }
  }

  function applyAdminTheme(mode) {
    var isDark = mode === 'dark';
    document.documentElement.classList.toggle('mx-admin-dark', isDark);
    var btn = document.getElementById('mx-admin-theme-toggle');
    if (btn) {
      btn.textContent = isDark ? '☀ Light' : '☾ Dark';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.title = isDark ? 'Switch Admin Panel to Light Mode' : 'Switch Admin Panel to Dark Mode';
    }
  }

  // Apply immediately in <head> to prevent theme flash
  applyAdminTheme(getStoredTheme());

  document.addEventListener('DOMContentLoaded', function () {
    applyAdminTheme(getStoredTheme());

    var navList = document.querySelector('.main-header .navbar-custom-menu > ul.nav');
    if (navList && !document.getElementById('mx-admin-theme-toggle')) {
      var li = document.createElement('li');
      var btn = document.createElement('button');
      btn.id = 'mx-admin-theme-toggle';
      btn.type = 'button';
      btn.className = 'mx-admin-theme-btn';
      btn.addEventListener('click', function () {
        var next = document.documentElement.classList.contains('mx-admin-dark') ? 'light' : 'dark';
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {}
        applyAdminTheme(next);
      });
      li.appendChild(btn);
      navList.insertBefore(li, navList.firstChild);
      applyAdminTheme(getStoredTheme());
    }
  });
})();
