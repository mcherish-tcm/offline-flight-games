/*
 * ฟรีเซลล์ — กติกาล้วน ๆ (ใช้ได้ทั้งในเบราว์เซอร์ window.FreeCell และใน node require)
 * ไพ่ id = ดอก*13 + (แต้ม-1) · ดอก 0 โพดำ · 1 โพแดง · 2 ข้าวหลามตัด · 3 ดอกจิก
 * S = { cols: [8 แถว ล่าง→บน], cells: [4 ช่องพัก, -1 = ว่าง], found: [จำนวนไพ่บนกองของแต่ละดอก] }
 * ตำแหน่ง: { t: 'col', i } · { t: 'cell', i } · { t: 'found' }
 * แจกไพ่ตามเลขเกมแบบมาตรฐาน (เลขเดียวกัน = แจกเหมือนกันทุกเครื่อง/ทุกแอป FreeCell ทั่วไป)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FreeCell = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAX_DEAL = 32000;
  var BAD_DEALS = [11982]; // เกมเดียวในช่วง 1–32000 ที่พิสูจน์แล้วว่าไม่มีทางชนะ

  function suit(id) {
    return Math.floor(id / 13);
  }
  function rank(id) {
    return (id % 13) + 1;
  }
  function red(id) {
    var s = suit(id);
    return s === 1 || s === 2;
  }

  // การแจกแบบมาตรฐาน: LCG (214013, 2531011) · ไพ่ลำดับ A♣ A♦ A♥ A♠ 2♣ … · วางทีละแถวซ้าย→ขวา
  var MS_SUIT = [3, 2, 1, 0]; // ♣ ♦ ♥ ♠ → ดอกของเรา
  function deal(n) {
    var seed = n % 2147483648;
    function rnd() {
      seed = (seed * 214013 + 2531011) % 2147483648;
      return Math.floor(seed / 65536);
    }
    var cards = [];
    for (var i = 0; i < 52; i++) cards.push(i);
    var cols = [[], [], [], [], [], [], [], []];
    var left = 52;
    for (i = 0; i < 52; i++) {
      var j = rnd() % left;
      var ms = cards[j];
      cards[j] = cards[left - 1];
      left--;
      var r = Math.floor(ms / 4) + 1;
      cols[i % 8].push(MS_SUIT[ms % 4] * 13 + r - 1);
    }
    return { cols: cols, cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] };
  }

  function randomDealNumber(rnd) {
    rnd = rnd || Math.random;
    var n;
    do {
      n = 1 + Math.floor(rnd() * MAX_DEAL);
    } while (BAD_DEALS.indexOf(n) !== -1);
    return n;
  }

  function clone(S) {
    return {
      cols: S.cols.map(function (c) {
        return c.slice();
      }),
      cells: S.cells.slice(),
      found: S.found.slice()
    };
  }

  function stacks(a, b) {
    // วาง a บน b ได้ไหม (สีสลับ แต้มน้อยกว่า 1)
    return red(a) !== red(b) && rank(b) === rank(a) + 1;
  }

  // ไพ่ตั้งแต่ index i ถึงบนสุดของแถว เรียงถูกต้องไหม
  function isRun(col, i) {
    for (var k = i; k < col.length - 1; k++) if (!stacks(col[k + 1], col[k])) return false;
    return true;
  }

  function freeCells(S) {
    return S.cells.filter(function (c) {
      return c === -1;
    }).length;
  }

  function emptyCols(S) {
    return S.cols.filter(function (c) {
      return !c.length;
    }).length;
  }

  // ย้ายได้ทีละกี่ใบ (supermove) = (ช่องพักว่าง + 1) × 2^(แถวว่าง) · ถ้าย้ายไปแถวว่าง ไม่นับแถวนั้น
  function maxMove(S, toEmpty) {
    var e = emptyCols(S) - (toEmpty ? 1 : 0);
    return (freeCells(S) + 1) * Math.pow(2, Math.max(0, e));
  }

  function cardsAt(S, from, n) {
    if (from.t === 'cell') return S.cells[from.i] === -1 ? [] : [S.cells[from.i]];
    var col = S.cols[from.i];
    return col.slice(col.length - n);
  }

  function canFound(S, id) {
    return S.found[suit(id)] === rank(id) - 1;
  }

  /* ย้าย n ใบจาก from ไป to ได้ไหม */
  function legal(S, from, n, to) {
    if (!n || n < 1) return false;
    var moving;
    if (from.t === 'cell') {
      if (n !== 1 || S.cells[from.i] === -1) return false;
      moving = [S.cells[from.i]];
    } else if (from.t === 'col') {
      var col = S.cols[from.i];
      if (n > col.length || !isRun(col, col.length - n)) return false;
      moving = col.slice(col.length - n);
    } else return false;
    var first = moving[0];
    if (to.t === 'found') return n === 1 && canFound(S, first);
    if (to.t === 'cell') return n === 1 && S.cells[to.i] === -1 && !(from.t === 'cell' && from.i === to.i);
    if (to.t === 'col') {
      if (from.t === 'col' && from.i === to.i) return false;
      var dest = S.cols[to.i];
      if (!dest.length) return n <= maxMove(S, true);
      return n <= maxMove(S, false) && stacks(first, dest[dest.length - 1]);
    }
    return false;
  }

  function apply(S, from, n, to) {
    var T = clone(S);
    var moving;
    if (from.t === 'cell') {
      moving = [T.cells[from.i]];
      T.cells[from.i] = -1;
    } else {
      moving = T.cols[from.i].splice(T.cols[from.i].length - n, n);
    }
    if (to.t === 'found') T.found[suit(moving[0])]++;
    else if (to.t === 'cell') T.cells[to.i] = moving[0];
    else Array.prototype.push.apply(T.cols[to.i], moving);
    return T;
  }

  // ขึ้นกองอัตโนมัติได้อย่างปลอดภัย: แต้ม ≤ 2 หรือไพ่สีตรงข้ามแต้มน้อยกว่า 1 ขึ้นกองครบทั้งสองดอกแล้ว
  function safeToFound(S, id) {
    if (!canFound(S, id)) return false;
    var r = rank(id);
    if (r <= 2) return true;
    var opp = red(id) ? [0, 3] : [1, 2];
    return S.found[opp[0]] >= r - 1 && S.found[opp[1]] >= r - 1;
  }

  // ตาเดินอัตโนมัติถัดไป 1 ตา (หรือ null)
  function nextAuto(S) {
    for (var i = 0; i < 4; i++) {
      if (S.cells[i] !== -1 && safeToFound(S, S.cells[i])) return { from: { t: 'cell', i: i }, n: 1, to: { t: 'found' } };
    }
    for (i = 0; i < 8; i++) {
      var col = S.cols[i];
      if (col.length && safeToFound(S, col[col.length - 1])) return { from: { t: 'col', i: i }, n: 1, to: { t: 'found' } };
    }
    return null;
  }

  /*
   * แตะไพ่ → หาที่ลงให้เอง: ขึ้นกอง → ต่อบนแถวที่มีไพ่ → แถวว่าง → ช่องพัก
   * from + n = ไพ่ที่แตะ (n = จำนวนใบจากใบที่แตะถึงบนสุด)
   */
  function bestMove(S, from, n) {
    if (n === 1 && legal(S, from, 1, { t: 'found' })) return { t: 'found' };
    var start = from.t === 'col' ? from.i : -1;
    var empty = null;
    for (var k = 1; k <= 8; k++) {
      var i = (start + k + 8) % 8;
      var to = { t: 'col', i: i };
      if (!legal(S, from, n, to)) continue;
      if (S.cols[i].length) return to;
      // ย้ายทั้งแถวไปแถวว่างอีกแถว ไม่มีประโยชน์
      if (!empty && !(from.t === 'col' && S.cols[from.i].length === n)) empty = to;
    }
    if (empty) return empty;
    if (n === 1 && from.t === 'col') {
      for (i = 0; i < 4; i++) if (S.cells[i] === -1) return { t: 'cell', i: i };
    }
    return null;
  }

  function isWon(S) {
    return S.found.every(function (f) {
      return f === 13;
    });
  }

  // ยังมีตาเดินที่มีความหมายไหม (ใช้บอก "ติดแล้ว")
  function hasMoves(S) {
    var froms = [];
    for (var i = 0; i < 4; i++) if (S.cells[i] !== -1) froms.push({ from: { t: 'cell', i: i }, n: 1 });
    for (i = 0; i < 8; i++) {
      var col = S.cols[i];
      for (var n = 1; n <= col.length && isRun(col, col.length - n); n++) froms.push({ from: { t: 'col', i: i }, n: n });
    }
    var tos = [{ t: 'found' }];
    for (i = 0; i < 8; i++) tos.push({ t: 'col', i: i });
    var cell = S.cells.indexOf(-1);
    if (cell !== -1) tos.push({ t: 'cell', i: cell });
    for (var a = 0; a < froms.length; a++) {
      for (var b = 0; b < tos.length; b++) {
        var f = froms[a];
        var t = tos[b];
        if (!legal(S, f.from, f.n, t)) continue;
        // ช่องพัก ↔ ช่องพัก หรือย้ายทั้งแถวไปแถวว่าง = ไม่นับ
        if (f.from.t === 'cell' && t.t === 'cell') continue;
        if (f.from.t === 'col' && t.t === 'col' && !S.cols[t.i].length && S.cols[f.from.i].length === f.n) continue;
        return true;
      }
    }
    return false;
  }

  return {
    MAX_DEAL: MAX_DEAL,
    BAD_DEALS: BAD_DEALS,
    suit: suit,
    rank: rank,
    red: red,
    deal: deal,
    randomDealNumber: randomDealNumber,
    clone: clone,
    stacks: stacks,
    isRun: isRun,
    maxMove: maxMove,
    cardsAt: cardsAt,
    legal: legal,
    apply: apply,
    safeToFound: safeToFound,
    nextAuto: nextAuto,
    bestMove: bestMove,
    isWon: isWon,
    hasMoves: hasMoves
  };
});
