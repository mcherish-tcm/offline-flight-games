/* ฟรีเซลล์ — แจกตามเลขเกม, แตะเพื่อย้ายเอง + ลากวาง, ย้ายทีละหลายใบตามช่องว่าง, ขึ้นกองอัตโนมัติ, ย้อน, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var F = window.FreeCell;
  var C = window.FGCards;
  var KEY = 'fc:state';
  var STATS = 'fc:stats';

  var boardEl = document.getElementById('board');
  var movesEl = document.getElementById('moves');
  var timeEl = document.getElementById('time');
  var dealEl = document.getElementById('deal');
  var undoBtn = document.getElementById('undo');
  var autoBtn = document.getElementById('auto');

  var G; // { s: state, n: เลขเกม, moves, seconds, started, done }
  var history = [];
  var L = null;
  var busy = false;
  var stuckShown = false;

  /* ---------- DOM ---------- */
  C.sprite();
  var cellSlots = [0, 1, 2, 3].map(function () {
    return C.makeSlot(boardEl, 'slot--cell');
  });
  var foundSlots = [0, 1, 2, 3].map(function (s) {
    return C.makeSlot(boardEl, 'slot--found', C.suitIcon(s));
  });
  var colSlots = [0, 1, 2, 3, 4, 5, 6, 7].map(function () {
    return C.makeSlot(boardEl, 'slot--col');
  });
  var cardEls = [];
  for (var id = 0; id < 52; id++) {
    var el = C.makeCard(id, F.suit(id), F.rank(id));
    el.classList.add('is-up');
    boardEl.appendChild(el);
    cardEls.push(el);
  }

  /* ---------- game ---------- */
  function newGame(n) {
    FG.closeSheet();
    G = { s: F.deal(n), n: n, moves: 0, seconds: 0, started: false, done: false };
    history = [];
    stuckShown = false;
    save();
    render();
    setTimeout(runAuto, 350);
  }

  function snapshot() {
    history.push(JSON.stringify({ s: G.s, moves: G.moves }));
    if (history.length > 300) history.shift();
  }

  function undo() {
    if (!history.length || busy || G.done) return;
    var h = JSON.parse(history.pop());
    G.s = h.s;
    G.moves = h.moves + 1;
    stuckShown = false;
    save();
    render();
  }

  function doMove(from, n, to) {
    snapshot();
    G.s = F.apply(G.s, from, n, to);
    G.moves++;
    G.started = true;
    render();
    save();
    setTimeout(runAuto, 200);
  }

  // ขึ้นกองอัตโนมัติ (เฉพาะใบที่ปลอดภัย) ทีละใบ ให้เห็นไพ่วิ่ง
  function runAuto() {
    if (G.done) return;
    var m = F.nextAuto(G.s);
    if (!m) {
      busy = false;
      afterMoves();
      return;
    }
    busy = true;
    G.s = F.apply(G.s, m.from, m.n, m.to);
    render();
    setTimeout(runAuto, 110);
  }

  // ทุกแถวเรียงถูกแล้ว = ชนะแน่นอน → ปุ่มเก็บที่เหลือ
  function allSorted() {
    return G.s.cols.every(function (col) {
      return !col.length || F.isRun(col, 0);
    });
  }

  function finishAll() {
    if (busy || G.done) return;
    busy = true;
    snapshot();
    var mark = history.length;
    (function step() {
      var S = G.s;
      var best = null;
      for (var i = 0; i < 4; i++) {
        var c = S.cells[i];
        if (c !== -1 && S.found[F.suit(c)] === F.rank(c) - 1) best = { from: { t: 'cell', i: i }, n: 1, to: { t: 'found' } };
      }
      for (i = 0; !best && i < 8; i++) {
        var col = S.cols[i];
        if (col.length) {
          var t = col[col.length - 1];
          if (S.found[F.suit(t)] === F.rank(t) - 1) best = { from: { t: 'col', i: i }, n: 1, to: { t: 'found' } };
        }
      }
      if (best) {
        G.s = F.apply(G.s, best.from, best.n, best.to);
        G.moves++;
        render();
        setTimeout(step, 70);
      } else {
        history.length = mark;
        busy = false;
        afterMoves();
      }
    })();
  }

  function afterMoves() {
    if (F.isWon(G.s) && !G.done) {
      G.done = true;
      var st = FG.store.get(STATS, { wins: 0 });
      st.wins++;
      var isBest = st.best == null || G.seconds < st.best;
      if (isBest) st.best = G.seconds;
      FG.store.set(STATS, st);
      save();
      render();
      setTimeout(function () {
        FG.sheet({
          title: 'ชนะแล้ว!',
          text:
            'เกม #' + G.n + ' · ย้าย ' + G.moves + ' ครั้ง · ' + FG.fmtTime(G.seconds) + (isBest ? ' — เร็วที่สุดของเรา' : '') + ' · ชนะรวม ' + st.wins + ' ครั้ง',
          actions: [
            { label: 'ดูโต๊ะ' },
            {
              label: 'เกมใหม่',
              primary: true,
              onClick: function () {
                newGame(F.randomDealNumber());
              }
            }
          ]
        });
      }, 400);
      return;
    }
    save();
    render();
    if (G.started && !stuckShown && !F.hasMoves(G.s)) {
      stuckShown = true;
      FG.sheet({
        title: 'ไม่มีตาเดินแล้ว',
        text: 'กดย้อนเพื่อลองทางอื่น หรือเริ่มใหม่',
        actions: [
          { label: 'ย้อน', onClick: undo },
          {
            label: 'เริ่มเกมนี้ใหม่',
            primary: true,
            onClick: function () {
              newGame(G.n);
            }
          }
        ]
      });
    }
  }

  /* ---------- layout + render ---------- */
  function layout() {
    L = C.sizeCards(boardEl, 8, 0.3);
    L.tabTop = L.g + L.h + Math.round(L.g * 2.5);
  }

  function colOffsets(c) {
    var col = G.s.cols[c];
    var off = L.h * 0.3;
    var need = off * Math.max(0, col.length - 1);
    var avail = L.H - L.tabTop - L.h - L.g;
    return need > avail && need > 0 ? Math.max(L.h * 0.08, avail / (col.length - 1)) : off;
  }

  function render() {
    if (!L) layout();
    var S = G.s;
    var y0 = L.g;
    cellSlots.forEach(function (el, i) {
      C.place(el, L.colX(i), y0, 0);
    });
    foundSlots.forEach(function (el, s) {
      C.place(el, L.colX(4 + s), y0, 0);
    });
    colSlots.forEach(function (el, c) {
      C.place(el, L.colX(c), L.tabTop, 0);
    });
    S.cells.forEach(function (id, i) {
      if (id !== -1) C.place(cardEls[id], L.colX(i), y0, 50);
    });
    for (var s = 0; s < 4; s++) {
      for (var r = 1; r <= S.found[s]; r++) C.place(cardEls[s * 13 + r - 1], L.colX(4 + s), y0, 100 + r);
    }
    S.cols.forEach(function (col, c) {
      var off = colOffsets(c);
      col.forEach(function (id, k) {
        C.place(cardEls[id], L.colX(c), Math.round(L.tabTop + k * off), 200 + k);
      });
    });
    movesEl.textContent = G.moves;
    timeEl.textContent = FG.fmtTime(G.seconds);
    dealEl.textContent = 'เกม #' + G.n;
    undoBtn.disabled = !history.length || G.done || busy;
    autoBtn.hidden = G.done || busy || !allSorted() || F.isWon(S);
  }

  function save() {
    FG.store.set(KEY, { g: G, h: history.slice(-60) });
    var st = FG.store.get(STATS, { wins: 0 });
    FG.hubNote('freecell', { note: st.wins ? 'ชนะ ' + st.wins + ' ครั้ง' : '', resume: G.started && !G.done });
  }

  /* ---------- input ---------- */
  function locate(id) {
    var S = G.s;
    var i = S.cells.indexOf(id);
    if (i !== -1) return { from: { t: 'cell', i: i }, n: 1 };
    for (var c = 0; c < 8; c++) {
      var k = S.cols[c].indexOf(id);
      if (k !== -1) return { from: { t: 'col', i: c }, n: S.cols[c].length - k, k: k };
    }
    return null; // บนกองเก็บ — ไม่ให้ดึงลง
  }

  function limitToast(n, to) {
    var max = F.maxMove(G.s, to.t === 'col' && !G.s.cols[to.i].length);
    if (n > max) FG.toast('ตอนนี้ย้ายได้ทีละ ' + max + ' ใบ (เพิ่มได้ด้วยช่องพัก/แถวว่าง)', 2400);
  }

  C.input(boardEl, {
    els: cardEls,
    busy: function () {
      return busy || G.done;
    },
    pick: function (id) {
      if (id == null) return null;
      var loc = locate(id);
      if (!loc) return null;
      if (loc.from.t === 'col' && !F.isRun(G.s.cols[loc.from.i], loc.k)) return null;
      var ids = loc.from.t === 'cell' ? [id] : G.s.cols[loc.from.i].slice(loc.k);
      return { ids: ids, from: loc.from, n: loc.n };
    },
    drop: function (p, cx, cy) {
      var col = Math.floor((cx - L.x0 + L.g / 2) / (L.w + L.g));
      if (col < 0 || col > 7) return false;
      var to;
      if (cy < L.tabTop - L.g) {
        if (col >= 4) to = { t: 'found' };
        else to = { t: 'cell', i: col };
      } else to = { t: 'col', i: col };
      if (F.legal(G.s, p.from, p.n, to)) {
        doMove(p.from, p.n, to);
        return true;
      }
      if (to.t === 'col') limitToast(p.n, to);
      return false;
    },
    tap: function (id, slot, p) {
      if (id == null) return;
      if (!p) {
        C.shake(cardEls[id]);
        return;
      }
      var to = F.bestMove(G.s, p.from, p.n);
      if (to) doMove(p.from, p.n, to);
      else {
        C.shake(cardEls[id]);
        if (p.n > 1) {
          // หาแถวที่ต่อได้ถ้าไม่ติดจำนวนใบ แล้วบอกเหตุผล
          for (var c = 0; c < 8; c++) {
            var dest = G.s.cols[c];
            if (dest.length && F.stacks(p.ids[0], dest[dest.length - 1])) {
              limitToast(p.n, { t: 'col', i: c });
              break;
            }
          }
        }
      }
    },
    cancel: function () {
      render();
    }
  });

  undoBtn.addEventListener('click', undo);
  autoBtn.addEventListener('click', finishAll);

  document.getElementById('new').addEventListener('click', function () {
    var body = document.createElement('div');
    body.appendChild(FG.label('เลขเกม (1–' + F.MAX_DEAL + ') · เลขเดียวกัน = แจกเหมือนเดิม'));
    var input = document.createElement('input');
    input.className = 'field';
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '1';
    input.max = String(F.MAX_DEAL);
    input.placeholder = 'เว้นว่าง = สุ่ม';
    input.setAttribute('aria-label', 'เลขเกม');
    body.appendChild(input);
    FG.sheet({
      title: 'เกมใหม่?',
      text: G.started && !G.done ? 'ตาที่เล่นอยู่จะหายไป' : '',
      body: body,
      actions: [
        {
          label: 'เล่นเกม #' + G.n + ' ใหม่',
          onClick: function () {
            newGame(G.n);
          }
        },
        {
          label: 'แจกใหม่',
          primary: true,
          onClick: function () {
            var v = parseInt(input.value, 10);
            if (v >= 1 && v <= F.MAX_DEAL) newGame(v);
            else newGame(F.randomDealNumber());
          }
        }
      ]
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'u') undo();
  });

  /* ---------- timer ---------- */
  setInterval(function () {
    if (!G || !G.started || G.done || document.hidden) return;
    G.seconds++;
    timeEl.textContent = FG.fmtTime(G.seconds);
    if (G.seconds % 10 === 0) save();
  }, 1000);
  FG.onVisibility(function (hidden) {
    if (hidden && G) save();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();
      render();
    }, 80);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.g && saved.g.s && Array.isArray(saved.g.s.cols) && saved.g.s.cols.length === 8 && !saved.g.done) {
    G = saved.g;
    history = Array.isArray(saved.h) ? saved.h : [];
    layout();
    render();
    setTimeout(runAuto, 300);
  } else {
    layout();
    newGame(F.randomDealNumber());
  }
})();
