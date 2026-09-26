/*
 * โอเอ็กซ์ — คอม (ใช้ได้ทั้งในเบราว์เซอร์ window.OXAI และใน node require)
 * กระดาน = array 9 ช่อง: -1 ว่าง · 0 แดง (X) · 1 ฟ้า (O)
 * ง่าย = มีทางชนะมักจะเห็น กันบ้างไม่กันบ้าง นอกนั้นสุ่ม · ยาก = เล่นไม่มีพลาด (minimax เต็มกระดาน)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OXAI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  function winner(c) {
    for (var k = 0; k < LINES.length; k++) {
      var l = LINES[k];
      if (c[l[0]] !== -1 && c[l[0]] === c[l[1]] && c[l[1]] === c[l[2]]) return c[l[0]];
    }
    return -1;
  }

  function empties(c) {
    var out = [];
    for (var i = 0; i < 9; i++) if (c[i] === -1) out.push(i);
    return out;
  }

  function winningCell(c, p) {
    var e = empties(c);
    for (var k = 0; k < e.length; k++) {
      c[e[k]] = p;
      var w = winner(c) === p;
      c[e[k]] = -1;
      if (w) return e[k];
    }
    return -1;
  }

  // คะแนนจากมุมของ me: ชนะเร็ว = ดีกว่า, แพ้ช้า = ดีกว่า
  function minimax(c, turn, me, depth) {
    var w = winner(c);
    if (w === me) return 10 - depth;
    if (w !== -1) return depth - 10;
    var e = empties(c);
    if (!e.length) return 0;
    var best = turn === me ? -Infinity : Infinity;
    for (var k = 0; k < e.length; k++) {
      c[e[k]] = turn;
      var s = minimax(c, 1 - turn, me, depth + 1);
      c[e[k]] = -1;
      if (turn === me ? s > best : s < best) best = s;
    }
    return best;
  }

  function pick(list, rnd) {
    return list[Math.floor(rnd() * list.length)];
  }

  /* ตาเดินของคอม: cells, p (ฝ่ายคอม), level 1|2, rnd (ไม่ใส่ = Math.random) → index 0–8 หรือ -1 ถ้ากระดานเต็ม */
  function choose(cells, p, level, rnd) {
    rnd = rnd || Math.random;
    var c = cells.slice();
    var e = empties(c);
    if (!e.length || winner(c) !== -1) return -1;
    if (level !== 2) {
      var win = winningCell(c, p);
      if (win !== -1 && rnd() < 0.8) return win;
      var block = winningCell(c, 1 - p);
      if (block !== -1 && rnd() < 0.5) return block;
      return pick(e, rnd);
    }
    var best = -Infinity;
    var bestMoves = [];
    for (var k = 0; k < e.length; k++) {
      c[e[k]] = p;
      var s = minimax(c, 1 - p, p, 1);
      c[e[k]] = -1;
      if (s > best) {
        best = s;
        bestMoves = [e[k]];
      } else if (s === best) {
        bestMoves.push(e[k]);
      }
    }
    return pick(bestMoves, rnd);
  }

  return { choose: choose, winner: winner, LINES: LINES };
});
