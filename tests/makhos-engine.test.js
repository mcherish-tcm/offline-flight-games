/*
 * เทสกติกาหมากฮอสไทย — รันด้วย:  node tests/makhos-engine.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var M = require('../games/makhos/engine.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}

function sq(r, c) {
  assert.ok((r + c) % 2 === 1, 'test setup uses a light square ' + r + ',' + c);
  return r * 8 + c;
}

function board(pieces) {
  var b = M.emptyBoard();
  pieces.forEach(function (p) {
    b[sq(p[0], p[1])] = p[2];
  });
  return b;
}

function paths(moves) {
  return moves
    .map(function (m) {
      return m.from + '>' + m.path.join('>');
    })
    .sort();
}

var R = M.RED_MAN;
var RK = M.RED_KING;
var B = M.BLUE_MAN;
var BK = M.BLUE_KING;

console.log('หมากฮอสไทย — engine self-tests');

/* ---------- ตั้งกระดาน ---------- */
test('กระดานเริ่ม: ฝ่ายละ 8 ตัว บนช่องเข้ม 2 แถวแรก · แดงมีตาเดินแรก 7 แบบ', function () {
  var b = M.initialBoard();
  assert.strictEqual(M.count(b, 0), 8);
  assert.strictEqual(M.count(b, 1), 8);
  for (var i = 0; i < 64; i++) if (b[i]) assert.ok(M.isDark(i), 'piece on light square ' + i);
  assert.strictEqual(M.legalMoves(b, 0).length, 7);
});

/* ---------- บังคับกิน ---------- */
test('บังคับกิน: มีทางกิน → เดินธรรมดาไม่ได้เลย', function () {
  var b = board([[5, 2, R], [4, 3, B], [5, 6, R], [0, 1, B]]);
  var moves = M.legalMoves(b, 0);
  assert.deepStrictEqual(paths(moves), [sq(5, 2) + '>' + sq(3, 4)]);
  assert.deepStrictEqual(moves[0].captures, [sq(4, 3)]);
});

test('ตั้งค่า "ไม่บังคับกิน": กินได้ และเดินธรรมดาก็ได้', function () {
  var b = board([[5, 2, R], [4, 3, B], [5, 6, R], [0, 1, B]]);
  var moves = M.legalMoves(b, 0, { forceCapture: false });
  var p = paths(moves);
  assert.ok(p.indexOf(sq(5, 2) + '>' + sq(3, 4)) !== -1, 'capture still offered');
  assert.ok(p.indexOf(sq(5, 6) + '>' + sq(4, 5)) !== -1, 'simple move offered');
  assert.ok(moves.length > 1);
});

test('เบี้ยกินถอยหลังไม่ได้', function () {
  var b = board([[4, 3, R], [5, 4, B], [0, 1, B]]);
  assert.strictEqual(M.captureMoves(b, sq(4, 3)).length, 0);
});

/* ---------- เลือกกินได้อิสระ ---------- */
test('มีหลายทางกิน → เลือกได้อิสระ (ไม่บังคับทางที่กินได้มากสุด)', function () {
  var b = board([[5, 4, R], [4, 3, B], [4, 5, B], [2, 1, B]]);
  var moves = M.legalMoves(b, 0);
  assert.strictEqual(moves.length, 2);
  var counts = moves
    .map(function (m) {
      return m.captures.length;
    })
    .sort();
  assert.deepStrictEqual(counts, [1, 2], 'both the 1-capture and the 2-capture line are legal');
});

/* ---------- ฮอส: ลงติดหลังตัวที่ถูกกินเท่านั้น ---------- */
test('ฮอสกินจากระยะไกลได้ แต่ต้องลงช่องที่ติดหลังตัวที่ถูกกินทันที', function () {
  var b = board([[7, 0, RK], [4, 3, B], [0, 1, B]]);
  var caps = M.captureMoves(b, sq(7, 0));
  assert.deepStrictEqual(paths(caps), [sq(7, 0) + '>' + sq(3, 4)]);
  var all = paths(M.legalMoves(b, 0));
  assert.ok(all.indexOf(sq(7, 0) + '>' + sq(2, 5)) === -1, 'no flying landing at 2,5');
  assert.ok(all.indexOf(sq(7, 0) + '>' + sq(1, 6)) === -1, 'no flying landing at 1,6');
});

