/*
 * เทสกติกาโอเทลโล — รันด้วย:  node tests/othello-engine.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var O = require('../games/othello/engine.js');

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
  return r * 8 + c;
}

function empty() {
  var b = [];
  for (var i = 0; i < 64; i++) b.push(-1);
  return b;
}

function board(pieces) {
  var b = empty();
  pieces.forEach(function (p) {
    b[sq(p[0], p[1])] = p[2];
  });
  return b;
}

function cells(moves) {
  return moves
    .map(function (m) {
      return m.i;
    })
    .sort(function (a, b) {
      return a - b;
    });
}

console.log('โอเทลโล — engine self-tests');

test('กระดานเริ่ม: 4 เม็ดกลาง ฝ่ายละ 2 · ช่องลงได้ตาแรก 4 ช่อง (ทั้งสองฝ่าย)', function () {
  var b = O.initialBoard();
  assert.strictEqual(O.count(b, 0), 2);
  assert.strictEqual(O.count(b, 1), 2);
  assert.strictEqual(b[sq(3, 3)], 1);
  assert.strictEqual(b[sq(4, 4)], 1);
  assert.strictEqual(b[sq(3, 4)], 0);
  assert.strictEqual(b[sq(4, 3)], 0);
  // แดง (มี e4, d5) ลงได้ที่ d3, c4, f5, e6
  assert.deepStrictEqual(cells(O.legalMoves(b, 0)), [sq(2, 3), sq(3, 2), sq(4, 5), sq(5, 4)].sort(function (a, b) { return a - b; }));
  assert.strictEqual(O.legalMoves(b, 1).length, 4);
});

test('ลงแล้วพลิกเม็ดที่ถูกหนีบ', function () {
  var s = O.newGame(0);
  s = O.play(s, sq(2, 3)); // แดงลง d3 หนีบ d4
  assert.ok(s);
  assert.strictEqual(s.board[sq(2, 3)], 0);
  assert.strictEqual(s.board[sq(3, 3)], 0, 'd4 flipped');
  assert.strictEqual(O.count(s.board, 0), 4);
  assert.strictEqual(O.count(s.board, 1), 1);
  assert.strictEqual(s.turn, 1);
  assert.deepStrictEqual(s.last.flips, [sq(3, 3)]);
});

test('ลงช่องที่ไม่หนีบอะไร = ลงไม่ได้ (play คืน null)', function () {
  var s = O.newGame(0);
  assert.strictEqual(O.play(s, sq(0, 0)), null);
  assert.strictEqual(O.play(s, sq(3, 3)), null, 'occupied');
});

test('พลิกได้หลายทิศพร้อมกัน และหลายเม็ดต่อแนว', function () {
  // แดงลงที่ (4,4): หนีบแนวนอน 2 เม็ด (4,2)-(4,3) ถึง (4,1) · แนวตั้ง (3,4) ถึง (2,4) · ทแยง (3,3) ถึง (2,2)
  var b = board([
    [4, 1, 0], [4, 2, 1], [4, 3, 1],
    [2, 4, 0], [3, 4, 1],
    [2, 2, 0], [3, 3, 1],
    [5, 5, 1] // ไม่มีแดงปิดท้าย → ไม่พลิก
  ]);
  var f = O.flipsFor(b, sq(4, 4), 0).sort(function (a, c) { return a - c; });
  assert.deepStrictEqual(f, [sq(3, 3), sq(3, 4), sq(4, 2), sq(4, 3)].sort(function (a, c) { return a - c; }));
});

test('ไม่มีช่องลง = ข้ามตาอัตโนมัติ (passed บอกว่าใครข้าม)', function () {
  // ฟ้า (4,0) ชิดขอบ แดงหนีบไม่ได้ · ฟ้า (2,2) แดง (2,3) ว่าง (2,4) → ฟ้าลง (2,4) พลิก (2,3)
  // หลังจากนั้นแดงเหลือ (4,1) ตัวเดียว ไม่มีช่องลง · แต่ฟ้ายังลง (4,2) หนีบ (4,1) ได้ → แดงต้องข้ามตา
  var b = board([[4, 0, 1], [4, 1, 0], [2, 2, 1], [2, 3, 0]]);
  var s = { board: b, turn: 1, over: null, last: null, passed: null };
  s = O.play(s, sq(2, 4));
  assert.strictEqual(s.over, null);
  assert.strictEqual(s.passed, 0, 'red must pass');
  assert.strictEqual(s.turn, 1, 'blue moves again');
  s = O.play(s, sq(4, 2)); // ฟ้าหนีบตัวสุดท้าย → แดงหมดกระดาน จบเกม
  assert.deepStrictEqual(s.over, { w: 1 });
});

test('ทั้งสองฝ่ายไม่มีช่องลง = จบเกม นับเม็ด', function () {
  var b = board([[0, 0, 0], [0, 1, 1]]);
  var s = { board: b, turn: 0, over: null, last: null, passed: null };
  s = O.play(s, sq(0, 2)); // แดงหนีบ (0,1) → ฟ้าหมดกระดาน
  assert.deepStrictEqual(s.over, { w: 0 });
  assert.strictEqual(O.count(s.board, 0), 3);
});

test('กระดานเต็ม นับเท่ากัน = เสมอ', function () {
  var b = [];
  for (var i = 0; i < 64; i++) b.push(i < 32 ? 0 : 1);
  b[63] = -1;
  b[62] = 0; // ให้แดงลง 63 ไม่ได้ ฟ้าลงได้ไหม? ฟ้า 63 หนีบ 62 ด้วย 61(ฟ้า) → ได้
  var s = { board: b, turn: 1, over: null, last: null, passed: null };
  var mv = O.legalMoves(b, 1);
  assert.ok(mv.length === 1 && mv[0].i === 63);
  s = O.play(s, 63);
  assert.ok(s.over, 'board full = over');
  var a = O.count(s.board, 0);
  var c = O.count(s.board, 1);
  assert.strictEqual(a + c, 64);
  assert.deepStrictEqual(s.over, a === c ? { draw: true } : { w: a > c ? 0 : 1 });
});

test('settle: สถานะค้างที่ถึงตาคนไม่มีช่องลง → ข้ามให้เอง', function () {
  // แดง (4,1) ลงไม่ได้ (ฟ้า (4,0) ชิดขอบ) · ฟ้าลง (4,2) ได้ → ข้ามตาแดง
  var s = O.settle({ board: board([[4, 0, 1], [4, 1, 0]]), turn: 0, over: null, last: null, passed: null });
  assert.strictEqual(s.over, null);
  assert.strictEqual(s.passed, 0);
  assert.strictEqual(s.turn, 1);
  // ไม่มีใครลงได้เลย → จบเกม นับเม็ด 1:1 = เสมอ
  var t = O.settle({ board: board([[0, 0, 0], [7, 7, 1]]), turn: 0, over: null, last: null, passed: null });
  assert.deepStrictEqual(t.over, { draw: true });
});

test('เล่นสุ่มจนจบ 30 เกม: ทุกตาถูกกติกา และจบด้วยนับเม็ดถูกต้อง', function () {
  var seed = 7;
  function rnd() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  for (var g = 0; g < 30; g++) {
    var s = O.newGame(g % 2);
    var plies = 0;
    while (!s.over) {
      var mv = O.legalMoves(s.board, s.turn);
      assert.ok(mv.length, 'side to move always has a move');
      s = O.play(s, mv[Math.floor(rnd() * mv.length)].i);
      plies++;
      assert.ok(plies <= 60);
    }
    var a = O.count(s.board, 0);
    var c = O.count(s.board, 1);
    assert.ok(!O.hasMove(s.board, 0) && !O.hasMove(s.board, 1));
    assert.deepStrictEqual(s.over, a === c ? { draw: true } : { w: a > c ? 0 : 1 });
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
