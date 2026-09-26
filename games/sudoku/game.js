/* ซูโดกุ — สร้างโจทย์คำตอบเดียว 3 ระดับ, โน้ต, ไฮไลต์เลขเดียวกัน, เช็คผิด, จับเวลา, เล่นต่อ */
(function () {
  'use strict';

  var KEY = 'sudoku:state';
  var BEST = 'sudoku:best';
  var LEVELS = {
    easy: { label: 'ง่าย', clues: 40 },
    medium: { label: 'กลาง', clues: 32 },
    hard: { label: 'ยาก', clues: 26 }
  };

  /* ---------- solver / generator (bitmask + fewest-candidates first) ---------- */
  var ROW = [];
  var COL = [];
  var BOX = [];
  var PEERS = [];
  for (var i = 0; i < 81; i++) {
    ROW[i] = Math.floor(i / 9);
    COL[i] = i % 9;
    BOX[i] = Math.floor(ROW[i] / 3) * 3 + Math.floor(COL[i] / 3);
  }
  for (i = 0; i < 81; i++) {
    PEERS[i] = [];
    for (var j = 0; j < 81; j++) if (j !== i && (ROW[j] === ROW[i] || COL[j] === COL[i] || BOX[j] === BOX[i])) PEERS[i].push(j);
  }

  function bitCount(m) {
    var c = 0;
    while (m) {
      m &= m - 1;
      c++;
    }
    return c;
  }

  function shuffle(a) {
    for (var k = a.length - 1; k > 0; k--) {
      var r = Math.floor(Math.random() * (k + 1));
      var t = a[k];
      a[k] = a[r];
      a[r] = t;
    }
    return a;
  }

  // นับจำนวนคำตอบ (หยุดที่ limit) · ถ้า randomFill = true จะเติมตารางให้เต็มแบบสุ่ม
  function solve(cells, limit, randomFill) {
    var rows = new Array(9).fill(0);
    var cols = new Array(9).fill(0);
    var boxes = new Array(9).fill(0);
    for (var n = 0; n < 81; n++) {
      var v = cells[n];
      if (v) {
        var bit = 1 << (v - 1);
        if (rows[ROW[n]] & bit || cols[COL[n]] & bit || boxes[BOX[n]] & bit) return 0;
        rows[ROW[n]] |= bit;
        cols[COL[n]] |= bit;
        boxes[BOX[n]] |= bit;
      }
    }
    var count = 0;
    function rec() {
      var best = -1;
      var bestMask = 0;
      var bestN = 10;
      for (var p = 0; p < 81; p++) {
        if (cells[p]) continue;
        var m = ~(rows[ROW[p]] | cols[COL[p]] | boxes[BOX[p]]) & 0x1ff;
        var c = bitCount(m);
        if (c < bestN) {
          best = p;
          bestMask = m;
          bestN = c;
          if (c <= 1) break;
        }
      }
      if (best === -1) {
        count++;
        return count >= limit;
      }
      if (bestN === 0) return false;
      var digits = [];
      for (var d = 1; d <= 9; d++) if (bestMask & (1 << (d - 1))) digits.push(d);
      if (randomFill) shuffle(digits);
      for (var k = 0; k < digits.length; k++) {
        var dd = digits[k];
        var b = 1 << (dd - 1);
        cells[best] = dd;
        rows[ROW[best]] |= b;
        cols[COL[best]] |= b;
        boxes[BOX[best]] |= b;
        if (rec()) return true;
        rows[ROW[best]] &= ~b;
        cols[COL[best]] &= ~b;
        boxes[BOX[best]] &= ~b;
        cells[best] = 0;
      }
      return false;
    }
    rec();
    return count;
  }

  function generate(level) {
    var target = LEVELS[level].clues;
    var solution = new Array(81).fill(0);
    solve(solution, 1, true);
    var puzzle = solution.slice();
    var givens = 81;
    var order = shuffle(Array.from({ length: 81 }, function (_, k) { return k; }));
    for (var k = 0; k < order.length && givens > target; k++) {
      var p = order[k];
      var keep = puzzle[p];
      puzzle[p] = 0;
      if (solve(puzzle.slice(), 2, false) !== 1) puzzle[p] = keep;
      else givens--;
    }
    return { puzzle: puzzle, solution: solution };
  }

  /* ---------- state ---------- */
  var S = null; // {level, puzzle[], solution[], values[], notes[], seconds, done}
  var sel = -1;
  var notesMode = false;
  var checkOn = FG.store.get('sudoku:check', true);
  var history = [];

  var boardEl = document.getElementById('board');
  var padEl = document.getElementById('pad');
  var timeEl = document.getElementById('time');
  var levelEl = document.getElementById('level');
  var undoBtn = document.getElementById('undo');
  var notesBtn = document.getElementById('notes');
  var checkBtn = document.getElementById('check');
  var cellEls = [];

  // build board: 9 boxes × 9 cells, cell index = row*9+col
  for (var b = 0; b < 9; b++) {
    var box = document.createElement('div');
    box.className = 'sd-box';
    for (var k = 0; k < 9; k++) {
      var r = Math.floor(b / 3) * 3 + Math.floor(k / 3);
      var c = (b % 3) * 3 + (k % 3);
      var idx = r * 9 + c;
      var cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sd-cell';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.i = idx;
      box.appendChild(cell);
      cellEls[idx] = cell;
    }
    boardEl.appendChild(box);
  }

  var keyEls = [];
  for (var d = 1; d <= 9; d++) {
    var key = document.createElement('button');
    key.type = 'button';
    key.className = 'sd-key';
    key.dataset.d = d;
    key.innerHTML = d + '<small></small>';
    key.setAttribute('aria-label', 'ใส่เลข ' + d);
    padEl.appendChild(key);
    keyEls[d] = key;
  }

  function start(level) {
    FG.closeSheet();
    var g = generate(level);
    S = {
      level: level,
      puzzle: g.puzzle,
      solution: g.solution,
      values: g.puzzle.slice(),
      notes: new Array(81).fill(0),
      seconds: 0,
      done: false
    };
    history = [];
    sel = -1;
    save();
    render();
  }

  function snapshot() {
    history.push({ v: S.values.slice(), n: S.notes.slice() });
    if (history.length > 100) history.shift();
  }

  function setValue(i, d) {
    if (S.done || S.puzzle[i]) return;
    snapshot();
    if (S.values[i] === d) {
      S.values[i] = 0;
    } else {
      S.values[i] = d;
      S.notes[i] = 0;
      var bit = 1 << (d - 1);
      PEERS[i].forEach(function (p) {
        S.notes[p] &= ~bit;
      });
      if (checkOn && d !== S.solution[i]) FG.buzz(30);
    }
    afterChange();
  }

  function toggleNote(i, d) {
    if (S.done || S.puzzle[i] || S.values[i]) return;
    snapshot();
    S.notes[i] ^= 1 << (d - 1);
    afterChange();
  }

  function erase() {
    if (sel < 0 || S.done || S.puzzle[sel]) return;
    if (!S.values[sel] && !S.notes[sel]) return;
    snapshot();
    S.values[sel] = 0;
    S.notes[sel] = 0;
    afterChange();
  }

  function undo() {
    if (!history.length || S.done) return;
    var h = history.pop();
    S.values = h.v;
    S.notes = h.n;
    afterChange();
  }

  function afterChange() {
    var solved = S.values.every(function (v, i) {
      return v === S.solution[i];
    });
    if (solved) {
      S.done = true;
      var bests = FG.store.get(BEST, {});
      var isBest = bests[S.level] == null || S.seconds < bests[S.level];
      if (isBest) {
        bests[S.level] = S.seconds;
        FG.store.set(BEST, bests);
      }
      setTimeout(function () {
        FG.sheet({
          title: 'ไขสำเร็จ!',
          text: 'ระดับ' + LEVELS[S.level].label + ' ใช้เวลา ' + FG.fmtTime(S.seconds) + (isBest ? ' — เร็วที่สุดของระดับนี้' : ''),
          actions: [{ label: 'ดูตาราง' }, { label: 'เกมใหม่', primary: true, onClick: askNew }]
        });
      }, 250);
    }
    save();
    render();
  }

  function save() {
    FG.store.set(KEY, S);
    var bests = FG.store.get(BEST, {});
    var parts = [];
    ['easy', 'medium', 'hard'].forEach(function (l) {
      if (bests[l]) parts.push(LEVELS[l].label + ' ' + FG.fmtTime(bests[l]));
    });
    FG.hubNote('sudoku', { note: parts.length ? 'เร็วสุด ' + parts[0] : '', resume: !!S && !S.done });
  }

  /* ---------- render ---------- */
  function render() {
    if (!S) return;
    levelEl.textContent = 'ระดับ' + LEVELS[S.level].label;
    timeEl.textContent = FG.fmtTime(S.seconds);
    var selVal = sel >= 0 ? S.values[sel] : 0;
    var counts = new Array(10).fill(0);
    for (var i = 0; i < 81; i++) {
      var v = S.values[i];
      if (v) counts[v]++;
      var el = cellEls[i];
      var cls = 'sd-cell';
      if (S.puzzle[i]) cls += ' is-given';
      if (sel >= 0 && i !== sel && (ROW[i] === ROW[sel] || COL[i] === COL[sel] || BOX[i] === BOX[sel])) cls += ' is-peer';
      if (selVal && v === selVal && i !== sel) cls += ' is-same';
      if (i === sel) cls += ' is-sel';
      if (checkOn && v && !S.puzzle[i] && v !== S.solution[i]) cls += ' is-wrong';
      el.className = cls;
      if (v) {
        el.textContent = v;
        el.setAttribute('aria-label', 'แถว ' + (ROW[i] + 1) + ' คอลัมน์ ' + (COL[i] + 1) + ' เลข ' + v);
      } else if (S.notes[i]) {
        var h = '<span class="sd-notes" aria-hidden="true">';
        for (var d = 1; d <= 9; d++) {
          var on = S.notes[i] & (1 << (d - 1));
          h += '<span' + (on && d === selVal ? ' class="is-hit"' : '') + '>' + (on ? d : '') + '</span>';
        }
        el.innerHTML = h + '</span>';
        el.setAttribute('aria-label', 'แถว ' + (ROW[i] + 1) + ' คอลัมน์ ' + (COL[i] + 1) + ' ว่าง มีโน้ต');
      } else {
        el.textContent = '';
        el.setAttribute('aria-label', 'แถว ' + (ROW[i] + 1) + ' คอลัมน์ ' + (COL[i] + 1) + ' ว่าง');
      }
    }
    for (var k = 1; k <= 9; k++) {
      var left = 9 - counts[k];
      keyEls[k].classList.toggle('is-done', left <= 0);
      keyEls[k].querySelector('small').textContent = left > 0 ? left : '';
    }
    undoBtn.disabled = !history.length || S.done;
    notesBtn.setAttribute('aria-pressed', String(notesMode));
    checkBtn.setAttribute('aria-pressed', String(checkOn));
    document.body.classList.toggle('is-notes', notesMode);
  }

  /* ---------- timer (หยุดเมื่อสลับแอป / จบเกม) ---------- */
  var timer = 0;
  function tick() {
    if (!S || S.done || document.hidden) return;
    S.seconds++;
    timeEl.textContent = FG.fmtTime(S.seconds);
    if (S.seconds % 5 === 0) FG.store.set(KEY, S);
  }
  function runTimer() {
    clearInterval(timer);
    timer = setInterval(tick, 1000);
  }
  FG.onVisibility(function (hidden) {
    if (hidden) {
      clearInterval(timer);
      if (S) FG.store.set(KEY, S);
    } else runTimer();
  });
  window.addEventListener('pagehide', function () {
    if (S) FG.store.set(KEY, S);
  });

  /* ---------- new game sheet ---------- */
  function askNew() {
    var bests = FG.store.get(BEST, {});
    var list = document.createElement('div');
    list.className = 'sd-diffs';
    ['easy', 'medium', 'hard'].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.innerHTML = '<span>' + LEVELS[l].label + '</span><span>' + (bests[l] ? 'เร็วสุด ' + FG.fmtTime(bests[l]) : 'ยังไม่มีสถิติ') + '</span>';
      b.addEventListener('click', function () {
        start(l);
      });
      list.appendChild(b);
    });
    var hasGame = S && !S.done;
    var dlg = FG.sheet({
      title: 'เกมใหม่ — เลือกระดับ',
      text: hasGame ? 'เกมที่เล่นอยู่จะหายไป' : '',
      body: list,
      dismissible: !!S,
      actions: S ? [{ label: 'ยกเลิก' }] : []
    });
    // ยังไม่มีเกม แต่หน้าต่างถูกปิดไปโดยไม่ได้เลือก (เช่น ปัดย้อนกลับบน Android) → บอกให้แตะตารางเพื่อเลือกระดับ
    dlg.addEventListener('close', function () {
      if (!S) levelEl.textContent = 'แตะตารางเพื่อเลือกระดับ';
    });
  }

  /* ---------- input ---------- */
  boardEl.addEventListener('click', function (e) {
    if (!S) {
      askNew();
      return;
    }
    var cell = e.target.closest('.sd-cell');
    if (!cell) return;
    sel = +cell.dataset.i;
    render();
  });

  padEl.addEventListener('click', function (e) {
    var key = e.target.closest('.sd-key');
    if (!key) return;
    if (!S) {
      askNew();
      return;
    }
    if (sel < 0) {
      FG.toast('แตะช่องในตารางก่อน');
      return;
    }
    var d = +key.dataset.d;
    if (notesMode) toggleNote(sel, d);
    else setValue(sel, d);
  });

  notesBtn.addEventListener('click', function () {
    notesMode = !notesMode;
    render();
  });
  checkBtn.addEventListener('click', function () {
    checkOn = !checkOn;
    FG.store.set('sudoku:check', checkOn);
    FG.toast(checkOn ? 'เปิดเช็คผิด: เลขที่ผิดจะเป็นสีแดง' : 'ปิดเช็คผิดแล้ว');
    render();
  });
  document.getElementById('erase').addEventListener('click', erase);
  undoBtn.addEventListener('click', undo);
  document.getElementById('new').addEventListener('click', askNew);

  document.addEventListener('keydown', function (e) {
    if (!S || FG.isSheetOpen()) return;
    if (e.key >= '1' && e.key <= '9') {
      if (sel < 0) return;
      if (notesMode) toggleNote(sel, +e.key);
      else setValue(sel, +e.key);
    } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
      erase();
    } else if (e.key === 'n') {
      notesMode = !notesMode;
      render();
    } else if (e.key.indexOf('Arrow') === 0) {
      e.preventDefault();
      if (sel < 0) sel = 40;
      else {
        var r = ROW[sel];
        var c = COL[sel];
        if (e.key === 'ArrowUp') r = (r + 8) % 9;
        if (e.key === 'ArrowDown') r = (r + 1) % 9;
        if (e.key === 'ArrowLeft') c = (c + 8) % 9;
        if (e.key === 'ArrowRight') c = (c + 1) % 9;
        sel = r * 9 + c;
      }
      render();
    }
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.values) && saved.values.length === 81 && LEVELS[saved.level]) {
    S = saved;
    render();
    if (S.done) askNew();
  } else {
    askNew();
  }
  runTimer();
})();
