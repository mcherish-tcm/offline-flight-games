/*
 * เทสกติกาฟรีเซลล์ + สไปเดอร์ — รันด้วย:  node tests/cards-engine.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var F = require('../games/freecell/engine.js');
var P = require('../games/spider/engine.js');

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

// 'JD' → id (ดอก 0 โพดำ S · 1 โพแดง H · 2 ข้าวหลามตัด D · 3 ดอกจิก C)
function card(txt) {
  var r = 'A23456789TJQK'.indexOf(txt[0]) + 1;
  var s = 'SHDC'.indexOf(txt[1]);
  return s * 13 + r - 1;
}

function emptyFC() {
  return { cols: [[], [], [], [], [], [], [], []], cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] };
}

console.log('ฟรีเซลล์ — engine self-tests');

test('แจกเกม #1 ตรงตามมาตรฐาน (แถวบน + แถวล่างสุด)', function () {
  var S = F.deal(1);
  var row0 = 'JD 2D 9H JC 5D 7H 7C 5H'.split(' ').map(card);
  var row6 = '6S 9C 2H 6H'.split(' ').map(card);
  for (var c = 0; c < 8; c++) assert.strictEqual(S.cols[c][0], row0[c], 'แถวบน คอลัมน์ ' + c);
  for (c = 0; c < 4; c++) assert.strictEqual(S.cols[c][6], row6[c], 'แถวล่าง คอลัมน์ ' + c);
});

test('แจกเกม #617 ตรงตามมาตรฐาน', function () {
  var S = F.deal(617);
  var row0 = '7D AD 5C 3S 5S 8C 2D AH'.split(' ').map(card);
  for (var c = 0; c < 8; c++) assert.strictEqual(S.cols[c][0], row0[c]);
});

test('แจก: 52 ใบไม่ซ้ำ · แถว 7,7,7,7,6,6,6,6 · ช่องพัก/กองว่าง', function () {
  for (var n = 1; n <= 200; n += 13) {
    var S = F.deal(n);
    var all = [].concat.apply([], S.cols).sort(function (a, b) {
      return a - b;
    });
    assert.strictEqual(all.length, 52);
    for (var i = 0; i < 52; i++) assert.strictEqual(all[i], i);
    assert.deepStrictEqual(
      S.cols.map(function (c) {
        return c.length;
      }),
      [7, 7, 7, 7, 6, 6, 6, 6]
    );
  }
});

test('สุ่มเลขเกม: อยู่ใน 1–32000 และไม่เคยได้เกม 11982', function () {
  var seq = [11982 / 32000 - 1 / 64000, 0.5];
  var k = 0;
  var n = F.randomDealNumber(function () {
    return seq[k++];
  });
  assert.strictEqual(n, 16001);
  for (var i = 0; i < 500; i++) {
    var m = F.randomDealNumber();
    assert.ok(m >= 1 && m <= 32000 && m !== 11982);
  }
});

test('ต่อไพ่ในแถว: สีสลับ + แต้มน้อยกว่า 1', function () {
  assert.ok(F.stacks(card('9H'), card('TS')));
  assert.ok(!F.stacks(card('9S'), card('TC')));
  assert.ok(!F.stacks(card('8H'), card('TS')));
});

test('ช่องพักรับได้ใบเดียว และต้องว่าง', function () {
  var S = emptyFC();
  S.cols[0] = [card('KS'), card('QH')];
  S.cells[0] = card('2C');
  assert.ok(F.legal(S, { t: 'col', i: 0 }, 1, { t: 'cell', i: 1 }));
  assert.ok(!F.legal(S, { t: 'col', i: 0 }, 1, { t: 'cell', i: 0 }));
  assert.ok(!F.legal(S, { t: 'col', i: 0 }, 2, { t: 'cell', i: 1 }));
});

test('ขึ้นกอง: ต้องเริ่มจาก A แล้วเรียงทีละ 1 ดอกเดียวกัน', function () {
  var S = emptyFC();
  S.cols[0] = [card('2H')];
  S.cols[1] = [card('AH')];
  assert.ok(!F.legal(S, { t: 'col', i: 0 }, 1, { t: 'found' }));
  S = F.apply(S, { t: 'col', i: 1 }, 1, { t: 'found' });
  assert.strictEqual(S.found[1], 1);
  assert.ok(F.legal(S, { t: 'col', i: 0 }, 1, { t: 'found' }));
});

test('ย้ายหลายใบ = (ช่องพักว่าง+1) × 2^แถวว่าง · ไปแถวว่างไม่นับแถวนั้น', function () {
  var S = emptyFC();
  S.cols[0] = [card('KS'), card('QH'), card('JS'), card('TH'), card('9S'), card('8H')];
  S.cols[1] = [card('9C')];
  for (var i = 2; i < 8; i++) S.cols[i] = [card(['2C', '3C', '4C', '5C', '6C', '7C'][i - 2])];
  S.cells = [card('2S'), card('3S'), -1, -1]; // ว่าง 2 ช่อง · แถวว่าง 0
  assert.strictEqual(F.maxMove(S, false), 3);
  assert.ok(F.legal(S, { t: 'col', i: 0 }, 1, { t: 'col', i: 1 }));
  S.cols[7] = [];
  assert.strictEqual(F.maxMove(S, false), 6);
  assert.strictEqual(F.maxMove(S, true), 3);
  assert.ok(F.legal(S, { t: 'col', i: 0 }, 3, { t: 'col', i: 7 }));
  assert.ok(!F.legal(S, { t: 'col', i: 0 }, 4, { t: 'col', i: 7 }));
  // กลุ่มที่ไม่เรียงย้ายไม่ได้
  S.cols[2] = [card('5H'), card('4H')];
  assert.ok(!F.legal(S, { t: 'col', i: 2 }, 2, { t: 'col', i: 7 }));
});

test('ขึ้นกองอัตโนมัติเฉพาะใบที่ปลอดภัย', function () {
  var S = emptyFC();
  S.found = [2, 0, 0, 2]; // ♠2 ♣2 · ♥♦ ยังไม่มี
  S.cols[0] = [card('3S')];
  assert.ok(!F.safeToFound(S, card('3S')), '3♠ ยังอาจต้องใช้รอง 2 แดง');
  S.found = [2, 2, 2, 2];
  assert.ok(F.safeToFound(S, card('3S')));
  var m = F.nextAuto(S);
  assert.deepStrictEqual(m.from, { t: 'col', i: 0 });
  S.cols[0] = [];
  S.cells[2] = card('AD');
  S.found = [0, 0, 0, 0];
  m = F.nextAuto(S);
  assert.deepStrictEqual(m.from, { t: 'cell', i: 2 });
});

test('แตะไพ่: ขึ้นกองก่อน → ต่อบนแถว → แถวว่าง → ช่องพัก', function () {
  var S = emptyFC();
  S.cols[0] = [card('5D'), card('AH')];
  assert.deepStrictEqual(F.bestMove(S, { t: 'col', i: 0 }, 1), { t: 'found' });
  S.cols[0] = [card('5D'), card('9H')];
  S.cols[3] = [card('TS')];
  S.cols[4] = [];
  assert.deepStrictEqual(F.bestMove(S, { t: 'col', i: 0 }, 1), { t: 'col', i: 3 });
  S.cols[3] = [card('TH')];
  assert.deepStrictEqual(F.bestMove(S, { t: 'col', i: 0 }, 1).t, 'col');
  for (var i = 1; i < 8; i++) S.cols[i] = [card(['2C', '3C', '4C', '5C', '6C', '7C', '8C'][i - 1])];
  assert.deepStrictEqual(F.bestMove(S, { t: 'col', i: 0 }, 1), { t: 'cell', i: 0 });
});

test('ชนะ: ทุกกองครบ 13', function () {
  var S = emptyFC();
  S.found = [13, 13, 13, 12];
  S.cols[5] = [card('KC')];
  assert.ok(!F.isWon(S));
  S = F.apply(S, { t: 'col', i: 5 }, 1, { t: 'found' });
  assert.ok(F.isWon(S));
});

test('เล่นสุ่ม 3,000 ตา: ไพ่ครบ 52 ไม่หาย ไม่ซ้ำ · apply ไม่แก้สถานะเดิม', function () {
  var seed = 7;
  function rnd() {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  }
  var S = F.deal(12345);
  for (var step = 0; step < 3000; step++) {
    var opts = [];
    for (var c = 0; c < 8; c++) {
      var col = S.cols[c];
      for (var n = 1; n <= col.length && F.isRun(col, col.length - n); n++) {
        var from = { t: 'col', i: c };
        var to = F.bestMove(S, from, n);
        if (to) opts.push([from, n, to]);
      }
    }
    for (var i = 0; i < 4; i++) {
      if (S.cells[i] !== -1) {
        var t2 = F.bestMove(S, { t: 'cell', i: i }, 1);
        if (t2) opts.push([{ t: 'cell', i: i }, 1, t2]);
      }
    }
    if (!opts.length) break;
    var o = opts[Math.floor(rnd() * opts.length)];
    var before = JSON.stringify(S);
    assert.ok(F.legal(S, o[0], o[1], o[2]));
    var T = F.apply(S, o[0], o[1], o[2]);
    assert.strictEqual(JSON.stringify(S), before);
    S = T;
    var seen = {};
    var count = 0;
    S.cols.forEach(function (col) {
      col.forEach(function (id) {
        assert.ok(!seen[id]);
        seen[id] = 1;
        count++;
      });
    });
    S.cells.forEach(function (id) {
      if (id !== -1) {
        assert.ok(!seen[id]);
        seen[id] = 1;
        count++;
      }
    });
    count += S.found[0] + S.found[1] + S.found[2] + S.found[3];
    assert.strictEqual(count, 52);
  }
});

console.log('\nสไปเดอร์ — engine self-tests');

test('แจก: 104 ใบไม่ซ้ำ · แถว 6,6,6,6,5×6 · หงายใบบนสุด · กองแจก 50', function () {
  [1, 2, 4].forEach(function (suits) {
    var S = P.deal(suits, 99);
    var all = [].concat.apply([], S.cols).concat(S.stock).sort(function (a, b) {
      return a - b;
    });
    assert.strictEqual(all.length, 104);
    for (var i = 0; i < 104; i++) assert.strictEqual(all[i], i);
    assert.deepStrictEqual(
      S.cols.map(function (c) {
        return c.length;
      }),
      [6, 6, 6, 6, 5, 5, 5, 5, 5, 5]
    );
    assert.deepStrictEqual(S.down, [5, 5, 5, 5, 4, 4, 4, 4, 4, 4]);
    assert.strictEqual(S.stock.length, 50);
  });
});

test('seed เดียวกัน = แจกเหมือนกัน', function () {
  assert.deepStrictEqual(P.deal(2, 42), P.deal(2, 42));
});

test('จำนวนดอกตามโหมด: 1 ดอก = โพดำล้วน · 2 ดอก = โพดำ/โพแดงอย่างละ 52 · 4 ดอก = ดอกละ 26', function () {
  var cnt = function (suits) {
    var c = [0, 0, 0, 0];
    for (var id = 0; id < 104; id++) c[P.suitOf(suits, id)]++;
    return c;
  };
  assert.deepStrictEqual(cnt(1), [104, 0, 0, 0]);
  assert.deepStrictEqual(cnt(2), [52, 52, 0, 0]);
  assert.deepStrictEqual(cnt(4), [26, 26, 26, 26]);
});

// สร้างสถานะเอง: cols = array ของ [แต้ม, ดอก] ที่หงายทั้งหมด (โหมด 4 ดอก)
function sp(colsSpec) {
  var used = {};
  function idFor(r, s) {
    // ชุด k ของดอก s: k = s หรือ s+4
    for (var set = s; set < 8; set += 4) {
      var id = set * 13 + r - 1;
      if (!used[id]) {
        used[id] = 1;
        return id;
      }
    }
    throw new Error('ไพ่หมด');
  }
  var cols = colsSpec.map(function (c) {
    return c.map(function (x) {
      return idFor(x[0], x[1]);
    });
  });
  // แถวที่เหลือ: เติม K ดอกต่าง ๆ (มีใบละ 2 ชุด) กันไม่ให้แถวว่าง
  var filler = 0;
  while (cols.length < 10) {
    var f = filler++;
    try {
      cols.push([idFor(13 - Math.floor(f / 4), f % 4)]);
    } catch (e) {
      /* ใบนี้ใช้หมดแล้ว ลองใบถัดไป */
    }
  }
  return { suits: 4, cols: cols, down: cols.map(function () { return 0; }), stock: [], done: [] };
}

