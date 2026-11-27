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
      btn.innerHTML =
        '<span aria-hidden="true">' +
        (isDark ? '☀' : '☾') +
        '</span><span class="mx-admin-theme-label">' +
        (isDark ? 'Light' : 'Dark') +
        '</span>';
      btn.setAttribute('aria-pressed', String(isDark));
      btn.title = isDark ? 'Switch Admin Panel to Light Mode' : 'Switch Admin Panel to Dark Mode';
    }
  }

  // Apply immediately in <head> to prevent theme flash
  applyAdminTheme(getStoredTheme());

  document.addEventListener('DOMContentLoaded', function () {
    applyAdminTheme(getStoredTheme());

    // 1. Ambient RGB Glow Orbs behind wrapper
    if (!document.querySelector('.mx-admin-glow')) {
      var glow = document.createElement('div');
      glow.className = 'mx-admin-glow';
      glow.setAttribute('aria-hidden', 'true');
      glow.innerHTML = '<div class="mx-admin-glow-a"></div><div class="mx-admin-glow-b"></div>';
      document.body.insertBefore(glow, document.body.firstChild);
    }

    // 2. Mobile drawer backdrop INSIDE .wrapper (under .main-sidebar, above .content-wrapper)
    //    so only the page behind the open drawer is dimmed/blurred — never the sidebar itself.
    if (!document.querySelector('.mx-admin-backdrop')) {
      var backdrop = document.createElement('div');
      backdrop.className = 'mx-admin-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.addEventListener('click', function () {
        document.body.classList.remove('sidebar-open');
      });
      var wrapper = document.querySelector('.wrapper');
      var sidebar = wrapper ? wrapper.querySelector('.main-sidebar') : null;
      if (wrapper && sidebar) {
        wrapper.insertBefore(backdrop, sidebar);
      } else if (wrapper) {
        wrapper.appendChild(backdrop);
      } else {
        document.body.appendChild(backdrop);
      }
    }

    // 3. Add MidnightX Star emblem to Admin Logo bar (works with both .logo-lg and Pterodactyl's span)
    var logoTarget =
      document.querySelector('.main-header .logo .logo-lg') ||
      document.querySelector('.main-header .logo');
    if (logoTarget && !logoTarget.querySelector('.mx-admin-star')) {
      var badge = document.createElement('span');
      badge.className = 'mx-admin-star';
      badge.innerHTML =
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="4.2" y1="7.5" x2="19.8" y2="16.5"/><line x1="19.8" y1="7.5" x2="4.2" y2="16.5"/></svg>';
      logoTarget.insertBefore(badge, logoTarget.firstChild);
    }

    // 4. Add synced Light/Dark 3D toggle in Admin Navbar
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

    // 5. Ensure every admin table scrolls cleanly horizontally on small screens
    var tables = document.querySelectorAll('.content table.table');
    tables.forEach(function (tbl) {
      var parent = tbl.parentElement;
      if (parent && !parent.classList.contains('table-responsive') && !parent.classList.contains('mx-table-scroll')) {
        var wrap = document.createElement('div');
        wrap.className = 'mx-table-scroll';
        parent.insertBefore(wrap, tbl);
        wrap.appendChild(tbl);
      }
    });
  });
})();
