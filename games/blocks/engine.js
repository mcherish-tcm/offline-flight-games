/*
 * บล็อกเติมแถว — กติกาล้วน ๆ (ใช้ได้ทั้งในเบราว์เซอร์ window.Blocks และใน node require)
 * กระดาน 8×8 = array 64 ช่อง: -1 ว่าง · 0–11 = สีของบล็อก
 * ชิ้น = { k: ชื่อแบบ, cells: [[แถว, หลัก], ...] (มุมซ้ายบน = 0,0), color }
 * วางแล้วแถวนอน/แถวตั้งที่เต็ม หายไปพร้อมกัน · ไม่มีชิ้นไหนลงได้ = จบเกม
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Blocks = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 8;

  // แบบชิ้น (เขียนเป็นภาพ # = มีช่อง) · w = น้ำหนักการสุ่ม
  var SHAPES = [
    { k: '1', w: 3, rows: ['#'] },
    { k: '2h', w: 4, rows: ['##'] },
    { k: '2v', w: 4, rows: ['#', '#'] },
    { k: '3h', w: 4, rows: ['###'] },
    { k: '3v', w: 4, rows: ['#', '#', '#'] },
    { k: '4h', w: 3, rows: ['####'] },
    { k: '4v', w: 3, rows: ['#', '#', '#', '#'] },
    { k: '5h', w: 2, rows: ['#####'] },
    { k: '5v', w: 2, rows: ['#', '#', '#', '#', '#'] },
    { k: 'sq2', w: 5, rows: ['##', '##'] },
    { k: 'sq3', w: 2, rows: ['###', '###', '###'] },
    { k: 'r23', w: 2, rows: ['###', '###'] },
    { k: 'r32', w: 2, rows: ['##', '##', '##'] },
    { k: 'c3a', w: 2, rows: ['##', '#.'] },
    { k: 'c3b', w: 2, rows: ['##', '.#'] },
    { k: 'c3c', w: 2, rows: ['#.', '##'] },
    { k: 'c3d', w: 2, rows: ['.#', '##'] },
    { k: 'La', w: 1, rows: ['#.', '#.', '##'] },
    { k: 'Lb', w: 1, rows: ['###', '#..'] },
    { k: 'Lc', w: 1, rows: ['##', '.#', '.#'] },
    { k: 'Ld', w: 1, rows: ['..#', '###'] },
    { k: 'Ja', w: 1, rows: ['.#', '.#', '##'] },
    { k: 'Jb', w: 1, rows: ['#..', '###'] },
    { k: 'Jc', w: 1, rows: ['##', '#.', '#.'] },
    { k: 'Jd', w: 1, rows: ['###', '..#'] },
    { k: 'Ta', w: 1, rows: ['###', '.#.'] },
    { k: 'Tb', w: 1, rows: ['.#.', '###'] },
    { k: 'Tc', w: 1, rows: ['#.', '##', '#.'] },
    { k: 'Td', w: 1, rows: ['.#', '##', '.#'] },
    { k: 'Sh', w: 1, rows: ['.##', '##.'] },
    { k: 'Zh', w: 1, rows: ['##.', '.##'] },
    { k: 'Sv', w: 1, rows: ['#.', '##', '.#'] },
    { k: 'Zv', w: 1, rows: ['.#', '##', '#.'] },
    { k: 'BLa', w: 1, rows: ['###', '#..', '#..'] },
    { k: 'BLb', w: 1, rows: ['###', '..#', '..#'] },
    { k: 'BLc', w: 1, rows: ['#..', '#..', '###'] },
    { k: 'BLd', w: 1, rows: ['..#', '..#', '###'] }
  ];

  var BY_KEY = {};
  var TOTAL_W = 0;
  SHAPES.forEach(function (s) {
    s.cells = [];
    s.rows.forEach(function (row, r) {
      for (var c = 0; c < row.length; c++) if (row[c] === '#') s.cells.push([r, c]);
    });
    s.h = s.rows.length;
    s.wd = s.rows[0].length;
    BY_KEY[s.k] = s;
    TOTAL_W += s.w;
  });

  function shape(k) {
    return BY_KEY[k];
  }

  function emptyBoard() {
    var b = [];
    for (var i = 0; i < N * N; i++) b.push(-1);
    return b;
  }

  function canPlace(board, k, r, c) {
    var s = BY_KEY[k];
    if (!s) return false;
    for (var i = 0; i < s.cells.length; i++) {
      var rr = r + s.cells[i][0];
      var cc = c + s.cells[i][1];
      if (rr < 0 || cc < 0 || rr >= N || cc >= N) return false;
      if (board[rr * N + cc] !== -1) return false;
    }
    return true;
  }

  function fits(board, k) {
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (canPlace(board, k, r, c)) return true;
    return false;
  }

  // แถว/หลักที่จะเต็มถ้าวางตรงนี้ (ใช้ไฮไลต์ตอนลาก)
  function wouldClear(board, k, r, c) {
    var b = board.slice();
    BY_KEY[k].cells.forEach(function (p) {
      b[(r + p[0]) * N + c + p[1]] = 0;
    });
    return fullLines(b);
  }

  function fullLines(b) {
    var rows = [];
    var cols = [];
    for (var i = 0; i < N; i++) {
      var rf = true;
      var cf = true;
      for (var j = 0; j < N; j++) {
        if (b[i * N + j] === -1) rf = false;
        if (b[j * N + i] === -1) cf = false;
      }
      if (rf) rows.push(i);
      if (cf) cols.push(i);
    }
    return { rows: rows, cols: cols };
  }

  /*
   * วางชิ้น → { board, rows, cols, cleared (จำนวนช่องที่หาย), lines, points }
   * คะแนน = จำนวนช่องที่วาง + 10 × เส้น × เส้น (หายพร้อมกันหลายเส้นได้มากขึ้น) + ต่อเนื่อง (streak) × 10
   * streak = จำนวนตาติดกันก่อนหน้านี้ที่ทำเส้นหายได้
   */
  function place(board, k, r, c, color, streak) {
    var s = BY_KEY[k];
    var b = board.slice();
    s.cells.forEach(function (p) {
      b[(r + p[0]) * N + c + p[1]] = color;
    });
    var full = fullLines(b);
    var cleared = 0;
    full.rows.forEach(function (row) {
      for (var j = 0; j < N; j++) {
        if (b[row * N + j] !== -1) cleared++;
        b[row * N + j] = -1;
      }
    });
    full.cols.forEach(function (col) {
      for (var i = 0; i < N; i++) {
        if (b[i * N + col] !== -1) cleared++;
        b[i * N + col] = -1;
      }
    });
    var lines = full.rows.length + full.cols.length;
    var points = s.cells.length;
    if (lines) points += 10 * lines * lines + 10 * (streak || 0);
    return { board: b, rows: full.rows, cols: full.cols, cleared: cleared, lines: lines, points: points };
  }

  function pickShape(rnd) {
    var x = rnd() * TOTAL_W;
    for (var i = 0; i < SHAPES.length; i++) {
      x -= SHAPES[i].w;
      if (x < 0) return SHAPES[i].k;
    }
    return SHAPES[SHAPES.length - 1].k;
  }

  /*
   * ชุดใหม่ 3 ชิ้น · พยายามให้มีอย่างน้อย 1 ชิ้นที่ลงได้ (สุ่มใหม่ได้ไม่เกิน 30 รอบ)
   * → [{ k, color }, ...]
   */
  function newSet(board, rnd) {
    rnd = rnd || Math.random;
    var set;
    for (var tries = 0; tries < 30; tries++) {
      set = [];
      for (var i = 0; i < 3; i++) set.push({ k: pickShape(rnd), color: Math.floor(rnd() * 7) });
      if (!board || anyFits(board, set)) return set;
    }
    return set;
  }

  // ชิ้นที่ยังไม่ได้วาง (null = วางแล้ว) มีชิ้นไหนลงได้ไหม
  function anyFits(board, set) {
    for (var i = 0; i < set.length; i++) if (set[i] && fits(board, set[i].k)) return true;
    return false;
  }

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    N: N,
    SHAPES: SHAPES,
    shape: shape,
    emptyBoard: emptyBoard,
    canPlace: canPlace,
    fits: fits,
    wouldClear: wouldClear,
    place: place,
    newSet: newSet,
    anyFits: anyFits,
    rng: rng
  };
});
