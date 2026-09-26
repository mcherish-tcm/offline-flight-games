/*
 * เทสคอม (AI) ของ 5 เกม — รันด้วย:  node tests/ai.test.js
 * เช็คว่า: คอมเลือกแต่ตาที่ถูกกติกาเสมอ (ทั้งง่าย/ยาก) · เห็นทางชนะ · กันทางแพ้ · ใช้เวลาไม่เกินกำหนด
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var OX = require('../games/ox/ai.js');
var C4 = require('../games/connect4/ai.js');
var M = require('../games/makhos/engine.js');
var MAI = require('../games/makhos/ai.js');
var O = require('../games/othello/engine.js');
var G = require('../games/gomoku/engine.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join('\n       ') : e));
  }
}

function rng(seed) {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

// เร็วขึ้นตอนเทส: ให้เวลาคิดสั้นลง (ของจริงในเกม 450 ms)
var FAST = { budget: 60 };

console.log('คอม (AI) — sanity tests');

/* ---------- โอเอ็กซ์ ---------- */
test('OX: คอมทั้ง 2 ระดับเลือกแต่ช่องว่าง (เล่นสุ่มกับคอม 200 เกม)', function () {
  var r = rng(1);
  for (var g = 0; g < 200; g++) {
    var cells = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
    var turn = g % 2;
    var level = g % 4 < 2 ? 1 : 2;
    while (OX.winner(cells) === -1 && cells.indexOf(-1) !== -1) {
      var i;
      if (turn === 1) {
        i = OX.choose(cells, 1, level, r);
        assert.ok(i >= 0 && i < 9 && cells[i] === -1, 'AI picked occupied/invalid cell ' + i);
      } else {
        var e = [];
        cells.forEach(function (v, k) { if (v === -1) e.push(k); });
        i = e[Math.floor(r() * e.length)];
      }
      cells[i] = turn;
      turn = 1 - turn;
    }
  }
});

test('OX ยาก: ไม่เคยแพ้คนที่เดินสุ่ม (300 เกม) และเดินชนะทันทีเมื่อทำได้', function () {
  var r = rng(2);
  for (var g = 0; g < 300; g++) {
    var cells = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
    var turn = g % 2;
    while (OX.winner(cells) === -1 && cells.indexOf(-1) !== -1) {
      var i;
      if (turn === 1) i = OX.choose(cells, 1, 2, r);
      else {
        var e = [];
        cells.forEach(function (v, k) { if (v === -1) e.push(k); });
        i = e[Math.floor(r() * e.length)];
      }
      cells[i] = turn;
      turn = 1 - turn;
    }
    assert.notStrictEqual(OX.winner(cells), 0, 'hard AI lost a game');
  }
  // O O _ → ต้องเติมช่อง 2
  assert.strictEqual(OX.choose([1, 1, -1, 0, 0, -1, 0, -1, -1], 1, 2), 2);
});

test('OX ยาก vs ยาก = เสมอเสมอ', function () {
  var cells = [-1, -1, -1, -1, -1, -1, -1, -1, -1];
  var turn = 0;
  var r = rng(3);
  while (OX.winner(cells) === -1 && cells.indexOf(-1) !== -1) {
    cells[OX.choose(cells, turn, 2, r)] = turn;
    turn = 1 - turn;
  }
  assert.strictEqual(OX.winner(cells), -1);
});

/* ---------- หยอดเหรียญ ---------- */
function c4Drop(g, c, p) {
  var r = C4.dropRow(g, c);
  g[r * 7 + c] = p;
  return r * 7 + c;
}

test('หยอดเหรียญ: คอมเลือกแต่แถวที่ยังไม่เต็ม (สุ่มเล่นกับคอม 40 เกม ทั้ง 2 ระดับ)', function () {
  var r = rng(4);
  for (var n = 0; n < 40; n++) {
    var g = [];
    for (var i = 0; i < 42; i++) g.push(-1);
    var turn = n % 2;
    var level = n % 2 ? 2 : 1;
    var over = false;
    while (!over && C4.legalCols(g).length) {
      var c;
      if (turn === 1) {
        c = C4.choose(g, 1, level, r, { budget: 25 });
        assert.ok(C4.legalCols(g).indexOf(c) !== -1, 'AI picked full/invalid column ' + c);
      } else {
        var cols = C4.legalCols(g);
        c = cols[Math.floor(r() * cols.length)];
      }
      var idx = c4Drop(g, c, turn);
      over = C4.winsAt(g, idx, turn);
      turn = 1 - turn;
    }
  }
});