test('ยกกลุ่มได้เฉพาะดอกเดียวกันที่เรียงลด · วางบนแต้มมากกว่า 1 ดอกไหนก็ได้', function () {
  var S = sp([
    [[9, 0], [8, 0], [7, 1]],
    [[9, 2], [8, 2], [7, 2]],
    [[9, 3]],
    []
  ]);
  assert.ok(P.isRun(S, 1, 0));
  assert.ok(!P.isRun(S, 0, 0));
  assert.ok(P.isRun(S, 0, 2));
  assert.ok(P.legal(S, 1, 1, 2), '8♦7♦ บน 9♣ ได้');
  assert.ok(!P.legal(S, 0, 0, 2), 'กลุ่มดอกปนยกไม่ได้');
  assert.ok(P.legal(S, 0, 2, 3), 'แถวว่างวางอะไรก็ได้');
});

test('ย้ายแล้วใบคว่ำด้านล่างหงายขึ้นเอง', function () {
  var S = sp([[[3, 0], [9, 1]], [[10, 2]]]);
  S.down[0] = 1;
  var r = P.move(S, 0, 1, 1);
  assert.strictEqual(r.state.down[0], 0);
  assert.deepStrictEqual(r.state.cols[0].length, 1);
  assert.strictEqual(S.cols[1].length, 1, 'ไม่แก้สถานะเดิม');
});

