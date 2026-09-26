/*
 * หมากฮอสไทย — คอม (ใช้ได้ทั้งในเบราว์เซอร์ window.MakhosAI และใน node require)
 * เลือกตาเดินจาก Makhos.legalMoves เท่านั้น → ทำตามกติกาบ้านเราทุกข้อเหมือนคน
 * (บังคับกิน/ไม่บังคับกิน, กินต่อจนสุด, ฮอสลงช่องที่ติดหลังตัวที่ถูกกิน)
 * ง่าย = มองล่วงหน้า 2 ตา แต่ใส่ความมั่วเยอะ · ยาก = alpha-beta ลึกขึ้นเรื่อย ๆ จนหมดเวลา (ค่าเริ่มต้น 450 ms)
 */
(function (root, factory) {
  var M = typeof module === 'object' && module.exports ? require('./engine.js') : root.Makhos;
  var api = factory(M);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MakhosAI = api;
})(typeof self !== 'undefined' ? self : this, function (M) {
  'use strict';

  var MAN = 100;
  var KING = 320; // ฮอสเดินไกลได้ → มีค่ามากกว่าเบี้ยหลายเท่า
  var WIN = 100000;

  /* คะแนนกระดานจากมุมของ p (บวก = p ได้เปรียบ) */
  function evaluate(board, p) {
    var s = 0;
    var mine = 0;
    var theirs = 0;
    for (var i = 0; i < 64; i++) {
      var v = board[i];
      if (!v) continue;
      var o = M.owner(v);
      var r = i >> 3;
      var c = i & 7;
      var val;
      if (M.isKing(v)) {
        val = KING;
      } else {
        var adv = o === 0 ? 7 - r : r; // เดินหน้ามากี่แถวแล้ว
        val = MAN + adv * 5;
        if (adv === 0) val += 6; // แถวหลังช่วยกันฮอสอีกฝ่าย
      }
      if (c === 0 || c === 7) val += 4; // ขอบกระดานถูกกินยาก
      if (o === p) {
        s += val;
        mine++;
      } else {
        s -= val;
        theirs++;
      }
    }
    // ได้เปรียบแล้วให้แลกหมาก (เหลือน้อย = ปิดเกมง่าย)
    if (s > 0 && mine + theirs) s += Math.round((s * 8) / (mine + theirs));
    return s;
  }

  function ordered(moves) {
    return moves.slice().sort(function (a, b) {
      return b.captures.length - a.captures.length || (b.promote ? 1 : 0) - (a.promote ? 1 : 0);
    });
  }

  function Timeout() {}

  function search(board, p, opts, maxDepth, budgetMs, noise, rnd) {
    var deadline = Date.now() + budgetMs;
    var nodes = 0;

    function negamax(b, turn, depth, alpha, beta, ply) {
      if ((++nodes & 255) === 0 && Date.now() > deadline) throw new Timeout();
      var moves = M.legalMoves(b, turn, opts);
      if (!moves.length) return -WIN + ply; // ไม่มีตาเดิน/ไม่เหลือหมาก = แพ้
      if (depth <= 0) {
        // ถ้ายังมีการกินค้างอยู่ ให้ดูต่ออีกนิด (กันมองข้ามการกินกลับ)
        if (depth > -4 && moves[0].captures.length && opts.forceCapture !== false) {
          /* ดูต่อ */
        } else {
          return evaluate(b, turn);
        }
      }
      moves = ordered(moves);
      var best = -Infinity;
      for (var k = 0; k < moves.length; k++) {
        var s = -negamax(M.applyMove(b, moves[k]), 1 - turn, depth - 1, -beta, -alpha, ply + 1);
        if (s > best) best = s;
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      }
      return best;
    }

    var moves = ordered(M.legalMoves(board, p, opts));
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    var best = moves[0];
    var order = moves;
    for (var depth = 1; depth <= maxDepth; depth++) {
      try {
        var scored = [];
        var alpha = -Infinity;
        for (var k = 0; k < order.length; k++) {
          var s = -negamax(M.applyMove(board, order[k]), 1 - p, depth - 1, -Infinity, noise ? Infinity : -alpha, 1);
          if (noise) s += (rnd() - 0.5) * noise;
          scored.push({ m: order[k], s: s });
          if (s > alpha) alpha = s;
        }
        scored.sort(function (a, b) {
          return b.s - a.s;
        });
        order = scored.map(function (x) {
          return x.m;
        });
        best = order[0];
        if (!noise && (scored[0].s >= WIN - 200 || scored[0].s <= -WIN + 200)) break;
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
    return best;
  }

  /*
   * ตาเดินของคอม: board, p (ฝ่ายคอม), level 1|2, rnd, opts { forceCapture, budget }
   * → move object จาก Makhos.legalMoves (หรือ null ถ้าไม่มีตาเดิน)
   */
  function choose(board, p, level, rnd, opts) {
    rnd = rnd || Math.random;
    opts = opts || {};
    var rules = { forceCapture: opts.forceCapture !== false };
    var moves = M.legalMoves(board, p, rules);
    if (!moves.length) return null;
    if (level !== 2) {
      if (rnd() < 0.25) return moves[Math.floor(rnd() * moves.length)];
      return search(board, p, rules, 2, 200, 180, rnd);
    }
    return search(board, p, rules, 30, opts.budget || 450, 0, rnd);
  }

  /* คอมยอมเสมอไหม: ยอมเมื่อไม่ได้เปรียบชัดเจน */
  function acceptsDraw(board, p) {
    return evaluate(board, p) <= 60;
  }

  return { choose: choose, evaluate: evaluate, acceptsDraw: acceptsDraw };
});