test('หยอดเหรียญ ยาก: ชนะทันทีเมื่อได้ · กันเมื่ออีกฝ่ายจะชนะ · ชนะคนเดินสุ่มเกือบทุกเกม', function () {
  var g = [];
  for (var i = 0; i < 42; i++) g.push(-1);
  c4Drop(g, 0, 1); c4Drop(g, 1, 1); c4Drop(g, 2, 1); c4Drop(g, 6, 0); c4Drop(g, 6, 0);
  assert.strictEqual(C4.choose(g, 1, 2, rng(5), FAST), 3, 'take the win');
  var h = [];
  for (var k = 0; k < 42; k++) h.push(-1);
  c4Drop(h, 4, 0); c4Drop(h, 4, 0); c4Drop(h, 4, 0); c4Drop(h, 0, 1); c4Drop(h, 1, 1);
  assert.strictEqual(C4.choose(h, 1, 2, rng(6), FAST), 4, 'block the column');
  var r = rng(7);
  var wins = 0;
  for (var n = 0; n < 10; n++) {
    var b = [];
    for (var j = 0; j < 42; j++) b.push(-1);
    var turn = n % 2;
    var winner = -1;
    while (winner === -1 && C4.legalCols(b).length) {
      var c = turn === 1 ? C4.choose(b, 1, 2, r, { budget: 30 }) : C4.legalCols(b)[Math.floor(r() * C4.legalCols(b).length)];
      var idx = c4Drop(b, c, turn);
      if (C4.winsAt(b, idx, turn)) winner = turn;
      turn = 1 - turn;
    }
    if (winner === 1) wins++;
  }
  assert.ok(wins >= 9, 'hard AI should crush random play (won ' + wins + '/10)');
});

/* ---------- หมากฮอส ---------- */
function mkSq(r, c) {
  return r * 8 + c;
}

test('หมากฮอส: คอมเลือกแต่ตาที่อยู่ใน legalMoves (บังคับกิน / ไม่บังคับกิน × ง่าย / ยาก)', function () {
  var r = rng(8);
  [true, false].forEach(function (force) {
    [1, 2].forEach(function (level) {
      for (var n = 0; n < 4; n++) {
        var s = M.newGame(n % 2);
        var opts = { forceCapture: force };
        var plies = 0;
        while (!s.over && plies < 120) {
          var legal = M.legalMoves(s.board, s.turn, opts);
          var mv;
          if (s.turn === 1) {
            mv = MAI.choose(s.board, 1, level, r, { forceCapture: force, budget: 20 });
            assert.ok(
              legal.some(function (m) { return M.sameMove(m, mv); }),
              'AI move not legal (force=' + force + ', level=' + level + ')'
            );
          } else {
            mv = legal[Math.floor(r() * legal.length)];
          }
          s = M.play(s, mv, opts);
          plies++;
        }
      }
    });
  });
});

test('หมากฮอส: คอมกินต่อจนสุด และฮอสลงช่องติดหลังตัวที่ถูกกิน (ได้จาก engine)', function () {
  // ฮอสฟ้าที่ (0,1) · แดง (2,3) → ฮอสกินต้องลง (3,4) ติดหลัง ไม่ใช่ (4,5)
  var b = M.emptyBoard();
  b[mkSq(0, 1)] = M.BLUE_KING;
  b[mkSq(2, 3)] = M.RED_MAN;
  b[mkSq(7, 0)] = M.RED_MAN;
  var mv = MAI.choose(b, 1, 2, rng(9), { budget: 50 });
  assert.deepStrictEqual(mv.captures, [mkSq(2, 3)]);
  assert.deepStrictEqual(mv.path, [mkSq(3, 4)]);
  // เบี้ยฟ้ากิน 2 ต่อ: (1,2) → กิน (2,3) ลง (3,4) → กิน (4,5) ลง (5,6)
  var c = M.emptyBoard();
  c[mkSq(1, 2)] = M.BLUE_MAN;
  c[mkSq(2, 3)] = M.RED_MAN;
  c[mkSq(4, 5)] = M.RED_MAN;
  c[mkSq(7, 0)] = M.RED_MAN;
  var mv2 = MAI.choose(c, 1, 1, rng(10), { budget: 50 });
  assert.deepStrictEqual(mv2.path, [mkSq(3, 4), mkSq(5, 6)]);
});