test('ครบ K→A ดอกเดียวกัน = เก็บออก 13 ใบ', function () {
  var run = [];
  for (var r = 13; r >= 2; r--) run.push([r, 1]);
  var S = sp([run, [[1, 1]]]);
  var res = P.move(S, 1, 0, 0);
  assert.ok(res.collected);
  assert.strictEqual(res.state.cols[0].length, 0);
  assert.deepStrictEqual(res.state.done, [1]);
  // ดอกปน = ไม่เก็บ
  run[5] = [8, 2];
  S = sp([run, [[1, 1]]]);
  assert.ok(!P.move(S, 1, 0, 0).collected);
});

test('แจกจากกอง: ต้องไม่มีแถวว่าง · แจกแถวละ 1 ใบ', function () {
  var S = P.deal(1, 5);
  assert.strictEqual(P.canDeal(S), '');
  var r = P.dealRow(S);
  assert.strictEqual(r.state.stock.length, 40);
  r.state.cols.forEach(function (c, i) {
    assert.strictEqual(c.length, S.cols[i].length + 1);
  });
  var T = P.clone(S);
  T.cols[3] = [];
  assert.strictEqual(P.canDeal(T), 'gap');
  T.stock = [];
  assert.strictEqual(P.canDeal(T), 'empty');
});

