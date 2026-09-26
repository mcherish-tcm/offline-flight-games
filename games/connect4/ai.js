/*
 * หยอดเหรียญเรียง 4 — คอม (ใช้ได้ทั้งในเบราว์เซอร์ window.C4AI และใน node require)
 * กระดาน = array 42 ช่อง (7 แถวตั้ง × 6 แถวนอน), index = แถว*7 + หลัก, แถว 0 = บนสุด · -1 ว่าง · 0 แดง · 1 ฟ้า
 * ง่าย = เห็นทางชนะเกือบทุกครั้ง กันบ้างไม่กันบ้าง นอกนั้นสุ่มเอนเข้ากลาง
 * ยาก = alpha-beta ลึกขึ้นเรื่อย ๆ จนหมดเวลาที่ให้ (ค่าเริ่มต้น 450 ms)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.C4AI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var COLS = 7;
  var ROWS = 6;
  var ORDER = [3, 2, 4, 1, 5, 0, 6];
  var WIN = 1000000;
  var DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  // หน้าต่าง 4 ช่องทั้งหมด (คำนวณครั้งเดียว)
  var WINDOWS = [];
  (function () {
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        for (var d = 0; d < 4; d++) {
          var er = r + DIRS[d][0] * 3;
          var ec = c + DIRS[d][1] * 3;
          if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
          var w = [];
          for (var k = 0; k < 4; k++) w.push((r + DIRS[d][0] * k) * COLS + (c + DIRS[d][1] * k));
          WINDOWS.push(w);
        }
      }
    }
  })();

  function dropRow(g, c) {
    for (var r = ROWS - 1; r >= 0; r--) if (g[r * COLS + c] === -1) return r;
    return -1;
  }

  function legalCols(g) {
    var out = [];
    for (var k = 0; k < ORDER.length; k++) if (g[ORDER[k]] === -1) out.push(ORDER[k]);
    return out;
  }

  function winsAt(g, idx, p) {
    var r0 = Math.floor(idx / COLS);
    var c0 = idx % COLS;
    for (var d = 0; d < 4; d++) {
      var n = 1;
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var r = r0 + DIRS[d][0] * sgn;
        var c = c0 + DIRS[d][1] * sgn;
        while (r >= 0 && r < ROWS && c >= 0 && c < COLS && g[r * COLS + c] === p) {
          n++;
          r += DIRS[d][0] * sgn;
          c += DIRS[d][1] * sgn;
        }
      }
      if (n >= 4) return true;
    }
    return false;
  }

  function winningCol(g, p) {
    var cols = legalCols(g);
    for (var k = 0; k < cols.length; k++) {
      var idx = dropRow(g, cols[k]) * COLS + cols[k];
      g[idx] = p;
      var w = winsAt(g, idx, p);
      g[idx] = -1;
      if (w) return cols[k];
    }
    return -1;
  }

  // คะแนนตำแหน่งจากมุมของ p
  function evaluate(g, p) {
    var s = 0;
    for (var r = 0; r < ROWS; r++) {
      var v = g[r * COLS + 3];
      if (v === p) s += 4;
      else if (v === 1 - p) s -= 4;
    }
    for (var k = 0; k < WINDOWS.length; k++) {
      var w = WINDOWS[k];
      var mine = 0;
      var theirs = 0;
      for (var j = 0; j < 4; j++) {
        var x = g[w[j]];
        if (x === p) mine++;
        else if (x !== -1) theirs++;
      }
      if (mine && theirs) continue;
      if (mine === 3) s += 12;
      else if (mine === 2) s += 3;
      else if (theirs === 3) s -= 14;
      else if (theirs === 2) s -= 3;
    }
    return s;
  }

  function Timeout() {}

  function search(g, p, budgetMs) {
    var deadline = Date.now() + budgetMs;
    var nodes = 0;
    var filled = 0;
    for (var i = 0; i < g.length; i++) if (g[i] !== -1) filled++;

    function negamax(depth, alpha, beta, turn, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
      var cols = legalCols(g);
      if (!cols.length) return 0;
      if (depth === 0) return evaluate(g, turn);
      var best = -Infinity;
      for (var k = 0; k < cols.length; k++) {
        var c = cols[k];
        var idx = dropRow(g, c) * COLS + c;
        g[idx] = turn;
        var s;
        if (winsAt(g, idx, turn)) s = WIN - ply;
        else s = -negamax(depth - 1, -beta, -alpha, 1 - turn, ply + 1);
        g[idx] = -1;
        if (s > best) best = s;
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      }
      return best;
    }

    var cols = legalCols(g);
    var bestCol = cols[0];
    var maxDepth = COLS * ROWS - filled;
    var order = cols.slice();
    for (var depth = 1; depth <= maxDepth; depth++) {
      try {
        var alpha = -Infinity;
        var scored = [];
        for (var k = 0; k < order.length; k++) {
          var c = order[k];
          var idx = dropRow(g, c) * COLS + c;
          g[idx] = p;
          var s;
          try {
            if (winsAt(g, idx, p)) s = WIN;
            else s = -negamax(depth - 1, -Infinity, -alpha, 1 - p, 1);
          } finally {
            g[idx] = -1;
          }
          scored.push({ c: c, s: s });
          if (s > alpha) alpha = s;
        }
        scored.sort(function (a, b) {
          return b.s - a.s;
        });
        order = scored.map(function (x) {
          return x.c;
        });
        bestCol = order[0];
        if (scored[0].s >= WIN - 50 || scored[0].s <= -WIN + 50) break; // รู้ผลแน่นอนแล้ว
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
    return bestCol;
  }

  /* ตาเดินของคอม → หมายเลขแถวตั้ง 0–6 (หรือ -1 ถ้าเต็ม) · opts.budget = ms สำหรับระดับยาก */
  function choose(board, p, level, rnd, opts) {
    rnd = rnd || Math.random;
    var g = board.slice();
    var cols = legalCols(g);
    if (!cols.length) return -1;
    var win = winningCol(g, p);
    if (level !== 2) {
      if (win !== -1 && rnd() < 0.85) return win;
      var block = winningCol(g, 1 - p);
      if (block !== -1 && rnd() < 0.55) return block;
      // สุ่มเอนเข้ากลางกระดาน
      var bag = [];
      cols.forEach(function (c) {
        var weight = 4 - Math.abs(3 - c);
        for (var k = 0; k < weight; k++) bag.push(c);
      });
      return bag[Math.floor(rnd() * bag.length)];
    }
    if (win !== -1) return win;
    var must = winningCol(g, 1 - p);
    if (must !== -1) return must;
    return search(g, p, (opts && opts.budget) || 450);
  }

  return { choose: choose, dropRow: dropRow, legalCols: legalCols, winsAt: winsAt, COLS: COLS, ROWS: ROWS };
});
