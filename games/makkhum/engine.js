/*
 * หมากขุม — กติกา + คอม (ใช้ได้ทั้งในเบราว์เซอร์ window.MakKhum และใน node require)
 * กติกาที่ใช้ = docs/makkhum-thai-rules.md หัวข้อ "กติกาที่แนะนำให้ใช้ในเกม" (โหมดเกมเดียวจบ)
 *
 * ช่อง 16 ช่อง เรียงตามทิศหยอด:
 *   0–6  = หลุม (เมือง) ของแดง (ผู้เล่น 0, ล่างจอ) · 0 = ขวาสุด · 6 = ติดหัวเมืองแดง
 *   7    = หัวเมืองแดง (ปลายซ้ายของแดง)
 *   8–14 = หลุมของฟ้า (ผู้เล่น 1, บนจอ) · 8 = ตรงข้ามหลุม 6
 *   15   = หัวเมืองฟ้า
 * หลุมตรงข้ามของ i = 14 - i · หยอดไปทางซ้ายมือของผู้เล่น (มองจากด้านบน = ตามเข็มนาฬิกา)
 * S = { pits: [16], turn: 0|1, over: bool }
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MakKhum = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOLES = 7;
  var SEEDS = 7;
  var STORE = [7, 15];
  var DROP_LIMIT = 3000; // กันเหนียว — ตามกติกาจบเองได้เสมอ

  function initial(starter) {
    var pits = [];
    for (var i = 0; i < 16; i++) pits.push(i === 7 || i === 15 ? 0 : SEEDS);
    return { pits: pits, turn: starter || 0, over: false };
  }

  function ownerOf(i) {
    if (i === 7 || i === 15) return -1;
    return i < 7 ? 0 : 1;
  }

  function holesOf(p) {
    var out = [];
    for (var k = 0; k < HOLES; k++) out.push(p === 0 ? k : 8 + k);
    return out;
  }

  function opposite(i) {
    return 14 - i;
  }

  function seedsOnSide(pits, p) {
    var n = 0;
    holesOf(p).forEach(function (i) {
      n += pits[i];
    });
    return n;
  }

  function legalMoves(S) {
    if (S.over) return [];
    return holesOf(S.turn).filter(function (i) {
      return S.pits[i] > 0;
    });
  }

  /*
   * เดินหลุม i → { state, steps, result }
   * steps (สำหรับแอนิเมชัน): {t:'pick', i, n} · {t:'drop', i} · {t:'capture', from, to, n} · {t:'sweep', from, to, n}
   * result: 'store' (ตกหัวเมืองตัวเอง ได้เดินต่อ) · 'dead' (ตาย แดนคู่แข่ง / หลุมตรงข้ามว่าง) · 'capture' (กินแทน) · 'limit'
   */
  function move(S, i) {
    var pits = S.pits.slice();
    var p = S.turn;
    var own = STORE[p];
    var foe = STORE[1 - p];
    var steps = [];
    var result = 'dead';
    var hand = pits[i];
    pits[i] = 0;
    steps.push({ t: 'pick', i: i, n: hand });
    var pos = i;
    var drops = 0;
    for (;;) {
      while (hand > 0) {
        pos = (pos + 1) % 16;
        if (pos === foe) continue;
        pits[pos]++;
        hand--;
        drops++;
        steps.push({ t: 'drop', i: pos });
      }
      if (pos === own) {
        result = 'store';
        break;
      }
      if (drops > DROP_LIMIT) {
        result = 'limit';
        break;
      }
      if (pits[pos] > 1) {
        // หลุมมีหมากอยู่ก่อน → หยิบทั้งหลุมหยอดต่อ
        hand = pits[pos];
        pits[pos] = 0;
        steps.push({ t: 'pick', i: pos, n: hand });
        continue;
      }
      // หมากตาย (ตกหลุมว่าง)
      if (ownerOf(pos) === p) {
        var o = opposite(pos);
        if (pits[o] > 0) {
          steps.push({ t: 'capture', from: o, to: own, n: pits[o] });
          pits[own] += pits[o];
          pits[o] = 0;
          result = 'capture';
        }
      }
      break;
    }
    var T = { pits: pits, turn: result === 'store' ? p : 1 - p, over: false };
    // ถึงตาใครแล้วฝั่งนั้นไม่มีหมาก = จบ · หมากที่ค้างเข้าหัวเมืองเจ้าของฝั่ง
    if (seedsOnSide(pits, T.turn) === 0) {
      T.over = true;
      [0, 1].forEach(function (q) {
        holesOf(q).forEach(function (h) {
          if (pits[h]) {
            steps.push({ t: 'sweep', from: h, to: STORE[q], n: pits[h] });
            pits[STORE[q]] += pits[h];
            pits[h] = 0;
          }
        });
      });
    }
    return { state: T, steps: steps, result: result };
  }

  // ผล: 0 / 1 ชนะ · 'draw' · null ยังไม่จบ
  function winner(S) {
    if (!S.over) return null;
    var a = S.pits[7];
    var b = S.pits[15];
    return a === b ? 'draw' : a > b ? 0 : 1;
  }

  /* ---------- คอม ---------- */
  function evaluate(S, me) {
    var diff = S.pits[STORE[me]] - S.pits[STORE[1 - me]];
    if (S.over) return diff > 0 ? 1000 + diff : diff < 0 ? -1000 + diff : 0;
    // หมากในแดนตัวเองมีค่าบ้าง (จบรอบแล้วเป็นของเรา)
    return diff * 4 + (seedsOnSide(S.pits, me) - seedsOnSide(S.pits, 1 - me));
  }

  function search(S, depth, alpha, beta, me, deadline, ctx) {
    if (S.over || depth === 0) return evaluate(S, me);
    if (++ctx.nodes % 256 === 0 && Date.now() > deadline) ctx.timeout = true;
    if (ctx.timeout) return evaluate(S, me);
    var moves = legalMoves(S);
    var maxing = S.turn === me;
    var best = maxing ? -Infinity : Infinity;
    for (var k = 0; k < moves.length; k++) {
      var r = move(S, moves[k]);
      // ได้เดินต่อ = ไม่นับเป็นชั้นเต็ม (ยังเป็นตาเดิม)
      var v = search(r.state, r.result === 'store' ? depth : depth - 1, alpha, beta, me, deadline, ctx);
      if (maxing) {
        if (v > best) best = v;
        if (best > alpha) alpha = best;
      } else {
        if (v < best) best = v;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break;
    }
    return best;
  }

  /*
   * คอมเลือกหลุม: level 1 = ง่าย (มักเลือกหลุมที่ได้เดินต่อ/กินได้ทันที ไม่งั้นสุ่ม) · 2 = ยาก (มองล่วงหน้า จำกัดเวลา)
   * → หมายเลขหลุม หรือ -1 ถ้าไม่มีตาเดิน
   */
  function choose(S, level, rnd, timeMs) {
    rnd = rnd || Math.random;
    var moves = legalMoves(S);
    if (!moves.length) return -1;
    var me = S.turn;
    if (level !== 2) {
      if (rnd() < 0.55) {
        var bestGain = -Infinity;
        var picks = [];
        moves.forEach(function (i) {
          var r = move(S, i);
          var gain = r.state.pits[STORE[me]] - S.pits[STORE[me]] + (r.result === 'store' ? 3 : 0);
          if (gain > bestGain) {
            bestGain = gain;
            picks = [i];
          } else if (gain === bestGain) picks.push(i);
        });
        return picks[Math.floor(rnd() * picks.length)];
      }
      return moves[Math.floor(rnd() * moves.length)];
    }
    var deadline = Date.now() + (timeMs || 450);
    var bestMove = moves[0];
    for (var depth = 1; depth <= 12; depth++) {
      var ctx = { nodes: 0, timeout: false };
      var bestVal = -Infinity;
      var cand = [];
      for (var k = 0; k < moves.length; k++) {
        var r = move(S, moves[k]);
        var v = search(r.state, r.result === 'store' ? depth : depth - 1, -Infinity, Infinity, me, deadline, ctx);
        if (v > bestVal) {
          bestVal = v;
          cand = [moves[k]];
        } else if (v === bestVal) cand.push(moves[k]);
      }
      if (ctx.timeout) break;
      bestMove = cand[Math.floor(rnd() * cand.length)];
      if (Date.now() > deadline) break;
    }
    return bestMove;
  }

  return {
    HOLES: HOLES,
    SEEDS: SEEDS,
    STORE: STORE,
    initial: initial,
    ownerOf: ownerOf,
    holesOf: holesOf,
    opposite: opposite,
    seedsOnSide: seedsOnSide,
    legalMoves: legalMoves,
    move: move,
    winner: winner,
    choose: choose
  };
});
