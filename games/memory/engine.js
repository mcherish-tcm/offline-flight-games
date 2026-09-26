/*
 * จับคู่ไพ่ความจำ — กติกาล้วน ๆ (ใช้ได้ทั้งในเบราว์เซอร์ window.Memory และใน node require)
 * S = { size, deck: [เลขภาพ ×2 ต่อคู่], matched: [bool], open: [index ที่เปิดอยู่ (≤2)], pending: bool,
 *       duo: bool, turn: 0|1, pairs: [คู่ของแดง, คู่ของฟ้า], moves, over }
 * เปิดใบที่ 2 แล้ว: ตรงกัน = ได้คู่ + เล่นต่อ · ไม่ตรง = pending (รอปิด) → hide() ปิดคืน + เปลี่ยนตา (โหมด 2 คน)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Memory = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SYMBOLS = 20;
  var SIZES = {
    s: { cols: 4, rows: 4, label: '4×4 (8 คู่)' },
    m: { cols: 4, rows: 6, label: '4×6 (12 คู่)' },
    l: { cols: 6, rows: 6, label: '6×6 (18 คู่)' }
  };

  function pairsOf(size) {
    var z = SIZES[size] || SIZES.s;
    return (z.cols * z.rows) / 2;
  }

  function deal(size, duo, starter, rnd) {
    rnd = rnd || Math.random;
    if (!SIZES[size]) size = 's';
    var n = pairsOf(size);
    // สุ่มภาพที่จะใช้จากทั้งหมด แล้วใส่ใบละ 2
    var pool = [];
    for (var i = 0; i < SYMBOLS; i++) pool.push(i);
    shuffle(pool, rnd);
    var deck = [];
    for (i = 0; i < n; i++) deck.push(pool[i], pool[i]);
    shuffle(deck, rnd);
    return {
      size: size,
      deck: deck,
      matched: deck.map(function () {
        return false;
      }),
      open: [],
      pending: false,
      duo: !!duo,
      turn: starter || 0,
      starter: starter || 0,
      pairs: [0, 0],
      moves: 0,
      over: false
    };
  }

  function shuffle(a, rnd) {
    for (var i = a.length - 1; i > 0; i--) {
      var r = Math.floor(rnd() * (i + 1));
      var t = a[i];
      a[i] = a[r];
      a[r] = t;
    }
    return a;
  }

  function clone(S) {
    var T = {};
    for (var k in S) T[k] = S[k];
    T.deck = S.deck.slice();
    T.matched = S.matched.slice();
    T.open = S.open.slice();
    T.pairs = S.pairs.slice();
    return T;
  }

  /* เปิดใบ i → { state, event: 'open' | 'match' | 'miss' | 'invalid' } */
  function reveal(S, i) {
    if (S.over || S.pending || i < 0 || i >= S.deck.length || S.matched[i] || S.open.indexOf(i) !== -1) {
      return { state: S, event: 'invalid' };
    }
    var T = clone(S);
    T.open.push(i);
    if (T.open.length < 2) return { state: T, event: 'open' };
    T.moves++;
    var a = T.open[0];
    var b = T.open[1];
    if (T.deck[a] === T.deck[b]) {
      T.matched[a] = true;
      T.matched[b] = true;
      T.open = [];
      T.pairs[T.duo ? T.turn : 0]++;
      if (T.matched.every(Boolean)) T.over = true;
      return { state: T, event: 'match' };
    }
    T.pending = true;
    return { state: T, event: 'miss' };
  }

  /* ปิดคู่ที่ไม่ตรงกลับ + เปลี่ยนตา (โหมด 2 คน) */
  function hide(S) {
    if (!S.pending) return S;
    var T = clone(S);
    T.open = [];
    T.pending = false;
    if (T.duo) T.turn = 1 - T.turn;
    return T;
  }

  // ผลโหมด 2 คน: 0 / 1 / 'draw' · null ยังไม่จบ
  function winner(S) {
    if (!S.over || !S.duo) return null;
    return S.pairs[0] === S.pairs[1] ? 'draw' : S.pairs[0] > S.pairs[1] ? 0 : 1;
  }

  return {
    SYMBOLS: SYMBOLS,
    SIZES: SIZES,
    pairsOf: pairsOf,
    deal: deal,
    reveal: reveal,
    hide: hide,
    winner: winner
  };
});
