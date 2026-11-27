(function () {
  var STORAGE_KEY = 'midnightx_theme';

  function getStoredTheme() {
    try {
      var mode = localStorage.getItem('midnightx_theme_mode');
      if (mode === 'light' || mode === 'dark') return mode;
      if (mode === 'auto' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
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
      btn.setAttribute('aria-label', isDark ? 'Switch Admin Panel to Light Mode' : 'Switch Admin Panel to Dark Mode');
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

    // 3. Add white HelzerX logo emblem to Admin Logo bar (works with both .logo-lg and Pterodactyl's span)
    var logoTarget =
      document.querySelector('.main-header .logo .logo-lg') ||
      document.querySelector('.main-header .logo');
    if (logoTarget && !logoTarget.querySelector('.mx-admin-star')) {
      var badge = document.createElement('span');
      badge.className = 'mx-admin-star';
      badge.innerHTML =
        '<img src="/midnightx/assets/aistudio/IMG_20261011_201132-removebg-preview_9b5f47c8.png" alt="HelzerX" class="mx-admin-logo-img" />';
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
          localStorage.setItem('midnightx_theme_mode', next);
        } catch (_) {}
        applyAdminTheme(next);
      });
      li.appendChild(btn);
      navList.insertBefore(li, navList.firstChild);
      applyAdminTheme(getStoredTheme());
    }

    // 5. Ensure every admin table scrolls cleanly horizontally on small screens + add CSV export
    var tables = document.querySelectorAll('.content table.table');
    tables.forEach(function (tbl, tblIdx) {
      var parent = tbl.parentElement;
      if (parent && !parent.classList.contains('table-responsive') && !parent.classList.contains('mx-table-scroll')) {
        var wrap = document.createElement('div');
        wrap.className = 'mx-table-scroll';
        parent.insertBefore(wrap, tbl);
        wrap.appendChild(tbl);
      }

      var box = tbl.closest('.box');
      var rows = tbl.querySelectorAll('tr');
      if (box && rows.length > 1) {
        var header = box.querySelector('.box-header');
        if (header && !header.querySelector('.mx-admin-csv-btn')) {
          var tools = header.querySelector('.box-tools');
          if (!tools) {
            tools = document.createElement('div');
            tools.className = 'box-tools';
            header.appendChild(tools);
          }
          var csvBtn = document.createElement('button');
          csvBtn.type = 'button';
          csvBtn.className = 'btn btn-default btn-xs mx-admin-csv-btn';
          csvBtn.title = 'Export visible table rows to CSV';
          csvBtn.textContent = 'Export CSV';
          csvBtn.addEventListener('click', function () {
            var lines = [];
            tbl.querySelectorAll('tr').forEach(function (tr) {
              var cols = [];
              tr.querySelectorAll('th, td').forEach(function (cell) {
                var txt = (cell.innerText || cell.textContent || '').replace(/\s+/g, ' ').trim();
                cols.push('"' + txt.replace(/"/g, '""') + '"');
              });
              if (cols.length) lines.push(cols.join(','));
            });
            var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var pageSlug = (location.pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'admin');
            a.href = url;
            a.download = pageSlug + '-table-' + (tblIdx + 1) + '.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          });
          tools.appendChild(csvBtn);
        }
      }
    });

    // 6. Admin Quick Jump Palette (Ctrl+K / Cmd+K + navbar trigger)
    var navItems = [];
    document.querySelectorAll('.sidebar-menu a[href]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href === '#') return;
      var label = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
      if (label) navItems.push({ label: label, href: href });
    });

    if (navItems.length > 0 && navList && !document.getElementById('mx-admin-jump-btn')) {
      var jumpLi = document.createElement('li');
      var jumpBtn = document.createElement('button');
      jumpBtn.id = 'mx-admin-jump-btn';
      jumpBtn.type = 'button';
      jumpBtn.className = 'mx-admin-theme-btn';
      jumpBtn.title = 'Quick Jump (Ctrl+K)';
      jumpBtn.setAttribute('aria-label', 'Open Admin Quick Jump (Ctrl+K)');
      jumpBtn.innerHTML = '<span aria-hidden="true">⌕</span><span class="mx-admin-theme-label">⌘K</span>';
      jumpLi.appendChild(jumpBtn);
      navList.insertBefore(jumpLi, navList.firstChild);

      var overlay = document.createElement('div');
      overlay.id = 'mx-admin-jump-modal';
      overlay.className = 'mx-admin-jump-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML =
        '<div class="mx-admin-jump-card">' +
        '  <div class="mx-admin-jump-head">' +
        '    <input type="text" id="mx-admin-jump-input" class="form-control" placeholder="Jump to admin section..." autocomplete="off" />' +
        '    <button type="button" id="mx-admin-jump-close" class="btn btn-default btn-sm">ESC</button>' +
        '  </div>' +
        '  <div id="mx-admin-jump-list" class="mx-admin-jump-list"></div>' +
        '</div>';
      document.body.appendChild(overlay);

      var jumpInput = document.getElementById('mx-admin-jump-input');
      var jumpList = document.getElementById('mx-admin-jump-list');
      var activeIdx = 0;
      var currentMatches = navItems.slice();

      function renderJumpList() {
        var q = (jumpInput.value || '').trim().toLowerCase();
        currentMatches = q
          ? navItems.filter(function (item) {
              return item.label.toLowerCase().indexOf(q) !== -1 || item.href.toLowerCase().indexOf(q) !== -1;
            })
          : navItems.slice();
        if (activeIdx >= currentMatches.length) activeIdx = 0;

        jumpList.innerHTML = '';
        if (currentMatches.length === 0) {
          var empty = document.createElement('div');
          empty.className = 'mx-admin-jump-empty';
          empty.textContent = 'No matching admin routes.';
          jumpList.appendChild(empty);
          return;
        }
        currentMatches.forEach(function (item, idx) {
          var row = document.createElement('a');
          row.href = item.href;
          row.className = 'mx-admin-jump-item' + (idx === activeIdx ? ' is-active' : '');
          row.innerHTML = '<span>' + item.label.replace(/</g, '&lt;') + '</span><small>' + item.href.replace(/</g, '&lt;') + '</small>';
          jumpList.appendChild(row);
        });
      }

      function openJump() {
        overlay.classList.add('is-open');
        jumpInput.value = '';
        activeIdx = 0;
        renderJumpList();
        setTimeout(function () {
          jumpInput.focus();
        }, 20);
      }

      function closeJump() {
        overlay.classList.remove('is-open');
      }

      jumpBtn.addEventListener('click', openJump);
      document.getElementById('mx-admin-jump-close').addEventListener('click', closeJump);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeJump();
      });
      jumpInput.addEventListener('input', function () {
        activeIdx = 0;
        renderJumpList();
      });
      jumpInput.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && currentMatches.length) {
          e.preventDefault();
          activeIdx = (activeIdx + 1) % currentMatches.length;
          renderJumpList();
        } else if (e.key === 'ArrowUp' && currentMatches.length) {
          e.preventDefault();
          activeIdx = (activeIdx - 1 + currentMatches.length) % currentMatches.length;
          renderJumpList();
        } else if (e.key === 'Enter' && currentMatches[activeIdx]) {
          e.preventDefault();
          window.location.href = currentMatches[activeIdx].href;
        }
      });
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          if (overlay.classList.contains('is-open')) closeJump();
          else openJump();
        } else if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
          closeJump();
        }
      });
    }
  });
})();
