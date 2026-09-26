/*
 * เรือรบ (Battleship) — กติกาล้วน + คอม · ใช้ได้ทั้งในเบราว์เซอร์ (window.Battleship) และใน node (require)
 *
 * กระดาน 10×10 · index = แถว*10 + หลัก (แถว 0 = บนสุด, หลัก 0 = ซ้ายสุด)
 * เรือ 5 ลำ ยาว 5 · 4 · 3 · 3 · 2 · เรือ = { k: ลำที่ (0–4), r, c: หัวเรือ (ซ้ายสุด/บนสุด), v: true = แนวตั้ง }
 * วางติดกันได้ แต่ห้ามทับกัน ห้ามล้นกระดาน
 *
 * ฝั่ง (side) = { ships: [5 ลำ เรียงตาม k], shots: array 100 ช่อง (0 = ยังไม่ถูกยิง · 1 = พลาด · 2 = โดน) }
 *   shots คือนัดที่ "ฝั่งนี้ถูกยิง"
 * กติกาการยิง (rule): 'alt' = ผลัดกันนัดละครั้ง (ค่าเริ่มต้น) · 'chain' = ยิงโดนได้ยิงต่อ (พลาดแล้วเปลี่ยนตา)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Battleship = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var N = 10;
  var CELLS = N * N;
  var FLEET = [
    { len: 5, name: 'เรือบรรทุกเครื่องบิน' },
    { len: 4, name: 'เรือประจัญบาน' },
    { len: 3, name: 'เรือลาดตระเวน' },
    { len: 3, name: 'เรือดำน้ำ' },
    { len: 2, name: 'เรือพิฆาต' }
  ];
  var COLS = 'ABCDEFGHIJ';

  function zeros() {
    var a = [];
    for (var i = 0; i < CELLS; i++) a.push(0);
    return a;
  }

  function label(i) {
    return COLS[i % N] + (Math.floor(i / N) + 1);
  }

  /* ---------- เรือ + การวาง ---------- */
  function cellsOf(s) {
    var out = [];
    var L = FLEET[s.k].len;
    for (var j = 0; j < L; j++) out.push((s.r + (s.v ? j : 0)) * N + s.c + (s.v ? 0 : j));
    return out;
  }

  function inBounds(s) {
    var L = FLEET[s.k].len;
    if (s.r < 0 || s.c < 0) return false;
    return s.v ? s.r + L <= N && s.c < N : s.c + L <= N && s.r < N;
  }

  // ช่องไหนเป็นเรือลำไหน (-1 = น้ำ) · skipK = ไม่นับลำนี้ (ใช้ตอนย้าย/หมุน)
  function occupancy(ships, skipK) {
    var occ = [];
    for (var i = 0; i < CELLS; i++) occ.push(-1);
    ships.forEach(function (s) {
      if (!s || s.k === skipK) return;
      cellsOf(s).forEach(function (i) {
        occ[i] = s.k;
      });
    });
    return occ;
  }

  function canPlace(ships, s) {
    if (!inBounds(s)) return false;
    var occ = occupancy(ships, s.k);
    return cellsOf(s).every(function (i) {
      return occ[i] === -1;
    });
  }

  // ดันเรือกลับเข้ากระดาน ถ้าล้นขอบ
  function clamp(s) {
    var L = FLEET[s.k].len;
    var r = Math.max(0, Math.min(s.r, s.v ? N - L : N - 1));
    var c = Math.max(0, Math.min(s.c, s.v ? N - 1 : N - L));
    return { k: s.k, r: r, c: c, v: !!s.v };
  }

  function validFleet(ships) {
    if (!Array.isArray(ships) || ships.length !== FLEET.length) return false;
    for (var k = 0; k < FLEET.length; k++) {
      var s = ships[k];
      if (!s || s.k !== k || !inBounds(s)) return false;
    }
    var occ = occupancy([], -1);
    for (var q = 0; q < ships.length; q++) {
      var cs = cellsOf(ships[q]);
      for (var j = 0; j < cs.length; j++) {
        if (occ[cs[j]] !== -1) return false;
        occ[cs[j]] = q;
      }
    }
    return true;
  }

  function randomFleet(rnd) {
    rnd = rnd || Math.random;
    for (;;) {
      var ships = [];
      var ok = true;
      for (var k = 0; k < FLEET.length && ok; k++) {
        var placed = false;
        for (var t = 0; t < 300 && !placed; t++) {
          var v = rnd() < 0.5;
          var L = FLEET[k].len;
          var s = {
            k: k,
            r: Math.floor(rnd() * (v ? N - L + 1 : N)),
            c: Math.floor(rnd() * (v ? N : N - L + 1)),
            v: v
          };
          if (canPlace(ships, s)) {
            ships.push(s);
            placed = true;
          }
        }
        if (!placed) ok = false;
      }
      if (ok) return ships;
    }
  }

  function replace(ships, s) {
    return ships.map(function (x) {
      return x.k === s.k ? s : x;
    });
  }

  // ย้ายเรือลำ k ให้หัวเรืออยู่ที่ (r, c) · ล้นขอบ = ดันกลับเข้ามาให้ · คืน ships ใหม่ หรือ null ถ้าทับลำอื่น
  function moveShip(ships, k, r, c, v) {
    var cur = ships[k];
    var s = clamp({ k: k, r: r, c: c, v: v == null ? cur.v : v });
    return canPlace(ships, s) ? replace(ships, s) : null;
  }

  // หมุนรอบหัวเรือ · คืน ships ใหม่ หรือ null ถ้าหมุนแล้วทับลำอื่น
  function rotateShip(ships, k) {
    var cur = ships[k];
    return moveShip(ships, k, cur.r, cur.c, !cur.v);
  }

  /* ---------- การยิง ---------- */
  function newSide(ships) {
    return { ships: ships.map(function (s) {
      return { k: s.k, r: s.r, c: s.c, v: !!s.v };
    }), shots: zeros() };
  }

  function shipAt(side, i) {
    for (var k = 0; k < side.ships.length; k++) if (cellsOf(side.ships[k]).indexOf(i) !== -1) return k;
    return -1;
  }

  function isSunk(side, k) {
    return cellsOf(side.ships[k]).every(function (i) {
      return side.shots[i] === 2;
    });
  }

  function allSunk(side) {
    for (var k = 0; k < side.ships.length; k++) if (!isSunk(side, k)) return false;
    return true;
  }

  function sunkCount(side) {
    var n = 0;
    for (var k = 0; k < side.ships.length; k++) if (isSunk(side, k)) n++;
    return n;
  }

  // ยิงช่อง i ใส่ฝั่งนี้ → { side: ฝั่งใหม่, result: 'miss' | 'hit' | 'sunk' | 'repeat', k }
  function fire(side, i) {
    if (!(i >= 0 && i < CELLS) || side.shots[i] !== 0) return { side: side, result: 'repeat', k: -1 };
    var k = shipAt(side, i);
    var shots = side.shots.slice();
    shots[i] = k === -1 ? 1 : 2;
    var ns = { ships: side.ships, shots: shots };
    if (k === -1) return { side: ns, result: 'miss', k: -1 };
    return { side: ns, result: isSunk(ns, k) ? 'sunk' : 'hit', k: k };
  }

  /* ---------- เกม ---------- */
  // o = { ai, level (1 ง่าย / 2 ยาก), rule ('alt' | 'chain'), starter (0 | 1) }
  function newGame(o) {
    o = o || {};
    return {
      phase: 'place', // place → play → over
      ai: !!o.ai,
      level: o.level === 2 ? 2 : 1,
      rule: o.rule === 'chain' ? 'chain' : 'alt',
      starter: o.starter === 1 ? 1 : 0,
      placing: 0,
      fleets: [null, null],
      sides: [null, null],
      turn: o.starter === 1 ? 1 : 0,
      winner: null,
      shots: [0, 0],
      hits: [0, 0],
      last: [-1, -1] // ช่องล่าสุดที่ฝั่งนั้นถูกยิง
    };
  }

  // ผู้เล่น placing วางเรือเสร็จ → คนถัดไปวาง หรือเริ่มยิง
  function ready(g, ships, rnd) {
    if (g.phase !== 'place' || !validFleet(ships)) return null;
    var ng = copy(g);
    ng.fleets = g.fleets.slice();
    ng.fleets[g.placing] = ships;
    if (g.ai) ng.fleets[1] = randomFleet(rnd);
    if (!g.ai && g.placing === 0) {
      ng.placing = 1;
      return ng;
    }
    ng.sides = [newSide(ng.fleets[0]), newSide(ng.fleets[1])];
    ng.phase = 'play';
    ng.turn = g.starter;
    return ng;
  }

  function copy(g) {
    var o = {};
    for (var key in g) o[key] = g[key];
    o.shots = g.shots.slice();
    o.hits = g.hits.slice();
    o.last = g.last.slice();
    o.sides = g.sides.slice();
    return o;
  }

  // คนที่ถึงตายิงช่อง i ใส่ฝั่งตรงข้าม → { g, result, k, again (ได้ยิงต่อ), over } หรือ null ถ้ายิงไม่ได้
  function play(g, i) {
    if (g.phase !== 'play') return null;
    var target = 1 - g.turn;
    var r = fire(g.sides[target], i);
    if (r.result === 'repeat') return null;
    var ng = copy(g);
    ng.sides[target] = r.side;
    ng.shots[g.turn] += 1;
    if (r.result !== 'miss') ng.hits[g.turn] += 1;
    ng.last[target] = i;
    var over = allSunk(r.side);
    var again = !over && g.rule === 'chain' && r.result !== 'miss';
    if (over) {
      ng.phase = 'over';
      ng.winner = g.turn;
    } else if (!again) {
      ng.turn = target;
    }
    return { g: ng, result: r.result, k: r.k, again: again, over: over };
  }

  /* ---------- คอม ---------- */
  // สิ่งที่คนยิงมองเห็นของฝั่งนี้: 0 ยังไม่ยิง · 1 พลาด · 2 โดน (ยังไม่จม) · 3 ส่วนของเรือที่จมแล้ว
  function viewOf(side) {
    var v = side.shots.slice();
    for (var k = 0; k < side.ships.length; k++) {
      if (isSunk(side, k)) cellsOf(side.ships[k]).forEach(function (i) {
        v[i] = 3;
      });
    }
    return v;
  }

  function remainingLens(side) {
    var out = [];
    for (var k = 0; k < side.ships.length; k++) if (!isSunk(side, k)) out.push(FLEET[k].len);
    return out;
  }

  function neighbors(i) {
    var r = Math.floor(i / N);
    var c = i % N;
    var out = [];
    if (r > 0) out.push(i - N);
    if (r < N - 1) out.push(i + N);
    if (c > 0) out.push(i - 1);
    if (c < N - 1) out.push(i + 1);
    return out;
  }

  function pickRandom(list, rnd) {
    return list[Math.floor(rnd() * list.length)];
  }

  // ความหนาแน่น: นับว่าเรือที่ยังไม่จม วางผ่านช่องนี้ได้กี่แบบ (ไม่ทับช่องพลาด/เรือที่จมแล้ว)
  // มีช่อง "โดนแต่ยังไม่จม" = โหมดไล่ล่า นับเฉพาะแบบที่ผ่านช่องโดน และให้น้ำหนักมากตามจำนวนช่องโดนที่ผ่าน
  function density(view, lens, targetOnly) {
    var d = [];
    for (var i = 0; i < CELLS; i++) d.push(0);
    lens.forEach(function (L) {
      for (var vv = 0; vv < 2; vv++) {
        var vert = vv === 1;
        for (var r = 0; r < (vert ? N - L + 1 : N); r++) {
          for (var c = 0; c < (vert ? N : N - L + 1); c++) {
            var cells = [];
            var blocked = false;
            var cover = 0;
            for (var j = 0; j < L; j++) {
              var idx = (r + (vert ? j : 0)) * N + c + (vert ? 0 : j);
              var s = view[idx];
              if (s === 1 || s === 3) {
                blocked = true;
                break;
              }
              if (s === 2) cover++;
              cells.push(idx);
            }
            if (blocked) continue;
            if (targetOnly && cover === 0) continue;
            var w = cover ? Math.pow(8, cover) : 1;
            cells.forEach(function (idx) {
              if (view[idx] === 0) d[idx] += w;
            });
          }
        }
      }
    });
    return d;
  }

  /*
   * คอมเลือกช่องยิง · view = viewOf(ฝั่งเป้า) · lens = remainingLens(ฝั่งเป้า)
   * level 1 (ง่าย): สุ่มช่องที่ยังไม่ยิง (ไม่ยิงซ้ำ) · ถ้ามีช่องโดนค้าง บางครั้ง (40%) ยิงช่องติดกัน
   * level 2 (ยาก): ไล่ล่า + ความหนาแน่นความน่าจะเป็น + ช่องสลับแบบกระดานหมากรุก ตอนยังหาไม่เจอ
   */
  function chooseShot(view, lens, level, rnd) {
    rnd = rnd || Math.random;
    var open = [];
    var hits = [];
    for (var i = 0; i < CELLS; i++) {
      if (view[i] === 0) open.push(i);
      else if (view[i] === 2) hits.push(i);
    }
    if (!open.length) return -1;

    if (level !== 2) {
      if (hits.length && rnd() < 0.4) {
        var near = [];
        hits.forEach(function (h) {
          neighbors(h).forEach(function (n) {
            if (view[n] === 0 && near.indexOf(n) === -1) near.push(n);
          });
        });
        if (near.length) return pickRandom(near, rnd);
      }
      return pickRandom(open, rnd);
    }

    var d = density(view, lens, hits.length > 0);
    var any = d.some(function (x) {
      return x > 0;
    });
    if (!any && hits.length) d = density(view, lens, false);
    if (!hits.length) {
      // ยังไม่มีเป้า: ยิงช่องสลับ (เรือเล็กสุดยาว ≥ 2 จึงไม่พลาดลำไหน) → ประหยัดนัด
      for (var q = 0; q < CELLS; q++) {
        if ((Math.floor(q / N) + (q % N)) % 2 === 1) d[q] *= 0.35;
      }
    }
    var best = -1;
    for (var z = 0; z < CELLS; z++) if (view[z] === 0 && d[z] > best) best = d[z];
    if (best <= 0) return pickRandom(open, rnd);
    var top = [];
    for (var y = 0; y < CELLS; y++) if (view[y] === 0 && d[y] >= best * 0.999) top.push(y);
    return pickRandom(top, rnd);
  }

  // ช่วยเกม: คนที่ถึงตา (คอม) เลือกช่องยิงใส่ฝั่งตรงข้าม
  function aiShot(g, rnd) {
    var side = g.sides[1 - g.turn];
    return chooseShot(viewOf(side), remainingLens(side), g.level, rnd);
  }

  return {
    N: N,
    FLEET: FLEET,
    label: label,
    cellsOf: cellsOf,
    inBounds: inBounds,
    occupancy: occupancy,
    canPlace: canPlace,
    clamp: clamp,
    validFleet: validFleet,
    randomFleet: randomFleet,
    moveShip: moveShip,
    rotateShip: rotateShip,
    newSide: newSide,
    shipAt: shipAt,
    isSunk: isSunk,
    allSunk: allSunk,
    sunkCount: sunkCount,
    fire: fire,
    newGame: newGame,
    ready: ready,
    play: play,
    viewOf: viewOf,
    remainingLens: remainingLens,
    chooseShot: chooseShot,
    aiShot: aiShot
  };
});
