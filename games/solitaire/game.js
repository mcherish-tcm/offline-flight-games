/* โซลิแทร์ (Klondike) — จั่ว 1 / จั่ว 3, แตะเพื่อย้ายอัตโนมัติ + ลากวาง, ย้อน, เก็บไพ่อัตโนมัติ, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var KEY = 'sol:state';
  var STATS = 'sol:stats';
  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUIT_TH = ['โพดำ', 'โพแดง', 'ข้าวหลามตัด', 'ดอกจิก'];

  function suit(id) {
    return Math.floor(id / 13);
  }
  function rank(id) {
    return (id % 13) + 1;
  }
  function red(id) {
    var s = suit(id);
    return s === 1 || s === 2;
  }

  var boardEl = document.getElementById('board');
  var movesEl = document.getElementById('moves');
  var timeEl = document.getElementById('time');
  var modeEl = document.getElementById('mode');
  var undoBtn = document.getElementById('undo');
  var autoBtn = document.getElementById('auto');

  var S; // {stock[], waste[], found[4][], tab[7][], up[52], draw, moves, seconds, done, started}
  var history = [];
  var L = {}; // layout numbers
  var cardEls = [];
  var slotEls = {};
  var autoRunning = false;

  /* ---------- DOM ---------- */
  function suitSvg(s, cls) {
    return '<svg class="' + cls + '" aria-hidden="true"><use href="#suit-' + s + '"/></svg>';
  }

  function makeSlot(name, inner) {
    var el = document.createElement('div');
    el.className = 'slot slot--' + name;
    el.innerHTML = inner || '';
    boardEl.appendChild(el);
    return el;
  }

  slotEls.stock = makeSlot('stock', FG.icon('restart'));
  slotEls.waste = makeSlot('waste');
  slotEls.found = [0, 1, 2, 3].map(function (s) {
    return makeSlot('found', '<svg aria-hidden="true"><use href="#suit-' + s + '"/></svg>');
  });
  slotEls.tab = [0, 1, 2, 3, 4, 5, 6].map(function () {
    return makeSlot('tab');
  });

  for (var id = 0; id < 52; id++) {
    var el = document.createElement('div');
    el.className = 'card' + (red(id) ? ' is-red' : '');
    el.dataset.id = id;
    el.setAttribute('aria-label', SUIT_TH[suit(id)] + ' ' + RANKS[rank(id)]);
    el.innerHTML =
      '<div class="card__back"></div><div class="card__face"><span class="card__rank">' +
      RANKS[rank(id)] +
      '</span>' +
      suitSvg(suit(id), 'card__pip') +
      suitSvg(suit(id), 'card__big') +
      '</div>';
    boardEl.appendChild(el);
    cardEls.push(el);
  }

  /* ---------- game setup ---------- */
  function deal(draw) {
    FG.closeSheet();
    var deck = [];
    for (var i = 0; i < 52; i++) deck.push(i);
    for (i = 51; i > 0; i--) {
      var r = Math.floor(Math.random() * (i + 1));
      var t = deck[i];
      deck[i] = deck[r];
      deck[r] = t;
    }
    S = { stock: [], waste: [], found: [[], [], [], []], tab: [[], [], [], [], [], [], []], up: new Array(52).fill(false), draw: draw, moves: 0, seconds: 0, done: false, started: false };
    for (var p = 0; p < 7; p++) {
      for (var k = 0; k <= p; k++) S.tab[p].push(deck.pop());
      S.up[S.tab[p][p]] = true;
    }
    S.stock = deck;
    history = [];
    FG.store.set('sol:draw', draw);
    save();
    render();
  }

  function pushHistory() {
    history.push(JSON.stringify({ stock: S.stock, waste: S.waste, found: S.found, tab: S.tab, up: S.up, moves: S.moves }));
    if (history.length > 400) history.shift();
  }

  function undo() {
    if (!history.length || autoRunning || S.done) return;
    var h = JSON.parse(history.pop());
    S.stock = h.stock;
    S.waste = h.waste;
    S.found = h.found;
    S.tab = h.tab;
    S.up = h.up;
    S.moves = h.moves + 1; // undo counts as a move, like most Klondike apps
    save();
    render();
  }

  /* ---------- rules ---------- */
  function top(arr) {
    return arr.length ? arr[arr.length - 1] : -1;
  }

  function canFound(id) {
    var f = S.found[suit(id)];
    return f.length === rank(id) - 1;
  }

  function canTab(id, p) {
    var pile = S.tab[p];
    if (!pile.length) return rank(id) === 13;
    var t = top(pile);
    return S.up[t] && red(t) !== red(id) && rank(t) === rank(id) + 1;
  }

  // where is card id? → {kind, p|k, i}
  function locate(id) {
    var i = S.waste.indexOf(id);
    if (i >= 0) return { kind: 'waste', i: i };
    i = S.stock.indexOf(id);
    if (i >= 0) return { kind: 'stock', i: i };
    for (var k = 0; k < 4; k++) {
      i = S.found[k].indexOf(id);
      if (i >= 0) return { kind: 'found', k: k, i: i };
    }
    for (var p = 0; p < 7; p++) {
      i = S.tab[p].indexOf(id);
      if (i >= 0) return { kind: 'tab', p: p, i: i };
    }
    return null;
  }

  function pileOf(loc) {
    if (loc.kind === 'waste') return S.waste;
    if (loc.kind === 'stock') return S.stock;
    if (loc.kind === 'found') return S.found[loc.k];
    return S.tab[loc.p];
  }

  // can the card at loc be picked up (with everything on top of it)?
  function movable(loc) {
    var pile = pileOf(loc);
    if (loc.kind === 'stock') return false;
    if (loc.kind === 'waste' || loc.kind === 'found') return loc.i === pile.length - 1;
    return S.up[pile[loc.i]];
  }

  function legal(loc, dest) {
    var pile = pileOf(loc);
    var id = pile[loc.i];
    var count = pile.length - loc.i;
    if (dest.kind === 'found') return count === 1 && dest.k === suit(id) && canFound(id);
    if (dest.kind === 'tab') {
      if (loc.kind === 'tab' && loc.p === dest.p) return false;
      return canTab(id, dest.p);
    }
    return false;
  }

  function doMove(loc, dest) {
    pushHistory();
    var from = pileOf(loc);
    var cards = from.splice(loc.i);
    var to = dest.kind === 'found' ? S.found[dest.k] : S.tab[dest.p];
    Array.prototype.push.apply(to, cards);
    if (loc.kind === 'tab' && from.length) S.up[top(from)] = true;
    S.moves++;
    S.started = true;
    afterMove();
  }

  // หาที่ลงที่ดีที่สุดให้ไพ่ที่แตะ: ขึ้นกองก่อน (ยกเว้นดึงลงจากกอง) → ต่อบนไพ่ในแถว → ช่องว่าง (เฉพาะ K)
  function bestDest(loc) {
    var pile = pileOf(loc);
    var id = pile[loc.i];
    var single = loc.i === pile.length - 1;
    if (single && loc.kind !== 'found') {
      var fd = { kind: 'found', k: suit(id) };
      if (legal(loc, fd)) return fd;
    }
    var empty = null;
    for (var n = 1; n <= 7; n++) {
      var p = ((loc.kind === 'tab' ? loc.p : -1) + n + 7) % 7;
      if (loc.kind === 'tab' && p === loc.p) continue;
      var d = { kind: 'tab', p: p };
      if (!legal(loc, d)) continue;
      if (S.tab[p].length) return d;
      // K ที่อยู่ล่างสุดของแถวอยู่แล้ว ย้ายไปช่องว่างไม่มีประโยชน์
      if (!(loc.kind === 'tab' && loc.i === 0) && !empty) empty = d;
    }
    return empty;
  }

  function drawStock() {
    if (autoRunning || S.done) return;
    if (!S.stock.length && !S.waste.length) return;
    pushHistory();
    if (S.stock.length) {
      for (var n = 0; n < S.draw && S.stock.length; n++) {
        var id = S.stock.pop();
        S.up[id] = true;
        S.waste.push(id);
      }
    } else {
      while (S.waste.length) {
        var w = S.waste.pop();
        S.up[w] = false;
        S.stock.push(w);
      }
    }
    S.moves++;
    S.started = true;
    afterMove();
  }

  function allRevealed() {
    if (S.stock.length || S.waste.length) return false;
    return S.tab.every(function (pile) {
      return pile.every(function (id) {
        return S.up[id];
      });
    });
  }

  function afterMove() {
    var won = S.found.every(function (f) {
      return f.length === 13;
    });
    if (won && !S.done) {
      S.done = true;
      var st = FG.store.get(STATS, { wins: 0 });
      st.wins++;
      var isBest = st.best == null || S.seconds < st.best;
      if (isBest) st.best = S.seconds;
      FG.store.set(STATS, st);
      setTimeout(function () {
        FG.sheet({
          title: 'ชนะแล้ว!',
          text: 'ย้าย ' + S.moves + ' ครั้ง · ' + FG.fmtTime(S.seconds) + (isBest ? ' — เร็วที่สุดของเรา' : '') + ' · ชนะรวม ' + st.wins + ' ครั้ง',
          actions: [{ label: 'ดูโต๊ะ' }, { label: 'แจกใหม่', primary: true, onClick: function () { deal(S.draw); } }]
        });
      }, 400);
    }
    save();
    render();
  }

  function autoComplete() {
    if (autoRunning || !allRevealed()) return;
    autoRunning = true;
    pushHistory();
    var historyLen = history.length;
    (function step() {
      var moved = false;
      // เลือกไพ่ใบที่แต้มต่ำสุดที่ขึ้นกองได้
      var best = null;
      for (var p = 0; p < 7; p++) {
        var pile = S.tab[p];
        if (!pile.length) continue;
        var id = top(pile);
        if (canFound(id) && (!best || rank(id) < rank(best.id))) best = { p: p, id: id };
      }
      if (best) {
        S.tab[best.p].pop();
        S.found[suit(best.id)].push(best.id);
        S.moves++;
        moved = true;
        render();
      }
      if (moved) setTimeout(step, 70);
      else {
        autoRunning = false;
        history.length = historyLen; // auto-complete = 1 step of undo
        afterMove();
      }
    })();
  }

  /* ---------- layout + render ---------- */
  function layout() {
    var W = boardEl.clientWidth;
    var H = boardEl.clientHeight;
    var g = Math.max(4, Math.round(W * 0.014));
    var w = Math.floor((W - 8 * g) / 7);
    var h = Math.round(w * 1.4);
    // จอเตี้ยมาก: ย่อไพ่ให้แถวบน + แถวล่างพอดี
    var maxH = (H - 3 * g) / 3.2;
    if (h > maxH) {
      h = Math.floor(maxH);
      w = Math.floor(h / 1.4);
    }
    var x0 = Math.round((W - (7 * w + 6 * g)) / 2);
    L = { W: W, H: H, g: g, w: w, h: h, x0: x0, tabTop: g + h + Math.round(g * 2.2) };
    boardEl.style.setProperty('--card-radius', Math.max(4, Math.round(w * 0.1)) + 'px');
    boardEl.style.setProperty('--rank-size', Math.round(w * 0.36) + 'px');
    boardEl.style.setProperty('--pip-size', Math.round(w * 0.3) + 'px');
    boardEl.querySelectorAll('.slot, .card').forEach(function (el) {
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    });
  }

  function colX(c) {
    return L.x0 + c * (L.w + L.g);
  }

  function place(el, x, y, z) {
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    el.style.zIndex = z;
  }

  function tabOffsets(p) {
    var pile = S.tab[p];
    var down = L.h * 0.12;
    var upOff = L.h * 0.3;
    var need = 0;
    for (var i = 0; i < pile.length - 1; i++) need += S.up[pile[i]] ? upOff : down;
    var avail = L.H - L.tabTop - L.h - L.g;
    var f = need > avail && need > 0 ? Math.max(0.2, avail / need) : 1;
    return { down: down * f, up: upOff * f };
  }

  function render() {
    if (!L.w) layout();
    var y0 = L.g;
    // slots
    place(slotEls.stock, colX(0), y0, 0);
    slotEls.stock.classList.toggle('is-recycle', !S.stock.length && S.waste.length > 0);
    slotEls.stock.style.visibility = S.stock.length ? 'hidden' : 'visible';
    place(slotEls.waste, colX(1), y0, 0);
    slotEls.waste.style.visibility = 'hidden';
    slotEls.found.forEach(function (el, k) {
      place(el, colX(3 + k), y0, 0);
    });
    slotEls.tab.forEach(function (el, p) {
      place(el, colX(p), L.tabTop, 0);
    });

    // stock
    S.stock.forEach(function (id, i) {
      setCard(id, colX(0), y0, 10 + i);
    });
    // waste — draw-3 fans the last three
    var fanStart = S.draw === 3 ? Math.max(0, S.waste.length - 3) : S.waste.length;
    S.waste.forEach(function (id, i) {
      var off = i >= fanStart ? (i - fanStart) * Math.round(L.w * 0.3) : 0;
      setCard(id, colX(1) + off, y0, 100 + i);
    });
    // foundations
    S.found.forEach(function (f, k) {
      f.forEach(function (id, i) {
        setCard(id, colX(3 + k), y0, 200 + i);
      });
    });
    // tableau
    S.tab.forEach(function (pile, p) {
      var o = tabOffsets(p);
      var y = L.tabTop;
      pile.forEach(function (id, i) {
        setCard(id, colX(p), Math.round(y), 300 + i);
        y += S.up[id] ? o.up : o.down;
      });
    });

    movesEl.textContent = S.moves;
    timeEl.textContent = FG.fmtTime(S.seconds);
    modeEl.textContent = 'จั่วทีละ ' + S.draw;
    undoBtn.disabled = !history.length || S.done || autoRunning;
    autoBtn.hidden = !(allRevealed() && !S.done && !autoRunning);
  }

  function setCard(id, x, y, z) {
    var el = cardEls[id];
    el.classList.toggle('is-up', !!S.up[id]);
    el.dataset.x = x;
    el.dataset.y = y;
    place(el, x, y, z);
  }

  function save() {
    FG.store.set(KEY, { s: S, h: history.slice(-40) });
    var st = FG.store.get(STATS, { wins: 0 });
    FG.hubNote('solitaire', { note: st.wins ? 'ชนะ ' + st.wins + ' ครั้ง' : '', resume: S.started && !S.done });
  }

  /* ---------- input: tap to move + drag ---------- */
  var drag = null;

  function shake(el) {
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
  }

  boardEl.addEventListener('pointerdown', function (e) {
    if (autoRunning || drag || FG.isSheetOpen()) return;
    var cardEl = e.target.closest('.card');
    var slot = e.target.closest('.slot--stock');
    drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, moving: false, stock: !!slot };
    if (cardEl) {
      var id = +cardEl.dataset.id;
      var loc = locate(id);
      drag.id = id;
      drag.loc = loc;
      if (loc.kind === 'stock') drag.stock = true;
      else if (movable(loc)) {
        drag.group = pileOf(loc).slice(loc.i);
      }
    }
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch (err) {}
  });

  boardEl.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.pid || !drag.group) return;
    var dx = e.clientX - drag.x;
    var dy = e.clientY - drag.y;
    if (!drag.moving && Math.abs(dx) + Math.abs(dy) < 8) return;
    drag.moving = true;
    drag.group.forEach(function (id, n) {
      var el = cardEls[id];
      el.classList.add('is-dragging');
      place(el, +el.dataset.x + dx, +el.dataset.y + dy, 1000 + n);
    });
    drag.dx = dx;
    drag.dy = dy;
  });

  function endDrag(e, cancelled) {
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    if (d.group)
      d.group.forEach(function (id) {
        cardEls[id].classList.remove('is-dragging');
      });
    if (cancelled) {
      render();
      return;
    }
    if (d.moving) {
      var el = cardEls[d.group[0]];
      var cx = +el.dataset.x + d.dx + L.w / 2;
      var cy = +el.dataset.y + d.dy + L.h / 2;
      var col = Math.floor((cx - L.x0 + L.g / 2) / (L.w + L.g));
      var dest = null;
      if (col >= 0 && col < 7) {
        if (cy < L.tabTop - L.g && col >= 3) dest = { kind: 'found', k: col - 3 };
        else if (cy >= L.tabTop - L.h * 0.3) dest = { kind: 'tab', p: col };
      }
      // วางเลยกองไปนิดก็ยังขึ้นกองให้ ถ้าเป็นใบเดียวที่ขึ้นได้
      if (dest && dest.kind === 'found' && d.group.length === 1) dest.k = suit(d.id);
      if (dest && legal(d.loc, dest)) doMove(d.loc, dest);
      else render();
      return;
    }
    // tap
    if (d.stock) {
      drawStock();
      return;
    }
    if (d.id == null) return;
    if (!d.group) {
      shake(cardEls[d.id]);
      return;
    }
    var best = bestDest(d.loc);
    if (best) doMove(d.loc, best);
    else {
      shake(cardEls[d.id]);
      FG.buzz(20);
    }
  }

  boardEl.addEventListener('pointerup', function (e) {
    endDrag(e, false);
  });
  boardEl.addEventListener('pointercancel', function (e) {
    endDrag(e, true);
  });
  boardEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  undoBtn.addEventListener('click', undo);
  autoBtn.addEventListener('click', autoComplete);
  document.getElementById('new').addEventListener('click', function () {
    var draw = S ? S.draw : 1;
    var body = document.createElement('div');
    body.appendChild(FG.label('แบบการจั่ว'));
    body.appendChild(
      FG.choice(
        [
          { value: 1, label: 'จั่วทีละ 1 (ง่าย)' },
          { value: 3, label: 'จั่วทีละ 3' }
        ],
        draw,
        function (v) {
          draw = v;
        }
      )
    );
    FG.sheet({
      title: 'แจกไพ่ใหม่?',
      text: S && S.started && !S.done ? 'ตาที่เล่นอยู่จะหายไป' : '',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'แจกใหม่',
          primary: true,
          onClick: function () {
            deal(draw);
          }
        }
      ]
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'u') undo();
    if (e.key === ' ' || e.key === 'd') {
      e.preventDefault();
      drawStock();
    }
  });

  /* ---------- timer ---------- */
  setInterval(function () {
    if (!S || !S.started || S.done || document.hidden) return;
    S.seconds++;
    timeEl.textContent = FG.fmtTime(S.seconds);
    if (S.seconds % 10 === 0) save();
  }, 1000);
  FG.onVisibility(function (hidden) {
    if (hidden && S) save();
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
  if (saved && saved.s && Array.isArray(saved.s.tab) && saved.s.tab.length === 7 && !saved.s.done) {
    S = saved.s;
    history = Array.isArray(saved.h) ? saved.h : [];
    layout();
    render();
  } else {
    layout();
    deal(FG.store.get('sol:draw', 1));
  }
})();
