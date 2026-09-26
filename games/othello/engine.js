/*
 * โอเทลโล (Othello / Reversi) — กติกาล้วน + คอม · ใช้ได้ทั้งในเบราว์เซอร์ (window.Othello) และใน node (require)
 *
 * กระดาน = array 64 ช่อง, index = แถว*8 + หลัก, แถว 0 = บนสุดของจอ · -1 ว่าง · 0 แดง · 1 ฟ้า
 * กติกามาตรฐาน:
 *  - เริ่มด้วย 4 เม็ดกลางกระดาน (แดง d5/e4 · ฟ้า d4/e5) · ใครเริ่มก่อนสลับกันทุกตา
 *  - ลงเม็ดได้เฉพาะช่องที่ "หนีบ" เม็ดอีกฝ่ายเป็นแนวตรง (8 ทิศ) ได้อย่างน้อย 1 เม็ด → เม็ดที่ถูกหนีบพลิกเป็นสีเรา
 *  - ไม่มีช่องลง = ข้ามตา (อัตโนมัติ) · ทั้งสองฝ่ายไม่มีช่องลง = จบเกม นับเม็ด มากกว่าชนะ เท่ากัน = เสมอ
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Othello = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DIRS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];

  function initialBoard() {
    var b = [];
    for (var i = 0; i < 64; i++) b.push(-1);
    b[27] = 1; // d4
    b[28] = 0; // e4
    b[35] = 0; // d5
    b[36] = 1; // e5
    return b;
  }

  /* เม็ดที่จะพลิกถ้า p ลงที่ช่อง i (array ว่าง = ลงไม่ได้) */
  function flipsFor(board, i, p) {
    if (board[i] !== -1) return [];
    var out = [];
    var r0 = i >> 3;
    var c0 = i & 7;
    for (var d = 0; d < 8; d++) {
      var dr = DIRS[d][0];
      var dc = DIRS[d][1];
      var r = r0 + dr;
      var c = c0 + dc;
      var run = [];
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === 1 - p) {
        run.push(r * 8 + c);
        r += dr;
        c += dc;
      }
      if (run.length && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r * 8 + c] === p) {
        for (var k = 0; k < run.length; k++) out.push(run[k]);
      }
    }
    return out;
  }

  /* ช่องที่ p ลงได้ทั้งหมด → [{ i, flips:[...] }] */
  function legalMoves(board, p) {
    var out = [];
    for (var i = 0; i < 64; i++) {
      if (board[i] !== -1) continue;
      var f = flipsFor(board, i, p);
      if (f.length) out.push({ i: i, flips: f });
    }
    return out;
  }

  function hasMove(board, p) {
    for (var i = 0; i < 64; i++) if (board[i] === -1 && flipsFor(board, i, p).length) return true;
    return false;
  }

  function applyMove(board, i, p) {
    var f = flipsFor(board, i, p);
    if (!f.length) return null;
    var b = board.slice();
    b[i] = p;
    for (var k = 0; k < f.length; k++) b[f[k]] = p;
    return b;
  }

  function count(board, p) {
    var n = 0;
    for (var i = 0; i < 64; i++) if (board[i] === p) n++;
    return n;
  }

  /* ---------- สถานะเกมเต็ม ---------- */
  // { board, turn, over: null | { w } | { draw:true }, last: { i, flips } | null, passed: null | ฝ่ายที่เพิ่งข้ามตา }
  function newGame(starter) {
    return { board: initialBoard(), turn: starter || 0, over: null, last: null, passed: null };
  }

  function finish(board) {
    var a = count(board, 0);
    var b = count(board, 1);
    return a === b ? { draw: true } : { w: a > b ? 0 : 1 };
  }

  /* ลงเม็ดที่ช่อง i (ต้องเป็นช่องที่ลงได้) → สถานะใหม่ (null ถ้าลงไม่ได้) · จัดการข้ามตา/จบเกมให้เอง */
  function play(state, i) {
    var p = state.turn;
    var f = flipsFor(state.board, i, p);
    if (!f.length) return null;
    var b = applyMove(state.board, i, p);
    var next = 1 - p;
    var s = { board: b, turn: next, over: null, last: { i: i, flips: f }, passed: null };
    if (hasMove(b, next)) return s;
    if (hasMove(b, p)) {
      s.turn = p;
      s.passed = next;
      return s;
    }
    s.over = finish(b);
    return s;
  }

  /* สถานะที่ค้างอยู่ในเครื่องอาจถึงตาคนที่ไม่มีช่องลง (เช่น ข้อมูลเก่า) → จัดให้ถูกกติกา */
  function settle(state) {
    if (state.over) return state;
    if (hasMove(state.board, state.turn)) return state;
    if (hasMove(state.board, 1 - state.turn)) {
      state.passed = state.turn;
      state.turn = 1 - state.turn;
      return state;
    }
    state.over = finish(state.board);
    return state;
  }

  /* ---------- คอม ---------- */
  var WEIGHTS = [
    120, -25, 20, 5, 5, 20, -25, 120,
    -25, -45, -5, -5, -5, -5, -45, -25,
    20, -5, 15, 3, 3, 15, -5, 20,
    5, -5, 3, 3, 3, 3, -5, 5,
    5, -5, 3, 3, 3, 3, -5, 5,
    20, -5, 15, 3, 3, 15, -5, 20,
    -25, -45, -5, -5, -5, -5, -45, -25,
    120, -25, 20, 5, 5, 20, -25, 120
  ];
  var CORNERS = [0, 7, 56, 63];
  // ช่องติดมุม (ไม่เป็นช่องอันตรายแล้วถ้ามุมนั้นมีเม็ดอยู่)
  var NEAR = {
    0: [1, 8, 9],
    7: [6, 15, 14],
    56: [48, 57, 49],
    63: [62, 55, 54]
  };
  var WIN = 100000;

  function evaluate(board, p) {
    var s = 0;
    var empty = 0;
    for (var i = 0; i < 64; i++) {
      var v = board[i];
      if (v === -1) empty++;
      else s += v === p ? WEIGHTS[i] : -WEIGHTS[i];
    }
    for (var k = 0; k < 4; k++) {
      var cn = CORNERS[k];
      if (board[cn] === -1) continue;
      // มุมถูกยึดแล้ว → ยกเลิกโทษของช่องติดมุม
      NEAR[cn].forEach(function (j) {
        if (board[j] === p) s -= WEIGHTS[j];
        else if (board[j] === 1 - p) s += WEIGHTS[j];
      });
    }
    var mob = legalMoves(board, p).length - legalMoves(board, 1 - p).length;
    s += mob * (empty > 20 ? 8 : 4);
    if (empty < 12) s += (count(board, p) - count(board, 1 - p)) * 6;
    return s;
  }

  function Timeout() {}

  function search(board, p, budgetMs) {
    var deadline = Date.now() + budgetMs;
    var nodes = 0;

    function negamax(b, turn, depth, alpha, beta, passed) {
      if ((++nodes & 511) === 0 && Date.now() > deadline) throw new Timeout();
      var moves = legalMoves(b, turn);
      if (!moves.length) {
        if (passed) {
          var d = count(b, turn) - count(b, 1 - turn);
          return d > 0 ? WIN + d : d < 0 ? -WIN + d : 0;
        }
        return -negamax(b, 1 - turn, depth, -beta, -alpha, true);
      }
      if (depth <= 0) return evaluate(b, turn);
      moves.sort(function (x, y) {
        return WEIGHTS[y.i] - WEIGHTS[x.i];
      });
      var best = -Infinity;
      for (var k = 0; k < moves.length; k++) {
        var s = -negamax(applyMove(b, moves[k].i, turn), 1 - turn, depth - 1, -beta, -alpha, false);
        if (s > best) best = s;
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      }
      return best;
    }

    var moves = legalMoves(board, p);
    if (!moves.length) return -1;
    if (moves.length === 1) return moves[0].i;
    var order = moves
      .map(function (m) {
        return m.i;
      })
      .sort(function (a, b) {
        return WEIGHTS[b] - WEIGHTS[a];
      });
    var best = order[0];
    var empties = 0;
    for (var i = 0; i < 64; i++) if (board[i] === -1) empties++;
    for (var depth = 1; depth <= empties; depth++) {
      try {
        var scored = [];
        var alpha = -Infinity;
        for (var k = 0; k < order.length; k++) {
          var s = -negamax(applyMove(board, order[k], p), 1 - p, depth - 1, -Infinity, -alpha, false);
          scored.push({ i: order[k], s: s });
          if (s > alpha) alpha = s;
        }
        scored.sort(function (a, b) {
          return b.s - a.s;
        });
        order = scored.map(function (x) {
          return x.i;
        });
        best = order[0];
      } catch (e) {
        if (e instanceof Timeout) break;
        throw e;
      }
    }
    return best;
  }

  /*
   * ตาเดินของคอม → index ช่อง (หรือ -1 ถ้าไม่มีช่องลง)
   * ง่าย = เลือกช่องที่พลิกได้เยอะ ๆ แบบมีสุ่ม ไม่ดูมุม · ยาก = alpha-beta + ตารางค่าช่อง + ความคล่องตัว
   */
  function choose(board, p, level, rnd, opts) {
    rnd = rnd || Math.random;
    var moves = legalMoves(board, p);
    if (!moves.length) return -1;
    if (level !== 2) {
      if (rnd() < 0.3) return moves[Math.floor(rnd() * moves.length)].i;
      var best = -Infinity;
      var pick = moves[0].i;
      moves.forEach(function (m) {
        var s = m.flips.length + rnd() * 3;
        if (s > best) {
          best = s;
          pick = m.i;
        }
      });
      return pick;
    }
    return search(board, p, (opts && opts.budget) || 450);
  }

  return {
    initialBoard: initialBoard,
    flipsFor: flipsFor,
    legalMoves: legalMoves,
    hasMove: hasMove,
    applyMove: applyMove,
    count: count,
    newGame: newGame,
    play: play,
    settle: settle,
    choose: choose,
    evaluate: evaluate
  };
});
