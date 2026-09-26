/* หน้าแรก: สร้างรายการเกมจาก FG_GAMES + แสดงสถานะพร้อมเล่นออฟไลน์ */
(function () {
  'use strict';

  var GLYPHS = {
    '2048':
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="12" height="12" rx="3"/><rect class="fg-accent" x="19" y="3" width="12" height="12" rx="3"/><rect x="3" y="19" width="12" height="12" rx="3"/><rect x="19" y="19" width="12" height="12" rx="3"/></svg>',
    sudoku:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="28" height="28" rx="3"/><path d="M12.3 3v28M21.7 3v28M3 12.3h28M3 21.7h28" stroke-width="1.4"/><circle class="fg-accent" cx="17" cy="17" r="2.6"/></svg>',
    minesweeper:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="17" cy="18" r="8"/><path d="M17 4v4M17 28v4M3 18h4M27 18h4M7 8l3 3M27 8l-3 3M7 28l3-3M27 28l-3-3"/><circle class="fg-accent" cx="14" cy="15" r="2"/></svg>',
    solitaire:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="7" width="15" height="22" rx="2.5" transform="rotate(-10 11 18)"/><rect x="14" y="5" width="15" height="22" rx="2.5"/><path class="fg-accent" d="M21.5 12.5c-1.6-2-4.2-.6-3.4 1.5.6 1.4 3.4 3.5 3.4 3.5s2.8-2.1 3.4-3.5c.8-2.1-1.8-3.5-3.4-1.5z"/></svg>',
    snake:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 27h10V17h12V7h-8"/><circle class="fg-accent" cx="12" cy="8" r="2.4" stroke-width="0"/></svg>'
  };

  function glyph(game) {
    if (GLYPHS[game.id]) return GLYPHS[game.id];
    return '<span class="glyph__letter">' + game.title.charAt(0) + '</span>';
  }

  function row(game) {
    var info = FG.store.get('hub:' + game.id, {});
    var meta = '';
    if (info.resume) meta += '<span class="tag">เล่นต่อ</span>';
    if (info.note) meta += '<span>' + info.note + '</span>';
    var li = document.createElement('li');
    li.innerHTML =
      '<a class="game-row" href="' +
      game.path +
      '">' +
      '<span class="glyph" aria-hidden="true">' +
      glyph(game) +
      '</span>' +
      '<span><span class="game-row__name">' +
      game.title +
      '</span><span class="game-row__blurb">' +
      game.blurb +
      '</span></span>' +
      '<span class="game-row__meta">' +
      meta +
      '</span></a>';
    return li;
  }

  function soon() {
    var li = document.createElement('li');
    li.innerHTML = '<div class="soon"><span class="soon__box" aria-hidden="true"></span><span>เร็ว ๆ นี้</span></div>';
    return li;
  }

  function renderLists() {
    var solo = document.getElementById('solo-list');
    var duo = document.getElementById('duo-list');
    solo.innerHTML = '';
    duo.innerHTML = '';
    FG_GAMES.forEach(function (g) {
      (g.players === 2 ? duo : solo).appendChild(row(g));
    });
    if (!duo.children.length) duo.appendChild(soon());
  }

  /* ---------- offline readiness ---------- */
  var pill = document.getElementById('offline');
  var pillText = document.getElementById('offline-text');
  var ver = document.getElementById('ver');
  var retryTimer = 0;
  var tries = 0;

  function setPill(state, text) {
    pill.setAttribute('data-state', state);
    pillText.textContent = text;
  }

  function check() {
    clearTimeout(retryTimer);
    if (!('serviceWorker' in navigator) || !('caches' in window)) {
      setPill('unsupported', 'เบราว์เซอร์นี้เล่นออฟไลน์ไม่ได้ — ใช้ Chrome');
      return;
    }
    FG.offlineStatus().then(function (s) {
      if (s && s.error) {
        setPill('unsupported', 'เก็บไฟล์ไว้เล่นออฟไลน์ไม่สำเร็จ — ต่อเน็ตแล้วเปิดใหม่ใน Chrome');
        return;
      }
      if (!s) {
        setPill('checking', 'กำลังเตรียมไฟล์สำหรับเล่นออฟไลน์…');
        scheduleRetry();
        return;
      }
      ver.textContent = 'ไฟล์ชุด ' + s.version;
      if (s.have === s.total) {
        setPill('ready', 'พร้อมเล่นออฟไลน์ ✓');
      } else if (navigator.onLine) {
        setPill('checking', 'กำลังเก็บไฟล์ ' + s.have + '/' + s.total + '…');
        scheduleRetry();
      } else {
        setPill('missing', 'ยังไม่พร้อม — เก็บได้ ' + s.have + '/' + s.total + ' ไฟล์ ต่อเน็ตแล้วเปิดใหม่');
      }
    });
  }

  function scheduleRetry() {
    tries += 1;
    if (tries > 40) {
      setPill('missing', 'ยังไม่พร้อมเล่นออฟไลน์ — แตะเพื่อตรวจอีกครั้ง');
      return;
    }
    retryTimer = setTimeout(check, 1500);
  }

  pill.addEventListener('click', function () {
    tries = 0;
    setPill('checking', 'กำลังตรวจ…');
    check();
  });
  document.addEventListener('fg:sw-activated', function () {
    tries = 0;
    check();
  });

  /* ---------- theme + install ---------- */
  var themeBtn = document.getElementById('theme-btn');
  function paintThemeBtn() {
    var dark = FG.getTheme() !== 'light';
    themeBtn.innerHTML = FG.icon(dark ? 'sun' : 'moon') + '<span>' + (dark ? 'โหมดสว่าง' : 'โหมดมืด') + '</span>';
  }
  themeBtn.addEventListener('click', function () {
    FG.setTheme(FG.getTheme() === 'light' ? 'dark' : 'light');
    paintThemeBtn();
  });

  var installBtn = document.getElementById('install-btn');
  var deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () {
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  });
  window.addEventListener('appinstalled', function () {
    installBtn.hidden = true;
    FG.toast('ติดตั้งแล้ว เปิดจากไอคอนบนหน้าจอได้เลย');
  });

  // กลับจากหน้าเกมด้วยปุ่มย้อน (bfcache) → อัปเดตสถิติ
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) renderLists();
  });

  renderLists();
  paintThemeBtn();
  check();
})();
