/*
 * เทน้ำเรียงสี (Water Sort) — กติกาล้วน + ตัวสร้างด่าน + ตัวแก้ · ใช้ได้ทั้งในเบราว์เซอร์ (window.WaterSort) และใน node (require)
 *
 * หลอด = array ของเลขสี (0..k-1) เรียงจากก้นหลอด → ปากหลอด · จุได้ CAP = 4 หน่วย
 * กติกามาตรฐาน:
 *  - เทจากหลอด a ไปหลอด b ได้เมื่อ a ไม่ว่าง · a ≠ b · b ยังไม่เต็ม · b ว่าง หรือสีบนสุดของ b ตรงกับของ a
 *  - เทแล้วน้ำสีบนสุดของ a ที่ติดกันไหลไปทั้งก้อนเท่าที่ b ยังรับไหว (อาจเทได้แค่บางส่วน)
 *  - ชนะเมื่อทุกหลอดว่าง หรือเต็ม 4 หน่วยสีเดียวกัน
 *
 * ด่าน level(n) — สุ่มแบบกำหนดผล (seed จาก n → ด่านเดิมทุกครั้งตลอดไป) · k หลอดเต็ม + หลอดว่าง 2 หลอด
 * เส้นความยาก (เลือกเอง):
 *  - จำนวนสี k = min(12, 3 + floor((n-1)/2)) → ด่าน 1–2: 3 สี · 3–4: 4 สี · 5–6: 5 สี … ด่าน 19 ขึ้นไป: 12 สี
 *  - ด่าน 1–2: ไม่มีเงื่อนไขเพิ่ม (ง่ายไว้ให้หัดเล่น)
 *  - ด่าน 3 ขึ้นไป: ห้ามมีหลอดที่มีสีเดียวกัน ≥ 3 หน่วย (กันเริ่มมาแล้วเกือบเสร็จ)
 *  - จำกัด "คู่ติดกัน" (สีเดียวกันซ้อนกันในหลอดเดียว — ยิ่งน้อยยิ่งยาก):
 *      ด่าน 3–30: ≤ ceil(k/3) · 31–60: ≤ 2 · 61–120: ≤ 1 · 121 ขึ้นไป: 0 (สลับสีทุกชั้น ยากสุด)
 *  - ทุกด่านต้องผ่านตัวแก้ solve() ได้จริง — ถ้าแก้ไม่ได้/เกินเพดานโหนด ขยับไป sub-seed ถัดไป (จำกัดจำนวนรอบ)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WaterSort = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CAP = 4;
  var COLORS = 12;
  var EMPTY_TUBES = 2;

  // ---------- สุ่มแบบกำหนดผล (mulberry32) ----------
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

  function seedFor(n, sub) {
    var h = Math.imul(n >>> 0, 0x9e3779b1) ^ Math.imul((sub + 1) >>> 0, 0x85ebca6b);
    h ^= h >>> 16;
    h = Math.imul(h, 0x7feb352d);
    h ^= h >>> 15;
    return h >>> 0;
  }

  // ---------- กติกา ----------
  function clone(tubes) {
    var out = [];
    for (var i = 0; i < tubes.length; i++) out.push(tubes[i].slice());
    return out;
  }

  function top(t) {
    return t.length ? t[t.length - 1] : -1;
  }

  // จำนวนหน่วยสีบนสุดที่ติดกัน
  function topRun(t) {
    if (!t.length) return 0;
    var c = t[t.length - 1];
    var r = 1;
    for (var i = t.length - 2; i >= 0 && t[i] === c; i--) r++;
    return r;
  }

  function canPour(tubes, a, b) {
    if (a === b) return false;
    var A = tubes[a];
    var B = tubes[b];
    if (!A || !B || !A.length) return false;
    if (B.length >= CAP) return false;
    return !B.length || top(B) === top(A);
  }

  function pourAmount(A, B) {
    return Math.min(topRun(A), CAP - B.length);
  }

  // ไม่แก้ของเดิม · เทไม่ได้ = คืนสำเนาเดิม amount 0
  function pour(tubes, a, b) {
    var next = clone(tubes);
    if (!canPour(tubes, a, b)) return { tubes: next, amount: 0 };
    var amt = pourAmount(next[a], next[b]);
    for (var i = 0; i < amt; i++) next[b].push(next[a].pop());
    return { tubes: next, amount: amt };
  }

  function isComplete(t) {
    if (t.length !== CAP) return false;
    for (var i = 1; i < CAP; i++) if (t[i] !== t[0]) return false;
    return true;
  }

  function isSolved(tubes) {
    for (var i = 0; i < tubes.length; i++) {
      if (tubes[i].length && !isComplete(tubes[i])) return false;
    }
    return true;
  }

  // ---------- ตัวแก้ (DFS + visited บนสถานะมาตรฐาน) ----------
  var CH = 'abcdefghijklmnopqrstuvwxyz';

  function keyOf(tubes) {
    var parts = [];
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      var s = '';
      for (var j = 0; j < t.length; j++) s += CH.charAt(t[j]);
      parts.push(s);
    }
    parts.sort();
    return parts.join('|');
  }

  function isSingleColor(t) {
    for (var i = 1; i < t.length; i++) if (t[i] !== t[0]) return false;
    return true;
  }

  // รายการตาเดินที่มีประโยชน์ เรียงตาที่น่าจะดีก่อน
  function usefulMoves(tubes) {
    var scored = [];
    var n = tubes.length;
    var firstEmpty = -1;
    for (var e = 0; e < n; e++) {
      if (!tubes[e].length) {
        firstEmpty = e;
        break;
      }
    }
    for (var a = 0; a < n; a++) {
      var A = tubes[a];
      if (!A.length || isComplete(A)) continue;
      var single = isSingleColor(A);
      var run = topRun(A);
      var c = A[A.length - 1];
      for (var b = 0; b < n; b++) {
        if (a === b) continue;
        var B = tubes[b];
        if (B.length >= CAP) continue;
        var score;
        if (!B.length) {
          if (single) continue; // เทหลอดสีเดียวลงหลอดว่าง = ไม่ได้อะไร
          if (b !== firstEmpty) continue; // หลอดว่างทุกหลอดเหมือนกัน ลองแค่หลอดแรก
          score = 1;
        } else {
          if (B[B.length - 1] !== c) continue;
          var amt = Math.min(run, CAP - B.length);
          var bSingle = isSingleColor(B);
          // เทหลอดสีเดียวไปทับหลอดที่มีสีอื่นอยู่ข้างใต้ = ถอยหลัง
          if (single && !bSingle) continue;
          score = 10;
          if (amt === run) score += 10; // ย้ายได้ทั้งก้อน
          if (bSingle) score += 20; // ต่อหลอดสีเดียวให้ยาวขึ้น
          if (bSingle && B.length + amt === CAP) score += 40; // ปิดหลอดเสร็จ
          if (amt === A.length) score += 5; // หลอดต้นทางว่าง
        }
        scored.push([score, a, b]);
      }
    }
    scored.sort(function (x, y) {
      return y[0] - x[0] || x[1] - y[1] || x[2] - y[2];
    });
    return scored;
  }

  function solve(tubes, opts) {
    var limit = (opts && opts.limit) || 200000;
    var state = clone(tubes);
    if (isSolved(state)) return [];
    var seen = {};
    seen[keyOf(state)] = true;
    var nodes = 0;
    var path = [];
    var aborted = false;

    function dfs() {
      if (isSolved(state)) return true;
      if (++nodes > limit) {
        aborted = true;
        return false;
      }
      var moves = usefulMoves(state);
      for (var i = 0; i < moves.length; i++) {
        var a = moves[i][1];
        var b = moves[i][2];
        var A = state[a];
        var B = state[b];
        var amt = pourAmount(A, B);
        for (var k = 0; k < amt; k++) B.push(A.pop());
        var key = keyOf(state);
        if (!seen[key]) {
          seen[key] = true;
          path.push([a, b]);
          if (dfs()) return true;
          path.pop();
        }
        for (var u = 0; u < amt; u++) A.push(B.pop());
        if (aborted) return false;
      }
      return false;
    }

    var ok = dfs();
    if (opts && opts.stats) {
      opts.stats.nodes = nodes;
      opts.stats.aborted = aborted;
    }
    return ok ? path : null;
  }

  // ตาแนะนำสำหรับปุ่มคำใบ้ · null = เสร็จแล้ว หรือหาทางไม่เจอ (ผู้เล่นอาจเดินจนตัน → ให้ UI แนะนำเริ่มใหม่/ย้อน)
  // เพดานโหนดต่ำกว่า solve() ปกติ เพื่อไม่ให้มือถือค้างนานเมื่อสถานะตันจริง
  function hint(tubes, opts) {
    if (isSolved(tubes)) return null;
    var sol = solve(tubes, { limit: (opts && opts.limit) || 50000 });
    return sol && sol.length ? sol[0] : null;
  }

  // ---------- ตัวสร้างด่าน ----------
  function colorsFor(n) {
    return Math.min(COLORS, 3 + Math.floor((n - 1) / 2));
  }

  function maxPairsFor(n, k) {
    if (n <= 2) return Infinity;
    if (n <= 30) return Math.ceil(k / 3);
    if (n <= 60) return 2;
    if (n <= 120) return 1;
    return 0;
  }

  function adjacentPairs(tubes) {
    var p = 0;
    for (var i = 0; i < tubes.length; i++) {
      var t = tubes[i];
      for (var j = 1; j < t.length; j++) if (t[j] === t[j - 1]) p++;
    }
    return p;
  }

  function maxSameInTube(t) {
    var cnt = {};
    var m = 0;
    for (var i = 0; i < t.length; i++) {
      cnt[t[i]] = (cnt[t[i]] || 0) + 1;
      if (cnt[t[i]] > m) m = cnt[t[i]];
    }
    return m;
  }

  function shuffled(k, rnd) {
    var units = [];
    for (var c = 0; c < k; c++) for (var i = 0; i < CAP; i++) units.push(c);
    for (var j = units.length - 1; j > 0; j--) {
      var r = Math.floor(rnd() * (j + 1));
      var tmp = units[j];
      units[j] = units[r];
      units[r] = tmp;
    }
    var tubes = [];
    for (var t = 0; t < k; t++) tubes.push(units.slice(t * CAP, t * CAP + CAP));
    for (var e = 0; e < EMPTY_TUBES; e++) tubes.push([]);
    return tubes;
  }

  function passes(tubes, n, k, maxPairs) {
    for (var i = 0; i < k; i++) {
      if (isComplete(tubes[i])) return false;
      if (n > 2 && maxSameInTube(tubes[i]) >= 3) return false;
    }
    return adjacentPairs(tubes) <= maxPairs;
  }

  var SHUFFLE_TRIES = 4000; // สุ่มสับหาแบบที่ผ่านเงื่อนไขความยาก (ถูกมาก ไม่ต้องรันตัวแก้)
  var SOLVE_TRIES = 40; // จำนวนแบบที่ผ่านเงื่อนไขแล้วส่งเข้าตัวแก้
  var GEN_LIMIT = 2000; // เพดานโหนดตอนสร้างด่าน (แก้ไม่ทัน = ทิ้ง ไปแบบถัดไป · แบบที่แก้ได้ส่วนใหญ่ใช้ < 500 โหนด)

  function level(n) {
    n = Math.max(1, Math.floor(n) || 1);
    var k = colorsFor(n);
    var maxPairs = maxPairsFor(n, k);
    var sub = 0;
    var solveTries = 0;
    var tubes;
    // รอบหลัก: ต้องผ่านเงื่อนไขความยาก + แก้ได้ภายในเพดาน
    while (sub < SHUFFLE_TRIES && solveTries < SOLVE_TRIES) {
      tubes = shuffled(k, rng(seedFor(n, sub++)));
      if (!passes(tubes, n, k, maxPairs)) continue;
      solveTries++;
      if (solve(tubes, { limit: GEN_LIMIT })) return { n: n, colors: k, tubes: tubes };
    }
    // รอบสำรอง (แทบไม่เคยเกิด): ผ่อนเงื่อนไขคู่ติดกัน + เพดานโหนดสูงขึ้น
    for (var extra = 0; extra < 1000; extra++) {
      tubes = shuffled(k, rng(seedFor(n, 100000 + extra)));
      if (!passes(tubes, n, k, Infinity)) continue;
      if (solve(tubes, { limit: 200000 })) return { n: n, colors: k, tubes: tubes };
    }
    // ทางสุดท้าย (ไม่ควรถึง): เรียงเสร็จแล้วเลื่อนชั้นบนสุดวนหลอด — แก้ได้แน่นอน
    tubes = [];
    for (var c = 0; c < k; c++) tubes.push([c, c, c, (c + 1) % k]);
    for (var e = 0; e < EMPTY_TUBES; e++) tubes.push([]);
    return { n: n, colors: k, tubes: tubes };
  }

  return {
    CAP: CAP,
    COLORS: COLORS,
    rng: rng,
    canPour: canPour,
    pour: pour,
    isSolved: isSolved,
    isComplete: isComplete,
    solve: solve,
    hint: hint,
    level: level,
    colorsFor: colorsFor,
    adjacentPairs: adjacentPairs
  };
});
