/*
 * เทสกติกาไฟว์ไดซ์ — รันด้วย:  node tests/dice.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var D = require('../games/dice/engine.js');

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

function seq(values) {
  // rnd ที่ให้หน้าเต๋าตามที่กำหนด (1–6)
  var k = 0;
  return function () {
    return (values[k++ % values.length] - 1) / 6 + 0.01;
  };
}

function card(filled) {
  var s = [];
  for (var i = 0; i < 13; i++) s.push(filled && filled[i] != null ? filled[i] : null);
  return { s: s, fb: 0 };
}

function opt(list, cat) {
  var o = list.filter(function (x) {
    return x.cat === cat;
  })[0];
  return o ? o.score : undefined;
}

console.log('ไฟว์ไดซ์ — engine self-tests');

test('ช่องบน: รวมเฉพาะหน้านั้น', function () {
  assert.strictEqual(D.raw(0, [1, 1, 3, 4, 1]), 3);
  assert.strictEqual(D.raw(5, [6, 6, 2, 6, 1]), 18);
  assert.strictEqual(D.raw(2, [1, 2, 4, 5, 6]), 0);
});

test('ตอง / สี่เหมือน = รวมทุกลูก · ไม่ถึง = 0', function () {
  assert.strictEqual(D.raw(6, [3, 3, 3, 4, 5]), 18);
  assert.strictEqual(D.raw(6, [3, 3, 2, 4, 5]), 0);
  assert.strictEqual(D.raw(7, [2, 2, 2, 2, 6]), 14);
  assert.strictEqual(D.raw(7, [2, 2, 2, 5, 6]), 0);
  assert.strictEqual(D.raw(6, [4, 4, 4, 4, 4]), 20);
});

test('ฟูลเฮาส์ 25 (ต้อง 3+2 พอดี) · เรียง 4 = 30 · เรียง 5 = 40', function () {
  assert.strictEqual(D.raw(8, [2, 2, 5, 5, 5]), 25);
  assert.strictEqual(D.raw(8, [2, 2, 2, 2, 5]), 0);
  assert.strictEqual(D.raw(9, [1, 2, 3, 4, 6]), 30);
  assert.strictEqual(D.raw(9, [3, 4, 5, 6, 6]), 30);
  assert.strictEqual(D.raw(9, [1, 2, 3, 5, 6]), 0);
  assert.strictEqual(D.raw(10, [2, 3, 4, 5, 6]), 40);
  assert.strictEqual(D.raw(10, [1, 2, 3, 4, 6]), 0);
  assert.strictEqual(D.raw(9, [2, 3, 4, 5, 6]), 30, 'เรียง 5 ลงเรียง 4 ได้');
});

test('ไฟว์ไดซ์ 50 · รวมทุกลูก', function () {
  assert.strictEqual(D.raw(11, [6, 6, 6, 6, 6]), 50);
  assert.strictEqual(D.raw(11, [6, 6, 6, 6, 5]), 0);
  assert.strictEqual(D.raw(12, [1, 2, 3, 4, 6]), 16);
});

test('โบนัสบน: รวม ≥ 63 ได้ +35', function () {
  var c = card([3, 6, 9, 12, 15, 18]); // 63
  var t = D.totals(c);
  assert.strictEqual(t.upper, 63);
  assert.strictEqual(t.bonus, 35);
  c = card([3, 6, 9, 12, 15, 17]);
  assert.strictEqual(D.totals(c).bonus, 0);
});

test('โจ๊กเกอร์: 5 เหมือนซ้ำ → บังคับช่องหน้าเดียวกันถ้ายังว่าง', function () {
  var c = card({ 11: 50 });
  var o = D.options(c, [4, 4, 4, 4, 4]);
  assert.strictEqual(o.length, 1);
  assert.strictEqual(o[0].cat, 3);
  assert.strictEqual(o[0].score, 20);
});

test('โจ๊กเกอร์: ช่องหน้าเดียวกันเต็ม → ลงช่องล่างได้เต็มแต้ม (ฟูลเฮาส์ 25 · เรียง 30/40)', function () {
  var c = card({ 3: 12, 11: 50 });
  var o = D.options(c, [4, 4, 4, 4, 4]);
  assert.strictEqual(opt(o, 8), 25);
  assert.strictEqual(opt(o, 9), 30);
  assert.strictEqual(opt(o, 10), 40);
  assert.strictEqual(opt(o, 6), 20);
  assert.strictEqual(opt(o, 0), undefined, 'ช่องบนลงไม่ได้ขณะช่องล่างยังว่าง');
});

test('โจ๊กเกอร์: ช่องล่างเต็มหมด → ลงช่องบนที่ว่างได้ 0', function () {
  var c = card({ 3: 12, 6: 20, 7: 10, 8: 25, 9: 30, 10: 40, 11: 0, 12: 22 });
  var o = D.options(c, [4, 4, 4, 4, 4]);
  assert.deepStrictEqual(
    o.map(function (x) {
      return x.cat;
    }),
    [0, 1, 2, 4, 5]
  );
  o.forEach(function (x) {
    assert.strictEqual(x.score, 0);
  });
});

test('ไฟว์ไดซ์ซ้ำ ได้โบนัส +100 เฉพาะเมื่อช่องไฟว์ไดซ์ได้ 50 (ไม่ใช่ 0)', function () {
  var S = D.newGame(1);
  S.cards[0].s[11] = 50;
  S = D.roll(S, seq([6]));
  assert.deepStrictEqual(S.dice, [6, 6, 6, 6, 6]);
  S = D.score(S, 5);
  assert.strictEqual(S.cards[0].fb, 1);
  assert.strictEqual(S.cards[0].s[5], 30);
  assert.strictEqual(D.totals(S.cards[0]).fiveBonus, 100);
  var Z = D.newGame(1);
  Z.cards[0].s[11] = 0;
  Z = D.score(D.roll(Z, seq([2])), 1);
  assert.strictEqual(Z.cards[0].fb, 0);
});

test('ทอยได้ 3 ครั้ง · เก็บลูก (hold) ไม่ถูกทอยใหม่ · ต้องทอยก่อนลงแต้ม', function () {
  var S = D.newGame(1);
  assert.strictEqual(D.score(S, 12), S, 'ยังไม่ทอยลงไม่ได้');
  assert.strictEqual(D.toggleHold(S, 0), S, 'ยังไม่ทอยเก็บลูกไม่ได้');
  S = D.roll(S, seq([1, 2, 3, 4, 5]));
  S = D.toggleHold(S, 0);
  S = D.toggleHold(S, 4);
  S = D.roll(S, seq([6]));
  assert.deepStrictEqual(S.dice, [1, 6, 6, 6, 5]);
  S = D.roll(S, seq([2]));
  assert.strictEqual(S.rolls, 3);
  assert.ok(!D.canRoll(S));
  assert.strictEqual(D.roll(S, seq([3])), S);
  S = D.score(S, 12);
  assert.strictEqual(S.cards[0].s[12], 1 + 2 + 2 + 2 + 5);
  assert.strictEqual(S.rolls, 0);
  assert.deepStrictEqual(S.held, [false, false, false, false, false]);
});

test('ลงช่องที่ลงแล้วซ้ำไม่ได้', function () {
  var S = D.roll(D.newGame(1), seq([3]));
  S = D.score(S, 2);
  S = D.roll(S, seq([3]));
  assert.strictEqual(D.score(S, 2), S);
});

test('2 คน: สลับตาหลังลงแต้ม · ครบ 13 ช่องทั้งคู่ = จบ · ผู้ชนะแต้มรวมมากกว่า', function () {
  var S = D.newGame(2, 1);
  assert.strictEqual(S.turn, 1);
  var rnd = seq([2, 3, 4, 5, 6, 1, 1, 1, 1, 1]);
  for (var t = 0; t < 26; t++) {
    S = D.roll(S, rnd);
    var o = D.options(S.cards[S.turn], S.dice);
    var before = S.turn;
    S = D.score(S, o[0].cat);
    if (!S.over) assert.strictEqual(S.turn, 1 - before);
  }
  assert.ok(S.over);
  var a = D.totals(S.cards[0]).total;
  var b = D.totals(S.cards[1]).total;
  assert.strictEqual(D.winner(S), a === b ? 'draw' : a > b ? 0 : 1);
});

test('เล่นสุ่ม 500 เกมคนเดียว: ลงครบ 13 ช่องเสมอ · แต้มรวมอยู่ในช่วงที่เป็นไปได้', function () {
  var a = 12345;
  function rnd() {
    a = (a * 16807) % 2147483647;
    return a / 2147483647;
  }
  for (var g = 0; g < 500; g++) {
    var S = D.newGame(1);
    var turns = 0;
    while (!S.over) {
      S = D.roll(S, rnd);
      while (D.canRoll(S) && rnd() < 0.6) {
        for (var i = 0; i < 5; i++) if (rnd() < 0.4) S = D.toggleHold(S, i);
        S = D.roll(S, rnd);
      }
      var o = D.options(S.cards[0], S.dice);
      assert.ok(o.length > 0);
      S = D.score(S, o[Math.floor(rnd() * o.length)].cat);
      turns++;
      assert.ok(turns <= 13);
    }
    assert.strictEqual(turns, 13);
    var t = D.totals(S.cards[0]).total;
    assert.ok(t >= 5 && t <= 1575, 'แต้ม ' + t);
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
