/* สไปเดอร์ — 1 / 2 / 4 ดอก, แตะเพื่อย้ายเอง + ลากวาง, แจกจากกอง, เก็บชุด K→A อัตโนมัติ, ย้อน, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var P = window.Spider;
  var C = window.FGCards;
  var KEY = 'sp:state';
  var STATS = 'sp:stats';
  var MODE_TH = { 1: '1 ดอก', 2: '2 ดอก', 4: '4 ดอก' };

  var boardEl = document.getElementById('board');
  var movesEl = document.getElementById('moves');
  var timeEl = document.getElementById('time');
  var modeEl = document.getElementById('mode');
  var undoBtn = document.getElementById('undo');

  var G; // { s, moves, seconds, started, done }
  var history = [];
  var L = null;
  var busy = false;
  var cardEls = [];
  var builtSuits = 0;

  /* ---------- DOM ---------- */
  C.sprite();
  var stockSlot = C.makeSlot(boardEl, 'slot--stock', FG.icon('restart'));
  var countEl = document.createElement('span');
  countEl.className = 'sp-count num';
  boardEl.appendChild(countEl);
  var doneSlots = [];
  for (var k = 0; k < 8; k++) doneSlots.push(C.makeSlot(boardEl, 'slot--found'));
  var colSlots = [];
  for (k = 0; k < 10; k++) colSlots.push(C.makeSlot(boardEl, 'slot--col'));

  function buildCards(suits) {
    if (builtSuits === suits) return;
    cardEls.forEach(function (el) {
      el.remove();
    });
    cardEls.length = 0; // แก้ array เดิม (input ถือ array นี้อยู่)
    for (var id = 0; id < 104; id++) {
      var el = C.makeCard(id, P.suitOf(suits, id), P.rank(id));
      boardEl.appendChild(el);
      cardEls.push(el);
    }
    builtSuits = suits;
    if (L) layout();
  }

  /* ---------- game ---------- */
  function newGame(suits) {
    FG.closeSheet();
    buildCards(suits);
    G = { s: P.deal(suits), moves: 0, seconds: 0, started: false, done: false };
    history = [];
    FG.store.set('sp:suits', suits);
    save();
    layout();
    render();
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
    save();
    render();
  }

  function finish(res) {
    G.s = res.state;
    G.moves++;
    G.started = true;
    render();
    if (res.collected) {
      FG.buzz(30);
      FG.toast('เก็บครบชุดแล้ว ' + G.s.done.length + '/8');
    }
    afterMove();
  }

  function doMove(from, i, to) {
    snapshot();
    finish(P.move(G.s, from, i, to));
  }

  function dealStock() {
    if (busy || G.done) return;
    var why = P.canDeal(G.s);
    if (why === 'empty') return;
    if (why === 'gap') {
      FG.toast('ต้องมีไพ่ครบทุกแถวก่อน จึงจะแจกได้', 2400);
      C.shake(stockSlot);
      return;
    }
    snapshot();
    finish(P.dealRow(G.s));
  }

  function afterMove() {
    if (P.isWon(G.s) && !G.done) {
      G.done = true;
      var st = FG.store.get(STATS, {});
      var key = 'w' + G.s.suits;
      st[key] = (st[key] || 0) + 1;
      var bk = 'b' + G.s.suits;
      var isBest = st[bk] == null || G.seconds < st[bk];
      if (isBest) st[bk] = G.seconds;
      FG.store.set(STATS, st);
      setTimeout(function () {
        FG.sheet({
          title: 'ชนะแล้ว!',
          text:
            MODE_TH[G.s.suits] + ' · ย้าย ' + G.moves + ' ครั้ง · ' + FG.fmtTime(G.seconds) + (isBest ? ' — เร็วที่สุดของเรา' : '') + ' · ชนะแบบนี้ ' + st[key] + ' ครั้ง',
          actions: [
            { label: 'ดูโต๊ะ' },
            {
              label: 'แจกใหม่',
              primary: true,
              onClick: function () {
                newGame(G.s.suits);
              }
            }
          ]
        });
      }, 450);
    }
    save();
    render();
  }

  /* ---------- layout + render ---------- */
  function layout() {
    L = C.sizeCards(boardEl, 10, 0.2);
    L.tabTop = L.g + L.h + Math.round(L.g * 3);
  }

  function colOffsets(c) {
    var S = G.s;
    var col = S.cols[c];
    var down = L.h * 0.12;
    var up = L.h * (L.w < 40 ? 0.36 : 0.3);
    var nd = Math.min(S.down[c], Math.max(0, col.length - 1));
    var nu = Math.max(0, col.length - 1 - nd);
    var need = nd * down + nu * up;
    var avail = L.H - L.tabTop - L.h - L.g;
    var f = need > avail && need > 0 ? avail / need : 1;
    return { down: down * f, up: up * f };
  }

  // ชุดที่เก็บแล้ว: ไพ่ที่ไม่อยู่ในแถวหรือกอง → จัดเป็นชุดละ 13 ใบตามดอก
  function doneGroups() {
    var S = G.s;
    var inPlay = {};
    S.cols.forEach(function (col) {
      col.forEach(function (id) {
        inPlay[id] = true;
      });
    });
    S.stock.forEach(function (id) {
      inPlay[id] = true;
    });
    var bySuit = {};
    for (var id = 0; id < 104; id++) {
      if (inPlay[id]) continue;
      var s = P.suitOf(S.suits, id);
      (bySuit[s] = bySuit[s] || []).push(id);
    }
    Object.keys(bySuit).forEach(function (s) {
      bySuit[s].sort(function (a, b) {
        return P.rank(b) - P.rank(a) || a - b;
      });
    });
    var groups = [];
    var used = {};
    S.done.forEach(function (s) {
      var list = bySuit[s] || [];
      var got = [];
      var seen = {};
      for (var k = 0; k < list.length && got.length < 13; k++) {
        var cid = list[k];
        if (used[cid] || seen[P.rank(cid)]) continue;
        seen[P.rank(cid)] = true;
        used[cid] = true;
        got.push(cid);
      }
      groups.push(got);
    });
    return groups;
  }

  function render() {
    if (!L) layout();
    var S = G.s;
    var y0 = L.g;
    C.place(stockSlot, L.colX(0), y0, 0);
    stockSlot.style.visibility = S.stock.length ? 'hidden' : 'visible';
    doneSlots.forEach(function (el, k) {
      C.place(el, L.colX(2 + k), y0, 0);
    });
    colSlots.forEach(function (el, c) {
      C.place(el, L.colX(c), L.tabTop, 0);
    });

    // กองแจก: 1 กองต่อ 1 รอบที่เหลือ ซ้อนเหลื่อมกันเล็กน้อย
    var rounds = Math.ceil(S.stock.length / 10);
    S.stock.forEach(function (id, n) {
      var el = cardEls[id];
      el.classList.remove('is-up');
      var r = Math.floor(n / 10);
      C.place(el, L.colX(0) + (rounds - 1 - r) * Math.max(3, Math.round(L.w * 0.12)), y0, 10 + (rounds - 1 - r) * 10 + (n % 10));
    });
    countEl.hidden = !rounds;
    countEl.textContent = rounds;
    countEl.style.transform = 'translate(' + (L.colX(0) + L.w - 8) + 'px,' + (y0 - 6) + 'px)';
    countEl.setAttribute('aria-label', 'แจกได้อีก ' + rounds + ' รอบ');

    doneGroups().forEach(function (grp, k) {
      grp.forEach(function (id, n) {
        cardEls[id].classList.add('is-up');
        C.place(cardEls[id], L.colX(2 + k), y0, 100 + (13 - n));
      });
    });

    S.cols.forEach(function (col, c) {
      var o = colOffsets(c);
      var y = L.tabTop;
      col.forEach(function (id, i) {
        var up = i >= S.down[c];
        cardEls[id].classList.toggle('is-up', up);
        C.place(cardEls[id], L.colX(c), Math.round(y), 200 + i);
        y += up ? o.up : o.down;
      });
    });

    movesEl.textContent = G.moves;
    timeEl.textContent = FG.fmtTime(G.seconds);
    modeEl.textContent = MODE_TH[S.suits] + ' · เก็บ ' + S.done.length + '/8';
    undoBtn.disabled = !history.length || G.done || busy;
  }

  function save() {
    FG.store.set(KEY, { g: G, h: history.slice(-50) });
    var st = FG.store.get(STATS, {});
    var wins = (st.w1 || 0) + (st.w2 || 0) + (st.w4 || 0);
    FG.hubNote('spider', { note: wins ? 'ชนะ ' + wins + ' ครั้ง' : '', resume: G.started && !G.done });
  }

  /* ---------- input ---------- */
  function locate(id) {
    for (var c = 0; c < 10; c++) {
      var i = G.s.cols[c].indexOf(id);
      if (i !== -1) return { c: c, i: i };
    }
    return null;
  }

  C.input(boardEl, {
    els: cardEls,
    busy: function () {
      return busy || G.done;
    },
    pick: function (id, slot) {
      if (id == null) return null;
      var loc = locate(id);
      if (!loc || !P.isRun(G.s, loc.c, loc.i)) return null;
      return { ids: G.s.cols[loc.c].slice(loc.i), c: loc.c, i: loc.i };
    },
    drop: function (p, cx, cy) {
      var col = Math.floor((cx - L.x0 + L.g / 2) / (L.w + L.g));
      if (col < 0 || col > 9 || cy < L.tabTop - L.h * 0.4) return false;
      if (!P.legal(G.s, p.c, p.i, col)) return false;
      doMove(p.c, p.i, col);
      return true;
    },
    tap: function (id, slot, p) {
      if (id == null) {
        if (slot === stockSlot) dealStock();
        return;
      }
      if (G.s.stock.indexOf(id) !== -1) {
        dealStock();
        return;
      }
      if (!p) {
        C.shake(cardEls[id]);
        return;
      }
      var to = P.bestMove(G.s, p.c, p.i);
      if (to !== -1) doMove(p.c, p.i, to);
      else C.shake(cardEls[id]);
    },
    cancel: function () {
      render();
    }
  });

  undoBtn.addEventListener('click', undo);
  document.getElementById('new').addEventListener('click', function () {
    var suits = G ? G.s.suits : 1;
    var body = document.createElement('div');
    body.appendChild(FG.label('จำนวนดอก (ยิ่งมากยิ่งยาก)'));
    body.appendChild(
      FG.choice(
        [
          { value: 1, label: '1 ดอก (ง่าย)' },
          { value: 2, label: '2 ดอก' },
          { value: 4, label: '4 ดอก' }
        ],
        suits,
        function (v) {
          suits = v;
        }
      )
    );
    FG.sheet({
      title: 'แจกไพ่ใหม่?',
      text: G.started && !G.done ? 'ตาที่เล่นอยู่จะหายไป' : '',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'แจกใหม่',
          primary: true,
          onClick: function () {
            newGame(suits);
          }
        }
      ]
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'u') undo();
    if (e.key === ' ' || e.key === 'd') {
      e.preventDefault();
      dealStock();
    }
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
  if (saved && saved.g && saved.g.s && Array.isArray(saved.g.s.cols) && saved.g.s.cols.length === 10 && !saved.g.done) {
    G = saved.g;
    history = Array.isArray(saved.h) ? saved.h : [];
    buildCards(G.s.suits);
    layout();
    render();
  } else {
    var s0 = FG.store.get('sp:suits', 1);
    newGame(s0 === 2 || s0 === 4 ? s0 : 1);
  }
})();