test('แตะไพ่: เลือกต่อดอกเดียวกันก่อนดอกอื่น', function () {
  var S = sp([[[7, 0]], [[8, 1]], [[8, 0]]]);
  assert.strictEqual(P.bestMove(S, 0, 0), 2);
  S = sp([[[7, 0]], [[8, 1]]]);
  assert.strictEqual(P.bestMove(S, 0, 0), 1);
});

test('ชนะเมื่อเก็บครบ 8 ชุด', function () {
  var S = P.deal(1, 3);
  assert.ok(!P.isWon(S));
  S.done = [0, 0, 0, 0, 0, 0, 0, 0];
  assert.ok(P.isWon(S));
});

test('เล่นสุ่ม (1 ดอก) จนติด: ไพ่ครบ 104 ตลอด · ใบคว่ำไม่อยู่บนสุด', function () {
  var rnd = P.rng(11);
  var S = P.deal(1, 2024);
  for (var step = 0; step < 4000; step++) {
    var opts = [];
    for (var c = 0; c < 10; c++) {
      for (var i = S.down[c]; i < S.cols[c].length; i++) {
        if (!P.isRun(S, c, i)) continue;
        var to = P.bestMove(S, c, i);
        if (to !== -1 && S.cols[to].length) opts.push([c, i, to]);
      }
    }
    var res;
    if (opts.length && rnd() < 0.9) {
      var o = opts[Math.floor(rnd() * opts.length)];
      res = P.move(S, o[0], o[1], o[2]);
    } else if (P.canDeal(S) === '') res = P.dealRow(S);
    else if (opts.length) {
      o = opts[0];
      res = P.move(S, o[0], o[1], o[2]);
    } else break;
    S = res.state;
    var n = S.stock.length + S.done.length * 13;
    S.cols.forEach(function (col, c) {
      n += col.length;
      if (col.length) assert.ok(S.down[c] < col.length, 'ใบบนสุดต้องหงาย');
    });
    assert.strictEqual(n, 104);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