test('หมากฮอส ยาก: คิดเสร็จภายในเวลาที่ให้ (ตำแหน่งเริ่ม)', function () {
  var t0 = Date.now();
  MAI.choose(M.initialBoard(), 1, 2, rng(11), { budget: 200 });
  assert.ok(Date.now() - t0 < 400, 'took ' + (Date.now() - t0) + 'ms');
});

/* ---------- โอเทลโล ---------- */
test('โอเทลโล: คอมเลือกแต่ช่องที่ลงได้ (ทั้ง 2 ระดับ เล่นจนจบ 12 เกม)', function () {
  var r = rng(12);
  for (var n = 0; n < 12; n++) {
    var s = O.newGame(n % 2);
    var level = n % 2 ? 2 : 1;
    while (!s.over) {
      var legal = O.legalMoves(s.board, s.turn).map(function (m) { return m.i; });
      var i;
      if (s.turn === 1) {
        i = O.choose(s.board, 1, level, r, { budget: 15 });
        assert.ok(legal.indexOf(i) !== -1, 'AI picked illegal square ' + i);
      } else {
        i = legal[Math.floor(r() * legal.length)];
      }
      s = O.play(s, i);
    }
  }
});

test('โอเทลโล ยาก: ให้ค่ามุมสูง และชนะคนเดินสุ่มเกือบทุกเกม', function () {
  // ตำแหน่งเดียวกัน ถ้าฟ้ามีมุม คะแนนต้องดีกว่าตอนแดงมีมุม
  var b = O.initialBoard();
  var withCorner = b.slice();
  withCorner[0] = 1;
  var enemyCorner = b.slice();
  enemyCorner[0] = 0;
  assert.ok(O.evaluate(withCorner, 1) > O.evaluate(enemyCorner, 1) + 150);
  var r = rng(14);
  var wins = 0;
  for (var n = 0; n < 6; n++) {
    var s = O.newGame(n % 2);
    while (!s.over) {
      var lg = O.legalMoves(s.board, s.turn);
      s = O.play(s, s.turn === 1 ? O.choose(s.board, 1, 2, r, { budget: 20 }) : lg[Math.floor(r() * lg.length)].i);
    }
    if (s.over.w === 1) wins++;
  }
  assert.ok(wins >= 5, 'hard AI won ' + wins + '/6');
});

/* ---------- โกโมกุ ---------- */
var N = G.N;
function gsq(r, c) {
  return r * N + c;
}

test('โกโมกุ: คอมเลือกแต่ช่องว่าง (ทั้ง 2 ระดับ 6 เกม)', function () {
  var r = rng(15);
  for (var n = 0; n < 6; n++) {
    var s = G.newGame(n % 2);
    var level = n % 2 ? 2 : 1;
    while (!s.over && s.moves < 120) {
      var i;
      if (s.turn === 1) {
        i = G.choose(s.board, 1, level, r, { budget: 30 });
        assert.ok(i >= 0 && i < 225 && s.board[i] === -1, 'AI picked occupied/invalid ' + i);
      } else {
        var c = G.candidates(s.board);
        i = c[Math.floor(r() * c.length)];
      }
      s = G.play(s, i);
    }
  }
});

test('โกโมกุ ยาก: ชนะเลยเมื่อมี 4 · กัน 4 ของอีกฝ่าย · กัน 3 เปิด', function () {
  var b = G.emptyBoard();
  [[7, 3], [7, 4], [7, 5], [7, 6]].forEach(function (x) { b[gsq(x[0], x[1])] = 1; });
  [[8, 3], [8, 4], [8, 5], [9, 9]].forEach(function (x) { b[gsq(x[0], x[1])] = 0; });
  var w = G.choose(b, 1, 2, rng(16), FAST);
  assert.ok(w === gsq(7, 2) || w === gsq(7, 7), 'should complete five');

  var c = G.emptyBoard();
  [[5, 5], [6, 5], [7, 5], [8, 5]].forEach(function (x) { c[gsq(x[0], x[1])] = 0; });
  [[4, 5], [1, 1], [1, 3]].forEach(function (x) { c[gsq(x[0], x[1])] = 1; });
  assert.strictEqual(G.choose(c, 1, 2, rng(17), FAST), gsq(9, 5), 'must block the four');

  var d = G.emptyBoard();
  [[7, 6], [7, 7], [7, 8]].forEach(function (x) { d[gsq(x[0], x[1])] = 0; });
  [[3, 3], [3, 4]].forEach(function (x) { d[gsq(x[0], x[1])] = 1; });
  var blk = G.choose(d, 1, 2, rng(18), FAST);
  assert.ok([gsq(7, 5), gsq(7, 9), gsq(7, 4), gsq(7, 10)].indexOf(blk) !== -1, 'should block open three, got ' + blk);
});

