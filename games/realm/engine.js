/*
 * ชิงเมืองแดนมนตร์ — กติกาล้วน + คอม · ใช้ได้ทั้งในเบราว์เซอร์ (window.Realm) และใน node (require)
 *
 * เกมกระดานแนว RPG แฟนตาซี (คิดขึ้นเองทั้งหมด): เดินรอบกระดาน 30 ช่อง ทอยเต๋า 1–6 เดินหน้าอย่างเดียว
 * ตีมอนสเตอร์เก็บเงิน/ค่าประสบการณ์ · ปราบผู้เฝ้าเมืองเพื่อยึดเมือง · คนอื่นตกเมืองเรา = จ่ายค่าผ่านทาง
 * ตกเมืองตัวเอง = ลงทุนขยายเมือง · ครบจำนวนรอบ = นับ เงิน + มูลค่าเมือง มากสุดชนะ
 *
 * สถานะเกม (s) เป็น object ธรรมดา แปลงเป็น JSON ได้ทั้งก้อน (บันทึกทุกตา) · สุ่มด้วย s.seed ในตัว (เล่นซ้ำได้เหมือนเดิม)
 * ทุกการกระทำผ่าน act(s, action) → คืนรายการเหตุการณ์ (events) ให้หน้าจอเอาไปแสดง
 * ใครต้องตัดสินใจตอนนี้ = decider(s) · คอมเลือกให้ = cpuAct(s)
 *
 * ช่วง (s.phase):
 *   'roll'   — รอทอยเต๋า (ใช้ยาก่อนทอยได้)
 *   'decide' — รอเลือก: s.pending.kind = 'duel-offer' | 'town' | 'invest' | 'shop'
 *   'battle' — กำลังสู้มอนสเตอร์/ผู้เฝ้าเมือง (s.battle) เลือกท่าทีละยก
 *   'duel'   — ประลองระหว่างผู้เล่น (s.duel) ต่างคนต่างวางแผน 3 ท่าลับ ๆ
 *   'over'   — จบเกม (s.result)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Realm = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- ตัวเลขหลัก (ปรับสมดุลตรงนี้ · ผลจำลองอยู่ใน tests/realm-sim.js) ---------- */
  var LENGTHS = { short: 15, mid: 22, long: 30 }; // จำนวนรอบ (ทุกคนเล่นคนละ 1 ตา = 1 รอบ)
  var START_GOLD = 150;
  var SEAT_BONUS = 25; // ที่นั่งหลังได้ทุนเพิ่มที่นั่งละ 25 (ชดเชยเดินทีหลัง · ผลจำลอง 3,000 เกม)
  var SALARY = 50; // ผ่านลานประตูเมือง
  var SALARY_PER_TOWN = 10;
  var CATCH_UP = 0.6; // คนที่ทรัพย์รวมน้อยสุดตอนผ่านลานประตูเมือง ได้เงินหลวงเพิ่ม 60% ของเงินหลวงพื้นฐาน
  var BASE = { hp: 30, atk: 8, def: 3 };
  var LEVEL_UP = { hp: 5, atk: 2, def: 1 };
  var MAX_LEVEL = 10;
  var MAX_TOWN_LEVEL = 5;
  var CLAIM_RATE = 0.5; // ค่าฟื้นฟูเมืองหลังชนะผู้เฝ้า = base × 0.5
  var INVEST_RATE = 0.6; // ขยายเมือง 1 ระดับ = base × 0.6 (มูลค่าเมืองเพิ่มเท่าที่จ่าย)
  var TOLL_RATE = 0.18; // ค่าผ่านทาง = มูลค่า × (0.18 + 0.05 × (ระดับ-1))
  var TOLL_STEP = 0.05;
  var DUEL_TAKE = 0.15; // ชนะประลอง = ได้เงินของผู้แพ้ 15%
  var LOSE_GOLD = 0.2; // แพ้มอนสเตอร์/ผู้เฝ้าเมือง = เสียเงิน 20%
  var MAX_EXCHANGES = 10; // สู้ครบ 10 ยกแล้วยังไม่จบ = ต่างฝ่ายต่างถอย
  var MAX_POTION = 3;
  var MAX_SMOKE = 2;

  /* ---------- ท่าต่อสู้ ----------
   * ตารางวน (เหมือนเป่ายิ้งฉุบ): โจมตีแรง ชนะ ป้องกัน · ป้องกัน ชนะ โจมตี (สวนกลับ) · โจมตี ชนะ โจมตีแรง (ตัดหน้า)
   * TABLE[ท่าเรา][ท่าอีกฝ่าย] = [ตัวคูณแรงที่เราทำ, ตัวคูณแรงที่อีกฝ่ายทำ]
   * ชนะ = ทำ 1.3 เท่า อีกฝ่ายทำไม่ได้ · เสมอ: โจมตี–โจมตี 1 เท่าทั้งคู่ · แรง–แรง 1.5 เท่าทั้งคู่ · ป้องกัน–ป้องกัน ไม่มีใครเจ็บ
   */
  var MOVES = ['A', 'H', 'D'];
  var MOVE_NAME = { A: 'โจมตี', H: 'โจมตีแรง', D: 'ป้องกัน' };
  var WIN_MULT = 1.3;
  var TABLE = {
    A: { A: [1, 1], H: [WIN_MULT, 0], D: [0, WIN_MULT] },
    H: { A: [0, WIN_MULT], H: [1.5, 1.5], D: [WIN_MULT, 0] },
    D: { A: [WIN_MULT, 0], H: [0, WIN_MULT], D: [0, 0] }
  };
  // ท่าที่ชนะท่านั้น
  var BEATS = { A: 'D', H: 'A', D: 'H' };

  /* ---------- มอนสเตอร์ 8 แบบ (ชื่อ/ค่าคิดเอง) · bias = โอกาสเลือก [โจมตี, แรง, ป้องกัน] ---------- */
  var MONSTERS = [
    { id: 'shroom', name: 'เห็ดพิษเดินได้', tier: 1, hp: 16, atk: 8, def: 1, bias: [0.5, 0.2, 0.3] },
    { id: 'bat', name: 'ค้างคาวหินผา', tier: 1, hp: 14, atk: 9, def: 0, bias: [0.25, 0.5, 0.25] },
    { id: 'wolf', name: 'หมาป่าเงา', tier: 2, hp: 24, atk: 11, def: 2, bias: [0.55, 0.25, 0.2] },
    { id: 'bones', name: 'ทหารกระดูก', tier: 2, hp: 26, atk: 10, def: 4, bias: [0.2, 0.25, 0.55] },
    { id: 'bog', name: 'ยักษ์หนองน้ำ', tier: 3, hp: 38, atk: 14, def: 4, bias: [0.25, 0.55, 0.2] },
    { id: 'firebird', name: 'นกไฟหางยาว', tier: 3, hp: 32, atk: 16, def: 3, bias: [0.5, 0.3, 0.2] },
    { id: 'rust', name: 'อัศวินสนิมเขรอะ', tier: 4, hp: 48, atk: 17, def: 7, bias: [0.2, 0.25, 0.55] },
    { id: 'mist', name: 'งูหมอกเจ็ดเกล็ด', tier: 4, hp: 56, atk: 19, def: 5, bias: [0.34, 0.33, 0.33] }
  ];
  var BIAS_TEXT = ['ชอบโจมตี', 'ชอบโจมตีแรง', 'ชอบตั้งป้องกัน'];

  /* ---------- เมือง 7 แห่ง (ชื่อคิดเอง) · tier 1–3 · guard = มอนสเตอร์ที่เฝ้า + ตัวคูณพลัง ---------- */
  var TOWNS = [
    { name: 'หมู่บ้านใบเฟิร์น', tier: 1, base: 100, guard: 'shroom', boost: 1.1 },
    { name: 'บ้านสายหมอก', tier: 1, base: 100, guard: 'bat', boost: 1.1 },
    { name: 'ท่าเรือจันทร์เสี้ยว', tier: 2, base: 150, guard: 'wolf', boost: 1.2 },
    { name: 'ป้อมลมหนาว', tier: 2, base: 150, guard: 'bones', boost: 1.2 },
    { name: 'ตลาดหินเขียว', tier: 2, base: 150, guard: 'bog', boost: 0.9 },
    { name: 'นครทรายทอง', tier: 3, base: 220, guard: 'firebird', boost: 1.15 },
    { name: 'ปราสาทเมฆา', tier: 3, base: 220, guard: 'rust', boost: 1.0 }
  ];

  /* ---------- กระดาน 30 ช่อง (วนรอบ) ---------- */
  var LAYOUT = [
    'start', 'gold', 'monster', 'town0', 'chest', 'monster', 'shop', 'town1', 'monster', 'gold',
    'town2', 'chest', 'monster', 'rest', 'town3', 'monster', 'gold', 'town4', 'chest', 'shop',
    'monster', 'town5', 'gold', 'monster', 'chest', 'town6', 'monster', 'gold', 'shop', 'chest'
  ];
  var SIZE = LAYOUT.length;
  var SPACE_NAME = {
    start: 'ลานประตูเมือง',
    gold: 'ถุงเงินตกหล่น',
    monster: 'ป่ามอนสเตอร์',
    chest: 'หีบสมบัติ',
    shop: 'ร้านพ่อค้าเร่',
    rest: 'บ่อน้ำพุร้อน',
    town: 'เมือง'
  };

  /* ---------- ร้านค้า ---------- */
  var WEAPONS = [
    { name: 'ดาบเหล็กกล้า', atk: 3, price: 70 },
    { name: 'ดาบเงินจันทร์', atk: 6, price: 170 }
  ];
  var ARMORS = [
    { name: 'เสื้อหนังแรด', def: 2, price: 60 },
    { name: 'เกราะเกล็ดเงิน', def: 4, price: 150 }
  ];
  var ITEMS = {
    potion: { name: 'ยาฟื้นพลัง', price: 30, max: MAX_POTION },
    smoke: { name: 'ลูกควันหนีภัย', price: 25, max: MAX_SMOKE }
  };

  /* ---------- สุ่ม (mulberry32 เก็บค่าไว้ใน s.seed) ---------- */
  function rnd(s) {
    s.seed = (s.seed + 0x6d2b79f5) >>> 0;
    var t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function rint(s, lo, hi) {
    return lo + Math.floor(rnd(s) * (hi - lo + 1));
  }

  function pickWeighted(s, w) {
    var sum = 0;
    for (var i = 0; i < w.length; i++) sum += w[i];
    var x = rnd(s) * sum;
    for (var j = 0; j < w.length; j++) {
      x -= w[j];
      if (x < 0) return j;
    }
    return w.length - 1;
  }

  function monsterById(id) {
    for (var i = 0; i < MONSTERS.length; i++) if (MONSTERS[i].id === id) return MONSTERS[i];
    return MONSTERS[0];
  }

  /* ---------- ผู้เล่น ---------- */
  function makePlayer(def, i) {
    return {
      name: def.name || 'ผู้เล่น ' + (i + 1),
      cpu: !!def.cpu,
      style: def.style || 'normal',
      pos: 0,
      gold: START_GOLD,
      hp: BASE.hp,
      mhp: BASE.hp,
      atk: BASE.atk,
      def: BASE.def,
      lv: 1,
      xp: 0,
      w: -1,
      ar: -1,
      potion: 1,
      smoke: 0,
      laps: 0,
      bank: false,
      skip: 0,
      st: { wins: 0, losses: 0, broke: 0, tollPaid: 0, tollGot: 0, duelsWon: 0, captured: 0 }
    };
  }

  function atkOf(p) {
    return p.atk + (p.w >= 0 ? WEAPONS[p.w].atk : 0);
  }

  function defOf(p) {
    return p.def + (p.ar >= 0 ? ARMORS[p.ar].def : 0);
  }

  function xpNeed(lv) {
    return lv * 10;
  }

  /* ---------- เมือง ---------- */
  function townValue(t) {
    var T = TOWNS[t.i];
    return T.base + Math.round(T.base * INVEST_RATE) * (t.level - 1);
  }

  function investCost(t) {
    return Math.round(TOWNS[t.i].base * INVEST_RATE);
  }

  // ค่าฟื้นฟูเมือง: ชนะผู้เฝ้าแล้วต้องจ่ายเท่านี้จึงได้เมือง
  function claimFee(ti) {
    return Math.round(TOWNS[ti].base * CLAIM_RATE);
  }

  function toll(t) {
    return Math.round(townValue(t) * (TOLL_RATE + TOLL_STEP * (t.level - 1)));
  }

  function townsOf(s, pi) {
    return s.towns.filter(function (t) {
      return t.owner === pi;
    });
  }

  function assets(s, pi) {
    var v = 0;
    townsOf(s, pi).forEach(function (t) {
      v += townValue(t);
    });
    return v;
  }

  function total(s, pi) {
    return s.players[pi].gold + assets(s, pi);
  }

  // ทรัพย์รวมน้อยสุด (ต้องน้อยกว่าทุกคนจริง ๆ ไม่นับเสมอ)
  function isLast(s, pi) {
    var mine = total(s, pi);
    for (var i = 0; i < s.players.length; i++) if (i !== pi && total(s, i) <= mine) return false;
    return s.players.length > 1;
  }

  /* ---------- สร้างเกม ----------
   * opts = { players: [{ name, cpu, style }], length: 'short'|'mid'|'long' หรือ rounds: ตัวเลข, seed }
   */
  function newGame(opts) {
    opts = opts || {};
    var defs = opts.players && opts.players.length ? opts.players : [{ name: 'คุณ' }, { name: 'คอม', cpu: true }];
    var rounds = opts.rounds || LENGTHS[opts.length] || LENGTHS.mid;
    var s = {
      v: 1,
      seed: (opts.seed == null ? Math.floor(Math.random() * 4294967296) : opts.seed) >>> 0,
      rounds: rounds,
      length: opts.length || null,
      round: 1,
      turn: 0,
      phase: 'roll',
      pending: null,
      battle: null,
      duel: null,
      result: null,
      lastRoll: 0,
      players: defs.map(makePlayer),
      board: LAYOUT.map(function (k) {
        return k.indexOf('town') === 0 ? { t: 'town', town: Number(k.slice(4)) } : { t: k };
      }),
      towns: TOWNS.map(function (T, i) {
        return { i: i, owner: -1, level: 1 };
      })
    };
    // ผู้เล่นคนหลัง ๆ ได้ทุนตั้งต้นเพิ่มนิดหน่อย ชดเชยที่ได้เดินทีหลัง (ดูผลจำลอง)
    s.players.forEach(function (p, i) {
      p.gold += i * SEAT_BONUS;
    });
    return s;
  }

  function decider(s) {
    if (s.phase === 'over') return -1;
    if (s.phase === 'duel') return s.duel.plans[0] ? s.duel.b : s.duel.a;
    return s.turn;
  }

  /* ---------- เหตุการณ์ ---------- */
  function ev(list, kind, text, extra) {
    var e = { k: kind, t: text };
    if (extra) for (var key in extra) e[key] = extra[key];
    list.push(e);
    return e;
  }

  function gainXp(s, pi, xp, out) {
    var p = s.players[pi];
    if (p.lv >= MAX_LEVEL) return;
    p.xp += xp;
    while (p.lv < MAX_LEVEL && p.xp >= xpNeed(p.lv)) {
      p.xp -= xpNeed(p.lv);
      p.lv += 1;
      p.mhp += LEVEL_UP.hp;
      p.hp = Math.min(p.mhp, p.hp + LEVEL_UP.hp);
      p.atk += LEVEL_UP.atk;
      p.def += LEVEL_UP.def;
      ev(out, 'level', p.name + ' เลเวลอัปเป็น Lv ' + p.lv + '! (พลังชีวิต +' + LEVEL_UP.hp + ' · โจมตี +' + LEVEL_UP.atk + ' · ป้องกัน +' + LEVEL_UP.def + ')', { p: pi });
    }
    if (p.lv >= MAX_LEVEL) p.xp = 0;
  }

  function pay(s, from, to, amount, out) {
    var p = s.players[from];
    var paid = Math.min(p.gold, amount);
    p.gold -= paid;
    if (to >= 0) s.players[to].gold += paid;
    if (paid < amount) {
      p.st.broke += 1;
      ev(out, 'broke', p.name + ' เงินไม่พอจ่าย — หมดตัว!', { p: from });
    }
    return paid;
  }

  /* ---------- เริ่ม/จบตา ---------- */
  function investable(s, pi) {
    var p = s.players[pi];
    return townsOf(s, pi)
      .filter(function (t) {
        return t.level < MAX_TOWN_LEVEL && investCost(t) <= p.gold;
      })
      .map(function (t) {
        return t.i;
      });
  }

  function endTurn(s, out) {
    s.pending = null;
    s.battle = null;
    s.duel = null;
    // ผ่านลานประตูเมืองในตานี้ → ได้เลือกลงทุนเมืองไหนก็ได้ของตัวเอง 1 เมือง ก่อนจบตา
    var cur = s.players[s.turn];
    if (cur.bank) {
      cur.bank = false;
      var list = investable(s, s.turn);
      if (list.length) {
        s.phase = 'decide';
        s.pending = { kind: 'invest', towns: list, bank: true };
        ev(out, 'ask', cur.name + ' ผ่านลานประตูเมือง — ลงทุนขยายเมืองของตัวเองได้ 1 เมือง', { p: s.turn });
        return;
      }
    }
    // ไปคนถัดไป · คนที่แพ้การต่อสู้ในตาก่อน = นอนพักฟื้น ข้าม 1 ตา (แล้วฟื้นเต็ม)
    for (var guard = 0; guard <= s.players.length; guard++) {
      s.turn += 1;
      if (s.turn >= s.players.length) {
        s.turn = 0;
        s.round += 1;
      }
      if (s.round > s.rounds) {
        finish(s, out);
        return;
      }
      var nx = s.players[s.turn];
      if (nx.skip > 0) {
        nx.skip -= 1;
        nx.hp = nx.mhp;
        ev(out, 'skip', nx.name + ' นอนพักฟื้น ข้าม 1 ตา (พลังชีวิตกลับมาเต็ม)', { p: s.turn });
        continue;
      }
      break;
    }
    s.phase = 'roll';
    ev(out, 'turn', 'ตาของ ' + s.players[s.turn].name, { p: s.turn });
  }

  function standings(s) {
    return s.players
      .map(function (p, i) {
        return { p: i, gold: p.gold, towns: assets(s, i), total: total(s, i), count: townsOf(s, i).length };
      })
      .sort(function (a, b) {
        return b.total - a.total || b.count - a.count || a.p - b.p;
      });
  }

  function finish(s, out) {
    s.phase = 'over';
    s.round = s.rounds;
    var rank = standings(s);
    var tie = rank.length > 1 && rank[0].total === rank[1].total && rank[0].count === rank[1].count;
    s.result = { rank: rank, winner: tie ? -1 : rank[0].p };
    ev(out, 'over', tie ? 'จบเกม — เสมอกัน!' : 'จบเกม — ' + s.players[rank[0].p].name + ' ชนะ!', { p: s.result.winner });
  }

  /* ---------- ทอย + เดิน ---------- */
  function roll(s, out, forced) {
    var pi = s.turn;
    var p = s.players[pi];
    var d = forced >= 1 && forced <= 6 ? forced : rint(s, 1, 6);
    s.lastRoll = d;
    var from = p.pos;
    ev(out, 'roll', p.name + ' ทอยได้ ' + d, { p: pi, v: d, from: from });
    for (var k = 0; k < d; k++) {
      p.pos = (p.pos + 1) % SIZE;
      if (p.pos === 0) {
        p.laps += 1;
        var sal = SALARY + SALARY_PER_TOWN * townsOf(s, pi).length;
        if (isLast(s, pi)) sal += Math.round(SALARY * CATCH_UP);
        p.gold += sal;
        p.bank = true;
        ev(out, 'salary', p.name + ' ผ่านลานประตูเมือง รับเงินหลวง ' + sal + ' เหรียญ', { p: pi, v: sal });
      }
    }
    ev(out, 'move', '', { p: pi, from: from, to: p.pos, steps: d });
    land(s, out);
  }

  function othersHere(s, pi) {
    var list = [];
    s.players.forEach(function (q, i) {
      if (i !== pi && q.pos === s.players[pi].pos) list.push(i);
    });
    return list;
  }

  function land(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var sp = s.board[p.pos];
    var here = sp.t === 'start' ? [] : othersHere(s, pi);
    if (here.length) {
      s.phase = 'decide';
      s.pending = { kind: 'duel-offer', targets: here };
      ev(out, 'ask', p.name + ' เจอ ' + here.map(function (i) { return s.players[i].name; }).join(' กับ ') + ' — จะท้าประลองไหม', { p: pi });
      return;
    }
    resolveSpace(s, out);
  }

  function resolveSpace(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var sp = s.board[p.pos];
    var frac = s.round / s.rounds;
    switch (sp.t) {
      case 'start': {
        var bonus = Math.round(SALARY / 2);
        p.gold += bonus;
        ev(out, 'gold', p.name + ' หยุดที่ลานประตูเมือง รับโบนัสอีก ' + bonus + ' เหรียญ', { p: pi, v: bonus });
        endTurn(s, out);
        return;
      }
      case 'gold': {
        var g = rint(s, 15, 35) + Math.round(frac * 20);
        p.gold += g;
        ev(out, 'gold', p.name + ' เก็บถุงเงินได้ ' + g + ' เหรียญ', { p: pi, v: g });
        endTurn(s, out);
        return;
      }
      case 'rest': {
        p.hp = p.mhp;
        ev(out, 'heal', p.name + ' แช่บ่อน้ำพุร้อน พลังชีวิตเต็ม', { p: pi });
        endTurn(s, out);
        return;
      }
      case 'chest':
        openChest(s, out);
        endTurn(s, out);
        return;
      case 'monster':
        startBattle(s, out, randomMonster(s), -1);
        return;
      case 'shop':
        s.phase = 'decide';
        s.pending = { kind: 'shop' };
        ev(out, 'ask', p.name + ' แวะร้านพ่อค้าเร่', { p: pi });
        return;
      case 'town': {
        var t = s.towns[sp.town];
        var T = TOWNS[t.i];
        if (t.owner === -1) {
          s.phase = 'decide';
          s.pending = { kind: 'town', town: t.i };
          ev(out, 'ask', T.name + ' ถูก' + monsterById(T.guard).name + 'ยึดอยู่ — จะสู้เพื่อยึดเมืองไหม', { p: pi });
        } else if (t.owner === pi) {
          if (t.level < MAX_TOWN_LEVEL && investCost(t) <= p.gold) {
            s.phase = 'decide';
            s.pending = { kind: 'invest', towns: [t.i], bank: false };
            ev(out, 'ask', p.name + ' กลับถึง' + T.name + ' เมืองของตัวเอง — ลงทุนขยายเมืองได้', { p: pi });
          } else {
            ev(out, 'home', p.name + ' แวะพักที่' + T.name + ' เมืองของตัวเอง', { p: pi });
            endTurn(s, out);
          }
        } else {
          var fee = toll(t);
          var paid = pay(s, pi, t.owner, fee, out);
          p.st.tollPaid += paid;
          s.players[t.owner].st.tollGot += paid;
          ev(out, 'toll', p.name + ' จ่ายค่าผ่านทาง' + T.name + ' ' + paid + ' เหรียญ ให้ ' + s.players[t.owner].name, { p: pi, to: t.owner, v: paid });
          endTurn(s, out);
        }
        return;
      }
    }
    endTurn(s, out);
  }

  function openChest(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var r = pickWeighted(s, [40, 25, 10, 10, 15]);
    if (r === 0) {
      var g = rint(s, 20, 50);
      p.gold += g;
      ev(out, 'chest', p.name + ' เปิดหีบได้ ' + g + ' เหรียญ', { p: pi });
    } else if (r === 1 && p.potion < MAX_POTION) {
      p.potion += 1;
      ev(out, 'chest', p.name + ' เปิดหีบได้' + ITEMS.potion.name + ' 1 ขวด', { p: pi });
    } else if (r === 2 && p.smoke < MAX_SMOKE) {
      p.smoke += 1;
      ev(out, 'chest', p.name + ' เปิดหีบได้' + ITEMS.smoke.name + ' 1 ลูก', { p: pi });
    } else if (r === 3) {
      p.atk += 1;
      ev(out, 'chest', p.name + ' เปิดหีบได้ยาเสริมแรง — โจมตี +1 ถาวร', { p: pi });
    } else {
      p.mhp += 3;
      p.hp += 3;
      ev(out, 'chest', p.name + ' เปิดหีบได้เครื่องรางไม้โอ๊ก — พลังชีวิตสูงสุด +3', { p: pi });
    }
  }

  function randomMonster(s) {
    var frac = s.round / s.rounds;
    var top = Math.max(1, Math.min(4, 1 + Math.floor(frac * 3.4)));
    var lo = Math.max(1, top - 1);
    var tier = rint(s, lo, top);
    var pool = MONSTERS.filter(function (m) {
      return m.tier === tier;
    });
    return pool[rint(s, 0, pool.length - 1)];
  }

  /* ---------- ต่อสู้กับมอนสเตอร์/ผู้เฝ้าเมือง ---------- */
  function startBattle(s, out, m, townIdx) {
    var boost = townIdx >= 0 ? TOWNS[townIdx].boost : 1;
    var hp = Math.round(m.hp * boost);
    s.phase = 'battle';
    s.battle = {
      m: m.id,
      town: townIdx,
      name: m.name,
      hp: hp,
      mhp: hp,
      atk: Math.round(m.atk * (townIdx >= 0 ? Math.sqrt(boost) : 1)),
      def: m.def,
      tier: m.tier + (townIdx >= 0 ? 1 : 0),
      bias: m.bias.slice(),
      n: 0,
      last: null
    };
    ev(out, 'battle', (townIdx >= 0 ? 'ผู้เฝ้า' + TOWNS[townIdx].name + ': ' : 'เจอ ') + m.name + '!', { p: s.turn });
  }

  function damage(s, atk, def, mult) {
    if (!mult) return 0;
    var base = atk * mult - def * 0.5;
    var v = 0.85 + rnd(s) * 0.3;
    return Math.max(1, Math.round(base * v));
  }

  function exchange(s, out, mine) {
    var b = s.battle;
    var p = s.players[s.turn];
    var theirs = MOVES[pickWeighted(s, b.bias)];
    var mult = TABLE[mine][theirs];
    var dealt = damage(s, atkOf(p), b.def, mult[0]);
    var took = damage(s, b.atk, defOf(p), mult[1]);
    b.hp = Math.max(0, b.hp - dealt);
    p.hp = Math.max(0, p.hp - took);
    b.n += 1;
    b.last = { me: mine, foe: theirs, dealt: dealt, took: took };
    ev(out, 'hit', p.name + ' ' + MOVE_NAME[mine] + ' · ' + b.name + ' ' + MOVE_NAME[theirs] + ' — ทำได้ ' + dealt + ' · โดน ' + took, {
      p: s.turn,
      me: mine,
      foe: theirs,
      dealt: dealt,
      took: took
    });
    afterExchange(s, out);
  }

  function afterExchange(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    if (b.hp <= 0) {
      winBattle(s, out);
      return;
    }
    if (p.hp <= 0) {
      loseBattle(s, out);
      return;
    }
    if (b.n >= MAX_EXCHANGES) {
      ev(out, 'draw', b.name + ' ถอยหนีไป — ไม่มีใครชนะ', { p: pi });
      endTurn(s, out);
    }
  }

  function winBattle(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    p.st.wins += 1;
    var gold = b.tier * 12 + rint(s, 0, 10);
    var xp = b.tier * 6;
    p.gold += gold;
    ev(out, 'win', p.name + ' ชนะ' + b.name + '! ได้ ' + gold + ' เหรียญ · ค่าประสบการณ์ +' + xp, { p: pi, v: gold });
    gainXp(s, pi, xp, out);
    if (b.town >= 0) {
      var t = s.towns[b.town];
      var fee = claimFee(b.town);
      if (p.gold >= fee) {
        p.gold -= fee;
        t.owner = pi;
        t.level = 1;
        p.st.captured += 1;
        ev(out, 'capture', p.name + ' จ่ายค่าฟื้นฟู ' + fee + ' เหรียญ ยึด' + TOWNS[b.town].name + 'ได้! (มูลค่า ' + townValue(t) + ')', { p: pi, town: b.town });
      } else {
        ev(out, 'nofee', p.name + ' เงินไม่พอค่าฟื้นฟูเมือง (' + fee + ') — เมืองยังว่างอยู่ ผู้เฝ้าตัวใหม่เข้ามาแทน', { p: pi, town: b.town });
      }
    }
    endTurn(s, out);
  }

  function loseBattle(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    p.st.losses += 1;
    var lost = Math.floor(p.gold * LOSE_GOLD);
    p.gold -= lost;
    p.hp = 1;
    p.skip = 1;
    ev(out, 'lose', p.name + ' แพ้' + b.name + ' — ทำเหรียญหล่น ' + lost + ' · ต้องนอนพักฟื้น 1 ตา', { p: pi, v: lost });
    endTurn(s, out);
  }

  function usePotion(s, pi, out) {
    var p = s.players[pi];
    if (p.potion <= 0 || p.hp >= p.mhp) return false;
    p.potion -= 1;
    var heal = Math.ceil(p.mhp / 2);
    p.hp = Math.min(p.mhp, p.hp + heal);
    ev(out, 'heal', p.name + ' ดื่ม' + ITEMS.potion.name + ' พลังชีวิต +' + heal, { p: pi });
    return true;
  }

  /* ---------- ประลองระหว่างผู้เล่น (ไม่เสียพลังชีวิตจริง · แค่วัดฝีมือ 3 ยก) ---------- */
  function startDuel(s, out, target) {
    s.phase = 'duel';
    s.pending = null;
    s.duel = { a: s.turn, b: target, plans: [null, null] };
    ev(out, 'duel', s.players[s.turn].name + ' ท้าประลอง ' + s.players[target].name + '!', { p: s.turn, to: target });
  }

  function validPlan(m) {
    return (
      Array.isArray(m) &&
      m.length === 3 &&
      m.every(function (x) {
        return MOVES.indexOf(x) !== -1;
      })
    );
  }

  function resolveDuel(s, out) {
    var d = s.duel;
    var A = s.players[d.a];
    var B = s.players[d.b];
    var dmg = [0, 0];
    var rounds = [];
    for (var k = 0; k < 3; k++) {
      var ma = d.plans[0][k];
      var mb = d.plans[1][k];
      var mult = TABLE[ma][mb];
      var x = damage(s, atkOf(A), defOf(B), mult[0]);
      var y = damage(s, atkOf(B), defOf(A), mult[1]);
      dmg[0] += x;
      dmg[1] += y;
      rounds.push({ a: ma, b: mb, da: x, db: y });
    }
    var win = dmg[0] > dmg[1] ? d.a : dmg[1] > dmg[0] ? d.b : -1;
    var take = 0;
    if (win >= 0) {
      var lose = win === d.a ? d.b : d.a;
      take = Math.floor(s.players[lose].gold * DUEL_TAKE);
      s.players[lose].gold -= take;
      s.players[win].gold += take;
      s.players[win].st.duelsWon += 1;
    }
    d.result = { rounds: rounds, dmg: dmg, winner: win, take: take };
    ev(
      out,
      'duel-result',
      win < 0
        ? 'ประลองเสมอ ' + dmg[0] + ' ต่อ ' + dmg[1] + ' — ไม่มีใครเสียเงิน'
        : s.players[win].name + ' ชนะประลอง (' + dmg[0] + ' ต่อ ' + dmg[1] + ') ได้เงิน ' + take + ' เหรียญ',
      { p: d.a, to: d.b, winner: win, take: take, rounds: rounds, dmg: dmg }
    );
    // ประลองจบ → ผลของช่องที่ยืนอยู่ยังเกิดตามปกติ
    s.duel = null;
    resolveSpace(s, out);
  }

  /* ---------- ร้านค้า ---------- */
  function shopList(p) {
    var list = [];
    list.push({ id: 'potion', name: ITEMS.potion.name, price: ITEMS.potion.price, note: 'ฟื้นพลังชีวิตครึ่งหลอด · มีได้ ' + MAX_POTION, ok: p.potion < MAX_POTION });
    list.push({ id: 'smoke', name: ITEMS.smoke.name, price: ITEMS.smoke.price, note: 'หนีออกจากการต่อสู้ · มีได้ ' + MAX_SMOKE, ok: p.smoke < MAX_SMOKE });
    var nw = p.w + 1;
    if (nw < WEAPONS.length) list.push({ id: 'w', name: WEAPONS[nw].name, price: WEAPONS[nw].price, note: 'โจมตี +' + WEAPONS[nw].atk, ok: true });
    var na = p.ar + 1;
    if (na < ARMORS.length) list.push({ id: 'ar', name: ARMORS[na].name, price: ARMORS[na].price, note: 'ป้องกัน +' + ARMORS[na].def, ok: true });
    list.forEach(function (it) {
      it.ok = it.ok && p.gold >= it.price;
    });
    return list;
  }

  function buy(s, out, id) {
    var pi = s.turn;
    var p = s.players[pi];
    var it = shopList(p).filter(function (x) {
      return x.id === id;
    })[0];
    if (!it || !it.ok) return false;
    p.gold -= it.price;
    if (id === 'potion') p.potion += 1;
    else if (id === 'smoke') p.smoke += 1;
    else if (id === 'w') p.w += 1;
    else if (id === 'ar') p.ar += 1;
    ev(out, 'buy', p.name + ' ซื้อ' + it.name + ' (' + it.price + ' เหรียญ)', { p: pi });
    return true;
  }

  /* ---------- การกระทำ ----------
   * { type: 'roll' }                          ช่วง roll
   * { type: 'use', item: 'potion' }           ช่วง roll / battle
   * { type: 'use', item: 'smoke' }            ช่วง battle
   * { type: 'duel', target } | { type: 'skip' }  duel-offer
   * { type: 'fight' } | { type: 'skip' }         town (ยังไม่มีเจ้าของ)
   * { type: 'invest', levels }                   invest (0 = ไม่ลงทุน)
   * { type: 'buy', item } | { type: 'leave' }    shop
   * { type: 'move', m: 'A'|'H'|'D' }             battle
   * { type: 'plan', moves: [3 ท่า] }              duel (ของ decider)
   * คืน events (array) · ทำไม่ได้ = คืน null
   */
  function act(s, a) {
    var out = [];
    if (!a || s.phase === 'over') return null;
    var pi = s.turn;
    var p = s.players[pi];
    switch (s.phase) {
      case 'roll':
        if (a.type === 'roll') {
          roll(s, out, a.forced);
          return out;
        }
        if (a.type === 'use' && a.item === 'potion') return usePotion(s, pi, out) ? out : null;
        return null;
      case 'decide': {
        var k = s.pending.kind;
        if (k === 'duel-offer') {
          if (a.type === 'duel' && s.pending.targets.indexOf(a.target) !== -1) startDuel(s, out, a.target);
          else if (a.type === 'skip') {
            s.pending = null;
            resolveSpace(s, out);
          } else return null;
          return out;
        }
        if (k === 'town') {
          if (a.type === 'fight') startBattle(s, out, monsterById(TOWNS[s.pending.town].guard), s.pending.town);
          else if (a.type === 'skip') {
            ev(out, 'pass', p.name + ' ผ่านเมืองไปก่อน', { p: pi });
            endTurn(s, out);
          } else return null;
          return out;
        }
        if (k === 'invest') {
          if (a.type !== 'invest') return null;
          var n = Math.max(0, a.levels | 0);
          if (n === 0) {
            endTurn(s, out);
            return out;
          }
          if (s.pending.towns.indexOf(a.town) === -1) return null;
          var t = s.towns[a.town];
          n = Math.min(n, MAX_TOWN_LEVEL - t.level);
          var cost = investCost(t) * n;
          if (cost > p.gold) return null;
          if (n > 0) {
            p.gold -= cost;
            t.level += n;
            ev(out, 'invest', p.name + ' ลงทุน ' + cost + ' เหรียญ ขยาย' + TOWNS[t.i].name + 'เป็นระดับ ' + t.level + ' (ค่าผ่านทาง ' + toll(t) + ')', { p: pi, town: t.i });
          }
          endTurn(s, out);
          return out;
        }
        if (k === 'shop') {
          if (a.type === 'buy') return buy(s, out, a.item) ? out : null;
          if (a.type === 'leave') {
            endTurn(s, out);
            return out;
          }
          return null;
        }
        return null;
      }
      case 'battle':
        if (a.type === 'move' && MOVES.indexOf(a.m) !== -1) {
          exchange(s, out, a.m);
          return out;
        }
        if (a.type === 'use' && a.item === 'potion') {
          if (!usePotion(s, pi, out)) return null;
          // ดื่มยา = เสียจังหวะ อีกฝ่ายได้โจมตีฟรี (ท่าตามนิสัย ถ้าป้องกัน = ไม่ทำอะไร)
          var b = s.battle;
          var mv = MOVES[pickWeighted(s, b.bias)];
          var took = mv === 'D' ? 0 : damage(s, b.atk, defOf(p), mv === 'H' ? 1.5 : 1);
          p.hp = Math.max(0, p.hp - took);
          b.n += 1;
          b.last = { me: 'P', foe: mv, dealt: 0, took: took };
          ev(out, 'hit', p.name + ' ดื่มยา · ' + b.name + (mv === 'D' ? ' ตั้งท่ารอ' : ' ฉวย' + MOVE_NAME[mv] + ' — โดน ' + took), { p: pi, me: 'P', foe: mv, dealt: 0, took: took });
          afterExchange(s, out);
          return out;
        }
        if (a.type === 'use' && a.item === 'smoke') {
          if (p.smoke <= 0) return null;
          p.smoke -= 1;
          ev(out, 'flee', p.name + ' ปาลูกควัน หนีออกมาได้', { p: pi });
          endTurn(s, out);
          return out;
        }
        return null;
      case 'duel': {
        if (a.type !== 'plan' || !validPlan(a.moves)) return null;
        var d = s.duel;
        d.plans[d.plans[0] ? 1 : 0] = a.moves.slice();
        if (d.plans[1]) resolveDuel(s, out);
        else ev(out, 'planned', s.players[d.a].name + ' วางแผนเสร็จแล้ว', { p: d.a });
        return out;
      }
    }
    return null;
  }

  /* ---------- คอม ---------- */
  // ประมาณโอกาสชนะแบบหยาบ: เทียบจำนวนยกที่ต้องใช้ล้มอีกฝ่าย
  function edge(p, foe) {
    var mine = Math.max(1, atkOf(p) - foe.def * 0.5);
    var theirs = Math.max(1, foe.atk - defOf(p) * 0.5);
    var myLife = p.hp + p.potion * Math.ceil(p.mhp / 2) * 0.6;
    return myLife / theirs / (foe.hp / mine);
  }

  function reserve(s, pi) {
    // เงินกันไว้จ่ายค่าผ่านทางแพงสุดที่อาจเจอ
    var worst = 0;
    s.towns.forEach(function (t) {
      if (t.owner >= 0 && t.owner !== pi) worst = Math.max(worst, toll(t));
    });
    return Math.max(40, Math.round(worst * 1.1));
  }

  function counterOf(bias) {
    var best = 0;
    for (var i = 1; i < 3; i++) if (bias[i] > bias[best]) best = i;
    return BEATS[MOVES[best]];
  }

  function cpuAct(s) {
    var di = decider(s);
    if (di < 0) return null;
    var p = s.players[di];
    var style = p.style;
    switch (s.phase) {
      case 'roll':
        if (p.hp < p.mhp * 0.45 && p.potion > 0) return { type: 'use', item: 'potion' };
        return { type: 'roll' };
      case 'decide': {
        var k = s.pending.kind;
        if (k === 'duel-offer') {
          if (style === 'meek') return { type: 'skip' };
          var best = -1;
          s.pending.targets.forEach(function (t) {
            var q = s.players[t];
            var mine = atkOf(p) + defOf(p);
            var theirs = atkOf(q) + defOf(q);
            if (q.gold >= 60 && mine >= theirs - 1 && (best < 0 || q.gold > s.players[best].gold)) best = t;
          });
          return best >= 0 ? { type: 'duel', target: best } : { type: 'skip' };
        }
        if (k === 'town') {
          var T = TOWNS[s.pending.town];
          var m = monsterById(T.guard);
          var foe = { hp: m.hp * T.boost, atk: m.atk * Math.sqrt(T.boost), def: m.def };
          var need = style === 'always' ? 0 : style === 'bold' ? 0.2 : style === 'meek' ? 0.9 : 0.35;
          if (p.gold < claimFee(s.pending.town)) return { type: 'skip' };
          return edge(p, foe) >= need ? { type: 'fight' } : { type: 'skip' };
        }
        if (k === 'invest') {
          if (style === 'hoard') return { type: 'invest', levels: 0 };
          // เลือกเมืองที่ค่าผ่านทางเพิ่มมากสุดต่อเงินที่ลง
          var bestT = -1;
          var bestGain = 0;
          s.pending.towns.forEach(function (ti) {
            var tt = s.towns[ti];
            var now = toll(tt);
            tt.level += 1;
            var gain = (toll(tt) - now) / investCost(tt);
            tt.level -= 1;
            if (gain > bestGain) {
              bestGain = gain;
              bestT = ti;
            }
          });
          if (bestT < 0) return { type: 'invest', levels: 0 };
          var t = s.towns[bestT];
          var cost = investCost(t);
          var spare = p.gold - reserve(s, di) - (style === 'bold' ? 0 : 30);
          var n = 0;
          while (t.level + n < MAX_TOWN_LEVEL && spare >= cost * (n + 1)) n++;
          if (style === 'tycoon') n = Math.min(MAX_TOWN_LEVEL - t.level, Math.floor((p.gold - 20) / cost));
          return { type: 'invest', town: bestT, levels: Math.max(0, n) };
        }
        if (k === 'shop') {
          var list = shopList(p);
          var keep = reserve(s, di);
          for (var i = 0; i < list.length; i++) {
            var it = list[i];
            if (!it.ok) continue;
            if (it.id === 'potion' && p.potion < 2 && p.gold - it.price >= keep * 0.5) return { type: 'buy', item: 'potion' };
            if ((it.id === 'w' || it.id === 'ar') && style !== 'hoard' && p.gold - it.price >= keep + 40) return { type: 'buy', item: it.id };
          }
          return { type: 'leave' };
        }
        return null;
      }
      case 'battle': {
        var b = s.battle;
        if (p.hp <= p.mhp * 0.3) {
          if (p.potion > 0) return { type: 'use', item: 'potion' };
          if (p.smoke > 0 && b.hp > b.mhp * 0.4) return { type: 'use', item: 'smoke' };
        }
        if (style === 'brute') return { type: 'move', m: 'H' };
        if (rnd(s) < 0.6) return { type: 'move', m: counterOf(b.bias) };
        return { type: 'move', m: MOVES[rint(s, 0, 2)] };
      }
      case 'duel': {
        var plan = [];
        for (var j = 0; j < 3; j++) plan.push(style === 'brute' ? 'H' : MOVES[rint(s, 0, 2)]);
        return { type: 'plan', moves: plan };
      }
    }
    return null;
  }

  /* ---------- เล่นทั้งเกมด้วยคอม (ใช้ในเทส/จำลอง) ---------- */
  function autoplay(s, maxSteps) {
    var steps = 0;
    var limit = maxSteps || 20000;
    while (s.phase !== 'over' && steps < limit) {
      var a = cpuAct(s);
      var r = act(s, a);
      if (!r) throw new Error('คอมเลือกการกระทำที่ใช้ไม่ได้: ' + JSON.stringify(a) + ' ช่วง ' + s.phase);
      steps++;
    }
    return steps;
  }

  return {
    LENGTHS: LENGTHS,
    SIZE: SIZE,
    MOVES: MOVES,
    MOVE_NAME: MOVE_NAME,
    TABLE: TABLE,
    BEATS: BEATS,
    MONSTERS: MONSTERS,
    BIAS_TEXT: BIAS_TEXT,
    TOWNS: TOWNS,
    LAYOUT: LAYOUT,
    SPACE_NAME: SPACE_NAME,
    WEAPONS: WEAPONS,
    ARMORS: ARMORS,
    ITEMS: ITEMS,
    MAX_TOWN_LEVEL: MAX_TOWN_LEVEL,
    MAX_EXCHANGES: MAX_EXCHANGES,
    START_GOLD: START_GOLD,
    SALARY: SALARY,
    newGame: newGame,
    decider: decider,
    act: act,
    cpuAct: cpuAct,
    autoplay: autoplay,
    atkOf: atkOf,
    defOf: defOf,
    xpNeed: xpNeed,
    townValue: townValue,
    investCost: investCost,
    claimFee: claimFee,
    toll: toll,
    townsOf: townsOf,
    assets: assets,
    total: total,
    standings: standings,
    shopList: shopList,
    monsterById: monsterById,
    counterOf: counterOf,
    edge: edge
  };
});
