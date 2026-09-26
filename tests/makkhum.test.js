/*
 * เทสกติกา + คอม หมากขุม — รันด้วย:  node tests/makkhum.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var M = require('../games/makkhum/engine.js');

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

function total(pits) {
  return pits.reduce(function (a, b) {
    return a + b;
  }, 0);
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

function blank(turn) {
  var pits = [];
  for (var i = 0; i < 16; i++) pits.push(0);
  return { pits: pits, turn: turn || 0, over: false };
}

console.log('หมากขุม — engine + AI self-tests');

test('เริ่ม: หลุมละ 7 เม็ด ฝั่งละ 7 หลุม รวม 98 · หัวเมืองว่าง', function () {
  var S = M.initial(0);
  assert.strictEqual(total(S.pits), 98);
  assert.strictEqual(S.pits[7], 0);
  assert.strictEqual(S.pits[15], 0);
  assert.deepStrictEqual(M.legalMoves(S), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(M.legalMoves(M.initial(1)), [8, 9, 10, 11, 12, 13, 14]);
});

test('หลุมตรงข้าม: 6↔8 · 0↔14 · 4↔10', function () {
  assert.strictEqual(M.opposite(6), 8);
  assert.strictEqual(M.opposite(0), 14);
  assert.strictEqual(M.opposite(10), 4);
});

test('ตัวอย่างในเอกสาร 1: เปิดเกมหลุม A1 → ตกหัวเมืองพอดี ได้เดินต่อ', function () {
  var r = M.move(M.initial(0), 0);
  assert.strictEqual(r.result, 'store');
  assert.strictEqual(r.state.turn, 0);
  assert.strictEqual(r.state.pits[0], 0);
  for (var i = 1; i <= 6; i++) assert.strictEqual(r.state.pits[i], 8);
  assert.strictEqual(r.state.pits[7], 1);
});

test('ตัวอย่างในเอกสาร 2: หยอดต่อ แล้วตายในแดนตัวเอง = กินแทนหลุมตรงข้าม', function () {
  var S = blank(0);
  S.pits[0] = 2;
  S.pits[2] = 1;
  S.pits[10] = 5;
  S.pits[12] = 3; // ให้ฟ้ามีหมากเหลือ (เกมยังไม่จบ)
  var r = M.move(S, 0);
  assert.strictEqual(r.result, 'capture');
  assert.deepStrictEqual(r.state.pits.slice(0, 5), [0, 1, 0, 1, 1]);
  assert.strictEqual(r.state.pits[10], 0);
  assert.strictEqual(r.state.pits[7], 5);
  assert.strictEqual(r.state.turn, 1);
  assert.ok(r.steps.some(function (s) { return s.t === 'capture' && s.from === 10 && s.n === 5; }));
});

test('หยอดข้ามหัวเมืองคู่แข่ง แต่ลงหัวเมืองตัวเอง', function () {
  var S = blank(1);
  S.pits[14] = 3; // ฟ้า: 15 (หัวเมืองตัวเอง) → 0 → 1
  S.pits[4] = 2;
  var r = M.move(S, 14);
  assert.strictEqual(r.state.pits[15], 1);
  assert.strictEqual(r.state.pits[7], 0);
  S = blank(0);
  S.pits[6] = 3; // แดง: 7 → 8 → 9 (ไม่ข้ามอะไร)
  S.pits[12] = 1;
  r = M.move(S, 6);
  assert.strictEqual(r.state.pits[7], 1);
  S = blank(0);
  S.pits[14 - 14] = 0;
  S.pits[13] = 0;
  // แดงหยอดผ่าน 15 ต้องข้าม: เริ่มหลุม 6 ด้วย 10 เม็ด → 7..14 (8 ช่อง) แล้วข้าม 15 ไป 0,1
  S.pits[6] = 10;
  S.pits[3] = 1;
  r = M.move(S, 6);
  assert.strictEqual(r.state.pits[15], 0, 'ห้ามลงหัวเมืองฟ้า');
  assert.ok(r.steps.every(function (s) { return s.t !== 'drop' || s.i !== 15; }));
});

test('ตายในแดนคู่แข่ง = หมดตาเฉย ๆ', function () {
  var S = blank(0);
  S.pits[6] = 2; // 7, 8 (ว่าง) → ตายแดนฟ้า
  S.pits[3] = 1;
  S.pits[12] = 4;
  var r = M.move(S, 6);
  assert.strictEqual(r.result, 'dead');
  assert.strictEqual(r.state.turn, 1);
  assert.strictEqual(r.state.pits[8], 1);
});

test('ตายในแดนตัวเองแต่หลุมตรงข้ามว่าง = ไม่ได้กิน', function () {
  var S = blank(0);
  S.pits[0] = 1; // → 1 (ว่าง) ตรงข้าม 13 ว่าง
  S.pits[5] = 1;
  S.pits[9] = 2;
  var r = M.move(S, 0);
  assert.strictEqual(r.result, 'dead');
  assert.strictEqual(r.state.pits[7], 0);
});

test('ถึงตาใครแล้วฝั่งนั้นไม่มีหมาก = จบ · หมากที่ค้างเข้าหัวเมืองเจ้าของฝั่ง', function () {
  var S = blank(0);
  S.pits[6] = 1; // ตกหัวเมืองตัวเอง ได้เดินต่อ แต่ฝั่งแดงหมด → จบ
  S.pits[10] = 4;
  S.pits[7] = 40;
  S.pits[15] = 53;
  var r = M.move(S, 6);
  assert.ok(r.state.over);
  assert.strictEqual(r.state.pits[7], 41);
  assert.strictEqual(r.state.pits[15], 57);
  assert.strictEqual(M.winner(r.state), 1);
  assert.strictEqual(total(r.state.pits), 98);
});

test('ผลเสมอเมื่อหัวเมืองเท่ากัน', function () {
  var S = blank(0);
  S.over = true;
  S.pits[7] = 49;
  S.pits[15] = 49;
  assert.strictEqual(M.winner(S), 'draw');
});

test('เล่นสุ่ม 300 เกม: เม็ดครบ 98 ทุกตา · จบได้เสมอ · steps สอดคล้องกับผล', function () {
  var rnd = rng(9);
  for (var g = 0; g < 300; g++) {
    var S = M.initial(g % 2);
    for (var turn = 0; turn < 2000 && !S.over; turn++) {
      var moves = M.legalMoves(S);
      assert.ok(moves.length > 0, 'ต้องมีตาเดินถ้ายังไม่จบ');
      var i = moves[Math.floor(rnd() * moves.length)];
      var r = M.move(S, i);
      assert.notStrictEqual(r.result, 'limit');
      assert.strictEqual(total(r.state.pits), 98);
      // เล่นซ้ำ steps บนกระดานเดิม ต้องได้ผลเดียวกัน
      var sim = S.pits.slice();
      var hand = 0;
      r.steps.forEach(function (s) {
        if (s.t === 'pick') {
          hand += sim[s.i];
          sim[s.i] = 0;
        } else if (s.t === 'drop') {
          sim[s.i]++;
          hand--;
        } else {
          sim[s.to] += sim[s.from];
          sim[s.from] = 0;
        }
      });
      assert.strictEqual(hand, 0);
      assert.deepStrictEqual(sim, r.state.pits);
      S = r.state;
    }
    assert.ok(S.over, 'เกมต้องจบ');
  }
});

test('คอมเลือกเฉพาะหลุมที่เดินได้ (ง่าย + ยาก) · ไม่มีตาเดิน = -1', function () {
  var rnd = rng(3);
  var S = M.initial(1);
  for (var t = 0; t < 40 && !S.over; t++) {
    var lv = t % 2 ? 2 : 1;
    var i = M.choose(S, lv, rnd, 60);
    assert.ok(M.legalMoves(S).indexOf(i) !== -1, 'ระดับ ' + lv + ' เลือก ' + i);
    S = M.move(S, i).state;
  }
  var E = blank(0);
  E.pits[9] = 3;
  assert.strictEqual(M.choose(E, 2), -1);
});

test('คอมยากเห็นทางกินแทนที่ได้มากสุดในตาเดียว', function () {
  var S = blank(0);
  S.pits[1] = 1; // หลุม 1 → 2 (ว่าง) ตรงข้าม 12 = 20 เม็ด
  S.pits[5] = 1; // หลุม 5 → 6 (ว่าง) ตรงข้าม 8 = 1 เม็ด
  S.pits[12] = 20;
  S.pits[8] = 1;
  S.pits[9] = 1;
  assert.strictEqual(M.choose(S, 2, rng(1), 200), 1);
});

test('คอมยากชนะคอมง่ายเป็นส่วนใหญ่ (10 เกม) และคิดไม่เกิน ~0.5 วินาทีต่อตา', function () {
  var rnd = rng(21);
  var wins = 0;
  var slow = 0;
  for (var g = 0; g < 10; g++) {
    var hard = g % 2;
    var S = M.initial(g % 2);
    while (!S.over) {
      var t0 = Date.now();
      var i = M.choose(S, S.turn === hard ? 2 : 1, rnd, 40);
      if (Date.now() - t0 > 500) slow++;
      S = M.move(S, i).state;
    }
    if (M.winner(S) === hard) wins++;
  }
  console.log('       (ยากชนะ ' + wins + '/10)');
  assert.ok(wins >= 7, 'ยากชนะแค่ ' + wins + '/10');
  assert.strictEqual(slow, 0);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