test('ฮอสกินไม่ได้ถ้าช่องหลังตัวนั้นไม่ว่าง (กระโดด 2 ตัวติดกันไม่ได้)', function () {
  var b = board([[7, 0, RK], [4, 3, B], [3, 4, B], [0, 1, B]]);
  assert.strictEqual(M.captureMoves(b, sq(7, 0)).length, 0);
});

test('ฮอสกินข้ามหมากฝ่ายตัวเองไม่ได้', function () {
  var b = board([[7, 0, RK], [5, 2, R], [4, 3, B], [0, 1, B]]);
  assert.strictEqual(M.captureMoves(b, sq(7, 0)).length, 0);
});

test('ฮอสกินต่อได้จากช่องที่ลง (ทั้งแนวเดิมและหักมุม) และเลือกทางได้อิสระ', function () {
  var b = board([[7, 0, RK], [4, 3, B], [1, 6, B], [1, 2, B]]);
  var caps = M.captureMoves(b, sq(7, 0));
  assert.deepStrictEqual(paths(caps), [sq(7, 0) + '>' + sq(3, 4) + '>' + sq(0, 1), sq(7, 0) + '>' + sq(3, 4) + '>' + sq(0, 7)].sort());
  caps.forEach(function (m) {
    assert.strictEqual(m.captures.length, 2);
  });
});

/* ---------- กินต่อ ---------- */
test('เบี้ยกินต่อเนื่อง: ต้องกินจนสุด หยุดกลางทางไม่ได้', function () {
  var b = board([[6, 1, R], [5, 2, B], [3, 4, B], [0, 1, B]]);
  var moves = M.legalMoves(b, 0);
  assert.deepStrictEqual(paths(moves), [sq(6, 1) + '>' + sq(4, 3) + '>' + sq(2, 5)]);
  assert.deepStrictEqual(moves[0].captures, [sq(5, 2), sq(3, 4)]);
  var s = M.play(M.newGame(0, b), moves[0]);
  assert.strictEqual(s.board[sq(5, 2)], 0);
  assert.strictEqual(s.board[sq(3, 4)], 0);
  assert.strictEqual(s.board[sq(2, 5)], R);
});

/* ---------- เลื่อนขั้น ---------- */
test('เบี้ยถึงแถวสุดท้าย → เป็นฮอส แล้วจบตา', function () {
  var b = board([[1, 2, R], [7, 0, B]]);
  var mv = M.legalMoves(b, 0).filter(function (m) {
    return m.path[0] === sq(0, 1);
  })[0];
  assert.ok(mv && mv.promote);
  var s = M.play(M.newGame(0, b), mv);
  assert.strictEqual(s.board[sq(0, 1)], RK);
  assert.strictEqual(s.turn, 1);
});

test('กินแล้วถึงแถวสุดท้าย → เป็นฮอสและจบตาทันที ไม่กินต่อในฐานะฮอส', function () {
  // จาก 0,5 ถ้าเป็นฮอสแล้วจะกิน 1,6 → 2,7 ต่อได้ แต่กติกาให้จบตาเมื่อเลื่อนขั้น
  var b = board([[2, 3, R], [1, 4, B], [1, 6, B]]);
  var moves = M.legalMoves(b, 0);
  assert.deepStrictEqual(paths(moves), [sq(2, 3) + '>' + sq(0, 5)]);
  assert.strictEqual(moves[0].captures.length, 1);
  assert.ok(moves[0].promote);
  var s = M.play(M.newGame(0, b), moves[0]);
  assert.strictEqual(s.board[sq(0, 5)], RK);
  assert.strictEqual(s.board[sq(1, 6)], B, 'second blue man untouched');
  assert.strictEqual(s.turn, 1);
});

