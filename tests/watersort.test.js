/*
 * เทสเทน้ำเรียงสี — รันด้วย:  node tests/watersort.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var W = require('../games/watersort/engine.js');

var passed = 0;
var failed = 0;
var T0 = Date.now();

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

var LEVELS = 300;
var cache = {};
function lv(n) {
  if (!cache[n]) cache[n] = W.level(n);
  return cache[n];
}

// ---------- กติกา ----------
test('constants', function () {
  assert.strictEqual(W.CAP, 4);
  assert.strictEqual(W.COLORS, 12);
});

test('canPour: basic rules', function () {
  var t = [[0, 1], [2, 1], [], [3, 3, 3, 1], [1]];
  assert.ok(W.canPour(t, 0, 1), 'same top color, room left');
  assert.ok(W.canPour(t, 0, 2), 'into empty tube');
  assert.ok(!W.canPour(t, 2, 0), 'from empty tube');
  assert.ok(!W.canPour(t, 0, 0), 'a === b');
  assert.ok(!W.canPour(t, 0, 3), 'into full tube');
  assert.ok(!W.canPour([[0], [1]], 0, 1), 'top colors differ');
  assert.ok(W.canPour(t, 3, 4), 'full tube can be a source');
  assert.ok(!W.canPour(t, 0, 9), 'out of range');
});

test('pour: moves the whole contiguous top run when it fits', function () {
  var t = [[0, 1, 1, 1], [1], []];
  var r = W.pour(t, 0, 1);
  assert.strictEqual(r.amount, 3);
  assert.deepStrictEqual(r.tubes, [[0], [1, 1, 1, 1], []]);
});

test('pour: partial pour when destination has less room', function () {
  var t = [[2, 1, 1, 1], [0, 0, 1], []];
  var r = W.pour(t, 0, 1);
  assert.strictEqual(r.amount, 1);
  assert.deepStrictEqual(r.tubes, [[2, 1, 1], [0, 0, 1, 1], []]);
});

test('pour: into empty tube takes the full run', function () {
  var r = W.pour([[3, 2, 2], []], 0, 1);
  assert.strictEqual(r.amount, 2);
  assert.deepStrictEqual(r.tubes, [[3], [2, 2]]);
});

test('pour: does not mutate input', function () {
  var t = [[0, 1, 1], [1], []];
  var snap = JSON.stringify(t);
  var r = W.pour(t, 0, 1);
  assert.strictEqual(JSON.stringify(t), snap);
  assert.notStrictEqual(r.tubes, t);
  assert.notStrictEqual(r.tubes[2], t[2], 'untouched tubes are copies too');
});

test('pour: illegal move → amount 0, same contents', function () {
  var t = [[0], [1]];
  var r = W.pour(t, 0, 1);
  assert.strictEqual(r.amount, 0);
  assert.deepStrictEqual(r.tubes, t);
});

test('isSolved', function () {
  assert.ok(W.isSolved([[0, 0, 0, 0], [1, 1, 1, 1], [], []]));
  assert.ok(W.isSolved([[], []]));
  assert.ok(!W.isSolved([[0, 0, 0], [0], [1, 1, 1, 1]]), 'split color');
  assert.ok(!W.isSolved([[0, 0, 0, 1], [1, 1, 1, 0], []]));
});

test('solve / hint on small puzzles', function () {
  assert.deepStrictEqual(W.solve([[0, 0, 0, 0], []]), []);
  assert.strictEqual(W.hint([[0, 0, 0, 0], []]), null, 'already solved → null');
  var t = [[0, 0, 0, 1], [1, 1, 1, 0], []];
  var sol = W.solve(t);
  assert.ok(sol && sol.length);
  var h = W.hint(t);
  assert.ok(h && W.canPour(t, h[0], h[1]));
  // ตันจริง: ไม่มีหลอดว่าง และเทอะไรไม่ได้เลย
  assert.strictEqual(W.solve([[0, 1, 0, 1], [1, 0, 1, 0]]), null);
  assert.strictEqual(W.hint([[0, 1, 0, 1], [1, 0, 1, 0]]), null);
});

test('rng is deterministic and in [0,1)', function () {
  var a = W.rng(42);
  var b = W.rng(42);
  for (var i = 0; i < 100; i++) {
    var x = a();
    assert.strictEqual(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

// ---------- ด่าน ----------
var genStart = Date.now();
for (var g = 1; g <= LEVELS; g++) lv(g);
var genMs = Date.now() - genStart;

test('level(n) is deterministic (same n → same level)', function () {
  [1, 2, 7, 19, 50, 123, 300].forEach(function (n) {
    var fresh = W.level(n);
    assert.deepStrictEqual(fresh, lv(n));
    assert.deepStrictEqual(W.level(n), fresh);
  });
  assert.notDeepStrictEqual(lv(40).tubes, lv(41).tubes, 'different n → different level');
});

test('level shape: k filled tubes + exactly 2 empty tubes, n echoed', function () {
  for (var n = 1; n <= LEVELS; n++) {
    var L = lv(n);
    assert.strictEqual(L.n, n);
    assert.strictEqual(L.tubes.length, L.colors + 2);
    var empties = L.tubes.filter(function (t) {
      return t.length === 0;
    }).length;
    assert.strictEqual(empties, 2, 'level ' + n);
    L.tubes.forEach(function (t) {
      assert.ok(t.length === 0 || t.length === W.CAP, 'level ' + n + ' tube length');
    });
  }
});

test('each color appears exactly CAP times, indices 0..k-1', function () {
  for (var n = 1; n <= LEVELS; n++) {
    var L = lv(n);
    var cnt = [];
    for (var c = 0; c < L.colors; c++) cnt.push(0);
    L.tubes.forEach(function (t) {
      t.forEach(function (c) {
        assert.ok(c >= 0 && c < L.colors && c === Math.floor(c), 'level ' + n + ' bad color ' + c);
        cnt[c]++;
      });
    });
    cnt.forEach(function (x, c) {
      assert.strictEqual(x, W.CAP, 'level ' + n + ' color ' + c);
    });
  }
});

test('no complete tube at start (and no 3-of-a-color tube after level 2)', function () {
  for (var n = 1; n <= LEVELS; n++) {
    lv(n).tubes.forEach(function (t) {
      assert.ok(!W.isComplete(t), 'level ' + n);
      if (n > 2) {
        var m = {};
        t.forEach(function (c) {
          m[c] = (m[c] || 0) + 1;
          assert.ok(m[c] < 3, 'level ' + n + ' has 3 of one color in a tube');
        });
      }
    });
  }
});

test('color curve: starts at 3, non-decreasing, max 12', function () {
  assert.strictEqual(lv(1).colors, 3);
  assert.strictEqual(lv(2).colors, 3);
  var prev = 0;
  for (var n = 1; n <= LEVELS; n++) {
    var k = lv(n).colors;
    assert.ok(k >= prev, 'level ' + n + ' decreased');
    assert.ok(k <= W.COLORS, 'level ' + n + ' > 12 colors');
    prev = k;
  }
  assert.strictEqual(lv(LEVELS).colors, 12);
});

test('harder shuffles later: few same-color neighbours (0 from level 121)', function () {
  for (var n = 121; n <= LEVELS; n++) assert.strictEqual(W.adjacentPairs(lv(n).tubes), 0, 'level ' + n);
});

var solveStart = Date.now();
test('levels 1..' + LEVELS + ' solvable: solve() + replay with pour() ends solved', function () {
  for (var n = 1; n <= LEVELS; n++) {
    var t = lv(n).tubes;
    var snap = JSON.stringify(t);
    var sol = W.solve(t);
    assert.ok(sol, 'level ' + n + ' unsolved');
    assert.strictEqual(JSON.stringify(t), snap, 'solve mutated level ' + n);
    var cur = t;
    sol.forEach(function (mv, i) {
      assert.ok(W.canPour(cur, mv[0], mv[1]), 'level ' + n + ' move ' + i + ' illegal');
      var r = W.pour(cur, mv[0], mv[1]);
      assert.ok(r.amount > 0);
      cur = r.tubes;
    });
    assert.ok(W.isSolved(cur), 'level ' + n + ' replay not solved');
    var h = W.hint(t);
    assert.ok(h && W.canPour(t, h[0], h[1]), 'level ' + n + ' hint');
  }
});
var solveMs = Date.now() - solveStart;

test('timing: generating levels 1..' + LEVELS + ' under 5 s', function () {
  assert.ok(genMs < 5000, 'took ' + genMs + ' ms');
});

console.log('\n  generate 1..' + LEVELS + ': ' + genMs + ' ms · solve+replay: ' + solveMs + ' ms · total: ' + (Date.now() - T0) + ' ms');
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
