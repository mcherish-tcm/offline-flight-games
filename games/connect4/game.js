/* หยอดเหรียญเรียง 4 — 2 คน หรือเล่นกับคอม (ai.js), แตะแถวตั้งเพื่อหยอด, เหรียญตกสั้น ๆ, ไฮไลต์ 4 เหรียญที่ชนะ, เต็มกระดาน = เสมอ */
(function () {
  'use strict';

  var KEY = 'c4:state';
  var COLS = 7;
  var ROWS = 6;
  var DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];
  var DISC =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="var(--color-paper)" stroke-opacity="0.35" stroke-width="2"/></svg>';

  var boardEl = document.getElementById('board');
  var duo = FGDuo.create({
    id: 'connect4',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return DISC;
    },
    ai: true
  });

  // S = { g:[-1|0|1 × 42] (แถว 0 = บนสุด), turn, starter, last, over: null | { w, cells } | { draw:true } }
  var S;
  var colEls = [];
  var slotEls = [];
  var busyUntil = 0;
  var endedAt = 0;

  for (var c = 0; c < COLS; c++) {
    var col = document.createElement('button');
    col.type = 'button';
    col.className = 'c4-col';
    for (var r = 0; r < ROWS; r++) {
      var slot = document.createElement('span');
      slot.className = 'c4-slot';
      col.appendChild(slot);
      slotEls[r * COLS + c] = slot;
    }
    col.addEventListener('click', drop.bind(null, c));
    boardEl.appendChild(col);
    colEls.push(col);
  }

  function fresh(starter) {
    var g = [];
    for (var i = 0; i < COLS * ROWS; i++) g.push(-1);
    return { g: g, turn: starter, starter: starter, last: -1, over: null };
  }

  function count() {
    return S.g.filter(function (v) {
      return v !== -1;
    }).length;
  }

  function lineAt(idx, p) {
    var r0 = Math.floor(idx / COLS);
    var c0 = idx % COLS;
    for (var d = 0; d < DIRS.length; d++) {
      var cells = [idx];
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var r = r0 + DIRS[d][0] * sgn;
        var c = c0 + DIRS[d][1] * sgn;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && S.g[r * COLS + c] === p) {
          cells.push(r * COLS + c);
          r += DIRS[d][0] * sgn;
          c += DIRS[d][1] * sgn;
        }
      }
      if (cells.length >= 4) return cells;
    }
    return null;
  }

  function drop(c) {
    if (FG.isSheetOpen()) return;
    if (S.over) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (Date.now() < busyUntil) return;
    if (duo.isCPU(S.turn)) return; // รอคอมเดิน
    dropAt(c);
  }

  function dropAt(c) {
    var row = -1;
    for (var r = ROWS - 1; r >= 0; r--) {
      if (S.g[r * COLS + c] === -1) {
        row = r;
        break;
      }
    }
    if (row === -1) {
      FG.toast('แถวนี้เต็มแล้ว');
      return;
    }
    var p = S.turn;
    var idx = row * COLS + c;
    S.g[idx] = p;
    S.last = idx;
    busyUntil = Date.now() + 260;
    FG.buzz(8);
    var cells = lineAt(idx, p);
    if (cells) {
      S.over = { w: p, cells: cells };
      duo.win(p);
    } else if (count() === COLS * ROWS) {
      S.over = { draw: true };
      duo.draw();
    } else {
      S.turn = 1 - p;
    }
    render(idx);
    save();
    if (S.over) {
      endedAt = Date.now();
      setTimeout(showResult, 800);
    } else {
      cpuTurn();
    }
  }

  // ถึงตาคอม → ให้คอมคิดแล้วหยอด
  function cpuTurn() {
    if (S.over || !duo.isCPU(S.turn)) return;
    duo.cpuMove(
      function () {
        return C4AI.choose(S.g, S.turn, duo.level());
      },
      function (c) {
        if (!S.over && duo.isCPU(S.turn) && c >= 0 && S.g[c] === -1) dropAt(c);
      }
    );
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    S = fresh(1 - S.starter);
    render(-1);
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    S = fresh(S.starter);
    render(-1);
    save();
    cpuTurn();
  }

  function showResult() {
    if (!S.over) return;
    if (S.over.draw) duo.showResult({ title: 'เสมอ', text: 'กระดานเต็มแล้ว ไม่มีใครเรียงครบ 4', onNext: nextRound });
    else duo.showResult({ title: duo.name(S.over.w) + 'ชนะ!', text: 'เรียงครบ 4 เหรียญ', onNext: nextRound, faceTo: S.over.w });
  }

  function render(dropped) {
    var winCells = S.over && S.over.cells ? S.over.cells : [];
    boardEl.classList.toggle('is-over', !!S.over);
    for (var i = 0; i < COLS * ROWS; i++) {
      var slot = slotEls[i];
      var v = S.g[i];
      var disc = slot.firstChild;
      if (v === -1) {
        if (disc) slot.removeChild(disc);
        continue;
      }
      if (!disc) {
        disc = document.createElement('span');
        disc.className = 'c4-disc';
        slot.appendChild(disc);
      }
      disc.setAttribute('data-p', String(v));
      disc.classList.toggle('is-win', winCells.indexOf(i) !== -1);
      disc.classList.toggle('is-last', i === S.last);
      if (i === dropped) {
        disc.style.setProperty('--from', String(Math.floor(i / COLS) + 1));
        disc.classList.remove('is-drop');
        void disc.offsetWidth;
        disc.classList.add('is-drop');
      }
    }
    for (var c = 0; c < COLS; c++) {
      var full = S.g[c] !== -1;
      colEls[c].disabled = full && !S.over;
      var left = 0;
      for (var r = 0; r < ROWS; r++) if (S.g[r * COLS + c] === -1) left++;
      colEls[c].setAttribute('aria-label', 'แถวตั้งที่ ' + (c + 1) + (full ? ' เต็มแล้ว' : ' ว่าง ' + left + ' ช่อง'));
    }
    duo.setResult(S.over ? (S.over.draw ? 'draw' : S.over.w) : null);
    duo.setTurn(S.over ? null : S.turn);
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.over && count() > 0);
  }

  document.getElementById('restart').addEventListener('click', function () {
    if (S.over) {
      nextRound();
      return;
    }
    if (count() === 0) return;
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'กระดานตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  document.getElementById('settings').addEventListener('click', function () {
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !S.over && count() > 0;
      },
      onModeChange: function () {
        S = fresh(0);
        render(-1);
        save();
        cpuTurn();
      }
    });
  });

  document.addEventListener('keydown', function (e) {
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLS) drop(n - 1);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  S = saved && Array.isArray(saved.g) && saved.g.length === COLS * ROWS ? saved : fresh(0);
  render(-1);
  save();
  cpuTurn();
})();
