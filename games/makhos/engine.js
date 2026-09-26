/*
 * หมากฮอสไทย — กติกาล้วน (ไม่แตะหน้าจอ) ใช้ได้ทั้งในเบราว์เซอร์ (window.Makhos) และใน node (require)
 * อ้างอิงกติกา: docs/makhos-thai-rules.md + การเคาะของเจ้าของ 2026-09-26
 *
 * กระดาน = array 64 ช่อง, index = แถว*8 + หลัก, แถว 0 = บนสุดของจอ · ใช้เฉพาะช่องสีเข้ม (แถว+หลัก เป็นเลขคี่)
 * ค่าในช่อง: 0 ว่าง · 1 เบี้ยแดง · 2 ฮอสแดง · 3 เบี้ยฟ้า · 4 ฮอสฟ้า
 * ผู้เล่น 0 = แดง (เริ่มแถวล่าง เดินขึ้น) · ผู้เล่น 1 = ฟ้า (เริ่มแถวบน เดินลง)
 *
 * กติกาที่ใช้:
 *  - เบี้ยเดิน/กิน ทแยงไปข้างหน้าเท่านั้น ทีละ 1 ช่อง
 *  - มีทางกิน → ต้องกิน (ตั้ง forceCapture:false เพื่อไม่บังคับ) · กินต่อได้ต้องกินต่อจนสุด
 *  - มีหลายทางกิน → เลือกได้อิสระ ไม่ต้องกินให้ได้มากที่สุด
 *  - ถึงแถวสุดท้าย = เป็นฮอส และจบตาทันที (ไม่กินต่อในฐานะฮอส)
 *  - ฮอสเดินทแยงกี่ช่องก็ได้ · เวลากินต้องลงช่องที่ติดหลังตัวที่ถูกกินทันที แล้วกินต่อจากตรงนั้นได้
 *  - ตัวที่ถูกกินยกออกตอนจบตา ระหว่างกินต่อ ห้ามกระโดดข้ามตัวเดิมซ้ำ และมันยังขวางทางอยู่
 *  - แพ้ = ไม่เหลือหมาก หรือไม่มีตาเดิน · เสมอ = ตกลงกัน หรือ ตำแหน่งเดิม + ฝ่ายเดินเดิม ซ้ำครบ 3 ครั้ง
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Makhos = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EMPTY = 0;
  var RED_MAN = 1;
  var RED_KING = 2;
  var BLUE_MAN = 3;
  var BLUE_KING = 4;
  var ALL_DIRS = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];

  function owner(v) {
    if (v === EMPTY) return -1;
    return v <= RED_KING ? 0 : 1;
  }

  function isKing(v) {
    return v === RED_KING || v === BLUE_KING;
  }

  function forward(p) {
    return p === 0 ? -1 : 1;
  }

  function promoRow(p) {
    return p === 0 ? 0 : 7;
  }

  function inBoard(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  function isDark(i) {
    return (((i >> 3) + (i & 7)) & 1) === 1;
  }

  function initialBoard() {
    var b = [];
    for (var i = 0; i < 64; i++) {
      var r = i >> 3;
      b.push(isDark(i) && r <= 1 ? BLUE_MAN : isDark(i) && r >= 6 ? RED_MAN : EMPTY);
    }
    return b;
  }

  function emptyBoard() {
    var b = [];
    for (var i = 0; i < 64; i++) b.push(EMPTY);
    return b;
  }

  /* ลำดับการกินทั้งหมดของหมากตัวที่ช่อง from (เฉพาะลำดับที่กินจนสุดแล้ว) */
  function captureMoves(board, from) {
    var v = board[from];
    var p = owner(v);
    if (p === -1) return [];
    var king = isKing(v);
    var dirs = king ? ALL_DIRS : [[forward(p), -1], [forward(p), 1]];
    var out = [];

    function at(i) {
      return i === from ? EMPTY : board[i]; // ตัวที่กำลังเดินออกจากช่องเดิมแล้ว
    }

    function dfs(sq, path, caps) {
      var r = sq >> 3;
      var c = sq & 7;
      var more = false;
      for (var d = 0; d < dirs.length; d++) {
        var dr = dirs[d][0];
        var dc = dirs[d][1];
        var rr = r + dr;
        var cc = c + dc;
        if (king) {
          while (inBoard(rr, cc) && at(rr * 8 + cc) === EMPTY) {
            rr += dr;
            cc += dc;
          }
        }
        if (!inBoard(rr, cc)) continue;
        var mid = rr * 8 + cc;
        if (owner(at(mid)) !== 1 - p || caps.indexOf(mid) !== -1) continue;
        var lr = rr + dr;
        var lc = cc + dc;
        if (!inBoard(lr, lc)) continue;
        var land = lr * 8 + lc;
        if (at(land) !== EMPTY) continue;
        more = true;
        var np = path.concat([land]);
        var nc = caps.concat([mid]);
        if (!king && lr === promoRow(p)) {
          out.push({ from: from, path: np, captures: nc, promote: true });
        } else {
          dfs(land, np, nc);
        }
      }
      if (!more && path.length) out.push({ from: from, path: path, captures: caps, promote: false });
    }

    dfs(from, [], []);
    return out;
  }

  function simpleMoves(board, from) {
    var v = board[from];
    var p = owner(v);
    if (p === -1) return [];
    var r = from >> 3;
    var c = from & 7;
    var out = [];
    if (isKing(v)) {
      for (var d = 0; d < 4; d++) {
        var rr = r + ALL_DIRS[d][0];
        var cc = c + ALL_DIRS[d][1];
        while (inBoard(rr, cc) && board[rr * 8 + cc] === EMPTY) {
          out.push({ from: from, path: [rr * 8 + cc], captures: [], promote: false });
          rr += ALL_DIRS[d][0];
          cc += ALL_DIRS[d][1];
        }
      }
    } else {
      var fr = r + forward(p);
      for (var k = -1; k <= 1; k += 2) {
        var fc = c + k;
        if (inBoard(fr, fc) && board[fr * 8 + fc] === EMPTY) {
          out.push({ from: from, path: [fr * 8 + fc], captures: [], promote: fr === promoRow(p) });
        }
      }
    }
    return out;
  }

  /* ตาเดินที่ถูกกติกาทั้งหมดของฝ่าย p · opts.forceCapture (ค่าเริ่มต้น true) */
  function legalMoves(board, p, opts) {
    var force = !opts || opts.forceCapture !== false;
    var caps = [];
    var simples = [];
    for (var i = 0; i < 64; i++) {
      if (owner(board[i]) !== p) continue;
      caps = caps.concat(captureMoves(board, i));
      simples = simples.concat(simpleMoves(board, i));
    }
    if (caps.length && force) return caps;
    return caps.concat(simples);
  }

  function applyMove(board, move) {
    var b = board.slice();
    var v = b[move.from];
    b[move.from] = EMPTY;
    for (var k = 0; k < move.captures.length; k++) b[move.captures[k]] = EMPTY;
    var to = move.path[move.path.length - 1];
    var p = owner(v);
    if (!isKing(v) && to >> 3 === promoRow(p)) v = p === 0 ? RED_KING : BLUE_KING;
    b[to] = v;
    return b;
  }

  function positionKey(board, turn) {
    return board.join('') + ':' + turn;
  }

  function count(board, p) {
    var n = 0;
    for (var i = 0; i < 64; i++) if (owner(board[i]) === p) n++;
    return n;
  }

  /* ---------- สถานะเกมเต็ม (ใช้ทั้งหน้าจอและเทส) ---------- */
  function newGame(starter, board) {
    var b = board ? board.slice() : initialBoard();
    var t = starter || 0;
    var rep = {};
    rep[positionKey(b, t)] = 1;
    return { board: b, turn: t, rep: rep, over: null, last: null };
  }

  /* เดิน 1 ตา (ต้องเป็นตาที่อยู่ใน legalMoves) → คืนสถานะใหม่ · over = { w } หรือ { draw:'repetition' } */
  function play(state, move, opts) {
    var before = state.board[move.from];
    var b = applyMove(state.board, move);
    var next = 1 - state.turn;
    // เดินเบี้ย / มีการกิน = ย้อนกลับไม่ได้ → ตำแหน่งก่อนหน้าไม่มีทางกลับมาอีก ล้างตัวนับได้
    var irreversible = move.captures.length > 0 || !isKing(before);
    var rep = {};
    if (!irreversible) for (var k in state.rep) rep[k] = state.rep[k];
    var key = positionKey(b, next);
    rep[key] = (rep[key] || 0) + 1;
    var over = null;
    if (legalMoves(b, next, opts).length === 0) over = { w: state.turn };
    else if (rep[key] >= 3) over = { draw: 'repetition' };
    return {
      board: b,
      turn: next,
      rep: rep,
      over: over,
      last: { from: move.from, to: move.path[move.path.length - 1], path: move.path, captures: move.captures }
    };
  }

  function sameMove(a, b) {
    return a.from === b.from && a.path.join(',') === b.path.join(',');
  }

  return {
    EMPTY: EMPTY,
    RED_MAN: RED_MAN,
    RED_KING: RED_KING,
    BLUE_MAN: BLUE_MAN,
    BLUE_KING: BLUE_KING,
    owner: owner,
    isKing: isKing,
    isDark: isDark,
    initialBoard: initialBoard,
    emptyBoard: emptyBoard,
    captureMoves: captureMoves,
    simpleMoves: simpleMoves,
    legalMoves: legalMoves,
    applyMove: applyMove,
    positionKey: positionKey,
    count: count,
    newGame: newGame,
    play: play,
    sameMove: sameMove
  };
});
