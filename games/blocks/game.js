/* บล็อกเติมแถว — ลากชิ้นจากถาดขึ้นไปวาง, เต็มแถวนอน/ตั้งแล้วหาย, คะแนน + สูงสุด, ไม่มีชิ้นไหนลงได้ = จบ, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var B = window.Blocks;
  var N = B.N;
  var KEY = 'blk:state';
  var BEST = 'blk:best';

  var boardEl = document.getElementById('board');
  var trayEl = document.getElementById('tray');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');

  // S = { board[64], set: [{k,color}|null ×3], score, streak, over }
  var S;
  var best = FG.store.get(BEST, 0) || 0;
  var cells = [];
  var slots = [];
  var drag = null;
  var clearing = false;

  for (var i = 0; i < N * N; i++) {
    var c = document.createElement('div');
    c.className = 'blk-cell';
    c.setAttribute('role', 'gridcell');
    boardEl.appendChild(c);
    cells.push(c);
  }
  for (i = 0; i < 3; i++) {
    var s = document.createElement('div');
    s.className = 'blk-slot';
    s.dataset.i = i;
    trayEl.appendChild(s);
    slots.push(s);
  }

  function fresh() {
    var b = B.emptyBoard();
    return { board: b, set: B.newSet(b), score: 0, streak: 0, over: false };
  }

  function pieceHtml(p, cls, size) {
    var sh = B.shape(p.k);
    var html = '<div class="' + cls + '" data-c="' + p.color + '" style="grid-template-columns:repeat(' + sh.wd + ',' + size + ');grid-auto-rows:' + size + '">';
    for (var r = 0; r < sh.h; r++) {
      for (var cc = 0; cc < sh.wd; cc++) html += '<i' + (sh.rows[r][cc] === '#' ? '' : ' class="is-hole"') + '></i>';
    }
    return html + '</div>';
  }

  /* ---------- render ---------- */
  function render() {
    for (var i = 0; i < N * N; i++) {
      var v = S.board[i];
      var el = cells[i];
      el.className = 'blk-cell';
      if (v === -1) el.removeAttribute('data-c');
      else el.setAttribute('data-c', v);
    }
    // ขนาดช่องในถาด: ให้ชิ้นใหญ่สุด (5 ช่อง) พอดีช่องถาด
    var slotW = slots[0].clientWidth || 100;
    var slotH = slots[0].clientHeight || 100;
    slots.forEach(function (slot, k) {
      var p = S.set[k];
      slot.classList.remove('is-lifted');
      var sh = p ? B.shape(p.k) : null;
      // ชิ้นเล็กใช้ขนาดเท่ากันหมด · ชิ้นยาวย่อลงให้พอดีช่องถาด
      var m = sh ? Math.max(8, Math.floor(Math.min(slotW / (Math.max(sh.wd, 3) + 0.8), slotH / (Math.max(sh.h, 3) + 0.8), 30)) - 2) : 0;
      slot.innerHTML = p ? pieceHtml(p, 'blk-mini', m + 'px') : '';
      slot.classList.toggle('is-dead', !!p && !S.over && !B.fits(S.board, p.k));
      slot.setAttribute('aria-label', p ? 'ชิ้นที่ ' + (k + 1) + (B.fits(S.board, p.k) ? '' : ' (ยังไม่มีที่ลง)') : 'ว่าง');
    });
    scoreEl.textContent = FG.fmtNum(S.score);
    bestEl.textContent = FG.fmtNum(Math.max(best, S.score));
  }

  function save() {
    FG.store.set(KEY, S);
    FG.hubNote('blocks', { note: best ? 'สูงสุด ' + FG.fmtNum(best) : '', resume: !S.over && S.score > 0 });
  }

  /* ---------- drag ---------- */
  function geometry() {
    var r0 = cells[0].getBoundingClientRect();
    var r1 = cells[1].getBoundingClientRect();
    return { left: r0.left, top: r0.top, cell: r0.width, pitch: r1.left - r0.left };
  }

  function clearGhost() {
    cells.forEach(function (el) {
      el.classList.remove('is-ghost', 'is-line');
      if (el.dataset.ghost) {
        el.removeAttribute('data-c');
        delete el.dataset.ghost;
      }
    });
  }

  function showGhost(p, r, c) {
    clearGhost();
    var sh = B.shape(p.k);
    sh.cells.forEach(function (q) {
      var el = cells[(r + q[0]) * N + c + q[1]];
      el.classList.add('is-ghost');
      el.setAttribute('data-c', p.color);
      el.dataset.ghost = '1';
    });
    var lines = B.wouldClear(S.board, p.k, r, c);
    lines.rows.forEach(function (row) {
      for (var j = 0; j < N; j++) cells[row * N + j].classList.add('is-line');
    });
    lines.cols.forEach(function (col) {
      for (var j = 0; j < N; j++) cells[j * N + col].classList.add('is-line');
    });
  }

  function target(e) {
    var g = drag.g;
    var sh = B.shape(drag.p.k);
    // ชิ้นลอยเหนือนิ้ว: ขอบล่างของชิ้นอยู่เหนือนิ้วประมาณ 1 ช่อง
    var w = sh.wd * g.pitch;
    var h = sh.h * g.pitch;
    var x = e.clientX - w / 2;
    var y = e.clientY - h - g.pitch * 1.1;
    drag.float.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    var c = Math.round((x - g.left) / g.pitch);
    var r = Math.round((y - g.top) / g.pitch);
    return { r: r, c: c };
  }

  trayEl.addEventListener('pointerdown', function (e) {
    if (drag || clearing || S.over || FG.isSheetOpen()) return;
    var slot = e.target.closest('.blk-slot');
    if (!slot) return;
    var k = +slot.dataset.i;
    var p = S.set[k];
    if (!p) return;
    var g = geometry();
    var fl = document.createElement('div');
    fl.innerHTML = pieceHtml(p, 'blk-float', g.cell + 'px');
    fl = fl.firstChild;
    fl.style.gap = g.pitch - g.cell + 'px';
    document.body.appendChild(fl);
    drag = { pid: e.pointerId, k: k, p: p, g: g, float: fl, at: null };
    slot.classList.add('is-lifted');
    try {
      trayEl.setPointerCapture(e.pointerId);
    } catch (err) {}
    move(e);
  });

  function move(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    var t = target(e);
    if (B.canPlace(S.board, drag.p.k, t.r, t.c)) {
      if (!drag.at || drag.at.r !== t.r || drag.at.c !== t.c) showGhost(drag.p, t.r, t.c);
      drag.at = t;
      drag.float.classList.remove('is-bad');
    } else {
      if (drag.at) clearGhost();
      drag.at = null;
      drag.float.classList.add('is-bad');
    }
  }

  trayEl.addEventListener('pointermove', move);

  function end(e, cancel) {
    if (!drag || e.pointerId !== drag.pid) return;
    var d = drag;
    drag = null;
    d.float.remove();
    clearGhost();
    if (!cancel && d.at) put(d.k, d.at.r, d.at.c);
    else render();
  }

  trayEl.addEventListener('pointerup', function (e) {
    end(e, false);
  });
  trayEl.addEventListener('pointercancel', function (e) {
    end(e, true);
  });
  trayEl.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });

  /* ---------- play ---------- */
  function pop(text, lines) {
    var rows = lines.rows;
    var cols = lines.cols;
    var el = document.createElement('div');
    el.className = 'blk-pop num';
    el.textContent = text;
    var ref = cells[(rows.length ? rows[0] : 3) * N + (cols.length ? cols[0] : 3)].getBoundingClientRect();
    var bb = boardEl.getBoundingClientRect();
    el.style.left = (cols.length ? ref.left + ref.width / 2 : bb.left + bb.width / 2) + 'px';
    el.style.top = (rows.length ? ref.top + ref.height / 2 : bb.top + bb.height / 2) + 'px';
    document.body.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 950);
  }

  function bump() {
    scoreEl.classList.remove('is-bump');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('is-bump');
  }

  function put(k, r, c) {
    var p = S.set[k];
    var res = B.place(S.board, p.k, r, c, p.color, S.streak);
    S.set[k] = null;
    S.score += res.points;
    S.streak = res.lines ? S.streak + 1 : 0;
    FG.buzz(res.lines ? 25 : 8);
    if (res.lines) {
      // วาดชิ้นที่วางก่อน แล้วค่อยให้แถวหาย
      var shown = S.board.slice();
      B.shape(p.k).cells.forEach(function (q) {
        shown[(r + q[0]) * N + c + q[1]] = p.color;
      });
      var old = S.board;
      S.board = shown;
      render();
      S.board = old;
      res.rows.forEach(function (row) {
        for (var j = 0; j < N; j++) cells[row * N + j].classList.add('is-clear');
      });
      res.cols.forEach(function (col) {
        for (var j = 0; j < N; j++) cells[j * N + col].classList.add('is-clear');
      });
      pop('+' + res.points + (res.lines > 1 ? ' · ' + res.lines + ' เส้น' : ''), res);
      clearing = true;
      S.board = res.board;
      advance();
      save();
      setTimeout(function () {
        clearing = false;
        render();
        checkOver();
      }, 280);
    } else {
      S.board = res.board;
      advance();
      render();
      save();
      checkOver();
    }
    bump();
  }

  function advance() {
    if (!S.set[0] && !S.set[1] && !S.set[2]) S.set = B.newSet(S.board);
    if (S.score > best) {
      best = S.score;
      FG.store.set(BEST, best);
    }
  }

  function checkOver() {
    if (S.over || B.anyFits(S.board, S.set)) return;
    S.over = true;
    save();
    render();
    var isBest = S.score > 0 && S.score >= best;
    setTimeout(function () {
      FG.sheet({
        title: 'ไม่มีที่วางแล้ว',
        text: 'ได้ ' + FG.fmtNum(S.score) + ' คะแนน' + (isBest ? ' — สูงสุดของเรา!' : ' · สูงสุด ' + FG.fmtNum(best)),
        actions: [{ label: 'ดูกระดาน' }, { label: 'เล่นใหม่', primary: true, onClick: restart }]
      });
    }, 350);
  }

  function restart() {
    FG.closeSheet();
    S = fresh();
    render();
    save();
  }

  document.getElementById('new').addEventListener('click', function () {
    if (S.over || S.score === 0) {
      restart();
      return;
    }
    FG.sheet({
      title: 'เริ่มเกมใหม่?',
      text: 'คะแนนตานี้ (' + FG.fmtNum(S.score) + ') จะหายไป',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restart }]
    });
  });

  // แตะกระดานหลังจบเกม = เริ่มใหม่
  boardEl.addEventListener('click', function () {
    if (S.over && !FG.isSheetOpen()) restart();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 80);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.board) && saved.board.length === N * N && Array.isArray(saved.set) && !saved.over) {
    S = saved;
    if (!S.set[0] && !S.set[1] && !S.set[2]) S.set = B.newSet(S.board);
  } else {
    S = fresh();
  }
  render();
  save();
  requestAnimationFrame(render); // ขนาดถาดถูกต้องหลังจัดหน้าเสร็จ
  checkOver();
})();
