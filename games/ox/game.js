/* โอเอ็กซ์ — 2 คนเครื่องเดียว หรือเล่นกับคอม (ai.js), สลับกันเริ่มทุกตา, ไฮไลต์แถวที่ชนะ, สกอร์สะสม, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var KEY = 'ox:state';
  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];
  var MARK = [
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>',
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/></svg>'
  ];
  var SYMBOL = ['X', 'O'];

  var boardEl = document.getElementById('board');
  var duo = FGDuo.create({
    id: 'ox',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function (p) {
      return MARK[p];
    },
    ai: true
  });

  // S = { cells:[-1|0|1 ×9], turn, starter, over: null | { w:0|1, line:[..] } | { draw:true } }
  var S;
  var cellEls = [];
  var endedAt = 0;

  for (var i = 0; i < 9; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'ox-cell';
    b.setAttribute('role', 'gridcell');
    b.addEventListener('click', onTap.bind(null, i));
    boardEl.appendChild(b);
    cellEls.push(b);
  }

  function fresh(starter) {
    return { cells: [-1, -1, -1, -1, -1, -1, -1, -1, -1], turn: starter, starter: starter, over: null };
  }

  function moves() {
    return S.cells.filter(function (c) {
      return c !== -1;
    }).length;
  }

  function winLine(p) {
    for (var k = 0; k < LINES.length; k++) {
      var l = LINES[k];
      if (S.cells[l[0]] === p && S.cells[l[1]] === p && S.cells[l[2]] === p) return l;
    }
    return null;
  }

  function onTap(i) {
    if (FG.isSheetOpen()) return;
    if (S.over) {
      // แตะกระดานหลังจบตา = เริ่มตาใหม่ (กันแตะรัวตอนเพิ่งจบ)
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (duo.isCPU(S.turn)) return; // รอคอมเดิน
    if (S.cells[i] !== -1) return;
    place(i);
  }

  function place(i) {
    var p = S.turn;
    S.cells[i] = p;
    FG.buzz(8);
    var line = winLine(p);
    if (line) {
      S.over = { w: p, line: line };
      duo.win(p);
    } else if (moves() === 9) {
      S.over = { draw: true };
      duo.draw();
    } else {
      S.turn = 1 - p;
    }
    render();
    save();
    if (S.over) {
      endedAt = Date.now();
      setTimeout(showResult, 650);
    } else {
      cpuTurn();
    }
  }

  // ถึงตาคอม → ให้คอมคิดแล้วเดิน
  function cpuTurn() {
    if (S.over || !duo.isCPU(S.turn)) return;
    duo.cpuMove(
      function () {
        return OXAI.choose(S.cells, S.turn, duo.level());
      },
      function (i) {
        if (!S.over && duo.isCPU(S.turn) && i >= 0 && S.cells[i] === -1) place(i);
      }
    );
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(1 - S.starter);
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(S.starter);
    render();
    save();
    cpuTurn();
  }

  function showResult() {
    if (!S.over) return;
    if (S.over.draw) {
      duo.showResult({ title: 'เสมอ', text: 'ไม่มีใครเรียงครบ 3', onNext: nextRound });
    } else {
      var w = S.over.w;
      duo.showResult({ title: duo.name(w) + ' (' + SYMBOL[w] + ') ชนะ!', onNext: nextRound, faceTo: w });
    }
  }

  function render() {
    var winSet = S.over && S.over.line ? S.over.line : [];
    boardEl.classList.toggle('is-over', !!S.over);
    for (var i = 0; i < 9; i++) {
      var el = cellEls[i];
      var v = S.cells[i];
      var want = v === -1 ? '' : String(v);
      if (el.getAttribute('data-p') !== want || (v === -1 && el.firstChild)) {
        el.innerHTML = v === -1 ? '' : MARK[v];
        if (v === -1) el.removeAttribute('data-p');
        else el.setAttribute('data-p', want);
      }
      el.classList.toggle('is-win', winSet.indexOf(i) !== -1);
      el.setAttribute('aria-disabled', String(v !== -1 && !S.over));
      var r = Math.floor(i / 3) + 1;
      var c = (i % 3) + 1;
      el.setAttribute('aria-label', 'แถว ' + r + ' ช่อง ' + c + (v === -1 ? ' ว่าง' : ' ' + SYMBOL[v]));
    }
    duo.setResult(S.over ? (S.over.draw ? 'draw' : S.over.w) : null);
    duo.setTurn(S.over ? null : S.turn);
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.over && moves() > 0);
  }

  document.getElementById('restart').addEventListener('click', function () {
    if (S.over) {
      nextRound();
      return;
    }
    if (moves() === 0) return;
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
        return !S.over && moves() > 0;
      },
      onModeChange: function () {
        S = fresh(0);
        render();
        save();
        cpuTurn();
      }
    });
  };

  document.addEventListener('keydown', function (e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) onTap(n - 1);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.cells) && saved.cells.length === 9) {
    S = saved;
  } else {
    S = fresh(0);
  }
  render();
  save();
  cpuTurn();
})();
