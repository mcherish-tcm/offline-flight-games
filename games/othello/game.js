/* โอเทลโล — 2 คน หรือเล่นกับคอม · จุดเหลือง = ช่องที่ลงได้ · ไม่มีช่องลง = ข้ามตาให้เอง (บอกเป็นข้อความชัด ๆ) · นับเม็ดสด ๆ ในป้ายผู้เล่น */
(function () {
  'use strict';

  var O = window.Othello;
  var KEY = 'othello:state';
  var DISC =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="var(--color-paper)" stroke-opacity="0.35" stroke-width="2"/></svg>';
  var COLS = 'ABCDEFGH';

  var boardEl = document.getElementById('board');
  var hintEl = document.getElementById('hint');
  var duo = FGDuo.create({
    id: 'othello',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return DISC;
    },
    ai: true
  });

  // S = { g: สถานะจาก engine { board, turn, over, last, passed }, starter }
  var S;
  var cellEls = [];
  var endedAt = 0;
  var fresh1 = null; // { i, flips } ของตาที่เพิ่งเดิน → เล่นแอนิเมชันครั้งเดียว

  for (var i = 0; i < 64; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ot-cell';
    b.setAttribute('role', 'gridcell');
    b.addEventListener('click', onTap.bind(null, i));
    boardEl.appendChild(b);
    cellEls.push(b);
  }

  function fresh(starter) {
    return { g: O.newGame(starter), starter: starter };
  }

  function played() {
    return O.count(S.g.board, 0) + O.count(S.g.board, 1) > 4;
  }

  /* ---------- input ---------- */
  function onTap(i) {
    if (FG.isSheetOpen()) return;
    if (S.g.over) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (duo.isCPU(S.g.turn)) return; // รอคอมเดิน
    if (S.g.board[i] !== -1) return;
    if (!O.flipsFor(S.g.board, i, S.g.turn).length) {
      FG.toast('ลงช่องนี้ไม่ได้ — ต้องหนีบเม็ดอีกฝ่าย (ลงได้เฉพาะจุดสีเหลือง)', 2200);
      return;
    }
    place(i);
  }

  function place(i) {
    var next = O.play(S.g, i);
    if (!next) return;
    S.g = next;
    fresh1 = next.last;
    FG.buzz(10);
    if (next.passed != null && !next.over) {
      FG.toast(duo.name(next.passed) + 'ไม่มีช่องลง — ข้ามตา', 2600);
      FG.buzz(30);
    }
    if (next.over) {
      endedAt = Date.now();
      if (next.over.draw) duo.draw();
      else duo.win(next.over.w);
    }
    render();
    save();
    if (next.over) setTimeout(showResult, 900);
    else cpuTurn();
  }

  // ถึงตาคอม → คิดแล้วลง (ถ้าอีกฝ่ายต้องข้ามตา คอมจะเดินต่อเองอีกตา)
  function cpuTurn() {
    if (S.g.over || !duo.isCPU(S.g.turn)) return;
    duo.cpuMove(
      function () {
        return O.choose(S.g.board, S.g.turn, duo.level());
      },
      function (i) {
        if (!S.g.over && duo.isCPU(S.g.turn) && i >= 0) place(i);
      }
    );
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(1 - S.starter);
    fresh1 = null;
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(S.starter);
    fresh1 = null;
    render();
    save();
    cpuTurn();
  }

  function score() {
    return duo.name(0) + ' ' + O.count(S.g.board, 0) + ' : ' + duo.name(1) + ' ' + O.count(S.g.board, 1) + ' เม็ด';
  }

  function showResult() {
    if (!S.g.over) return;
    if (S.g.over.draw) duo.showResult({ title: 'เสมอ', text: 'เม็ดเท่ากัน — ' + score(), onNext: nextRound });
    else duo.showResult({ title: duo.name(S.g.over.w) + 'ชนะ!', text: 'นับเม็ด ' + score(), onNext: nextRound, faceTo: S.g.over.w });
  }

  /* ---------- render ---------- */
  function render() {
    var g = S.g;
    var over = !!g.over;
    var showLegal = !over && !duo.isCPU(g.turn);
    var legal = {};
    if (showLegal) O.legalMoves(g.board, g.turn).forEach(function (m) { legal[m.i] = true; });
    var flipped = {};
    if (fresh1) fresh1.flips.forEach(function (k) { flipped[k] = true; });
    var lastI = g.last ? g.last.i : -1;
    var lead = over && !g.over.draw ? g.over.w : -1;

    boardEl.classList.toggle('is-over', over);
    for (var i = 0; i < 64; i++) {
      var el = cellEls[i];
      var v = g.board[i];
      var disc = el.firstChild;
      if (v === -1) {
        if (disc) el.removeChild(disc);
      } else {
        if (!disc) {
          disc = document.createElement('span');
          disc.className = 'ot-disc';
          el.appendChild(disc);
        }
        disc.setAttribute('data-p', String(v));
        disc.classList.toggle('is-last', i === lastI);
        disc.classList.toggle('is-lead', v === lead);
        if (fresh1 && (i === fresh1.i || flipped[i])) {
          disc.classList.remove('is-new', 'is-flip');
          void disc.offsetWidth;
          disc.classList.add(i === fresh1.i ? 'is-new' : 'is-flip');
        }
      }
      el.classList.toggle('is-legal', !!legal[i]);
      el.setAttribute('aria-disabled', String(!over && !legal[i]));
      el.setAttribute(
        'aria-label',
        COLS[i & 7] + ((i >> 3) + 1) + ' ' + (v === -1 ? (legal[i] ? 'ลงได้' : 'ว่าง') : duo.name(v))
      );
    }
    fresh1 = null;

    duo.setLive(0, String(O.count(g.board, 0)));
    duo.setLive(1, String(O.count(g.board, 1)));
    duo.setResult(over ? (g.over.draw ? 'draw' : g.over.w) : null);
    duo.setTurn(over ? null : g.turn);

    var hint;
    var pass = false;
    if (over) hint = 'จบเกม — แตะกระดานเพื่อเล่นตาต่อไป';
    else if (g.passed != null) {
      hint = duo.name(g.passed) + 'ไม่มีช่องลง ข้ามตา — ' + duo.name(g.turn) + 'เดินต่อ';
      pass = true;
    } else if (duo.isCPU(g.turn)) hint = 'คอมกำลังคิด…';
    else hint = 'ตาของ' + duo.name(g.turn) + ' — แตะจุดสีเหลืองเพื่อลง';
    hintEl.textContent = hint;
    hintEl.classList.toggle('is-pass', pass);
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.g.over && played());
  }

  document.getElementById('restart').addEventListener('click', function () {
    if (S.g.over) {
      nextRound();
      return;
    }
    if (!played()) return;
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'กระดานตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  // ⚙️ (ปุ่มเฟืองบนแถบหัว — app.js ผูกปุ่มให้แล้ว)
  FG.openSettings = function () {
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !S.g.over && played();
      },
      onModeChange: function () {
        S = fresh(0);
        fresh1 = null;
        render();
        save();
        cpuTurn();
      }
    });
  };

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.g && Array.isArray(saved.g.board) && saved.g.board.length === 64 && (saved.g.turn === 0 || saved.g.turn === 1)) {
    S = saved;
    S.g = O.settle(S.g);
  } else {
    S = fresh(0);
  }
  render();
  save();
  cpuTurn();
})();
