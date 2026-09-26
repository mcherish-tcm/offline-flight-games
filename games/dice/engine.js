/*
 * ไฟว์ไดซ์ (ลูกเต๋า 5 ลูก 13 ช่อง) — กติกาล้วน ๆ (ใช้ได้ทั้งในเบราว์เซอร์ window.FiveDice และใน node require)
 * ช่อง: 0–5 = หน้า 1–6 (รวมเฉพาะหน้านั้น) · 6 ตอง (3 เหมือน · รวมทุกลูก) · 7 สี่เหมือน (รวมทุกลูก) · 8 ฟูลเฮาส์ (3+2 = 25)
 *       9 เรียง 4 (30) · 10 เรียง 5 (40) · 11 ไฟว์ไดซ์ (5 เหมือน = 50) · 12 รวมทุกลูก
 * โบนัสบน: ช่อง 1–6 รวม ≥ 63 → +35 · ไฟว์ไดซ์ซ้ำ (ช่อง 11 ได้ 50 ไปแล้ว) → +100 ต่อครั้ง
 * กฎ "โจ๊กเกอร์" (แบบบังคับ): ทอยได้ 5 เหมือนแต่ช่อง 11 ลงไปแล้ว → ต้องลงช่องหน้าเดียวกันด้านบนถ้ายังว่าง ·
 *   ไม่ว่าง → ลงช่องล่างช่องไหนก็ได้ (ฟูลเฮาส์/เรียง ได้เต็มแต้ม) · ช่องล่างเต็ม → ลงช่องบนที่ว่าง ได้ 0
 * S = { cards: [{ s: [13 ช่อง null|แต้ม], fb: จำนวนโบนัสไฟว์ไดซ์ }], turn, starter, dice[5], held[5], rolls (ทอยไปแล้วกี่ครั้งในตานี้ 0–3), over }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FiveDice = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CATS = 13;
  var FIVE = 11;
  var MAX_ROLLS = 3;
  var UPPER_BONUS_AT = 63;
  var UPPER_BONUS = 35;
  var FIVE_BONUS = 100;

  function counts(dice) {
    var c = [0, 0, 0, 0, 0, 0, 0];
    dice.forEach(function (d) {
      c[d]++;
    });
    return c;
  }

  function sum(dice) {
    return dice.reduce(function (a, b) {
      return a + b;
    }, 0);
  }

  function isFive(dice) {
    return dice.length === 5 && dice.every(function (d) {
      return d === dice[0];
    });
  }

  function hasRun(c, len) {
    var run = 0;
    for (var v = 1; v <= 6; v++) {
      run = c[v] ? run + 1 : 0;
      if (run >= len) return true;
    }
    return false;
  }

  // แต้มตามกติกาปกติ (ยังไม่คิดโจ๊กเกอร์)
  function raw(cat, dice) {
    var c = counts(dice);
    if (cat <= 5) return c[cat + 1] * (cat + 1);
    var max = Math.max.apply(null, c);
    switch (cat) {
      case 6:
        return max >= 3 ? sum(dice) : 0;
      case 7:
        return max >= 4 ? sum(dice) : 0;
      case 8:
        return c.indexOf(3) !== -1 && c.indexOf(2) !== -1 ? 25 : 0;
      case 9:
        return hasRun(c, 4) ? 30 : 0;
      case 10:
        return hasRun(c, 5) ? 40 : 0;
      case 11:
        return max === 5 ? 50 : 0;
      case 12:
        return sum(dice);
    }
    return 0;
  }

  /* ช่องที่ลงได้ตอนนี้ + แต้มที่จะได้ → [{ cat, score }] (score ไม่รวมโบนัส +100) */
  function options(card, dice) {
    var s = card.s;
    var open = [];
    for (var k = 0; k < CATS; k++) if (s[k] == null) open.push(k);
    var joker = isFive(dice) && s[FIVE] != null;
    if (!joker) {
      return open.map(function (k) {
        return { cat: k, score: raw(k, dice) };
      });
    }
    var face = dice[0] - 1;
    if (s[face] == null) return [{ cat: face, score: raw(face, dice) }];
    var lower = open.filter(function (k) {
      return k >= 6;
    });
    if (lower.length) {
      return lower.map(function (k) {
        var v = k === 8 ? 25 : k === 9 ? 30 : k === 10 ? 40 : raw(k, dice);
        return { cat: k, score: v };
      });
    }
    return open.map(function (k) {
      return { cat: k, score: 0 };
    });
  }

  function totals(card) {
    var s = card.s;
    var upper = 0;
    var lower = 0;
    for (var k = 0; k < CATS; k++) {
      if (s[k] == null) continue;
      if (k <= 5) upper += s[k];
      else lower += s[k];
    }
    var bonus = upper >= UPPER_BONUS_AT ? UPPER_BONUS : 0;
    var fiveBonus = (card.fb || 0) * FIVE_BONUS;
    return { upper: upper, bonus: bonus, lower: lower, fiveBonus: fiveBonus, total: upper + bonus + lower + fiveBonus };
  }

  function newCard() {
    var s = [];
    for (var k = 0; k < CATS; k++) s.push(null);
    return { s: s, fb: 0 };
  }

  function newGame(players, starter) {
    var cards = [];
    for (var p = 0; p < (players === 2 ? 2 : 1); p++) cards.push(newCard());
    return { cards: cards, turn: starter || 0, starter: starter || 0, dice: [1, 2, 3, 4, 5], held: [false, false, false, false, false], rolls: 0, over: false };
  }

  function clone(S) {
    return {
      cards: S.cards.map(function (c) {
        return { s: c.s.slice(), fb: c.fb };
      }),
      turn: S.turn,
      starter: S.starter,
      dice: S.dice.slice(),
      held: S.held.slice(),
      rolls: S.rolls,
      over: S.over
    };
  }

  function canRoll(S) {
    return !S.over && S.rolls < MAX_ROLLS && !(S.rolls > 0 && S.held.every(Boolean));
  }

  function roll(S, rnd) {
    if (!canRoll(S)) return S;
    rnd = rnd || Math.random;
    var T = clone(S);
    if (T.rolls === 0) T.held = [false, false, false, false, false];
    for (var i = 0; i < 5; i++) if (!T.held[i]) T.dice[i] = 1 + Math.floor(rnd() * 6);
    T.rolls++;
    return T;
  }

  function toggleHold(S, i) {
    if (S.over || S.rolls === 0 || S.rolls >= MAX_ROLLS) return S;
    var T = clone(S);
    T.held[i] = !T.held[i];
    return T;
  }

  /* ลงแต้มช่อง cat → state ใหม่ (ถ้าลงไม่ได้ คืน S เดิม) */
  function score(S, cat) {
    if (S.over || S.rolls === 0) return S;
    var card = S.cards[S.turn];
    var opt = options(card, S.dice).filter(function (o) {
      return o.cat === cat;
    })[0];
    if (!opt) return S;
    var T = clone(S);
    var c = T.cards[T.turn];
    if (isFive(S.dice) && card.s[FIVE] === 50) c.fb++;
    c.s[cat] = opt.score;
    T.rolls = 0;
    T.held = [false, false, false, false, false];
    var full = T.cards.every(function (x) {
      return x.s.every(function (v) {
        return v != null;
      });
    });
    if (full) T.over = true;
    else T.turn = (T.turn + 1) % T.cards.length;
    return T;
  }

  // ผล: index ผู้ชนะ · 'draw' · null (ยังไม่จบ)
  function winner(S) {
    if (!S.over) return null;
    if (S.cards.length === 1) return 0;
    var a = totals(S.cards[0]).total;
    var b = totals(S.cards[1]).total;
    return a === b ? 'draw' : a > b ? 0 : 1;
  }

  return {
    CATS: CATS,
    FIVE: FIVE,
    MAX_ROLLS: MAX_ROLLS,
    UPPER_BONUS_AT: UPPER_BONUS_AT,
    raw: raw,
    options: options,
    totals: totals,
    newGame: newGame,
    canRoll: canRoll,
    roll: roll,
    toggleHold: toggleHold,
    score: score,
    winner: winner
  };
});
