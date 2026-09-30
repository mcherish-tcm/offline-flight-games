/* หาระเบิด — 3 ขนาดพอดีจอมือถือ, แตะแรกปลอดภัยเสมอ, โหมดปักธง + กดค้าง, แตะเลขเพื่อเปิดรอบ ๆ (chord) */
(function () {
  'use strict';

  var KEY = 'mines:state';
  var BEST = 'mines:best';
  var SIZES = {
    s: { label: 'เล็ก', cols: 9, rows: 9, mines: 10 },
    m: { label: 'กลาง', cols: 10, rows: 14, mines: 24 },
    l: { label: 'ใหญ่', cols: 10, rows: 18, mines: 38 }
  };
  var MINE_SVG =
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="5.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" fill="none"/></svg>';

  var boardEl = document.getElementById('board');
  var leftEl = document.getElementById('left');
  var timeEl = document.getElementById('time');
  var levelEl = document.getElementById('level');
  var modeOpen = document.getElementById('mode-open');
  var modeFlag = document.getElementById('mode-flag');
  var FLAG_SVG = FG.icon('flag');

  var S; // {size, cols, rows, mines, cells:[{m,a,o,f}], status:'ready'|'play'|'won'|'lost', seconds, boom}
  var flagMode = false;
  var cellEls = [];

  function neighbors(i) {
    var r = Math.floor(i / S.cols);
    var c = i % S.cols;
    var out = [];
    for (var dr = -1; dr <= 1; dr++)
      for (var dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        var rr = r + dr;
        var cc = c + dc;
        if (rr >= 0 && rr < S.rows && cc >= 0 && cc < S.cols) out.push(rr * S.cols + cc);
      }
    return out;
  }

  function newGame(size) {
    FG.closeSheet();
    var z = SIZES[size] || SIZES.s;
    S = { size: size, cols: z.cols, rows: z.rows, mines: z.mines, cells: [], status: 'ready', seconds: 0, boom: -1 };
    for (var i = 0; i < z.cols * z.rows; i++) S.cells.push({ m: 0, a: 0, o: 0, f: 0 });
    FG.store.set('mines:size', size);
    build();
    save();
    render();
  }

  // วางระเบิดหลังแตะแรก — ไม่ให้มีระเบิดที่ช่องแรกและรอบ ๆ (ได้พื้นที่เปิดกว้าง)
  function placeMines(first) {
    var banned = new Set(neighbors(first).concat([first]));
    var spots = [];
    for (var i = 0; i < S.cells.length; i++) if (!banned.has(i)) spots.push(i);
    if (spots.length < S.mines) {
      // กระดานเล็กเกิน (ไม่เกิดกับขนาดที่มี) — กันแค่ช่องแรก
      spots = [];
      for (i = 0; i < S.cells.length; i++) if (i !== first) spots.push(i);
    }
    for (var k = 0; k < S.mines; k++) {
      var r = k + Math.floor(Math.random() * (spots.length - k));
      var t = spots[k];
      spots[k] = spots[r];
      spots[r] = t;
      S.cells[spots[k]].m = 1;
    }
    for (i = 0; i < S.cells.length; i++) {
      S.cells[i].a = neighbors(i).filter(function (n) {
        return S.cells[n].m;
      }).length;
    }
  }

  function open(i) {
    if (S.status === 'won' || S.status === 'lost') return;
    var cell = S.cells[i];
    if (cell.f) return;
    if (S.status === 'ready') {
      placeMines(i);
      S.status = 'play';
    }
    if (cell.o) {
      chord(i);
      return;
    }
    if (cell.m) {
      lose(i);
      return;
    }
    flood(i);
    checkWin();
  }

  function flood(i) {
    var stack = [i];
    while (stack.length) {
      var p = stack.pop();
      var c = S.cells[p];
      if (c.o || c.f || c.m) continue;
      c.o = 1;
      if (c.a === 0) neighbors(p).forEach(function (n) {
        if (!S.cells[n].o) stack.push(n);
      });
    }
  }

  function chord(i) {
    var c = S.cells[i];
    if (!c.a) return;
    var ns = neighbors(i);
    var flags = ns.filter(function (n) {
      return S.cells[n].f;
    }).length;
    if (flags !== c.a) {
      if (ns.some(function (n) { return !S.cells[n].o && !S.cells[n].f; })) FG.toast('ปักธงรอบเลขนี้ให้ครบ ' + c.a + ' อันก่อน');
      return;
    }
    var hit = -1;
    ns.forEach(function (n) {
      var nc = S.cells[n];
      if (nc.o || nc.f) return;
      if (nc.m) hit = n;
      else flood(n);
    });
    if (hit >= 0) lose(hit);
    else checkWin();
  }

  function toggleFlag(i) {
    if (S.status === 'won' || S.status === 'lost') return;
    var c = S.cells[i];
    if (c.o) return;
    c.f = c.f ? 0 : 1;
    FG.buzz(15);
    save();
    render();
  }

  function lose(i) {
    S.status = 'lost';
    S.boom = i;
    FG.buzz(120);
    save();
    render();
    setTimeout(function () {
      FG.sheet({
        title: 'โดนระเบิด',
        text: 'ลองใหม่อีกตานะ — แตะแรกของทุกเกมปลอดภัยเสมอ',
        actions: [{ label: 'ดูกระดาน' }, { label: 'เล่นอีกครั้ง', primary: true, onClick: function () { newGame(prefSize()); } }]
      });
    }, 600);
  }

  function checkWin() {
    var closedSafe = S.cells.some(function (c) {
      return !c.o && !c.m;
    });
    if (closedSafe) {
      save();
      render();
      return;
    }
    S.status = 'won';
    S.cells.forEach(function (c) {
      if (c.m) c.f = 1;
    });
    var bests = FG.store.get(BEST, {});
    var isBest = bests[S.size] == null || S.seconds < bests[S.size];
    if (isBest) {
      bests[S.size] = S.seconds;
      FG.store.set(BEST, bests);
    }
    save();
    render();
    setTimeout(function () {
      FG.sheet({
        title: 'เคลียร์หมดแล้ว!',
        text: 'ขนาด' + SIZES[S.size].label + ' ใช้เวลา ' + FG.fmtTime(S.seconds) + (isBest ? ' — เร็วที่สุดของขนาดนี้' : ''),
        actions: [{ label: 'ดูกระดาน' }, { label: 'เล่นอีกครั้ง', primary: true, onClick: function () { newGame(prefSize()); } }]
      });
    }, 300);
  }

  function save() {
    FG.store.set(KEY, S);
    var bests = FG.store.get(BEST, {});
    var b = bests.s ? 'เล็ก ' + FG.fmtTime(bests.s) : bests.m ? 'กลาง ' + FG.fmtTime(bests.m) : bests.l ? 'ใหญ่ ' + FG.fmtTime(bests.l) : '';
    FG.hubNote('minesweeper', { note: b ? 'เร็วสุด ' + b : '', resume: S.status === 'play' });
  }

  /* ---------- render ---------- */
  function build() {
    boardEl.innerHTML = '';
    boardEl.style.setProperty('--cols', S.cols);
    boardEl.style.setProperty('--rows', S.rows);
    cellEls = [];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < S.cells.length; i++) {
      var el = document.createElement('div');
      el.className = 'ms-cell';
      el.setAttribute('role', 'gridcell');
      el.dataset.i = i;
      frag.appendChild(el);
      cellEls.push(el);
    }
    boardEl.appendChild(frag);
    levelEl.textContent = 'ขนาด' + SIZES[S.size].label;
  }

  function render() {
    var flags = 0;
    var ended = S.status === 'lost' || S.status === 'won';
    for (var i = 0; i < S.cells.length; i++) {
      var c = S.cells[i];
      var el = cellEls[i];
      var cls = 'ms-cell';
      var html = '';
      if (c.f) flags++;
      if (c.o) {
        cls += ' is-open';
        if (c.a) {
          cls += ' n' + c.a;
          html = String(c.a);
        }
      } else if (S.status === 'lost' && c.m && !c.f) {
        cls += ' is-open is-mine';
        if (i === S.boom) cls += ' is-boom';
        html = MINE_SVG;
      } else if (c.f) {
        cls += ' is-flag';
        if (ended && S.status === 'lost' && !c.m) cls += ' is-wrongflag';
        html = FLAG_SVG;
      }
      if (el.className !== cls) el.className = cls;
      if (el.innerHTML !== html) el.innerHTML = html;
    }
    leftEl.textContent = S.mines - flags;
    timeEl.textContent = FG.fmtTime(S.seconds);
  }

  /* ---------- timer ---------- */
  var timer = setInterval(function () {
    if (!S || S.status !== 'play' || document.hidden) return;
    S.seconds++;
    timeEl.textContent = FG.fmtTime(S.seconds);
    if (S.seconds % 5 === 0) FG.store.set(KEY, S);
  }, 1000);
  FG.onVisibility(function (hidden) {
    if (hidden && S) FG.store.set(KEY, S);
  });

  /* ---------- input: tap / long-press / right-click ---------- */
  var press = null; // {i, x, y, timer, done, el}
  var LONG_MS = 420;

  function cellAt(e) {
    var el = e.target.closest && e.target.closest('.ms-cell');
    return el ? +el.dataset.i : -1;
  }

  boardEl.addEventListener('pointerdown', function (e) {
    var i = cellAt(e);
    if (i < 0) return;
    if (e.button === 2) {
      toggleFlag(i);
      return;
    }
    if (press) clearTimeout(press.timer);
    var el = cellEls[i];
    press = { i: i, x: e.clientX, y: e.clientY, done: false, el: el, id: e.pointerId };
    if (!S.cells[i].o) el.classList.add('is-press');
    press.timer = setTimeout(function () {
      if (!press || press.i !== i) return;
      press.done = true;
      el.classList.remove('is-press');
      toggleFlag(i);
    }, LONG_MS);
  });

  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    press.el.classList.remove('is-press');
    press = null;
  }

  boardEl.addEventListener('pointermove', function (e) {
    if (!press || e.pointerId !== press.id) return;
    if (Math.abs(e.clientX - press.x) > 12 || Math.abs(e.clientY - press.y) > 12) cancelPress();
  });

  boardEl.addEventListener('pointerup', function (e) {
    if (!press || e.pointerId !== press.id) return;
    var p = press;
    cancelPress();
    if (p.done) return;
    var cell = S.cells[p.i];
    if (flagMode && !cell.o) toggleFlag(p.i);
    else open(p.i);
  });

  boardEl.addEventListener('pointercancel', cancelPress);
  boardEl.addEventListener('pointerleave', cancelPress);
  boardEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  function setMode(flag) {
    flagMode = flag;
    modeOpen.setAttribute('aria-checked', String(!flag));
    modeFlag.setAttribute('aria-checked', String(flag));
  }
  modeOpen.addEventListener('click', function () {
    setMode(false);
  });
  modeFlag.addEventListener('click', function () {
    setMode(true);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'f') setMode(!flagMode);
  });

  // ขนาดที่ตั้งไว้ (⚙️) — ปุ่ม ↻ และ "เล่นอีกครั้ง" ใช้ขนาดนี้
  function prefSize() {
    var s = FG.store.get('mines:size', 's');
    return SIZES[s] ? s : 's';
  }

  function inProgress() {
    return !!S && S.status === 'play';
  }

  // ↻ = เกมใหม่ขนาดที่ตั้งไว้
  document.getElementById('new').addEventListener('click', function () {
    FG.confirmNew({
      inProgress: inProgress,
      restart: function () {
        newGame(prefSize());
      }
    });
  });

  // ⚙️: ขนาดกระดาน (เริ่มเกมใหม่จึงมีผล) · บอกเวลาเร็วสุดของแต่ละขนาดไว้ด้วย
  FG.openSettings = function () {
    var cur = prefSize();
    var size = cur;
    var bests = FG.store.get(BEST, {});
    FG.settings({
      build: function (body) {
        var hint = Object.keys(SIZES)
          .map(function (k) {
            var z = SIZES[k];
            return z.label + ' ' + z.cols + '×' + z.rows + ' ระเบิด ' + z.mines + (bests[k] ? ' (เร็วสุด ' + FG.fmtTime(bests[k]) + ')' : '');
          })
          .join(' · ');
        body.appendChild(
          FG.group(
            'ขนาดกระดาน',
            FG.choice(
              Object.keys(SIZES).map(function (k) {
                return { value: k, label: SIZES[k].label };
              }),
              size,
              function (v) {
                size = v;
              }
            ),
            hint
          )
        );
      },
      needsNew: function () {
        return size !== cur;
      },
      save: function () {
        FG.store.set('mines:size', size);
      },
      inProgress: inProgress,
      restart: function () {
        newGame(size);
      }
    });
  };

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.cells) && SIZES[saved.size] && saved.cells.length === saved.cols * saved.rows && saved.status === 'play') {
    S = saved;
    build();
    render();
  } else {
    newGame(FG.store.get('mines:size', 's'));
  }
})();
