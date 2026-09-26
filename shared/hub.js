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
    freecell:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="3" width="8" height="10" rx="1.5"/><rect class="fg-accent" x="13" y="3" width="8" height="10" rx="1.5"/><rect x="23" y="3" width="8" height="10" rx="1.5" stroke-dasharray="2 2"/><rect x="6" y="17" width="12" height="14" rx="2"/><rect x="16" y="20" width="12" height="11" rx="2"/></svg>',
    spider:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 13l-6-4-2 4M11 17H3M11 21l-6 4-1 4M23 13l6-4 2 4M23 17h8M23 21l6 4 1 4"/><ellipse cx="17" cy="19" rx="6" ry="8"/><circle class="fg-accent" cx="17" cy="9" r="3.4"/></svg>',
    blocks:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="8" height="8" rx="1.5"/><rect x="13" y="4" width="8" height="8" rx="1.5"/><rect x="4" y="13" width="8" height="8" rx="1.5"/><rect class="fg-accent" x="4" y="22" width="8" height="8" rx="1.5"/><rect class="fg-accent" x="13" y="22" width="8" height="8" rx="1.5"/><rect class="fg-accent" x="22" y="22" width="8" height="8" rx="1.5"/><rect x="22" y="13" width="8" height="8" rx="1.5" stroke-dasharray="2 2"/></svg>',
    watersort:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 4v21a3.5 3.5 0 0 0 7 0V4M13.5 4v21a3.5 3.5 0 0 0 7 0V4M23 4v21a3.5 3.5 0 0 0 7 0V4"/><path class="fg-accent" d="M5.5 17h4v8a2 2 0 0 1-4 0z" stroke-width="0"/><path class="fg-accent" d="M15 21h4v4a2 2 0 0 1-4 0z" stroke-width="0"/><path d="M24.5 13h4" stroke-width="1.4"/></svg>',
    memory:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="12" height="16" rx="2.5"/><rect x="19" y="13" width="12" height="16" rx="2.5"/><path class="fg-accent" d="M9 10.5c-.9-1.2-2.8-.4-2.3 1 .4 1 2.3 2.4 2.3 2.4s1.9-1.4 2.3-2.4c.5-1.4-1.4-2.2-2.3-1z"/><path class="fg-accent" d="M25 18.5c-.9-1.2-2.8-.4-2.3 1 .4 1 2.3 2.4 2.3 2.4s1.9-1.4 2.3-2.4c.5-1.4-1.4-2.2-2.3-1z"/></svg>',
    dice:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="9" width="16" height="16" rx="3.5" transform="rotate(-10 11 17)"/><rect x="16" y="6" width="15" height="15" rx="3.5"/><g fill="currentColor" stroke-width="0"><circle cx="20" cy="10" r="1.5"/><circle cx="27" cy="17" r="1.5"/><circle cx="7.5" cy="13.8" r="1.5"/><circle cx="14.2" cy="20.2" r="1.5"/></g><circle class="fg-accent" cx="23.5" cy="13.5" r="1.7" stroke-width="0"/><circle class="fg-accent" cx="10.8" cy="17" r="1.7" stroke-width="0"/></svg>',
    nonogram:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="10" y="10" width="21" height="21" rx="2"/><path d="M17 10v21M24 10v21M10 17h21M10 24h21" stroke-width="1.2"/><path class="fg-accent" d="M10 10h7v7h-7zM17 17h7v7h-7zM24 10h7v7h-7z" stroke-width="0"/><path d="M3 13.5h4M3 20.5h4M3 27.5h4M13.5 3v4M20.5 3v4M27.5 3v4" stroke-width="1.6" stroke-linecap="round"/></svg>',
    snake:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 27h10V17h12V7h-8"/><circle class="fg-accent" cx="12" cy="8" r="2.4" stroke-width="0"/></svg>',
    ox:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12.3 4v26M21.7 4v26M4 12.3h26M4 21.7h26" stroke-width="1.4"/><path d="M5.6 5.6l4.3 4.3M9.9 5.6l-4.3 4.3"/><circle class="fg-accent-line" cx="17" cy="17" r="2.8"/></svg>',
    connect4:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="28" height="24" rx="4"/><circle cx="10" cy="13" r="2.6"/><circle cx="17" cy="13" r="2.6"/><circle cx="24" cy="13" r="2.6"/><circle cx="10" cy="22.5" r="2.6"/><circle class="fg-accent" cx="17" cy="22.5" r="2.6"/><circle cx="24" cy="22.5" r="2.6"/></svg>',
    dots:
      '<svg viewBox="0 0 34 34" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect class="fg-accent" x="10" y="10" width="4" height="4" rx="1" stroke-width="0"/><path d="M7 7h10v10H7zM17 17h10" fill="none"/><circle cx="7" cy="7" r="2" stroke-width="0"/><circle cx="17" cy="7" r="2" stroke-width="0"/><circle cx="27" cy="7" r="2" stroke-width="0"/><circle cx="7" cy="17" r="2" stroke-width="0"/><circle cx="17" cy="17" r="2" stroke-width="0"/><circle cx="27" cy="17" r="2" stroke-width="0"/><circle cx="7" cy="27" r="2" stroke-width="0"/><circle cx="17" cy="27" r="2" stroke-width="0"/><circle cx="27" cy="27" r="2" stroke-width="0"/></svg>',
    makhos:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="26" height="26" rx="3"/><path d="M17 4v26M4 17h26" stroke-width="1.4"/><circle class="fg-accent" cx="10.5" cy="23.5" r="3.6"/><circle cx="23.5" cy="10.5" r="3.6"/></svg>',
    makkhum:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="8" width="30" height="18" rx="9"/><circle cx="11" cy="13.5" r="2.2"/><circle cx="17" cy="13.5" r="2.2"/><circle cx="23" cy="13.5" r="2.2"/><circle cx="11" cy="20.5" r="2.2"/><circle class="fg-accent" cx="17" cy="20.5" r="2.2"/><circle cx="23" cy="20.5" r="2.2"/></svg>',
    othello:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="28" height="28" rx="3"/><circle cx="12.5" cy="12.5" r="4"/><circle class="fg-accent" cx="21.5" cy="12.5" r="4"/><circle class="fg-accent" cx="12.5" cy="21.5" r="4"/><circle cx="21.5" cy="21.5" r="4"/></svg>',
    gomoku:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h26M4 17h26M4 26h26M8 4v26M17 4v26M26 4v26" stroke-width="1.3"/><circle class="fg-accent" cx="8" cy="26" r="3.2"/><circle class="fg-accent" cx="17" cy="17" r="3.2"/><circle class="fg-accent" cx="26" cy="8" r="3.2"/><circle cx="8" cy="8" r="3.2"/><circle cx="26" cy="26" r="3.2"/></svg>',
    battleship:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 20h26l-3.2 6.2a2 2 0 0 1-1.8 1.1H9a2 2 0 0 1-1.8-1.1z"/><path d="M10 20v-5h6v-4h3v4h5l2 5"/><circle class="fg-accent" cx="26" cy="8" r="3.4" stroke-width="0"/><path d="M26 3v2M26 11v2M21 8h2M29 8h2" stroke-width="1.4"/></svg>',
    atc:
      '<svg viewBox="0 0 34 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="21" y="6" width="7" height="24" rx="1.5"/><path d="M24.5 11v3M24.5 18v3M24.5 25v2" stroke-width="1.3"/><path d="M4 27c3-9 8-14 15-15" stroke-dasharray="2 3" stroke-width="1.6"/><path class="fg-accent" d="M9.5 9l2.2-1.3 5.2 2.4 2.4-1.4a1.2 1.2 0 0 1 1.2 2.1l-2.4 1.4-1 5.6-2.2 1.3.1-4.9-3.2 1.9-.3 1.8-1.5.9-.3-2.9-2.3-1.8 1.5-.9 1.7.5 3.2-1.9z" stroke-width="0"/></svg>'
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

  // ขอบล่างจอ: ถ้าแถบปุ่ม/แถบท่าทางของมือถือบังปุ่มล่างสุดในเกม ให้เว้นเพิ่ม (ค่าจริงอยู่ใน shared/app.js)
  document.getElementById('gap-btn').addEventListener('click', function () {
    var cur = FG.getGap();
    var body = document.createElement('div');
    body.appendChild(FG.label('เว้นที่ว่างใต้ปุ่มล่างสุด'));
    var note = document.createElement('p');
    note.className = 'sheet__text';
    function paintNote(px) {
      note.textContent = 'ตอนนี้เว้นอยู่ ' + Math.round(Math.max(px, FG.envBottom())) + ' px' + (FG.isStandalone() ? ' (เปิดแบบแอป)' : ' (เปิดในเบราว์เซอร์)');
    }
    body.appendChild(
      FG.choice(
        [
          { value: 'auto', label: 'อัตโนมัติ' },
          { value: 0, label: 'ไม่เว้น' },
          { value: 24, label: 'น้อย' },
          { value: 48, label: 'กลาง' },
          { value: 72, label: 'มาก' }
        ],
        cur,
        function (v) {
          paintNote(FG.setGap(v));
        }
      )
    );
    body.appendChild(note);
    paintNote(FG.setGap(cur));
    FG.sheet({
      title: 'ขอบล่างจอ',
      text: 'ถ้าในเกม ปุ่มแถวล่างสุดถูกแถบปุ่มหรือขีดปัดของมือถือบัง ให้เลือก <b>กลาง</b> หรือ <b>มาก</b> แล้วเปิดเกมดูอีกครั้ง · ปกติใช้ <b>อัตโนมัติ</b>',
      body: body,
      actions: [{ label: 'เสร็จ', primary: true }]
    });
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