test('โกโมกุ ยาก: คิดเสร็จไม่เกินเวลามาก (กระดานกลางเกม)', function () {
  var r = rng(19);
  var s = G.newGame(0);
  for (var k = 0; k < 16; k++) {
    var c = G.candidates(s.board);
    s = G.play(s, c[Math.floor(r() * c.length)]);
    if (s.over) break;
  }
  var t0 = Date.now();
  G.choose(s.board, s.turn, 2, r, { budget: 200 });
  assert.ok(Date.now() - t0 < 700, 'took ' + (Date.now() - t0) + 'ms');
});

/* ---------- ลากเส้นปิดกล่อง ---------- */
var D = require('../games/dots/ai.js');

function dotsGame(n) {
  var lines = [];
  for (var i = 0; i < D.hCount(n) * 2; i++) lines.push(-1);
  var boxes = [];
  for (var b = 0; b < n * n; b++) boxes.push(-1);
  return { n: n, lines: lines, boxes: boxes };
}

// ลากเส้น k ให้ p → ปิดได้กี่กล่อง (กติกาเดียวกับในเกม)
function dotsPlay(g, k, p) {
  g.lines[k] = p;
  var closed = 0;
  D.lineBoxes(g.n, k).forEach(function (b) {
    var e = D.boxEdges(g.n, b);
    if (g.boxes[b] === -1 && e.every(function (x) { return g.lines[x] !== -1; })) {
      g.boxes[b] = p;
      closed++;
    }
  });
  return closed;
}

function dotsRun(n, pick0, pick1, starter) {
  var g = dotsGame(n);
  var turn = starter;
  while (g.lines.indexOf(-1) !== -1) {
    var k = (turn === 0 ? pick0 : pick1)(g, turn);
    assert.ok(k >= 0 && k < g.lines.length && g.lines[k] === -1, 'picked drawn/invalid line ' + k);
    if (!dotsPlay(g, k, turn)) turn = 1 - turn;
  }
  var s = [0, 0];
  g.boxes.forEach(function (o) { s[o]++; });
  return s;
}

test('ลากเส้น: คอมเลือกแต่เส้นที่ยังไม่ลาก (3×3 / 4×4 / 5×5 × ง่าย / ยาก)', function () {
  var r = rng(20);
  function randomPick(g) {
    var f = [];
    g.lines.forEach(function (v, k) { if (v === -1) f.push(k); });
    return f[Math.floor(r() * f.length)];
  }
  [3, 4, 5].forEach(function (n) {
    [1, 2].forEach(function (level) {
      for (var t = 0; t < 3; t++) {
        dotsRun(n, randomPick, function (g) { return D.choose(g.n, g.lines, level, r, { budget: 40 }); }, t % 2);
      }
    });
  });
});

test('ลากเส้น ยาก: ปิดกล่องที่ปิดได้ · ไม่ยื่นด้านที่ 3 ถ้ายังมีเส้นปลอดภัย', function () {
  var g = dotsGame(3);
  var e = D.boxEdges(3, 4); // กล่องกลาง มี 3 ด้าน
  dotsPlay(g, e[0], 0); dotsPlay(g, e[1], 0); dotsPlay(g, e[2], 0);
  assert.strictEqual(D.choose(3, g.lines, 2, rng(21), FAST), e[3], 'take the box');
  // กระดานว่าง + กล่องมุมมี 2 ด้าน → คอมต้องไม่ลากด้านที่ 3 ของกล่องมุม
  var h = dotsGame(4);
  var c = D.boxEdges(4, 0);
  dotsPlay(h, c[0], 0); dotsPlay(h, c[2], 1);
  for (var i = 0; i < 20; i++) {
    var k = D.choose(4, h.lines, 2, rng(22 + i), FAST);
    assert.ok(k !== c[1] && k !== c[3], 'gave away the 3rd side');
  }
});

test('ลากเส้น ยาก: ชนะคอมง่ายเกือบทุกเกม (4×4)', function () {
  var r = rng(30);
  var wins = 0;
  for (var t = 0; t < 8; t++) {
    var s = dotsRun(
      4,
      function (g) { return D.choose(g.n, g.lines, 1, r); },
      function (g) { return D.choose(g.n, g.lines, 2, r, { budget: 60 }); },
      t % 2
    );
    if (s[1] > s[0]) wins++;
  }
  assert.ok(wins >= 7, 'hard beat easy ' + wins + '/8');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
