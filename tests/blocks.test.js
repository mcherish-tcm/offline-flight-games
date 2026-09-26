/*
 * เทสกติกาบล็อกเติมแถว — รันด้วย:  node tests/blocks.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var B = require('../games/blocks/engine.js');
var N = B.N;

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

function fillRow(b, r, except) {
  for (var c = 0; c < N; c++) if (c !== except) b[r * N + c] = 1;
}

console.log('บล็อกเติมแถว — engine self-tests');

test('กระดาน 8×8 ว่าง · ทุกแบบชิ้นมีช่อง ไม่ใหญ่เกิน 5', function () {
  assert.strictEqual(N, 8);
  var b = B.emptyBoard();
  assert.strictEqual(b.length, 64);
  B.SHAPES.forEach(function (s) {
    assert.ok(s.cells.length >= 1 && s.h <= 5 && s.wd <= 5, s.k);
    assert.ok(B.fits(b, s.k), s.k + ' ต้องลงกระดานว่างได้');
  });
});

test('วางซ้อนช่องที่มีของ / เลยขอบ = ไม่ได้', function () {
  var b = B.emptyBoard();
  b[0] = 3;
  assert.ok(!B.canPlace(b, '2h', 0, 0));
  assert.ok(B.canPlace(b, '2h', 0, 1));
  assert.ok(!B.canPlace(b, '2h', 0, 7));
  assert.ok(!B.canPlace(b, '5v', 4, 0));
  assert.ok(!B.canPlace(b, '1', -1, 0));
});

test('เติมแถวนอนเต็ม = แถวหาย + คะแนน', function () {
  var b = B.emptyBoard();
  fillRow(b, 2, 7);
  var res = B.place(b, '1', 2, 7, 4, 0);
  assert.deepStrictEqual(res.rows, [2]);
  assert.deepStrictEqual(res.cols, []);
  assert.strictEqual(res.lines, 1);
  for (var c = 0; c < N; c++) assert.strictEqual(res.board[2 * N + c], -1);
  assert.strictEqual(res.points, 1 + 10);
  assert.strictEqual(b[2 * N + 0], 1, 'ไม่แก้กระดานเดิม');
});

test('แถวนอน + แถวตั้งหายพร้อมกัน (ช่องตัดนับครั้งเดียว) · คะแนนเพิ่มตามจำนวนเส้นยกกำลังสอง', function () {
  var b = B.emptyBoard();
  fillRow(b, 5, 3);
  for (var r = 0; r < N; r++) if (r !== 5) b[r * N + 3] = 2;
  var res = B.place(b, '1', 5, 3, 0, 0);
  assert.deepStrictEqual(res.rows, [5]);
  assert.deepStrictEqual(res.cols, [3]);
  assert.strictEqual(res.cleared, 15);
  assert.strictEqual(res.points, 1 + 10 * 4);
  assert.ok(res.board.every(function (v) { return v === -1; }));
});

test('ทำเส้นหายติดกันหลายตา (streak) ได้โบนัสเพิ่ม', function () {
  var b = B.emptyBoard();
  fillRow(b, 0, 0);
  assert.strictEqual(B.place(b, '1', 0, 0, 0, 2).points, 1 + 10 + 20);
  assert.strictEqual(B.place(B.emptyBoard(), '1', 0, 0, 0, 2).points, 1, 'ไม่หาย = ไม่มีโบนัส');
});

test('wouldClear บอกเส้นที่จะหายก่อนวางจริง', function () {
  var b = B.emptyBoard();
  fillRow(b, 7, 6);
  b[7 * N + 7] = -1;
  var w = B.wouldClear(b, '2h', 7, 6);
  assert.deepStrictEqual(w.rows, [7]);
});

test('ชุดใหม่ 3 ชิ้น · สีอยู่ใน 0–6 · มีอย่างน้อย 1 ชิ้นที่ลงได้เมื่อเป็นไปได้', function () {
  var rnd = B.rng(5);
  var b = B.emptyBoard();
  // เหลือช่องว่างช่องเดียว → ต้องได้ชิ้น 1 ช่องอย่างน้อย 1 ชิ้น (ถ้าสุ่มเจอภายใน 30 รอบ)
  for (var i = 0; i < 64; i++) b[i] = 1;
  b[27] = -1;
  var ok = 0;
  for (var t = 0; t < 50; t++) {
    var set = B.newSet(b, rnd);
    assert.strictEqual(set.length, 3);
    set.forEach(function (p) {
      assert.ok(B.shape(p.k));
      assert.ok(p.color >= 0 && p.color <= 6);
    });
    if (B.anyFits(b, set)) ok++;
  }
  assert.ok(ok >= 45, 'ส่วนใหญ่ต้องลงได้ (ได้ ' + ok + '/50)');
});

test('anyFits ข้ามชิ้นที่วางแล้ว (null) · กระดานเต็ม = ไม่มีที่ลง', function () {
  var b = B.emptyBoard();
  for (var i = 0; i < 64; i++) b[i] = 1;
  assert.ok(!B.anyFits(b, [null, { k: '1', color: 0 }, null]));
  b[10] = -1;
  assert.ok(B.anyFits(b, [null, { k: '1', color: 0 }, null]));
  assert.ok(!B.anyFits(b, [null, null, null]));
});

test('เล่นอัตโนมัติ 200 เกม: กระดานถูกต้องตลอด · คะแนนไม่ลด · จบเมื่อไม่มีชิ้นลงได้เท่านั้น', function () {
  var rnd = B.rng(77);
  for (var g = 0; g < 200; g++) {
    var b = B.emptyBoard();
    var set = B.newSet(b, rnd);
    var score = 0;
    var streak = 0;
    for (var step = 0; step < 400; step++) {
      if (!B.anyFits(b, set)) break;
      var moved = false;
      for (var k = 0; k < 3 && !moved; k++) {
        var p = set[k];
        if (!p) continue;
        for (var r = 0; r < N && !moved; r++) {
          for (var c = 0; c < N && !moved; c++) {
            if (!B.canPlace(b, p.k, r, c)) continue;
            var before = b.filter(function (v) { return v !== -1; }).length;
            var res = B.place(b, p.k, r, c, p.color, streak);
            var after = res.board.filter(function (v) { return v !== -1; }).length;
            assert.strictEqual(after, before + B.shape(p.k).cells.length - res.cleared);
            assert.ok(res.points >= B.shape(p.k).cells.length);
            score += res.points;
            streak = res.lines ? streak + 1 : 0;
            b = res.board;
            set[k] = null;
            moved = true;
          }
        }
      }
      assert.ok(moved);
      if (!set[0] && !set[1] && !set[2]) set = B.newSet(b, rnd);
    }
    assert.ok(score > 0);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
