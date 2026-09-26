/* จับคู่ไพ่ความจำ — คนเดียว (นับครั้ง + เวลา) หรือ 2 คนผลัดกัน (ได้คู่ = เล่นต่อ) · 3 ขนาด · ภาพวาดด้วย SVG · เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var M = window.Memory;
  var KEY = 'mem:state';
  var HIDE_MS = 900;

  // 20 ภาพ (viewBox 24) · สี = --color-g* ตามเลข
  var F = ' fill="currentColor"';
  var ST = ' fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"';
  var SYM = [
    '<path' + F + ' d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
    '<path' + F + ' d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    '<path' + F + ' d="M12 21s-8.5-5.3-8.5-11.4C3.5 6.5 5.8 4.3 8.6 4.3c1.5 0 2.7.7 3.4 1.8.7-1.1 1.9-1.8 3.4-1.8 2.8 0 5.1 2.2 5.1 5.3C20.5 15.7 12 21 12 21z"/>',
    '<path' + F + ' d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    '<circle' + F + ' cx="12" cy="12" r="4.6"/><path' + ST + ' d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    '<path' + F + ' d="M7 19a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.3A4 4 0 0 1 17.5 19z"/>',
    '<path' + F + ' d="M2.5 12c3.2-5 9.2-6.2 13.2-2.8L20.5 6v12l-4.8-3.2C11.7 18.2 5.7 17 2.5 12z"/>',
    '<path' + F + ' d="M12 2.5c3.5 4.6 6 8 6 11.2a6 6 0 0 1-12 0C6 10.5 8.5 7.1 12 2.5z"/>',
    '<path' + F + ' d="M20 3.5c-9 0-15.5 4-15.5 11 0 1.7.4 3.2 1.1 4.4 1-4.2 4.1-7.7 8.2-9.4-3.6 2.4-6.1 5.5-7.1 9.9C15.3 20.6 20 14.2 20 3.5z"/>',
    '<path' + F + ' d="M13.5 2L4 14h6.2L9 22l10-12.5h-6.3z"/>',
    '<path' + F + ' d="M12 2l7.5 10L12 22 4.5 12z"/>',
    '<g' + F + '><circle cx="12" cy="6.8" r="3.8"/><circle cx="17.2" cy="12" r="3.8"/><circle cx="12" cy="17.2" r="3.8"/><circle cx="6.8" cy="12" r="3.8"/></g><circle cx="12" cy="12" r="2.4" fill="var(--color-card-face)"/>',
    '<path' + F + ' d="M12 2.8l9.2 8.2h-2.7v9.5h-5v-6.2h-3v6.2h-5V11H2.8z"/>',
    '<path' + F + ' d="M12 3a9 9 0 0 1 9 9H3a9 9 0 0 1 9-9z"/><path' + ST + ' d="M12 12v6.3a2.2 2.2 0 0 1-4.4 0"/>',
    '<circle' + F + ' cx="7.5" cy="12" r="5"/><circle cx="7.5" cy="12" r="2" fill="var(--color-card-face)"/><path' + F + ' d="M11.5 10.5h10v3h-2.2v3h-3.1v-3h-4.7z"/>',
    '<path' + F + ' d="M12 2.8a6.2 6.2 0 0 1 6.2 6.2v4.3l2.3 3.4H3.5l2.3-3.4V9A6.2 6.2 0 0 1 12 2.8z"/><circle' + F + ' cx="12" cy="19.4" r="2.2"/>',
    '<circle' + F + ' cx="7" cy="18.3" r="3.2"/><circle' + F + ' cx="17.8" cy="16" r="3.2"/><path' + F + ' d="M8.6 18.3V6.4L21 3.8V16h-2.3V7.1l-7.8 1.7v9.5z"/>',
    '<circle' + ST + ' cx="12" cy="5" r="2.2"/><path' + ST + ' d="M12 7.2V21M7.5 11h9M4.5 14.5a7.5 7.5 0 0 0 15 0"/>',
    '<path' + F + ' d="M11 2.5v13.3H4zM13 5.8l6.5 10H13zM2.5 17.8h19l-2.6 3.7H5.1z"/>',
    '<path' + F + ' d="M3.5 7h13.8v6.3a6 6 0 0 1-6 6H9.5a6 6 0 0 1-6-6z"/><path' + ST + ' d="M17.3 9h1.6a2.6 2.6 0 0 1 0 5.2h-1.6"/>'
  ];

  var boardEl = document.getElementById('board');
  var soloEl = document.getElementById('solo');
  var movesEl = document.getElementById('moves');
  var timeEl = document.getElementById('time');
  var bestEl = document.getElementById('best');
  var settingsBtn = document.getElementById('settings');

  var duo = FGDuo.create({
    id: 'memory',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="13" height="17" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="8" y="6" width="13" height="16" rx="2.5" fill="currentColor"/></svg>';
    }
  });

  // G = { s: state จาก engine, seconds, started, by: [ใครได้ใบนี้ (โหมด 2 คน)] }
  var G;
  var cardEls = [];
  var hideTimer = 0;
  var endedAt = 0;

  function symHtml(v) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + SYM[v] + '</svg>';
  }

  function newGame(size, isDuo) {
    FG.closeSheet();
    clearTimeout(hideTimer);
    var starter = G && G.s.duo && isDuo ? 1 - G.s.starter : 0;
    G = { s: M.deal(size, isDuo, starter), seconds: 0, started: false, by: [] };
    FG.store.set('mem:pref', { size: size, duo: isDuo });
    build();
    render();
    save();
  }

  function build() {
    var z = M.SIZES[G.s.size];
    boardEl.style.setProperty('--cols', z.cols);
    boardEl.style.setProperty('--rows', z.rows);
    boardEl.innerHTML = '';
    cardEls = [];
    G.s.deck.forEach(function (v, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mm-card';
      b.innerHTML = '<span class="mm-inner"><span class="mm-back"></span><span class="mm-face" data-c="' + (v % 12) + '">' + symHtml(v) + '</span></span>';
      b.addEventListener('click', onTap.bind(null, i));
      boardEl.appendChild(b);
      cardEls.push(b);
    });
    var isDuo = G.s.duo;
    duo.sides[0].hidden = !isDuo;
    duo.sides[1].hidden = !isDuo;
    soloEl.hidden = isDuo;
    settingsBtn.hidden = !isDuo;
  }

  function render() {
    var S = G.s;
    cardEls.forEach(function (el, i) {
      var open = S.open.indexOf(i) !== -1;
      el.classList.toggle('is-open', open);
      el.classList.toggle('is-done', S.matched[i]);
      el.classList.toggle('is-miss', S.pending && open);
      if (G.by[i] != null) el.setAttribute('data-by', G.by[i]);
      else el.removeAttribute('data-by');
      el.setAttribute('aria-label', 'ไพ่ใบที่ ' + (i + 1) + (S.matched[i] ? ' จับคู่แล้ว' : open ? ' เปิดอยู่' : ' คว่ำ'));
    });
    if (S.duo) {
      duo.setLive(0, S.pairs[0]);
      duo.setLive(1, S.pairs[1]);
      var w = M.winner(S);
      duo.setResult(w);
      duo.setTurn(S.over ? null : S.turn);
    } else {
      movesEl.textContent = S.moves;
      timeEl.textContent = FG.fmtTime(G.seconds);
      var b = FG.store.get('mem:best:' + S.size, null);
      bestEl.textContent = b ? 'ดีสุด ' + b.moves + ' ครั้ง' : M.SIZES[S.size].label;
    }
  }

  function save() {
    FG.store.set(KEY, G);
    if (G.s.duo) duo.note(!G.s.over && G.s.moves > 0);
    else {
      var b = FG.store.get('mem:best:s', null);
      FG.hubNote('memory', { note: b ? '4×4 ดีสุด ' + b.moves + ' ครั้ง' : '', resume: !G.s.over && G.s.moves > 0 });
    }
  }

  function onTap(i) {
    if (FG.isSheetOpen()) return;
    var S = G.s;
    if (S.over) {
      if (Date.now() - endedAt > 900) newGame(S.size, S.duo);
      return;
    }
    if (S.pending) {
      // แตะระหว่างรอ = ปิดคู่เดิมทันที
      closePending();
      return;
    }
    var r = M.reveal(S, i);
    if (r.event === 'invalid') return;
    G.s = r.state;
    G.started = true;
    FG.buzz(6);
    if (r.event === 'match') {
      G.s.deck.forEach(function (v, k) {
        if (G.s.matched[k] && G.by[k] == null) G.by[k] = G.s.duo ? S.turn : 's';
      });
      FG.buzz(25);
      if (G.s.duo && !G.s.over) FG.toast(duo.name(S.turn) + ' ได้คู่ — เปิดต่อได้เลย', 1300);
    }
    render();
    save();
    if (r.event === 'miss') hideTimer = setTimeout(closePending, HIDE_MS);
    if (G.s.over) finish();
  }

  function closePending() {
    clearTimeout(hideTimer);
    if (!G.s.pending) return;
    G.s = M.hide(G.s);
    render();
    save();
  }

  function finish() {
    var S = G.s;
    endedAt = Date.now();
    if (S.duo) {
      var w = M.winner(S);
      if (w === 'draw') duo.draw();
      else duo.win(w);
      render();
      save();
      setTimeout(function () {
        var text = 'แดง ' + S.pairs[0] + ' คู่ · ฟ้า ' + S.pairs[1] + ' คู่';
        if (w === 'draw') duo.showResult({ title: 'เสมอ', text: text, onNext: next });
        else duo.showResult({ title: duo.name(w) + ' ชนะ!', text: text, onNext: next, faceTo: w });
      }, 700);
      return;
    }
    var key = 'mem:best:' + S.size;
    var best = FG.store.get(key, null);
    var isBest = !best || S.moves < best.moves || (S.moves === best.moves && G.seconds < best.time);
    if (isBest) FG.store.set(key, { moves: S.moves, time: G.seconds });
    save();
    render();
    setTimeout(function () {
      FG.sheet({
        title: 'เปิดครบทุกคู่แล้ว!',
        text: M.SIZES[S.size].label + ' · เปิด ' + S.moves + ' ครั้ง · ' + FG.fmtTime(G.seconds) + (isBest ? ' — ดีที่สุดของเรา' : ' · ดีสุด ' + best.moves + ' ครั้ง'),
        actions: [{ label: 'ดูกระดาน' }, { label: 'เล่นอีกครั้ง', primary: true, onClick: next }]
      });
    }, 700);
  }

  function next() {
    newGame(G.s.size, G.s.duo);
  }

  document.getElementById('restart').addEventListener('click', function () {
    var size = G.s.size;
    var isDuo = G.s.duo;
    var body = document.createElement('div');
    body.appendChild(FG.label('โหมด'));
    body.appendChild(
      FG.choice(
        [
          { value: false, label: 'คนเดียว' },
          { value: true, label: '2 คนผลัดกัน' }
        ],
        isDuo,
        function (v) {
          isDuo = v;
        }
      )
    );
    body.appendChild(FG.label('ขนาด'));
    body.appendChild(
      FG.choice(
        [
          { value: 's', label: '4×4' },
          { value: 'm', label: '4×6' },
          { value: 'l', label: '6×6' }
        ],
        size,
        function (v) {
          size = v;
        }
      )
    );
    FG.sheet({
      title: 'เกมใหม่',
      text: G.started && !G.s.over ? 'ตาที่เล่นอยู่จะหายไป' : '4×4 = 8 คู่ · 4×6 = 12 คู่ · 6×6 = 18 คู่',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'เริ่ม',
          primary: true,
          onClick: function () {
            newGame(size, isDuo);
          }
        }
      ]
    });
  });

  settingsBtn.addEventListener('click', function () {
    duo.openSettings({ onReset: save });
  });

  /* ---------- timer (คนเดียว) ---------- */
  setInterval(function () {
    if (!G || G.s.duo || !G.started || G.s.over || document.hidden) return;
    G.seconds++;
    timeEl.textContent = FG.fmtTime(G.seconds);
    if (G.seconds % 10 === 0) save();
  }, 1000);
  FG.onVisibility(function (hidden) {
    if (hidden && G) save();
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.s && Array.isArray(saved.s.deck) && M.SIZES[saved.s.size]) {
    G = saved;
    if (!Array.isArray(G.by)) G.by = [];
    if (G.s.pending) G.s = M.hide(G.s);
    build();
    render();
  } else {
    var pref = FG.store.get('mem:pref', { size: 's', duo: false });
    newGame(M.SIZES[pref.size] ? pref.size : 's', !!pref.duo);
  }
})();