test('ฝ่ายฟ้าเดินลง และเป็นฮอสที่แถวล่างสุด', function () {
  var b = board([[6, 1, B], [0, 1, R]]);
  var mv = M.legalMoves(b, 1).filter(function (m) {
    return m.path[0] === sq(7, 0);
  })[0];
  assert.ok(mv, 'blue man can step down to 7,0');
  assert.strictEqual(M.applyMove(b, mv)[sq(7, 0)], BK);
});

/* ---------- ชนะ ---------- */
test('กินตัวสุดท้ายของอีกฝ่าย = ชนะ', function () {
  var b = board([[5, 2, R], [4, 3, B]]);
  var s = M.play(M.newGame(0, b), M.legalMoves(b, 0)[0]);
  assert.deepStrictEqual(s.over, { w: 0 });
});

test('อีกฝ่ายไม่มีตาเดิน (โดนขวางหมด) = ชนะ', function () {
  // ฟ้าเหลือเบี้ย 1 ตัวที่ 6,7 ทางลงเดียวคือ 7,6 · ฮอสแดงจาก 4,3 ไถลไปขวางที่ 7,6
  var b = board([[6, 7, B], [4, 3, RK]]);
  var mv = M.legalMoves(b, 0).filter(function (m) {
    return m.path[0] === sq(7, 6) && m.captures.length === 0;
  })[0];
  assert.ok(mv, 'red king can slide to 7,6');
  var s = M.play(M.newGame(0, b), mv);
  assert.strictEqual(M.legalMoves(s.board, 1).length, 0);
  assert.deepStrictEqual(s.over, { w: 0 });
});

/* ---------- เสมอเพราะตำแหน่งซ้ำ 3 ครั้ง ---------- */
test('ตำแหน่งเดิม + ฝ่ายเดินเดิม ซ้ำครบ 3 ครั้ง = เสมออัตโนมัติ', function () {
  var b = board([[7, 2, RK], [0, 5, BK]]);
  var s = M.newGame(0, b);
  var cycle = [
    [sq(7, 2), sq(6, 3)],
    [sq(0, 5), sq(1, 4)],
    [sq(6, 3), sq(7, 2)],
    [sq(1, 4), sq(0, 5)]
  ];
  var plies = 0;
  for (var round = 0; round < 2; round++) {
    for (var k = 0; k < cycle.length; k++) {
      var want = cycle[k];
      var mv = M.legalMoves(s.board, s.turn).filter(function (m) {
        return m.from === want[0] && m.path.length === 1 && m.path[0] === want[1];
      })[0];
      assert.ok(mv, 'move ' + want + ' should be legal');
      assert.strictEqual(s.over, null, 'no early draw at ply ' + plies);
      s = M.play(s, mv);
      plies++;
    }
  }
  assert.strictEqual(plies, 8);
  assert.deepStrictEqual(s.over, { draw: 'repetition' });
});

test('ตำแหน่งซ้ำแค่ 2 ครั้ง ยังไม่เสมอ', function () {
  var b = board([[7, 2, RK], [0, 5, BK]]);
  var s = M.newGame(0, b);
  var seq = [
    [sq(7, 2), sq(6, 3)],
    [sq(0, 5), sq(1, 4)],
    [sq(6, 3), sq(7, 2)],
    [sq(1, 4), sq(0, 5)]
  ];
  seq.forEach(function (want) {
    var mv = M.legalMoves(s.board, s.turn).filter(function (m) {
      return m.from === want[0] && m.path[0] === want[1];
    })[0];
    s = M.play(s, mv);
  });
  assert.strictEqual(s.rep[M.positionKey(s.board, s.turn)], 2);
  assert.strictEqual(s.over, null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
