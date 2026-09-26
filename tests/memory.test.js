/*
 * เทสกติกาจับคู่ไพ่ความจำ — รันด้วย:  node tests/memory.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var M = require('../games/memory/engine.js');

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

// หา index ของอีกใบที่เป็นคู่ / ใบที่ไม่ใช่คู่
function mate(S, i) {
  for (var j = 0; j < S.deck.length; j++) if (j !== i && S.deck[j] === S.deck[i]) return j;
  return -1;
}
function nonMate(S, i) {
  for (var j = 0; j < S.deck.length; j++) if (j !== i && S.deck[j] !== S.deck[i] && !S.matched[j]) return j;
  return -1;
}

console.log('จับคู่ไพ่ความจำ — engine self-tests');

test('ขนาดกระดาน: 4×4 = 8 คู่ · 4×6 = 12 คู่ · 6×6 = 18 คู่ (ภาพพอ)', function () {
  assert.strictEqual(M.pairsOf('s'), 8);
  assert.strictEqual(M.pairsOf('m'), 12);
  assert.strictEqual(M.pairsOf('l'), 18);
  assert.ok(M.SYMBOLS >= 18);
});

test('แจก: ทุกภาพมีพอดี 2 ใบ · ภาพไม่เกินจำนวนที่วาดไว้', function () {
  ['s', 'm', 'l'].forEach(function (size) {
    var S = M.deal(size, false, 0, rng(4));
    var count = {};
    S.deck.forEach(function (v) {
      assert.ok(v >= 0 && v < M.SYMBOLS);
      count[v] = (count[v] || 0) + 1;
    });
    var keys = Object.keys(count);
    assert.strictEqual(keys.length, M.pairsOf(size));
    keys.forEach(function (k) {
      assert.strictEqual(count[k], 2);
    });
  });
});

test('เปิดคู่ตรงกัน = ได้คู่ + เล่นต่อ (ตาไม่เปลี่ยน)', function () {
  var S = M.deal('s', true, 1, rng(2));
  var r = M.reveal(S, 0);
  assert.strictEqual(r.event, 'open');
  r = M.reveal(r.state, mate(S, 0));
  assert.strictEqual(r.event, 'match');
  assert.deepStrictEqual(r.state.pairs, [0, 1]);
  assert.strictEqual(r.state.turn, 1);
  assert.strictEqual(r.state.moves, 1);
  assert.deepStrictEqual(r.state.open, []);
});

test('เปิดไม่ตรง = รอปิด (เปิดใบอื่นไม่ได้) → hide แล้วเปลี่ยนตา', function () {
  var S = M.deal('s', true, 0, rng(3));
  var r = M.reveal(S, 0);
  r = M.reveal(r.state, nonMate(S, 0));
  assert.strictEqual(r.event, 'miss');
  assert.ok(r.state.pending);
  assert.strictEqual(M.reveal(r.state, 5).event, 'invalid');
  var T = M.hide(r.state);
  assert.strictEqual(T.turn, 1);
  assert.deepStrictEqual(T.open, []);
  assert.ok(!T.pending);
});

test('โหมดคนเดียว: ไม่ตรงก็ไม่เปลี่ยนตา · นับครั้งที่เปิดคู่', function () {
  var S = M.deal('s', false, 0, rng(3));
  var r = M.reveal(M.reveal(S, 0).state, nonMate(S, 0));
  var T = M.hide(r.state);
  assert.strictEqual(T.turn, 0);
  assert.strictEqual(T.moves, 1);
});

test('แตะใบที่เปิดอยู่แล้ว / ใบที่จับคู่แล้ว = ไม่มีผล', function () {
  var S = M.deal('s', false, 0, rng(5));
  var r = M.reveal(S, 3);
  assert.strictEqual(M.reveal(r.state, 3).event, 'invalid');
  r = M.reveal(r.state, mate(S, 3));
  assert.strictEqual(M.reveal(r.state, 3).event, 'invalid');
  assert.strictEqual(M.reveal(S, 99).event, 'invalid');
});

test('เปิดครบทุกคู่ = จบ · ผู้ชนะ = คู่มากกว่า · เท่ากัน = เสมอ', function () {
  var S = M.deal('s', true, 0, rng(8));
  var done = {};
  var who = 0;
  for (var i = 0; i < S.deck.length; i++) {
    if (done[i]) continue;
    var j = mate(S, i);
    done[i] = done[j] = true;
    var r = M.reveal(M.reveal(S, i).state, j);
    S = r.state;
    // สลับคนได้คู่: ให้พลาด 1 ครั้งก่อนคู่ถัดไป (ถ้ายังมีใบให้พลาด)
    if (!S.over && who++ % 2 === 0) {
      var a = -1;
      for (var k = 0; k < S.deck.length; k++) if (!S.matched[k]) { a = k; break; }
      var b = nonMate(S, a);
      if (b !== -1) S = M.hide(M.reveal(M.reveal(S, a).state, b).state);
    }
  }
  assert.ok(S.over);
  assert.strictEqual(S.pairs[0] + S.pairs[1], 8);
  var w = M.winner(S);
  if (S.pairs[0] === S.pairs[1]) assert.strictEqual(w, 'draw');
  else assert.strictEqual(w, S.pairs[0] > S.pairs[1] ? 0 : 1);
  var E = M.deal('s', true, 0, rng(1));
  E.over = true;
  E.pairs = [4, 4];
  assert.strictEqual(M.winner(E), 'draw');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
