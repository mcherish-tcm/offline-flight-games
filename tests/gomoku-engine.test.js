/*
 * เทสกติกาโกโมกุ — รันด้วย:  node tests/gomoku-engine.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
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
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}

var N = G.N;
function sq(r, c) {
  return r * N + c;
}

// เดินตามลำดับ (สลับฝ่ายเอง) แล้วคืนสถานะสุดท้าย
function playAll(starter, list) {
  var s = G.newGame(starter);
  list.forEach(function (rc) {
    var n = G.play(s, sq(rc[0], rc[1]));
    assert.ok(n, 'move ' + rc + ' should be legal');
    s = n;
  });
  return s;
}

console.log('โกโมกุ — engine self-tests');

test('กระดาน 15×15 ว่าง · แดงเริ่มได้', function () {
  var s = G.newGame(0);
  assert.strictEqual(s.board.length, 225);
  assert.strictEqual(s.turn, 0);
  assert.strictEqual(s.over, null);
});

test('วางซ้ำช่องที่มีหมากแล้วไม่ได้', function () {
  var s = playAll(0, [[7, 7]]);
  assert.strictEqual(G.play(s, sq(7, 7)), null);
});

test('เรียง 5 แนวนอน = ชนะ และคืนแนวที่ชนะ', function () {
  var s = playAll(0, [[7, 3], [0, 0], [7, 4], [0, 1], [7, 5], [0, 2], [7, 6], [0, 3], [7, 7]]);
  assert.strictEqual(s.over.w, 0);
  assert.deepStrictEqual(s.over.line, [sq(7, 3), sq(7, 4), sq(7, 5), sq(7, 6), sq(7, 7)]);
});

test('เรียง 5 แนวตั้ง และแนวทแยงทั้งสองทิศ = ชนะ', function () {
  var v = playAll(1, [[2, 9], [0, 0], [3, 9], [0, 2], [4, 9], [0, 4], [5, 9], [0, 6], [6, 9]]);
  assert.strictEqual(v.over.w, 1);
  var d1 = playAll(0, [[3, 3], [0, 14], [4, 4], [1, 14], [5, 5], [2, 14], [6, 6], [4, 14], [7, 7]]);
  assert.strictEqual(d1.over.w, 0);
  var d2 = playAll(0, [[2, 10], [14, 0], [3, 9], [14, 2], [4, 8], [14, 4], [5, 7], [14, 6], [6, 6]]);
  assert.strictEqual(d2.over.w, 0);
});

test('เรียง 4 ยังไม่ชนะ · มีเม็ดอีกฝ่ายคั่น ไม่นับต่อกัน', function () {
  var s = playAll(0, [[7, 3], [7, 7], [7, 4], [0, 0], [7, 5], [0, 1], [7, 6]]);
  assert.strictEqual(s.over, null);
  s = G.play(s, sq(1, 1)); // ฟ้า
  s = G.play(s, sq(7, 8)); // แดงวางอีกฝั่งของเม็ดฟ้า → ไม่ติดกัน
  assert.strictEqual(s.over, null);
});

test('แบบอิสระ: เรียง 6 (ต่อช่องว่างตรงกลาง) ก็นับชนะ', function () {
  // แดง 7,2 7,3 7,4 _ 7,6 7,7 → วาง 7,5 ได้เรียง 6
  var s = playAll(0, [[7, 2], [0, 0], [7, 3], [0, 2], [7, 4], [0, 4], [7, 6], [0, 6], [7, 7], [0, 8], [7, 5]]);
  assert.strictEqual(s.over.w, 0);
  assert.strictEqual(s.over.line.length, 6);
});

test('ชนะที่ขอบกระดาน (ไม่ล้นไปแถวถัดไป)', function () {
  // แนวนอนแถว 0 หลัก 10–14 ชนะ · แต่ 0,12..14 + 1,0..1 ห้ามนับเป็นแนวเดียวกัน
  var s = playAll(0, [[0, 12], [5, 5], [0, 13], [5, 7], [0, 14], [5, 9], [1, 0], [5, 11], [1, 1]]);
  assert.strictEqual(s.over, null, 'no wrap-around win');
  s = playAll(0, [[0, 10], [5, 5], [0, 11], [5, 7], [0, 12], [5, 9], [0, 13], [5, 11], [0, 14]]);
  assert.strictEqual(s.over.w, 0);
});

test('กระดานเต็มไม่มีใครเรียง 5 = เสมอ', function () {
  // ลาย "แดงแดงฟ้าฟ้า" เลื่อนทีละ 2 ช่องต่อแถว ไม่มีทางเรียง 5 · เว้นช่องสุดท้ายไว้ให้วาง
  var s = G.newGame(0);
  var b = s.board;
  for (var r = 0; r < N; r++) {
    for (var c = 0; c < N; c++) {
      b[sq(r, c)] = [0, 0, 1, 1][(c + 2 * r) % 4];
    }
  }
  var last = sq(14, 14);
  var who = b[last];
  b[last] = -1;
  s.moves = 224;
  s.turn = who;
  // ตรวจว่าลายนี้ไม่มีเรียง 5 จริง
  for (var i = 0; i < 225; i++) if (b[i] !== -1) assert.strictEqual(G.winLine(b, i, b[i]), null, 'pattern has no five at ' + i);
  s = G.play(s, last);
  assert.deepStrictEqual(s.over, { draw: true });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
