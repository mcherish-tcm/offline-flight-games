/*
 * เทสภาพปริศนาเติมช่อง (ตัวแก้ + คลังภาพ) — รันด้วย:  node tests/nonogram.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var S = require('../games/nonogram/solver.js');
var PUZZLES = require('../games/nonogram/puzzles.js');

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

var THAI = /[฀-๿]/;

// --- ตัวเลขใบ้ ---

test('clues: แถว/คอลัมน์ของภาพเล็ก', function () {
  var c = S.clues(['###.#', '.....', '#.#.#']);
  assert.deepStrictEqual(c.rows, [[3, 1], [], [1, 1, 1]]);
  assert.deepStrictEqual(c.cols, [[1, 1], [1], [1, 1], [], [1, 1]]);
});

test('clues: เต็มทั้งแถว และคอลัมน์ต่อเนื่อง', function () {
  var c = S.clues(['##', '##', '#.']);
  assert.deepStrictEqual(c.rows, [[2], [2], [1]]);
  assert.deepStrictEqual(c.cols, [[3], [2]]);
});

test('lineClue: รับได้ทั้ง string และ array 1/0', function () {
  assert.deepStrictEqual(S.lineClue('.##..#'), [2, 1]);
  assert.deepStrictEqual(S.lineClue([1, 1, 0, 1]), [2, 1]);
  assert.deepStrictEqual(S.lineClue([0, 0, 0]), []);
});

// --- ตัวแก้ทีละแถว ---

test('solveLine: ส่วนทับกันของบล็อกยาวต้องถม', function () {
  // ยาว 5 บล็อก 4 → ช่อง 1-3 แน่นอน
  assert.deepStrictEqual(S.solveLine([-1, -1, -1, -1, -1], [4]), [-1, 1, 1, 1, -1]);
});

test('solveLine: แถวว่าง = ว่างทุกช่อง · เต็มพอดี = ถมทุกช่อง', function () {
  assert.deepStrictEqual(S.solveLine([-1, -1, -1], []), [0, 0, 0]);
  assert.deepStrictEqual(S.solveLine([-1, -1, -1, -1, -1], [2, 2]), [1, 1, 0, 1, 1]);
});

test('solveLine: ขัดแย้ง → null', function () {
  assert.strictEqual(S.solveLine([1, 1, 1], [1]), null);
  assert.strictEqual(S.solveLine([-1, -1], [3]), null);
});

test('solve: 2x2 แนวทแยง ตอบได้สองแบบ → solved:false', function () {
  var c = S.clues(['#.', '.#']);
  var r = S.solve(c.rows, c.cols);
  assert.strictEqual(r.solved, false);
  assert.strictEqual(r.contradiction, false);
  assert.deepStrictEqual(r.grid, [[-1, -1], [-1, -1]]);
});

test('solve: ตัวเลขใบ้ขัดกันเอง → contradiction', function () {
  var r = S.solve([[2], [2]], [[1], [1]]);
  assert.strictEqual(r.contradiction, true);
  assert.strictEqual(r.solved, false);
});

test('check: ตรง/ไม่ตรงตัวเลขใบ้ · กระดานยังไม่ครบ = false', function () {
  var c = S.clues(['#.', '##']);
  assert.strictEqual(S.check(c.rows, c.cols, [[1, 0], [1, 1]]), true);
  assert.strictEqual(S.check(c.rows, c.cols, [[0, 1], [1, 1]]), false);
  assert.strictEqual(S.check(c.rows, c.cols, [[1, -1], [1, 1]]), false);
});

// --- คลังภาพ ---

var MIN = { 5: 10, 10: 12, 15: 8 };

test('คลังภาพ: จำนวนต่อขนาดถึงขั้นต่ำ (5x5 ≥10 · 10x10 ≥12 · 15x15 ≥8)', function () {
  var cnt = { 5: 0, 10: 0, 15: 0 };
  PUZZLES.forEach(function (p) {
    assert.ok(cnt.hasOwnProperty(p.size), p.id + ' ขนาดแปลก: ' + p.size);
    cnt[p.size]++;
  });
  Object.keys(MIN).forEach(function (k) {
    assert.ok(cnt[k] >= MIN[k], k + 'x' + k + ' มีแค่ ' + cnt[k]);
  });
  assert.ok(PUZZLES.length >= 30);
});

test('คลังภาพ: id ไม่ซ้ำ · ชื่อเป็นภาษาไทย · เรียงขนาดเล็กไปใหญ่', function () {
  var seen = {};
  var last = 0;
  PUZZLES.forEach(function (p) {
    assert.ok(!seen[p.id], 'id ซ้ำ: ' + p.id);
    seen[p.id] = true;
    assert.ok(typeof p.name === 'string' && p.name.trim().length > 0, p.id + ' ไม่มีชื่อ');
    assert.ok(THAI.test(p.name), p.id + ' ชื่อไม่ใช่ภาษาไทย');
    assert.ok(p.size >= last, p.id + ' เรียงขนาดสลับ');
    last = p.size;
  });
});

PUZZLES.forEach(function (p) {
  test(p.id + ' ' + p.name + ': ขนาด · สัดส่วนถม · แก้ได้แบบเดียวด้วยตรรกะทีละแถว · check()', function () {
    assert.strictEqual(p.rows.length, p.size, 'จำนวนแถว');
    var filled = 0;
    p.rows.forEach(function (r, i) {
      assert.strictEqual(r.length, p.size, 'แถว ' + i + ' ยาวไม่ตรง');
      assert.ok(/^[#.]+$/.test(r), 'แถว ' + i + ' มีตัวอักษรแปลก');
      filled += r.split('#').length - 1;
    });
    var ratio = filled / (p.size * p.size);
    assert.ok(ratio >= 0.25 && ratio <= 0.8, 'สัดส่วนถม ' + ratio.toFixed(2));

    var c = S.clues(p.rows);
    var res = S.solve(c.rows, c.cols);
    var pic = S.toGrid(p.rows);
    assert.strictEqual(res.contradiction, false, 'ขัดแย้ง');
    assert.strictEqual(res.solved, true, 'ตัวแก้ทีละแถวไปไม่ถึงคำตอบ (ต้องเดา)');
    assert.deepStrictEqual(res.grid, pic, 'คำตอบไม่ตรงภาพ');

    assert.strictEqual(S.check(c.rows, c.cols, pic), true, 'check ภาพจริงต้องผ่าน');
    var flipped = pic.map(function (row) {
      return row.slice();
    });
    var mid = Math.floor(p.size / 2);
    flipped[mid][mid] = 1 - flipped[mid][mid];
    assert.strictEqual(S.check(c.rows, c.cols, flipped), false, 'สลับ 1 ช่องแล้วต้องไม่ผ่าน');
    flipped[mid][mid] = 1 - flipped[mid][mid];
    flipped[0][0] = 1 - flipped[0][0];
    assert.strictEqual(S.check(c.rows, c.cols, flipped), false, 'สลับมุมแล้วต้องไม่ผ่าน');
  });
});

test('ความเร็ว: แก้ 15x15 ทุกภาพ เฉลี่ย < 50 ms', function () {
  var big = PUZZLES.filter(function (p) {
    return p.size === 15;
  });
  var t0 = Date.now();
  big.forEach(function (p) {
    var c = S.clues(p.rows);
    S.solve(c.rows, c.cols);
  });
  var avg = (Date.now() - t0) / big.length;
  assert.ok(avg < 50, 'เฉลี่ย ' + avg.toFixed(1) + ' ms');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
