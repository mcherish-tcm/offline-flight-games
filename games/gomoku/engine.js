/*
 * โกโมกุ (Gomoku) — กติกาล้วน + คอม · ใช้ได้ทั้งในเบราว์เซอร์ (window.Gomoku) และใน node (require)
 *
 * กระดาน 15×15 = array 225 ช่อง (จุดตัด), index = แถว*15 + หลัก, แถว 0 = บนสุด · -1 ว่าง · 0 แดง · 1 ฟ้า
 * กติกาแบบอิสระ (freestyle): ผลัดกันวางหมาก 1 เม็ด · เรียงติดกัน 5 เม็ดขึ้นไป (แนวนอน/ตั้ง/ทแยง) = ชนะ
 * กระดานเต็มโดยไม่มีใครเรียงครบ = เสมอ · ไม่มีกติกาห้ามพิเศษ (ไม่มี renju)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Gomoku = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 15;
  var SIZE = N * N;
  var DIRS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1]
  ];

  function emptyBoard() {
    var b = [];
    for (var i = 0; i < SIZE; i++) b.push(-1);
    return b;
  }

  function inBoard(r, c) {
    return r >= 0 && r < N && c >= 0 && c < N;
  }

  /* แนวที่ชนะผ่านช่อง i (ถ้า p มีเม็ดที่ i) → array ของ index (≥5) หรือ null */
  function winLine(board, i, p) {
    var r0 = Math.floor(i / N);
    var c0 = i % N;
    for (var d = 0; d < 4; d++) {
      var cells = [i];
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var r = r0 + DIRS[d][0] * sgn;
        var c = c0 + DIRS[d][1] * sgn;
        while (inBoard(r, c) && board[r * N + c] === p) {
          cells.push(r * N + c);
          r += DIRS[d][0] * sgn;
          c += DIRS[d][1] * sgn;
        }
      }
      if (cells.length >= 5) {
        return cells.sort(function (a, b) {
          return a - b;
        });
      }
    }
    return null;
  }

  function makesFive(board, i, p) {
    if (board[i] !== -1) return false;
    board[i] = p;
    var ok = !!winLine(board, i, p);
    board[i] = -1;
    return ok;
  }

  function stones(board) {
    var n = 0;
    for (var i = 0; i < SIZE; i++) if (board[i] !== -1) n++;
    return n;
  }

  /* ---------- สถานะเกมเต็ม ---------- */
  // { board, turn, starter?, over: null | { w, line } | { draw:true }, last: index | -1, moves: จำนวนเม็ด }
  function newGame(starter) {
    return { board: emptyBoard(), turn: starter || 0, over: null, last: -1, moves: 0 };
  }

  function play(state, i) {
    if (state.over || i < 0 || i >= SIZE || state.board[i] !== -1) return null;
    var p = state.turn;
    var b = state.board.slice();
    b[i] = p;
    var s = { board: b, turn: 1 - p, over: null, last: i, moves: state.moves + 1 };
    var line = winLine(b, i, p);
    if (line) {
      s.over = { w: p, line: line };
      s.turn = p;
    } else if (s.moves >= SIZE) {
      s.over = { draw: true };
    }
    return s;
  }

  /* ---------- คอม ---------- */
  // ค่าของหน้าต่าง 5 ช่องที่มีหมากฝ่ายเดียว k เม็ด
  var WV = [0, 1, 12, 150, 2000, 1000000];

  // หน้าต่าง 5 ช่องทั้งหมด (คำนวณครั้งเดียว) + หน้าต่างที่ผ่านแต่ละช่อง
  var WINDOWS = [];
  var CELL_WINDOWS = [];
  (function () {
    for (var i = 0; i < SIZE; i++) CELL_WINDOWS.push([]);
    for (var r = 0; r < N; r++) {
      for (var c = 0; c < N; c++) {
        for (var d = 0; d < 4; d++) {
          var er = r + DIRS[d][0] * 4;
          var ec = c + DIRS[d][1] * 4;
          if (!inBoard(er, ec)) continue;
          var w = [];
          for (var k = 0; k < 5; k++) w.push((r + DIRS[d][0] * k) * N + (c + DIRS[d][1] * k));
          var id = WINDOWS.length;
          WINDOWS.push(w);
          for (var j = 0; j < 5; j++) CELL_WINDOWS[w[j]].push(id);
        }
      }
    }
  })();

  // คะแนนของการวางที่ช่อง i สำหรับ p (เฉพาะหน้าต่างที่ผ่านช่องนี้)
  function cellValue(board, i, p) {
    var s = 0;
    var ws = CELL_WINDOWS[i];
    for (var k = 0; k < ws.length; k++) {
      var w = WINDOWS[ws[k]];
      var mine = 0;
      var blocked = false;
      for (var j = 0; j < 5; j++) {
        var v = board[w[j]];
        if (v === p) mine++;
        else if (v !== -1) {
          blocked = true;
          break;
        }
      }
      if (!blocked) s += WV[mine + 1] - WV[mine];
    }
    return s;
  }

  function evaluate(board, p) {
    var s = 0;
    for (var k = 0; k < WINDOWS.length; k++) {
      var w = WINDOWS[k];
      var a = 0;
      var b = 0;
      for (var j = 0; j < 5; j++) {
        var v = board[w[j]];
        if (v === p) a++;
        else if (v !== -1) b++;
      }
      if (a && !b) s += WV[a];
      else if (b && !a) s -= WV[b] * 1.2;
    }
    return s;
  }

  // ช่องว่างที่อยู่ใกล้หมากที่มีอยู่ (ไม่เกิน 2 ช่อง) — ช่องที่น่าลงจริง ๆ
  function candidates(board) {
    var out = [];
    var seen = {};
    var any = false;
    for (var i = 0; i < SIZE; i++) {
      if (board[i] === -1) continue;
      any = true;
      var r0 = Math.floor(i / N);
      var c0 = i % N;
      for (var dr = -2; dr <= 2; dr++) {
        for (var dc = -2; dc <= 2; dc++) {
          var r = r0 + dr;
          var c = c0 + dc;
          if (!inBoard(r, c)) continue;
          var j = r * N + c;
          if (board[j] === -1 && !seen[j]) {
            seen[j] = true;
            out.push(j);
          }
        }
      }
    }
    if (!any) out.push(7 * N + 7);
    return out;
  }

  function findFive(board, p, cands) {
    for (var k = 0; k < cands.length; k++) if (makesFive(board, cands[k], p)) return cands[k];
    return -1;
  }

  // หลัง p วางที่ i จะมีช่องชนะกี่ช่อง (≥2 = กันไม่ทันแล้ว)
  function winningSpots(board, i, p) {
    board[i] = p;
    var r0 = Math.floor(i / N);
    var c0 = i % N;
    var spots = {};
    var n = 0;
    for (var d = 0; d < 4; d++) {
      for (var t = -4; t <= 4; t++) {
        if (!t) continue;
        var r = r0 + DIRS[d][0] * t;
        var c = c0 + DIRS[d][1] * t;
        if (!inBoard(r, c)) continue;
        var j = r * N + c;
        if (board[j] === -1 && !spots[j] && makesFive(board, j, p)) {
          spots[j] = true;
          n++;
        }
      }
    }
    board[i] = -1;
    return n;
  }

  function ranked(board, p, cands, defend) {
    return cands
      .map(function (i) {
        return { i: i, s: cellValue(board, i, p) + cellValue(board, i, 1 - p) * defend };
      })
      .sort(function (a, b) {
        return b.s - a.s;
      });
  }

  function Timeout() {}

  function search(board, p, cands, budgetMs) {
    var deadline = Date.now() + budgetMs;
    var nodes = 0;
    var WIN = 1e9;

    function negamax(depth, alpha, beta, turn) {
      if ((++nodes & 63) === 0 && Date.now() > deadline) throw new Timeout();
      if (depth === 0) return evaluate(board, turn);
      var list = ranked(board, turn, candidates(board), 0.9).slice(0, 8);
      if (!list.length) return 0;
      var best = -Infinity;
      for (var k = 0; k < list.length; k++) {
        var i = list[k].i;
        board[i] = turn;
        var s = winLine(board, i, turn) ? WIN - (10 - depth) : -negamax(depth - 1, -beta, -alpha, 1 - turn);
        board[i] = -1;
        if (s > best) best = s;
        if (s > alpha) alpha = s;
        if (alpha >= beta) break;
      }
      return best;
    }

    var order = cands.slice();
    var best = order[0];
    for (var depth = 2; depth <= 6; depth += 1) {
      try {
        var scored = [];
        var alpha = -Infinity;
        for (var k = 0; k < order.length; k++) {
          var i = order[k];
          board[i] = p;
          var s;
          try {
            s = -negamax(depth - 1, -Infinity, -alpha, 1 - p);
          } finally {
            board[i] = -1;
          }
          scored.push({ i: i, s: s });
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
   * ตาเดินของคอม → index ช่อง (หรือ -1 ถ้ากระดานเต็ม)
   * ง่าย = เห็นทางชนะ กันบ้างไม่กันบ้าง เลือกช่องดี ๆ แบบสุ่ม ไม่ระวังเรียง 3 เปิด
   * ยาก = ชนะเลยถ้าได้ → กันเรียง 4 → สร้าง 4 เปิด → กันเรียง 3 เปิด → ค้นล่วงหน้า 2–6 ตา (จนหมดเวลา)
   */
  function choose(board, p, level, rnd, opts) {
    rnd = rnd || Math.random;
    var b = board.slice();
    var cands = candidates(b);
    if (!cands.length) return -1;
    if (stones(b) === 0) return 7 * N + 7;

    var win = findFive(b, p, cands);
    var block = findFive(b, 1 - p, cands);

    if (level !== 2) {
      if (win !== -1 && rnd() < 0.9) return win;
      if (block !== -1 && rnd() < 0.75) return block;
      var top = ranked(b, p, cands, 0.5).slice(0, 5);
      return top[Math.floor(rnd() * top.length)].i;
    }

    if (win !== -1) return win;
    if (block !== -1) return block;

    var list = ranked(b, p, cands, 0.9);
    // สร้าง 4 เปิด (มีช่องชนะ 2 ช่อง) = ชนะแน่
    for (var k = 0; k < Math.min(list.length, 20); k++) {
      if (winningSpots(b, list[k].i, p) >= 2) return list[k].i;
    }
    // อีกฝ่ายมีทางสร้าง 4 เปิด → ต้องกันก่อน
    var threats = [];
    for (var t = 0; t < Math.min(list.length, 30); t++) {
      if (winningSpots(b, list[t].i, 1 - p) >= 2) threats.push(list[t].i);
    }
    if (threats.length) {
      // เลือกช่องที่ลงแล้วอีกฝ่ายไม่เหลือทางสร้าง 4 เปิด (ลองช่องที่คะแนนดีก่อน)
      var tries = list.slice(0, 16).map(function (x) {
        return x.i;
      });
      threats.forEach(function (i) {
        if (tries.indexOf(i) === -1) tries.push(i);
      });
      for (var q = 0; q < tries.length; q++) {
        var i = tries[q];
        b[i] = p;
        var safe = true;
        var next = candidates(b);
        for (var z = 0; z < next.length && safe; z++) {
          if (makesFive(b, next[z], 1 - p) || winningSpots(b, next[z], 1 - p) >= 2) safe = false;
        }
        b[i] = -1;
        if (safe) return i;
      }
      return threats[0];
    }

    var top2 = list.slice(0, 10).map(function (x) {
      return x.i;
    });
    return search(b, p, top2, (opts && opts.budget) || 450);
  }

  return {
    N: N,
    SIZE: SIZE,
    emptyBoard: emptyBoard,
    winLine: winLine,
    newGame: newGame,
    play: play,
    choose: choose,
    evaluate: evaluate,
    candidates: candidates
  };
});
