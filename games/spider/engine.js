/*
 * สไปเดอร์ — กติกาล้วน ๆ (ใช้ได้ทั้งในเบราว์เซอร์ window.Spider และใน node require)
 * ไพ่ 2 สำรับ = 104 ใบ · id 0–103 · ชุดที่ floor(id/13) (0–7) · แต้ม = id%13 + 1
 * ดอกของแต่ละชุดขึ้นกับโหมด 1 ดอก (โพดำล้วน) · 2 ดอก (โพดำ+โพแดง) · 4 ดอก
 * S = { suits, cols: [10 แถว ล่าง→บน], down: [จำนวนใบคว่ำล่างสุดของแต่ละแถว], stock: [..], done: [ดอกของชุดที่เก็บแล้ว] }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Spider = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SUIT_SETS = {
    1: [0, 0, 0, 0, 0, 0, 0, 0],
    2: [0, 1, 0, 1, 0, 1, 0, 1],
    4: [0, 1, 2, 3, 0, 1, 2, 3]
  };

  function rank(id) {
    return (id % 13) + 1;
  }
  function suitOf(suits, id) {
    return SUIT_SETS[suits][Math.floor(id / 13)];
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

  function deal(suits, seed) {
    if (!SUIT_SETS[suits]) suits = 1;
    var rnd = rng(seed == null ? Math.floor(Math.random() * 4294967296) : seed);
    var deck = [];
    for (var i = 0; i < 104; i++) deck.push(i);
    for (i = 103; i > 0; i--) {
      var r = Math.floor(rnd() * (i + 1));
      var t = deck[i];
      deck[i] = deck[r];
      deck[r] = t;
    }
    var cols = [];
    var down = [];
    for (var c = 0; c < 10; c++) {
      var n = c < 4 ? 6 : 5;
      cols.push(deck.splice(0, n));
      down.push(n - 1);
    }
    return { suits: suits, cols: cols, down: down, stock: deck, done: [] };
  }

  function clone(S) {
    return {
      suits: S.suits,
      cols: S.cols.map(function (c) {
        return c.slice();
      }),
      down: S.down.slice(),
      stock: S.stock.slice(),
      done: S.done.slice()
    };
  }

  // ไพ่ตั้งแต่ index i ถึงบนสุด = หงายหมด + ดอกเดียวกัน + เรียงลดทีละ 1
  function isRun(S, c, i) {
    var col = S.cols[c];
    if (i < S.down[c] || i >= col.length) return false;
    for (var k = i; k < col.length - 1; k++) {
      if (suitOf(S.suits, col[k]) !== suitOf(S.suits, col[k + 1])) return false;
      if (rank(col[k]) !== rank(col[k + 1]) + 1) return false;
    }
    return true;
  }

  function legal(S, from, i, to) {
    if (from === to || !isRun(S, from, i)) return false;
    var dest = S.cols[to];
    if (!dest.length) return true;
    return rank(dest[dest.length - 1]) === rank(S.cols[from][i]) + 1;
  }

  // ชุด K→A ดอกเดียวกันบนสุดของแถว c → เก็บออก
  function collect(T, c) {
    var col = T.cols[c];
    if (col.length < 13) return false;
    var i = col.length - 13;
    if (rank(col[i]) !== 13 || !isRun(T, c, i)) return false;
    T.done.push(suitOf(T.suits, col[i]));
    col.splice(i, 13);
    flip(T, c);
    return true;
  }

  function flip(T, c) {
    if (T.down[c] > 0 && T.down[c] >= T.cols[c].length) T.down[c] = T.cols[c].length - 1;
    if (T.down[c] < 0) T.down[c] = 0;
  }

  /* ย้ายไพ่จากแถว from ตั้งแต่ index i ไปแถว to → { state, collected } */
  function move(S, from, i, to) {
    var T = clone(S);
    var cards = T.cols[from].splice(i);
    Array.prototype.push.apply(T.cols[to], cards);
    flip(T, from);
    var got = collect(T, to);
    return { state: T, collected: got };
  }

  function canDeal(S) {
    if (!S.stock.length) return 'empty';
    for (var c = 0; c < 10; c++) if (!S.cols[c].length) return 'gap';
    return '';
  }

  /* แจกจากกอง 1 ใบทุกแถว (ต้องไม่มีแถวว่าง) */
  function dealRow(S) {
    var T = clone(S);
    var got = 0;
    for (var c = 0; c < 10; c++) T.cols[c].push(T.stock.shift());
    for (c = 0; c < 10; c++) if (collect(T, c)) got++;
    return { state: T, collected: got };
  }

  /* แตะไพ่ → ที่ลงที่ดีที่สุด: ต่อดอกเดียวกัน → ต่อดอกอื่น → แถวว่าง */
  function bestMove(S, from, i) {
    if (!isRun(S, from, i)) return -1;
    var s = suitOf(S.suits, S.cols[from][i]);
    var same = -1;
    var other = -1;
    var empty = -1;
    for (var k = 1; k <= 10; k++) {
      var c = (from + k) % 10;
      if (!legal(S, from, i, c)) continue;
      var dest = S.cols[c];
      if (!dest.length) {
        if (i > 0 && empty === -1) empty = c; // ย้ายทั้งแถวไปแถวว่าง ไม่มีประโยชน์
      } else if (suitOf(S.suits, dest[dest.length - 1]) === s) {
        if (same === -1) same = c;
      } else if (other === -1) other = c;
    }
    return same !== -1 ? same : other !== -1 ? other : empty;
  }

  function isWon(S) {
    return S.done.length === 8;
  }

  return {
    SUIT_SETS: SUIT_SETS,
    rank: rank,
    suitOf: suitOf,
    rng: rng,
    deal: deal,
    clone: clone,
    isRun: isRun,
    legal: legal,
    move: move,
    canDeal: canDeal,
    dealRow: dealRow,
    bestMove: bestMove,
    isWon: isWon
  };
});
