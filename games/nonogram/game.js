/* ภาพปริศนาเติมช่อง — เลือกภาพ 5×5 / 10×10 / 15×15, แตะหรือลากเพื่อถม/กากบาท, ตัวเลขใบ้จางเมื่อแถวครบ, ย้อน, จำความคืบหน้าทุกภาพ */
(function () {
  'use strict';

  var N = window.NonoSolver;
  var PUZ = window.NONO_PUZZLES || [];
  var PROG = 'nono:prog';
  var DONE = 'nono:done';
  var CUR = 'nono:cur';
  var SIZES = [5, 10, 15];

  var pickerEl = document.getElementById('picker');
  var playEl = document.getElementById('play');
  var gridEl = document.getElementById('grid');
  var boardEl = document.getElementById('board');
  var ccluesEl = document.getElementById('cclues');
  var rcluesEl = document.getElementById('rclues');
  var cornerEl = document.getElementById('corner');
  var nameEl = document.getElementById('pname');
  var timeEl = document.getElementById('ptime');
  var modeEl = document.getElementById('mode');
  var titleEl = document.querySelector('.bar__title');
  var undoBtn = document.getElementById('undo');
  var listBtn = document.getElementById('list');
  var clearBtn = document.getElementById('clear');

  var prog = FG.store.get(PROG, {}) || {};
  var done = FG.store.get(DONE, {}) || {};
  var P = null; // { puz, idx, n, clues, cells: [0|1|2], time, won }
  var cellEls = [];
  var rowClueEls = [];
  var colClueEls = [];
  var history = [];
  var mode = FG.store.get('nono:mode', 1) === 2 ? 2 : 1;
  var paint = null;

  function byId(id) {
    for (var i = 0; i < PUZ.length; i++) if (PUZ[i].id === id) return i;
    return -1;
  }

  function thumb(rows, cls) {
    var n = rows.length;
    var d = '';
    rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) if (row[c] === '#' || row[c] === 1) d += 'M' + c + ' ' + r + 'h1v1h-1z';
    });
    return '<svg class="' + (cls || '') + '" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
  }

  /* ---------- หน้าเลือกภาพ ---------- */
  function showPicker() {
    P = null;
    FG.store.set(CUR, null);
    playEl.hidden = true;
    pickerEl.hidden = false;
    titleEl.textContent = 'ภาพปริศนาเติมช่อง';
    undoBtn.hidden = listBtn.hidden = clearBtn.hidden = true;
    var html = '';
    SIZES.forEach(function (size) {
      var list = [];
      PUZ.forEach(function (p, i) {
        if (p.size === size) list.push(i);
      });
      var solved = list.filter(function (i) {
        return done[PUZ[i].id] != null;
      }).length;
      html += '<div class="ng-shelf"><h2>' + size + '×' + size + ' <small>ทำแล้ว ' + solved + '/' + list.length + '</small></h2><div class="ng-tiles">';
      list.forEach(function (i, k) {
        var p = PUZ[i];
        var isDone = done[p.id] != null;
        var pr = prog[p.id];
        var filled = pr ? (pr.c.match(/1/g) || []).length : 0;
        var total = p.rows.join('').split('#').length - 1;
        var going = !isDone && filled > 0;
        html +=
          '<button type="button" class="ng-tile' + (isDone ? ' is-done' : going ? ' is-going' : '') + '" data-i="' + i + '">' +
          (isDone ? thumb(p.rows) + '<span>' + p.name + '</span>' : '<b>' + (k + 1) + '</b><span>' + (going ? 'ทำต่อ' : 'ภาพที่ ' + (k + 1)) + '</span>' + (going ? '<span class="ng-bar"><i style="width:' + Math.min(100, Math.round((filled / total) * 100)) + '%"></i></span>' : '')) +
          '</button>';
      });
      html += '</div></div>';
    });
    pickerEl.innerHTML = html;
    note();
  }

  pickerEl.addEventListener('click', function (e) {
    var t = e.target.closest('.ng-tile');
    if (t) openPuzzle(+t.dataset.i);
  });

  function note() {
    var n = Object.keys(done).length;
    FG.hubNote('nonogram', { note: n ? 'ทำแล้ว ' + n + '/' + PUZ.length + ' ภาพ' : '', resume: !!(P && !P.won) });
  }

  /* ---------- หน้าเล่น ---------- */
  function openPuzzle(i) {
    var puz = PUZ[i];
    if (!puz) return showPicker();
    var n = puz.size;
    var saved = prog[puz.id];
    var cells = [];
    for (var k = 0; k < n * n; k++) cells.push(saved && saved.c ? +saved.c[k] || 0 : 0);
    var isDone = done[puz.id] != null;
    if (isDone && !(saved && saved.c)) {
      // ภาพที่เคยทำเสร็จ: แสดงภาพเต็ม
      cells = [];
      puz.rows.forEach(function (row) {
        for (var c = 0; c < n; c++) cells.push(row[c] === '#' ? 1 : 0);
      });
    }
    P = { puz: puz, idx: i, n: n, clues: N.clues(puz.rows), cells: cells, time: (saved && saved.t) || 0, won: false };
    history = [];
    FG.store.set(CUR, puz.id);
    pickerEl.hidden = true;
    playEl.hidden = false;
    undoBtn.hidden = listBtn.hidden = clearBtn.hidden = false;
    var sizeList = PUZ.filter(function (p) {
      return p.size === n;
    });
    var num = sizeList.indexOf(puz) + 1;
    titleEl.textContent = n + '×' + n + ' #' + num;
    nameEl.textContent = isDone ? 'ภาพ: ' + puz.name : 'ภาพนี้คืออะไร?';
    build();
    layout();
    render();
    if (isDone && isSolved()) {
      P.won = true;
      boardEl.classList.add('is-won');
    }
    note();
  }

  function build() {
    var n = P.n;
    gridEl.style.setProperty('--n', n);
    boardEl.innerHTML = '';
    ccluesEl.innerHTML = '';
    rcluesEl.innerHTML = '';
    boardEl.classList.remove('is-won');
    cellEls = [];
    rowClueEls = [];
    colClueEls = [];
    for (var k = 0; k < n * n; k++) {
      var el = document.createElement('div');
      var r = Math.floor(k / n);
      var c = k % n;
      el.className = 'ng-cell' + ((c + 1) % 5 === 0 && c < n - 1 ? ' is-r5' : '') + ((r + 1) % 5 === 0 && r < n - 1 ? ' is-b5' : '');
      el.setAttribute('role', 'gridcell');
      boardEl.appendChild(el);
      cellEls.push(el);
    }
    P.clues.cols.forEach(function (cl) {
      var d = document.createElement('div');
      d.className = 'ng-clue';
      d.innerHTML = (cl.length ? cl : [0]).map(function (x) { return '<span>' + x + '</span>'; }).join('');
      ccluesEl.appendChild(d);
      colClueEls.push(d);
    });
    P.clues.rows.forEach(function (cl) {
      var d = document.createElement('div');
      d.className = 'ng-clue';
      d.innerHTML = (cl.length ? cl : [0]).map(function (x) { return '<span>' + x + '</span>'; }).join('');
      rcluesEl.appendChild(d);
      rowClueEls.push(d);
    });
  }

  // ขนาดช่อง: ให้ตัวเลขใบ้ + กระดานพอดีพื้นที่
  function layout() {
    if (!P) return;
    var wrap = document.getElementById('wrap');
    var W = wrap.clientWidth;
    var H = wrap.clientHeight;
    var n = P.n;
    var maxR = 1;
    var maxRChars = 1;
    P.clues.rows.forEach(function (cl) {
      maxR = Math.max(maxR, cl.length);
      maxRChars = Math.max(maxRChars, cl.join(' ').length);
    });
    var maxC = 1;
    P.clues.cols.forEach(function (cl) {
      maxC = Math.max(maxC, cl.length);
    });
    // หน่วยเป็น "ช่อง": ตัวเลข 1 ตัวกว้างราว 0.4 ช่อง · สูงราว 0.62 ช่อง
    var fsRatio = n >= 15 ? 0.62 : n >= 10 ? 0.55 : 0.45;
    var rUnits = (maxRChars * 0.62 + 0.6) * fsRatio + 0.25;
    var cUnits = maxC * 1.12 * fsRatio + 0.3;
    var cell = Math.floor(Math.min((W - 6) / (n + rUnits), (H - 6) / (n + cUnits), n <= 5 ? 56 : 40));
    cell = Math.max(12, cell);
    gridEl.style.setProperty('--cell', cell + 'px');
    gridEl.style.setProperty('--fs', Math.max(9, Math.round(cell * fsRatio)) + 'px');
  }

  function lineOf(k, isRow) {
    var n = P.n;
    var out = [];
    for (var j = 0; j < n; j++) out.push(P.cells[isRow ? k * n + j : j * n + k] === 1 ? 1 : 0);
    return out;
  }

  function same(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  function render() {
    var n = P.n;
    for (var k = 0; k < n * n; k++) {
      var v = P.cells[k];
      if (cellEls[k].getAttribute('data-v') !== String(v)) {
        if (v) cellEls[k].setAttribute('data-v', v);
        else cellEls[k].removeAttribute('data-v');
      }
    }
    for (var i = 0; i < n; i++) {
      rowClueEls[i].classList.toggle('is-ok', same(N.lineClue(lineOf(i, true)), P.clues.rows[i]));
      colClueEls[i].classList.toggle('is-ok', same(N.lineClue(lineOf(i, false)), P.clues.cols[i]));
    }
    var rows = [];
    for (i = 0; i < n; i++) rows.push(lineOf(i, true));
    cornerEl.innerHTML = thumb(rows);
    timeEl.textContent = FG.fmtTime(P.time);
    undoBtn.disabled = !history.length || P.won;
  }

  function isSolved() {
    var grid = [];
    for (var i = 0; i < P.n; i++) grid.push(lineOf(i, true));
    return N.check(P.clues.rows, P.clues.cols, grid);
  }

  function save() {
    if (!P) return;
    prog[P.puz.id] = { c: P.cells.join(''), t: P.time };
    FG.store.set(PROG, prog);
    note();
  }

  /* ---------- แตะ/ลาก ---------- */
  function cellAt(x, y) {
    var r = boardEl.getBoundingClientRect();
    var pitch = (r.width - 4) / P.n;
    var c = Math.floor((x - r.left - 2) / pitch);
    var rr = Math.floor((y - r.top - 2) / pitch);
    if (c < 0 || rr < 0 || c >= P.n || rr >= P.n) return null;
    return { r: rr, c: c };
  }

  function hot(r, c) {
    rowClueEls.forEach(function (el, i) {
      el.classList.toggle('is-hot', i === r);
    });
    colClueEls.forEach(function (el, i) {
      el.classList.toggle('is-hot', i === c);
    });
  }

  function applyAt(pos) {
    var k = pos.r * P.n + pos.c;
    if (paint.seen[k]) return;
    paint.seen[k] = true;
    if (P.cells[k] !== paint.from) return;
    P.cells[k] = paint.to;
    paint.changed = true;
    render();
  }

  boardEl.addEventListener('pointerdown', function (e) {
    if (!P || P.won || paint || FG.isSheetOpen()) return;
    var pos = cellAt(e.clientX, e.clientY);
    if (!pos) return;
    var k = pos.r * P.n + pos.c;
    var v = P.cells[k];
    // ถม: ว่าง→ถม · ถม→ว่าง · กากบาท→ว่าง | กากบาท: ว่าง→กากบาท · กากบาท→ว่าง · ช่องที่ถมไว้ไม่แตะ
    var to = mode === 1 ? (v === 0 ? 1 : 0) : v === 0 ? 2 : v === 2 ? 0 : 1;
    paint = { pid: e.pointerId, start: pos, axis: null, from: v, to: to, seen: {}, before: P.cells.join(''), changed: false };
    try {
      boardEl.setPointerCapture(e.pointerId);
    } catch (err) {}
    applyAt(pos);
    hot(pos.r, pos.c);
    FG.buzz(6);
  });

  boardEl.addEventListener('pointermove', function (e) {
    if (!paint || e.pointerId !== paint.pid) return;
    var pos = cellAt(e.clientX, e.clientY);
    if (!pos) return;
    // ล็อกแนวลากตามทิศแรก (แนวนอน / แนวตั้ง)
    if (!paint.axis && (pos.r !== paint.start.r || pos.c !== paint.start.c)) paint.axis = pos.r === paint.start.r ? 'row' : pos.c === paint.start.c ? 'col' : Math.abs(pos.c - paint.start.c) >= Math.abs(pos.r - paint.start.r) ? 'row' : 'col';
    if (paint.axis === 'row') pos.r = paint.start.r;
    if (paint.axis === 'col') pos.c = paint.start.c;
    // เติมทุกช่องระหว่างจุดเริ่มกับนิ้ว (ลากเร็วไม่ข้ามช่อง)
    var a = paint.axis === 'col' ? paint.start.r : paint.start.c;
    var b = paint.axis === 'col' ? pos.r : pos.c;
    var step = a <= b ? 1 : -1;
    for (var x = a; x !== b + step; x += step) applyAt(paint.axis === 'col' ? { r: x, c: pos.c } : { r: pos.r, c: x });
    hot(pos.r, pos.c);
  });

  function endPaint(e) {
    if (!paint || e.pointerId !== paint.pid) return;
    var p = paint;
    paint = null;
    hot(-1, -1);
    if (!p.changed) return;
    history.push(p.before);
    if (history.length > 150) history.shift();
    render();
    save();
    if (isSolved()) win();
  }

  boardEl.addEventListener('pointerup', endPaint);
  boardEl.addEventListener('pointercancel', endPaint);
  boardEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  function win() {
    P.won = true;
    // ล้างกากบาท ให้เห็นภาพสะอาด
    P.cells = P.cells.map(function (v) {
      return v === 1 ? 1 : 0;
    });
    var first = done[P.puz.id] == null;
    if (first || P.time < done[P.puz.id]) done[P.puz.id] = P.time;
    FG.store.set(DONE, done);
    save();
    render();
    boardEl.classList.add('is-won');
    nameEl.textContent = 'ภาพ: ' + P.puz.name;
    FG.buzz(40);
    var nextIdx = nextPuzzle();
    setTimeout(function () {
      FG.sheet({
        title: 'เสร็จแล้ว!',
        text: 'ภาพนี้คือ <b>' + P.puz.name + '</b> · ' + FG.fmtTime(P.time) + ' · ทำแล้ว ' + Object.keys(done).length + '/' + PUZ.length + ' ภาพ',
        actions: [
          { label: 'ดูภาพ' },
          nextIdx >= 0
            ? {
                label: 'ภาพถัดไป',
                primary: true,
                onClick: function () {
                  openPuzzle(nextIdx);
                }
              }
            : { label: 'เลือกภาพ', primary: true, onClick: showPicker }
        ]
      });
    }, 700);
  }

  // ภาพถัดไปที่ยังไม่เสร็จ (ขนาดเดียวกันก่อน แล้วค่อยขนาดใหญ่ขึ้น)
  function nextPuzzle() {
    for (var i = P.idx + 1; i < PUZ.length; i++) if (done[PUZ[i].id] == null) return i;
    for (i = 0; i < PUZ.length; i++) if (done[PUZ[i].id] == null) return i;
    return -1;
  }

  /* ---------- ปุ่ม ---------- */
  function setMode(m) {
    mode = m;
    FG.store.set('nono:mode', m);
    modeEl.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-checked', String(+b.dataset.mode === m));
    });
  }
  modeEl.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) setMode(+b.dataset.mode);
  });
  setMode(mode);

  undoBtn.addEventListener('click', function () {
    if (!P || P.won || !history.length) return;
    P.cells = history.pop().split('').map(Number);
    render();
    save();
  });

  listBtn.addEventListener('click', function () {
    if (P) save();
    showPicker();
  });

  clearBtn.addEventListener('click', function () {
    if (!P) return;
    FG.sheet({
      title: 'ล้างภาพนี้เริ่มใหม่?',
      text: 'ช่องที่ถมไว้ทั้งหมดจะหายไป',
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'ล้าง',
          primary: true,
          onClick: function () {
            prog[P.puz.id] = { c: new Array(P.n * P.n + 1).join('0'), t: 0 };
            FG.store.set(PROG, prog);
            openPuzzle(P.idx); // ภาพที่เคยเสร็จแล้ว ยังนับว่าเสร็จ (เล่นซ้ำได้)
          }
        }
      ]
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'x') setMode(mode === 1 ? 2 : 1);
    if ((e.key === 'z' || e.key === 'u') && P) undoBtn.click();
  });

  /* ---------- timer ---------- */
  setInterval(function () {
    if (!P || P.won || document.hidden || playEl.hidden) return;
    P.time++;
    timeEl.textContent = FG.fmtTime(P.time);
    if (P.time % 15 === 0) save();
  }, 1000);
  FG.onVisibility(function (hidden) {
    if (hidden && P) save();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 80);
  });

  /* ---------- boot ---------- */
  var cur = FG.store.get(CUR, null);
  var ci = cur ? byId(cur) : -1;
  if (ci >= 0) openPuzzle(ci);
  else showPicker();
})();
