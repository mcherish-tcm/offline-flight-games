/*
 * เทสกติกาเรือรบ + คอม — รันด้วย:  node tests/battleship.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var B = require('../games/battleship/engine.js');

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

// กองเรือแบบรู้ตำแหน่ง: แต่ละลำแนวนอน อยู่แถว 0, 2, 4, 6, 8 ชิดซ้าย
function rowFleet() {
  return [0, 1, 2, 3, 4].map(function (k) {
    return { k: k, r: k * 2, c: 0, v: false };
  });
}

// ยิงจนจบด้วยคอมระดับ level → จำนวนนัดที่ใช้
function shotsToWin(level, seed) {
  var rnd = rng(seed);
  var side = B.newSide(B.randomFleet(rnd));
  var n = 0;
  var seen = {};
  while (!B.allSunk(side)) {
    var i = B.chooseShot(B.viewOf(side), B.remainingLens(side), level, rnd);
    assert.ok(i >= 0 && i < 100, 'ช่องยิงต้องอยู่ในกระดาน');
    assert.ok(!seen[i], 'คอมยิงซ้ำช่องเดิม ' + i);
    seen[i] = true;
    side = B.fire(side, i).side;
    n++;
    assert.ok(n <= 100, 'ยิงเกิน 100 นัด');
  }
  return n;
}

console.log('เรือรบ — engine self-tests');

test('กองเรือ 5 ลำ ยาว 5·4·3·3·2 รวม 17 ช่อง', function () {
  var lens = B.FLEET.map(function (f) {
    return f.len;
  });
  assert.deepStrictEqual(lens, [5, 4, 3, 3, 2]);
});

test('ป้ายช่อง: 0 = A1 · 9 = J1 · 99 = J10', function () {
  assert.strictEqual(B.label(0), 'A1');
  assert.strictEqual(B.label(9), 'J1');
  assert.strictEqual(B.label(99), 'J10');
  assert.strictEqual(B.label(23), 'D3');
});

test('ช่องของเรือ แนวนอน/แนวตั้ง ถูกต้อง', function () {
  assert.deepStrictEqual(B.cellsOf({ k: 4, r: 0, c: 0, v: false }), [0, 1]);
  assert.deepStrictEqual(B.cellsOf({ k: 2, r: 1, c: 5, v: true }), [15, 25, 35]);
});

test('ห้ามล้นกระดาน · ห้ามทับกัน · ติดกันได้', function () {
  assert.strictEqual(B.inBounds({ k: 0, r: 0, c: 6, v: false }), false); // 5 ช่องจาก F → เกิน J
  assert.strictEqual(B.inBounds({ k: 0, r: 0, c: 5, v: false }), true);
  assert.strictEqual(B.inBounds({ k: 0, r: 6, c: 0, v: true }), false);
  var ships = rowFleet();
  assert.strictEqual(B.canPlace(ships, { k: 4, r: 0, c: 3, v: true }), false, 'ทับเรือลำ 0 ที่แถว 0');
  assert.strictEqual(B.canPlace(ships, { k: 4, r: 1, c: 0, v: false }), true, 'แถว 1 ว่าง (ติดกันได้)');
  assert.strictEqual(B.validFleet(ships), true);
  var bad = rowFleet();
  bad[4] = { k: 4, r: 0, c: 0, v: false };
  assert.strictEqual(B.validFleet(bad), false);
});

test('สุ่มวางเรือ 300 ครั้ง ถูกกติกาทุกครั้ง', function () {
  var rnd = rng(7);
  for (var t = 0; t < 300; t++) assert.ok(B.validFleet(B.randomFleet(rnd)), 'ครั้งที่ ' + t);
});

test('ย้ายเรือ: ล้นขอบ = ดันกลับเข้ามา · ทับลำอื่น = null', function () {
  var ships = rowFleet();
  var moved = B.moveShip(ships, 4, 9, 9); // เรือพิฆาตแนวนอนที่ J10 → ดันเป็น I10–J10
  assert.ok(moved);
  assert.deepStrictEqual(B.cellsOf(moved[4]), [98, 99]);
  assert.strictEqual(B.moveShip(ships, 4, 0, 3), null);
  assert.ok(B.validFleet(moved));
});

test('หมุนเรือรอบหัวเรือ · ชิดขอบล่างแล้วหมุน = ดันขึ้น', function () {
  var ships = rowFleet();
  ships = B.moveShip(ships, 4, 9, 5); // แถวล่างสุด F10–G10
  var r = B.rotateShip(ships, 4);
  assert.ok(r);
  assert.strictEqual(r[4].v, true);
  assert.deepStrictEqual(B.cellsOf(r[4]), [85, 95]);
  // หมุนเรือลำ 0 (แถว 0 A–E) ลงแนวตั้งจะทับลำ 1 ที่แถว 2
  assert.strictEqual(B.rotateShip(rowFleet(), 0), null);
});

test('ยิง: พลาด / โดน / จม / ยิงซ้ำ', function () {
  var side = B.newSide(rowFleet());
  var r = B.fire(side, 10); // แถว 1 = น้ำ
  assert.strictEqual(r.result, 'miss');
  r = B.fire(r.side, 80); // เรือพิฆาต แถว 8
  assert.strictEqual(r.result, 'hit');
  assert.strictEqual(r.k, 4);
  var again = B.fire(r.side, 80);
  assert.strictEqual(again.result, 'repeat');
  r = B.fire(r.side, 81);
  assert.strictEqual(r.result, 'sunk');
  assert.strictEqual(r.k, 4);
  assert.strictEqual(B.sunkCount(r.side), 1);
  assert.strictEqual(B.allSunk(r.side), false);
  assert.strictEqual(side.shots[80], 0, 'ฝั่งเดิมไม่ถูกแก้ (ไม่มีผลข้างเคียง)');
});

test('ยิงโดนครบทุกช่อง = จมหมด', function () {
  var side = B.newSide(rowFleet());
  rowFleet().forEach(function (s) {
    B.cellsOf(s).forEach(function (i) {
      side = B.fire(side, i).side;
    });
  });
  assert.strictEqual(B.allSunk(side), true);
});

test('เกมกับคอม: วางเรือแล้วเริ่มยิงทันที คอมได้กองเรือสุ่มที่ถูกกติกา', function () {
  var g = B.newGame({ ai: true, level: 2, starter: 0 });
  assert.strictEqual(B.ready(g, [{ k: 0, r: 0, c: 0, v: false }]), null, 'เรือไม่ครบห้ามเริ่ม');
  g = B.ready(g, rowFleet(), rng(3));
  assert.strictEqual(g.phase, 'play');
  assert.strictEqual(g.turn, 0);
  assert.ok(B.validFleet(g.sides[1].ships));
});

test('เกม 2 คน: แดงวางก่อน แล้วฟ้าวาง แล้วคนเริ่มได้ยิง', function () {
  var g = B.newGame({ ai: false, starter: 1 });
  g = B.ready(g, rowFleet());
  assert.strictEqual(g.phase, 'place');
  assert.strictEqual(g.placing, 1);
  g = B.ready(g, B.randomFleet(rng(9)));
  assert.strictEqual(g.phase, 'play');
  assert.strictEqual(g.turn, 1);
});

function started(rule) {
  var g = B.newGame({ ai: false, rule: rule, starter: 0 });
  g = B.ready(g, rowFleet());
  return B.ready(g, rowFleet());
}

test('กติกา "ผลัดกันนัดละครั้ง": โดนแล้วก็เปลี่ยนตา', function () {
  var g = started('alt');
  var r = B.play(g, 0); // โดนเรือลำ 0 ของฟ้า
  assert.strictEqual(r.result, 'hit');
  assert.strictEqual(r.again, false);
  assert.strictEqual(r.g.turn, 1);
  assert.strictEqual(r.g.last[1], 0);
  assert.strictEqual(B.play(r.g, 0).result, 'hit', 'ฟ้ายิงฝั่งแดงช่องเดียวกันได้ (คนละกระดาน)');
});

test('กติกา "ยิงโดนได้ยิงต่อ": โดน/จม = ยิงต่อ · พลาด = เปลี่ยนตา', function () {
  var g = started('chain');
  var r = B.play(g, 80);
  assert.strictEqual(r.again, true);
  assert.strictEqual(r.g.turn, 0);
  r = B.play(r.g, 81);
  assert.strictEqual(r.result, 'sunk');
  assert.strictEqual(r.again, true);
  r = B.play(r.g, 10);
  assert.strictEqual(r.result, 'miss');
  assert.strictEqual(r.g.turn, 1);
  assert.deepStrictEqual(r.g.shots, [3, 0]);
  assert.deepStrictEqual(r.g.hits, [2, 0]);
});

test('ยิงช่องเดิมซ้ำ = ไม่นับ (คืน null) · จมครบ = จบเกม มีผู้ชนะ', function () {
  var g = started('chain');
  var r = B.play(g, 0); // แดงโดน → ยิงต่อ
  assert.strictEqual(r.g.turn, 0);
  assert.strictEqual(B.play(r.g, 0), null, 'แดงยิงช่องเดิมซ้ำไม่ได้');
  var g2 = started('chain');
  var res = null;
  rowFleet().forEach(function (s) {
    B.cellsOf(s).forEach(function (i) {
      res = B.play(g2, i);
      g2 = res.g;
    });
  });
  assert.strictEqual(res.over, true);
  assert.strictEqual(g2.phase, 'over');
  assert.strictEqual(g2.winner, 0);
  assert.strictEqual(B.play(g2, 50), null, 'จบแล้วยิงต่อไม่ได้');
});

test('มุมมองคนยิง: เรือที่จมแล้วเปิดเผยเป็น 3 · ช่องโดนที่ยังไม่จม = 2', function () {
  var side = B.newSide(rowFleet());
  side = B.fire(side, 80).side;
  side = B.fire(side, 81).side; // จมเรือพิฆาต
  side = B.fire(side, 60).side; // โดนเรือดำน้ำ
  var v = B.viewOf(side);
  assert.strictEqual(v[80], 3);
  assert.strictEqual(v[81], 3);
  assert.strictEqual(v[60], 2);
  assert.deepStrictEqual(B.remainingLens(side), [5, 4, 3, 3]);
});

test('คอมยาก: มีช่องโดนค้าง = ยิงช่องติดกันเสมอ', function () {
  var rnd = rng(11);
  for (var t = 0; t < 50; t++) {
    var side = B.newSide(B.randomFleet(rnd));
    // หาช่องเรือสักช่องแล้วยิงให้โดน
    var cell = B.cellsOf(side.ships[0])[2];
    side = B.fire(side, cell).side;
    var i = B.chooseShot(B.viewOf(side), B.remainingLens(side), 2, rnd);
    var d = Math.abs(i - cell);
    assert.ok(d === 1 || d === 10, 'ช่องที่เลือก ' + i + ' ไม่ติดกับช่องโดน ' + cell);
  }
});

test('คอมทั้ง 2 ระดับไม่ยิงซ้ำ และยิงจนจมครบได้เสมอ', function () {
  for (var s = 1; s <= 20; s++) {
    shotsToWin(1, s);
    shotsToWin(2, s * 31);
  }
});

test('คอมยากใช้นัดน้อยกว่าคอมง่ายชัดเจน (เฉลี่ย 60 เกม)', function () {
  var easy = 0;
  var hard = 0;
  var games = 60;
  for (var s = 1; s <= games; s++) {
    easy += shotsToWin(1, 1000 + s);
    hard += shotsToWin(2, 5000 + s);
  }
  easy /= games;
  hard /= games;
  console.log('       เฉลี่ย: ง่าย ' + easy.toFixed(1) + ' นัด · ยาก ' + hard.toFixed(1) + ' นัด');
  assert.ok(hard < 62, 'คอมยากใช้นัดเฉลี่ยเยอะไป: ' + hard);
  assert.ok(easy - hard > 15, 'ง่ายกับยากต่างกันน้อยไป');
});

test('aiShot เล็งฝั่งตรงข้ามคนที่ถึงตา', function () {
  var g = B.newGame({ ai: true, level: 2, starter: 1 });
  g = B.ready(g, rowFleet(), rng(4));
  assert.strictEqual(g.turn, 1);
  var i = B.aiShot(g, rng(5));
  var r = B.play(g, i);
  assert.ok(r, 'ยิงได้');
  assert.strictEqual(r.g.last[0], i, 'คอมยิงใส่ฝั่งแดง (0)');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
