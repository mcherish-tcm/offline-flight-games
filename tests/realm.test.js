/*
 * เทสกติกา "ชิงเมืองแดนมนตร์" + คอม — รันด้วย:  node tests/realm.test.js
 * (ผลจำลองสมดุลแบบเต็ม: node tests/realm-sim.js · ไฟล์ใน tests/ ไม่ได้อยู่ในรายการเก็บออฟไลน์)
 */
'use strict';

var assert = require('assert');
var R = require('../games/realm/engine.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}

function cpus(n) {
  var list = [];
  for (var i = 0; i < n; i++) list.push({ name: 'P' + i, cpu: true });
  return list;
}

function game(n, seed, length, map) {
  return R.newGame({ players: cpus(n || 2), length: length || 'short', seed: seed == null ? 42 : seed, map: map });
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function kinds(evs) {
  return evs.map(function (e) {
    return e.k;
  });
}

function count(list, k) {
  return list.filter(function (x) {
    return x === k;
  }).length;
}

// แดนมนตร์ (classic): 0 ลาน · 1 หีบ · 2 เมือง0 · 3 มอนสเตอร์ · 4 ศาลา · 6 ร้าน · 12 เมือง4 · 13 น้ำพุ
// ส่งผู้เล่น 0 จากช่อง from ทอยได้ d (ผู้เล่นอื่นไปยืนช่อง 20 ให้พ้นทาง)
function moveTo(s, from, d) {
  for (var i = 1; i < s.players.length; i++) s.players[i].pos = 20;
  s.players[0].pos = from;
  return R.act(s, { type: 'roll', forced: d });
}

// เปิดไพ่ใบที่ต้องการ: ใส่ไพ่ไว้บนกองแล้วเดินไปศาลาช่อง 4
function drawCard(s, id) {
  var idx = R.CARDS.map(function (c) {
    return c.id;
  }).indexOf(id);
  assert.ok(idx >= 0, 'ไม่มีไพ่ ' + id);
  s.deck = [idx];
  return moveTo(s, 0, 4);
}

// ชนะการต่อสู้ยกนี้แน่ ๆ (ศัตรูเหลือ 1 · ศัตรูโจมตีแน่ ๆ → เราป้องกันสวน)
function winFight(s) {
  s.battle.hp = 1;
  s.battle.bias = [1, 0, 0];
  return R.act(s, { type: 'move', m: 'D' });
}

// แพ้การต่อสู้ยกนี้แน่ ๆ
function loseFight(s) {
  s.players[s.turn].hp = 1;
  s.battle.bias = [0, 1, 0]; // ศัตรูโจมตีแรงแน่ ๆ → เราป้องกัน = แพ้ยกนี้
  return R.act(s, { type: 'move', m: 'D' });
}

// เลย์เอาต์กระดานของเซฟรุ่น 1 (ก่อนมีแผนที่) — ใช้สร้างเซฟเก่าจำลอง
var V1_LAYOUT = [
  'start', 'gold', 'monster', 'town0', 'chest', 'monster', 'shop', 'town1', 'monster', 'gold',
  'town2', 'chest', 'monster', 'rest', 'town3', 'monster', 'gold', 'town4', 'chest', 'shop',
  'monster', 'town5', 'gold', 'monster', 'chest', 'town6', 'monster', 'gold', 'shop', 'chest'
];

function v1Save(seed) {
  var s = game(2, seed || 5, 'short', 'legacy');
  s.v = 1;
  delete s.map;
  delete s.fest;
  delete s.deck;
  s.board = V1_LAYOUT.map(function (k) {
    return k.indexOf('town') === 0 ? { t: 'town', town: Number(k.slice(4)) } : { t: k };
  });
  s.players.forEach(function (p) {
    delete p.ch;
    delete p.bomb;
    delete p.boots;
    delete p.ward;
    delete p.fast;
    delete p.st.cards;
  });
  s.towns[3].owner = 1;
  s.towns[3].level = 3;
  s.players[0].pos = 9; // ยืนบนช่องถุงเงินเดิม
  return clone(s);
}

console.log('ชิงเมืองแดนมนตร์ — engine self-tests');

/* ---------- แผนที่ ---------- */

test('แผนที่: แดนมนตร์ 30 ช่อง 10 เมือง · หมู่เกาะ 24 ช่อง 7 เมือง · ช่องตรงสูตร cols×rows · ไม่มีช่องถุงเงินแยกแล้ว', function () {
  assert.deepStrictEqual(R.MAP_IDS, ['classic', 'isle']);
  var want = {
    classic: { size: 30, towns: 10, monster: 8, chest: 4, card: 3, shop: 3, rest: 1, start: 1 },
    isle: { size: 24, towns: 7, monster: 6, chest: 5, card: 2, shop: 2, rest: 1, start: 1 }
  };
  R.MAP_IDS.forEach(function (id) {
    var M = R.MAPS[id];
    var w = want[id];
    assert.strictEqual(M.layout.length, w.size, id + ' จำนวนช่อง');
    assert.strictEqual(M.layout.length, 2 * (M.cols + M.rows) - 4, id + ' ต้องวางรอบขอบตารางได้พอดี');
    assert.strictEqual(M.layout[0], 'start');
    assert.strictEqual(M.towns.length, w.towns, id + ' จำนวนเมือง');
    for (var k = 0; k < w.towns; k++) assert.strictEqual(count(M.layout, 'town' + k), 1, id + ' เมือง ' + k + ' ต้องมี 1 ช่อง');
    ['monster', 'chest', 'card', 'shop', 'rest', 'start'].forEach(function (t) {
      assert.strictEqual(count(M.layout, t), w[t], id + ' ช่อง ' + t);
    });
    assert.strictEqual(count(M.layout, 'gold'), 0, id + ' ต้องไม่มีช่องถุงเงินแยก');
    M.towns.forEach(function (ti) {
      assert.ok(R.TOWNS[ti], id + ' อ้างเมืองที่ไม่มี');
    });
  });
  // เมืองของแต่ละแผนที่ไม่ซ้ำกัน · ชื่อเมืองไม่ซ้ำกันทั้งเกม
  var names = R.TOWNS.map(function (T) {
    return T.name;
  });
  assert.strictEqual(new Set(names).size, names.length);
  assert.strictEqual(R.MONSTERS.length, 8);
});

test('เมืองใหม่มีค่าตามรูปแบบเดิม (ระดับ 1/2/3 = มูลค่า 100/150/220 · ผู้เฝ้ามีจริง)', function () {
  var base = { 1: 100, 2: 150, 3: 220 };
  R.TOWNS.forEach(function (T) {
    assert.strictEqual(T.base, base[T.tier], T.name);
    assert.ok(R.monsterById(T.guard).id === T.guard, T.name + ' ผู้เฝ้า');
    assert.ok(T.boost >= 0.85 && T.boost <= 1.25, T.name + ' boost');
  });
});

test('เกมใหม่: เลือกแผนที่ได้ (ไม่ระบุ = แดนมนตร์) · กระดาน/เมืองมาจากแผนที่ · สลับแผนที่ได้', function () {
  var a = game(2, 1);
  assert.strictEqual(a.map, 'classic');
  assert.strictEqual(a.board.length, 30);
  assert.strictEqual(a.towns.length, 10);
  var b = game(2, 1, 'short', 'isle');
  assert.strictEqual(b.map, 'isle');
  assert.strictEqual(b.board.length, 24);
  assert.strictEqual(b.towns.length, 7);
  assert.strictEqual(R.townDef(b, 0).name, R.TOWNS[R.MAPS.isle.towns[0]].name);
  var c = game(2, 1, 'short', 'classic');
  assert.strictEqual(c.board.length, 30);
  assert.strictEqual(R.mapOf(c).id, 'classic');
  assert.strictEqual(game(2, 1, 'short', 'ไม่มีจริง').map, 'classic', 'แผนที่ไม่รู้จัก = แดนมนตร์');
});

test('หมู่เกาะ 24 ช่อง: เดินวนข้ามลานประตูเมือง (22 + 4 → 2) ได้เงินหลวง · ถอยหลังข้ามลาน (ทรายดูด) วนถูก ไม่ได้เงิน', function () {
  var s = game(2, 3, 'short', 'isle');
  s.players[1].pos = 12;
  s.players[0].pos = 22;
  var g = s.players[0].gold;
  var evs = R.act(s, { type: 'roll', forced: 4 });
  assert.strictEqual(s.players[0].pos, 2);
  assert.ok(kinds(evs).indexOf('salary') !== -1, 'ต้องได้เงินหลวง');
  assert.ok(s.players[0].gold > g);
  var mv = evs.filter(function (e) {
    return e.k === 'move';
  })[0];
  assert.deepStrictEqual([mv.from, mv.to, mv.steps], [22, 2, 4]);
  // ทรายดูดจากศาลาช่อง 4 → ถอย 3 = ช่อง 1 · จากช่อง 1 ถอย 3 ต้องได้ 22
  var t = game(2, 4, 'short', 'isle');
  t.players[1].pos = 12;
  t.players[0].pos = 0;
  t.deck = [
    R.CARDS.map(function (c) {
      return c.id;
    }).indexOf('sand')
  ];
  R.act(t, { type: 'roll', forced: 4 });
  assert.strictEqual(t.players[0].pos, 1);
  var u = game(2, 4, 'short', 'isle');
  u.board[1] = { t: 'card' };
  u.players[1].pos = 12;
  u.players[0].pos = 0;
  u.deck = [
    R.CARDS.map(function (c) {
      return c.id;
    }).indexOf('sand')
  ];
  var g2 = u.players[0].gold;
  R.act(u, { type: 'roll', forced: 1 });
  assert.strictEqual(u.players[0].pos, 22, 'ถอยข้ามลานต้องวนไปท้ายกระดาน');
  assert.strictEqual(u.players[0].gold, g2, 'ถอยข้ามลานไม่ได้เงินหลวง');
});

test('ตารางท่าต่อสู้วนครบ: ท่าที่ชนะทำแรงได้ ท่าที่แพ้ทำไม่ได้', function () {
  R.MOVES.forEach(function (m) {
    var w = R.BEATS[m];
    assert.ok(w !== m);
    assert.ok(R.TABLE[w][m][0] > 0, w + ' ต้องทำแรงใส่ ' + m + ' ได้');
    assert.strictEqual(R.TABLE[w][m][1], 0, m + ' ต้องทำแรงใส่ ' + w + ' ไม่ได้');
    assert.deepStrictEqual(R.TABLE[m][w], [R.TABLE[w][m][1], R.TABLE[w][m][0]], 'ตารางต้องสมมาตร');
  });
  assert.strictEqual(R.BEATS[R.BEATS[R.BEATS.A]], 'A', 'ต้องวนครบ 3 ท่า');
});

test('เกมใหม่: ทุนตั้งต้น + ที่นั่งหลังได้ทุนชดเชยเพิ่ม · สถานะแปลงเป็น JSON ได้ทั้งก้อน', function () {
  var s = game(3);
  assert.strictEqual(s.phase, 'roll');
  assert.strictEqual(s.v, R.VERSION);
  assert.strictEqual(s.rounds, R.LENGTHS.short);
  assert.ok(s.players[1].gold > s.players[0].gold && s.players[2].gold > s.players[1].gold);
  assert.deepStrictEqual(clone(s), s);
});

test('ตัวเลขใหม่: ประลองได้ 20% · แพ้การต่อสู้เสีย 15%', function () {
  assert.strictEqual(R.DUEL_TAKE, 0.2);
  assert.strictEqual(R.LOSE_GOLD, 0.15);
});

test('เล่นคอมล้วนจนจบได้ทุกแผนที่ × ความยาว × 2/3 คน (จบตรงจำนวนรอบ มีผลอันดับ)', function () {
  R.MAP_IDS.forEach(function (map) {
    ['short', 'mid', 'long'].forEach(function (len) {
      [2, 3].forEach(function (n) {
        for (var k = 0; k < 12; k++) {
          var s = game(n, 1000 + k, len, map);
          R.autoplay(s);
          assert.strictEqual(s.phase, 'over', map + ' ' + len + ' ' + n + ' คน ยังไม่จบ');
          assert.strictEqual(s.round, s.rounds);
          assert.strictEqual(s.result.rank.length, n);
          s.players.forEach(function (p) {
            assert.ok(p.gold >= 0, 'เงินติดลบ');
            assert.ok(p.hp >= 0 && p.hp <= p.mhp, 'พลังชีวิตผิด');
            R.ITEM_IDS.forEach(function (id) {
              assert.ok(p[id] >= 0 && p[id] <= R.ITEMS[id].max, id + ' เกินเพดาน');
            });
          });
          s.towns.forEach(function (t) {
            assert.ok(t.level >= 1 && t.level <= R.MAX_TOWN_LEVEL);
          });
        }
      });
    });
  });
});

test('สุ่มด้วย seed ในสถานะ: seed เดียวกัน = ผลเหมือนกันทุกครั้ง (รวมกองไพ่)', function () {
  R.MAP_IDS.forEach(function (map) {
    var a = game(3, 7, 'mid', map);
    var b = game(3, 7, 'mid', map);
    R.autoplay(a);
    R.autoplay(b);
    assert.deepStrictEqual(a.result, b.result);
    assert.deepStrictEqual(a.deck, b.deck);
  });
});

test('บันทึกกลางเกม (JSON) แล้วเล่นต่อ = ผลเหมือนเล่นรวดเดียว', function () {
  var a = game(3, 99, 'mid', 'isle');
  var b = game(3, 99, 'mid', 'isle');
  var steps = 0;
  while (steps < 120) {
    R.act(b, R.cpuAct(b));
    steps++;
  }
  b = R.migrate(clone(b)); // จำลองปิดแอปแล้วเปิดใหม่ (รุ่นปัจจุบัน migrate ต้องคืนตัวเดิม)
  R.autoplay(a);
  R.autoplay(b);
  assert.deepStrictEqual(a.result, b.result);
});

test('การกระทำผิดช่วง = คืน null ไม่เปลี่ยนสถานะ', function () {
  var s = game(2);
  var before = clone(s);
  assert.strictEqual(R.act(s, { type: 'move', m: 'A' }), null);
  assert.strictEqual(R.act(s, { type: 'buy', item: 'potion' }), null);
  assert.strictEqual(R.act(s, { type: 'plan', moves: ['A', 'A', 'A'] }), null);
  assert.strictEqual(R.act(s, { type: 'use', item: 'potion' }), null, 'พลังชีวิตเต็มอยู่ ใช้ยาไม่ได้');
  assert.strictEqual(R.act(s, { type: 'use', item: 'boots' }), null, 'ไม่มีรองเท้า');
  assert.strictEqual(R.act(s, { type: 'use', item: 'bomb' }), null, 'ระเบิดใช้ได้แค่ตอนสู้');
  assert.deepStrictEqual(s, before);
});

/* ---------- เซฟเก่า ---------- */

test('เซฟรุ่น 1 (ไม่มีแผนที่ · มีช่องถุงเงิน) โหลดได้: เมือง/เจ้าของ/ระดับอยู่ครบ ช่องเมืองตำแหน่งเดิม แล้วเล่นต่อจนจบ', function () {
  var old = v1Save();
  var s = R.migrate(old);
  assert.ok(s, 'ต้องแปลงได้');
  assert.strictEqual(s.v, R.VERSION);
  assert.strictEqual(s.map, 'legacy');
  assert.strictEqual(s.board.length, 30);
  assert.strictEqual(s.towns.length, 7);
  assert.strictEqual(s.towns[3].owner, 1);
  assert.strictEqual(s.towns[3].level, 3);
  V1_LAYOUT.forEach(function (k, i) {
    if (k.indexOf('town') === 0) assert.deepStrictEqual(s.board[i], { t: 'town', town: Number(k.slice(4)) }, 'ช่อง ' + i);
  });
  assert.ok(
    s.board.every(function (sp) {
      return sp.t !== 'gold';
    }),
    'ถุงเงินต้องกลายเป็นหีบ'
  );
  assert.strictEqual(s.board[9].t, 'chest');
  s.players.forEach(function (p) {
    assert.strictEqual(p.ch, -1);
    assert.strictEqual(p.bomb, 0);
    assert.strictEqual(p.ward, 0);
  });
  R.autoplay(s);
  assert.strictEqual(s.phase, 'over');
});

test('เซฟรุ่น 1 ค้างกลางการต่อสู้ผู้เฝ้าเมือง → เล่นต่อได้ · ชนะแล้วยึดเมืองถูกเมือง', function () {
  var old = v1Save(8);
  old.phase = 'battle';
  old.battle = { m: 'wolf', town: 2, name: 'หมาป่าเงา', hp: 1, mhp: 29, atk: 12, def: 2, tier: 3, bias: [1, 0, 0], n: 0, last: null };
  old.players[0].pos = 10;
  old.players[0].gold = 300;
  var s = R.migrate(old);
  var evs = R.act(s, { type: 'move', m: 'D' });
  assert.ok(kinds(evs).indexOf('capture') !== -1);
  assert.strictEqual(s.towns[2].owner, 0);
});

test('ช่องชนิดเก่า "gold" ในกระดาน = ทำงานเหมือนหีบสมบัติ', function () {
  var s = game(2, 11);
  s.board[1] = { t: 'gold' };
  var evs = moveTo(s, 0, 1);
  assert.ok(kinds(evs).indexOf('chest') !== -1);
});

test('เซฟเสียหาย/รุ่นไม่รู้จัก = คืน null (หน้าจอจะเริ่มเกมใหม่)', function () {
  assert.strictEqual(R.migrate(null), null);
  assert.strictEqual(R.migrate({}), null);
  var s = game(2);
  s.v = 99;
  assert.strictEqual(R.migrate(s), null);
  var t = game(2);
  t.map = 'ไม่มีจริง';
  assert.strictEqual(R.migrate(t), null);
});

/* ---------- ลานประตูเมือง + ขยายเมือง (ต้องสู้ก่อน) ---------- */

test('ผ่านลานประตูเมือง = ได้เงินหลวง · มีเมือง = ได้เลือกขยาย 1 เมือง', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  s.players[1].pos = 5;
  s.players[0].pos = 27;
  var g0 = s.players[0].gold;
  var evs = R.act(s, { type: 'roll', forced: 4 }); // 27 → 1 (หีบ)
  assert.ok(kinds(evs).indexOf('salary') !== -1, 'ต้องได้เงินหลวง');
  assert.ok(s.players[0].gold >= g0 + 60, 'เงินหลวง 50 + 10 ต่อเมือง');
  assert.strictEqual(s.phase, 'decide');
  assert.strictEqual(s.pending.kind, 'invest');
  assert.deepStrictEqual(s.pending.towns, [0]);
});

test('ขยายเมือง: เลือกขยาย = เริ่มสู้หัวหน้าผู้เฝ้าก่อน ยังไม่ขึ้นระดับ ยังไม่หักเงิน', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  s.players[0].pos = 1;
  s.players[1].pos = 20;
  var evs = R.act(s, { type: 'roll', forced: 1 }); // ช่อง 2 = เมืองของตัวเอง
  assert.strictEqual(s.pending.kind, 'invest');
  var g = s.players[0].gold;
  evs = R.act(s, { type: 'invest', town: 0, levels: 3 });
  assert.strictEqual(s.phase, 'battle');
  assert.strictEqual(s.battle.up, 2, 'ขยายได้ทีละ 1 ระดับ');
  assert.strictEqual(s.battle.town, 0);
  assert.strictEqual(s.towns[0].level, 1);
  assert.strictEqual(s.players[0].gold, g);
  assert.ok(kinds(evs).indexOf('invest') === -1);
  var foe = R.upgradeFoe(s, 0);
  var cap = R.guardFoe(s, 0, 1);
  assert.ok(foe.hp > cap.hp && foe.def > cap.def, 'หัวหน้าผู้เฝ้าต้องแกร่งกว่าผู้เฝ้าตอนยึด');
});

test('ขยายเมือง: ชนะ = จ่ายค่าลงทุนแล้วขึ้น 1 ระดับ (มูลค่าเพิ่มเท่าเงินที่ลง)', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  moveTo(s, 1, 1);
  R.act(s, { type: 'invest', town: 0, levels: 1 });
  var v0 = R.townValue(s.towns[0]);
  var cost = R.investCost(s.towns[0]);
  var g = s.players[0].gold;
  var evs = winFight(s);
  var win = evs.filter(function (e) {
    return e.k === 'win';
  })[0];
  assert.ok(win, 'ต้องชนะ');
  assert.ok(kinds(evs).indexOf('invest') !== -1);
  assert.strictEqual(s.towns[0].level, 2);
  assert.strictEqual(s.players[0].gold, g + win.v - cost);
  assert.strictEqual(R.townValue(s.towns[0]), v0 + cost);
  assert.strictEqual(s.turn, 1, 'ขยายแล้วจบตา');
  // หัวหน้าผู้เฝ้าระดับถัดไปแกร่งขึ้นอีก
  assert.ok(R.upgradeFoe(s, 0).hp > R.guardFoe(s, 0, 2).hp - 1);
  assert.ok(R.guardFoe(s, 0, 5).hp > R.guardFoe(s, 0, 3).hp);
});

test('ขยายเมือง: แพ้ = โทษแพ้ปกติ (เหรียญหล่น 15% + พักฟื้น 1 ตา) · ไม่ขึ้นระดับ · ไม่เสียค่าลงทุน', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  moveTo(s, 1, 1);
  s.players[0].gold = 200;
  R.act(s, { type: 'invest', town: 0, levels: 1 });
  var evs = loseFight(s);
  assert.ok(kinds(evs).indexOf('lose') !== -1);
  assert.strictEqual(s.players[0].gold, 170);
  assert.strictEqual(s.players[0].skip, 1);
  assert.strictEqual(s.towns[0].level, 1);
});

test('ขยายเมือง: ปาลูกควันหนีได้ · ไม่ขึ้นระดับ ไม่เสียเงิน', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  s.players[0].smoke = 1;
  moveTo(s, 1, 1);
  R.act(s, { type: 'invest', town: 0, levels: 1 });
  var g = s.players[0].gold;
  var evs = R.act(s, { type: 'use', item: 'smoke' });
  assert.ok(kinds(evs).indexOf('flee') !== -1);
  assert.strictEqual(s.towns[0].level, 1);
  assert.strictEqual(s.players[0].gold, g);
  assert.strictEqual(s.turn, 1);
});

test('ขยายเมือง: เงินไม่พอค่าลงทุน = เริ่มสู้ไม่ได้ · ไม่ขยาย (levels 0) = จบตาเฉย ๆ', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  moveTo(s, 1, 1);
  s.players[0].gold = 10;
  assert.strictEqual(R.act(s, { type: 'invest', town: 0, levels: 1 }), null);
  R.act(s, { type: 'invest', levels: 0 });
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.towns[0].level, 1);
});

/* ---------- เมือง / ค่าผ่านทาง ---------- */

test('ตกเมืองคนอื่น = จ่ายค่าผ่านทางให้เจ้าของ (เงินรวมไม่หาย)', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 3;
  var before = s.players[0].gold + s.players[1].gold;
  var fee = R.toll(s.towns[0]);
  moveTo(s, 0, 2); // ช่อง 2 = เมืองแรก
  assert.strictEqual(s.players[1].gold + s.players[0].gold, before);
  assert.strictEqual(s.players[0].st.tollPaid, fee);
  assert.strictEqual(s.turn, 1);
});

test('เงินไม่พอจ่ายค่าผ่านทาง = จ่ายเท่าที่มี นับว่าหมดตัว', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 5;
  s.players[0].gold = 5;
  moveTo(s, 0, 2);
  assert.strictEqual(s.players[0].gold, 0);
  assert.strictEqual(s.players[0].st.broke, 1);
});

test('ค่าผ่านทางเพิ่มตามระดับเมือง', function () {
  var t = { i: 5, owner: 0, level: 1 };
  var last = 0;
  for (var l = 1; l <= R.MAX_TOWN_LEVEL; l++) {
    t.level = l;
    assert.ok(R.toll(t) > last);
    last = R.toll(t);
  }
});

test('ยึดเมือง: ชนะผู้เฝ้า + จ่ายค่าฟื้นฟู = ได้เมือง', function () {
  var s = game(2);
  moveTo(s, 0, 2);
  assert.strictEqual(s.pending.kind, 'town');
  assert.strictEqual(s.pending.town, 0);
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.phase, 'battle');
  assert.strictEqual(s.battle.up, 0);
  var g = s.players[0].gold;
  var evs = winFight(s);
  assert.ok(kinds(evs).indexOf('capture') !== -1, 'ต้องยึดได้');
  assert.strictEqual(s.towns[0].owner, 0);
  assert.strictEqual(s.towns[0].level, 1);
  assert.ok(s.players[0].gold < g, 'ต้องหักค่าฟื้นฟู (หลังได้เงินรางวัล)');
});

test('ยึดเมืองบนหมู่เกาะ: เมืองลำดับ k อ้างข้อมูลเมืองของแผนที่ถูกตัว', function () {
  var s = game(2, 5, 'short', 'isle');
  moveTo(s, 0, 2); // ช่อง 2 = เมือง 0 ของหมู่เกาะ
  assert.strictEqual(s.pending.town, 0);
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.battle.name, R.monsterById(R.townDef(s, 0).guard).name);
  s.players[0].gold = 500;
  winFight(s);
  assert.strictEqual(s.towns[0].owner, 0);
  assert.strictEqual(s.towns[0].i, R.MAPS.isle.towns[0]);
});

test('ชนะผู้เฝ้าแต่เงินไม่พอค่าฟื้นฟู = เมืองยังว่าง', function () {
  var s = game(2);
  s.players[0].gold = 0;
  moveTo(s, 0, 2);
  R.act(s, { type: 'fight' });
  s.battle.tier = 0; // รางวัลเงินน้อยมาก
  var evs = winFight(s);
  if (s.players[0].gold < R.claimFee(s.towns[0].i)) {
    assert.ok(kinds(evs).indexOf('nofee') !== -1);
    assert.strictEqual(s.towns[0].owner, -1);
  }
});

/* ---------- ต่อสู้ ---------- */

test('แพ้การต่อสู้ = เหรียญหล่น 15% + ข้าม 1 ตา แล้วกลับมาพลังชีวิตเต็ม', function () {
  var s = game(2);
  s.players[0].gold = 200;
  moveTo(s, 0, 3); // ช่อง 3 = ป่ามอนสเตอร์
  assert.strictEqual(s.phase, 'battle');
  var evs = loseFight(s);
  assert.ok(kinds(evs).indexOf('lose') !== -1);
  assert.strictEqual(s.players[0].gold, 170);
  assert.strictEqual(s.turn, 1);
  // คนที่ 2 เล่นจนจบตา → คนแรกต้องถูกข้าม (มีเหตุการณ์ skip) แล้ววนกลับมาคนที่ 2
  var skipped = false;
  var guard = 0;
  while (!skipped && guard++ < 50) {
    var e2 = R.act(s, R.cpuAct(s));
    if (kinds(e2).indexOf('skip') !== -1) skipped = true;
  }
  assert.ok(skipped, 'คนแรกต้องถูกข้าม');
  assert.strictEqual(s.turn, 1, 'ข้ามแล้วต้องเป็นตาคนที่ 2 อีกรอบ');
  assert.strictEqual(s.players[0].hp, s.players[0].mhp);
  assert.strictEqual(s.players[0].skip, 0);
});

test('ลูกควัน = หนีออกจากการต่อสู้ ไม่เสียอะไร', function () {
  var s = game(2);
  s.players[0].smoke = 1;
  moveTo(s, 0, 3);
  var g = s.players[0].gold;
  R.act(s, { type: 'use', item: 'smoke' });
  assert.strictEqual(s.players[0].smoke, 0);
  assert.strictEqual(s.players[0].gold, g);
  assert.strictEqual(s.turn, 1);
});

test('ระเบิดประกายไฟ: แรงคงที่ อีกฝ่ายไม่ได้สวน · ใช้แล้วหมด', function () {
  var s = game(2);
  s.players[0].bomb = 1;
  moveTo(s, 0, 3);
  s.battle.hp = 100;
  s.battle.mhp = 100;
  var hp = s.players[0].hp;
  var evs = R.act(s, { type: 'use', item: 'bomb' });
  assert.ok(evs);
  assert.strictEqual(s.battle.hp, 100 - R.BOMB_DMG);
  assert.strictEqual(s.players[0].hp, hp);
  assert.strictEqual(s.players[0].bomb, 0);
  assert.strictEqual(R.act(s, { type: 'use', item: 'bomb' }), null);
});

test('รองเท้าลมกรด: ตานี้ทอยเต๋า 2 ลูก (2–12) แล้วกลับเป็นลูกเดียว', function () {
  var s = game(2, 77);
  s.players[0].boots = 1;
  s.players[1].pos = 20;
  R.act(s, { type: 'use', item: 'boots' });
  assert.strictEqual(s.players[0].boots, 0);
  assert.strictEqual(R.act(s, { type: 'use', item: 'boots' }), null, 'ใช้ซ้ำตาเดียวกันไม่ได้');
  var evs = R.act(s, { type: 'roll' });
  var r = evs.filter(function (e) {
    return e.k === 'roll';
  })[0];
  assert.strictEqual(r.dice.length, 2);
  assert.ok(r.v >= 2 && r.v <= 12 && r.v === r.dice[0] + r.dice[1]);
  assert.strictEqual(s.players[0].fast, false);
});

test('เลเวลอัปเมื่อค่าประสบการณ์ถึง · ค่าพลังเพิ่ม', function () {
  var s = game(2);
  moveTo(s, 0, 3);
  s.battle.tier = 2; // xp 12 ≥ 10
  var atk = s.players[0].atk;
  var evs = winFight(s);
  assert.ok(kinds(evs).indexOf('level') !== -1);
  assert.strictEqual(s.players[0].lv, 2);
  assert.strictEqual(s.players[0].atk, atk + 2);
});

/* ---------- ร้านค้า / อุปกรณ์ / เครื่องราง ---------- */

test('ร้านค้า: อาวุธ/เกราะ 4 ขั้นอัปเกรดทีละขั้น · ค่าพลังตรงตาราง · ของใช้มีได้ไม่เกินเพดาน', function () {
  assert.strictEqual(R.WEAPONS.length, 4);
  assert.strictEqual(R.ARMORS.length, 4);
  for (var i = 1; i < 4; i++) {
    assert.ok(R.WEAPONS[i].atk > R.WEAPONS[i - 1].atk && R.WEAPONS[i].price > R.WEAPONS[i - 1].price);
    assert.ok(R.ARMORS[i].def > R.ARMORS[i - 1].def && R.ARMORS[i].price > R.ARMORS[i - 1].price);
  }
  var s = game(2);
  s.players[0].gold = 5000;
  moveTo(s, 0, 6); // ช่อง 6 = ร้าน
  assert.strictEqual(s.pending.kind, 'shop');
  R.ITEM_IDS.forEach(function (id) {
    for (var k = 0; k < 5; k++) R.act(s, { type: 'buy', item: id });
    assert.strictEqual(s.players[0][id], R.ITEMS[id].max, id);
  });
  var p = s.players[0];
  var atk = R.atkOf(p);
  var def = R.defOf(p);
  for (var w = 0; w < 4; w++) {
    R.act(s, { type: 'buy', item: 'w' });
    assert.strictEqual(R.atkOf(p), atk + R.WEAPONS[w].atk);
    R.act(s, { type: 'buy', item: 'ar' });
    assert.strictEqual(R.defOf(p), def + R.ARMORS[w].def);
  }
  assert.strictEqual(R.act(s, { type: 'buy', item: 'w' }), null, 'ไม่มีอาวุธขั้นต่อไปแล้ว');
  assert.strictEqual(R.act(s, { type: 'buy', item: 'ar' }), null);
  R.act(s, { type: 'leave' });
  assert.strictEqual(s.turn, 1);
});

test('เครื่องราง: ใส่ได้ชิ้นเดียว ซื้อใหม่ = เปลี่ยนแทน · ร้านไม่ขายชิ้นที่ใส่อยู่', function () {
  var s = game(2);
  s.players[0].gold = 1000;
  moveTo(s, 0, 6);
  R.act(s, { type: 'buy', item: 'ch0' });
  assert.strictEqual(R.charmOf(s.players[0]).id, R.CHARMS[0].id);
  assert.ok(
    R.shopList(s.players[0]).every(function (it) {
      return it.id !== 'ch0';
    })
  );
  R.act(s, { type: 'buy', item: 'ch2' });
  assert.strictEqual(R.charmOf(s.players[0]).id, R.CHARMS[2].id);
  assert.strictEqual(R.act(s, { type: 'buy', item: 'ch2' }), null);
});

test('เครื่องรางแต่ละชิ้นทำงาน: เหรียญมังกร (เงินหลวงเพิ่ม) · ตราผ่านแดน (ค่าผ่านทางครึ่งเดียว) · ตำรา (ค่าประสบการณ์ ×1.5) · ขนนก (แพ้ไม่ต้องพัก เสียครึ่ง)', function () {
  function charm(id) {
    for (var i = 0; i < R.CHARMS.length; i++) if (R.CHARMS[i].id === id) return i;
    return -1;
  }
  // เงินหลวง
  var a = game(2);
  var b = game(2);
  a.players[0].ch = charm('purse');
  var ea = moveTo(a, 27, 4);
  var eb = moveTo(b, 27, 4);
  var sa = ea.filter(function (e) {
    return e.k === 'salary';
  })[0].v;
  var sb = eb.filter(function (e) {
    return e.k === 'salary';
  })[0].v;
  assert.ok(sa > sb, 'เหรียญมังกรต้องได้เงินหลวงมากกว่า');
  // ค่าผ่านทาง
  var c = game(2);
  c.towns[0].owner = 1;
  c.towns[0].level = 4;
  c.players[0].ch = charm('seal');
  assert.strictEqual(R.tollFor(c, c.towns[0], 0), Math.round(R.toll(c.towns[0]) * 0.5));
  moveTo(c, 0, 2);
  assert.strictEqual(c.players[0].st.tollPaid, Math.round(R.toll(c.towns[0]) * 0.5));
  // ค่าประสบการณ์
  var d = game(2);
  d.players[0].ch = charm('tome');
  moveTo(d, 0, 3);
  d.battle.tier = 1; // xp 6 → 9
  winFight(d);
  assert.strictEqual(d.players[0].xp, 9);
  // ขนนก
  var f = game(2);
  f.players[0].ch = charm('feather');
  f.players[0].gold = 200;
  moveTo(f, 0, 3);
  loseFight(f);
  assert.strictEqual(f.players[0].skip, 0, 'ไม่ต้องพักฟื้น');
  assert.strictEqual(f.players[0].gold, 185, 'เหรียญหล่นครึ่งเดียว (7.5%)');
  assert.strictEqual(f.players[0].hp, f.players[0].mhp);
});

test('ยันต์กันเคราะห์: แพ้การต่อสู้ไม่เสียเหรียญ (ใช้แล้วหมด)', function () {
  var s = game(2);
  s.players[0].ward = 1;
  s.players[0].gold = 200;
  moveTo(s, 0, 3);
  loseFight(s);
  assert.strictEqual(s.players[0].gold, 200);
  assert.strictEqual(s.players[0].ward, 0);
});

/* ---------- หีบสมบัติ (รวมถุงเงิน) ---------- */

test('หีบสมบัติ: ได้เงินราวครึ่งหนึ่ง (20–60) อีกครึ่งได้ของ/พลัง · ของไม่เกินเพดาน · ได้อย่างเดียวต่อครั้ง', function () {
  var got = { gold: 0, other: 0 };
  for (var g = 0; g < 1500; g++) {
    var s = game(2, 3000 + g);
    s.round = 1 + (g % s.rounds);
    var p = s.players[0];
    if (g % 3 === 0) R.ITEM_IDS.forEach(function (id) {
      p[id] = R.ITEMS[id].max; // กระเป๋าเต็ม
    });
    var before = clone(p);
    var evs = moveTo(s, 0, 1);
    var ch = evs.filter(function (e) {
      return e.k === 'chest';
    });
    assert.strictEqual(ch.length, 1, 'เปิดหีบ 1 ครั้ง');
    var dg = p.gold - before.gold;
    assert.ok(dg >= 0 && dg <= 60, 'เงินจากหีบ ' + dg);
    var changes = (dg > 0 ? 1 : 0) + (p.atk !== before.atk ? 1 : 0) + (p.mhp !== before.mhp ? 1 : 0);
    R.ITEM_IDS.forEach(function (id) {
      assert.ok(p[id] <= R.ITEMS[id].max, id + ' เกินเพดาน');
      if (p[id] !== before[id]) changes++;
    });
    assert.strictEqual(changes, 1, 'ได้อย่างเดียวต่อครั้ง');
    if (ch[0].got === 'gold') got.gold++;
    else got.other++;
  }
  var share = got.gold / (got.gold + got.other);
  assert.ok(share > 0.4 && share < 0.75, 'สัดส่วนได้เงิน ' + share.toFixed(2));
});

/* ---------- ไพ่เหตุการณ์ ---------- */

test('กองไพ่ 16 ใบ ไม่ซ้ำ: ดี 10 · ร้าย 6 · ชื่อคิดเอง มีข้อความครบ', function () {
  assert.strictEqual(R.CARDS.length, 16);
  var ids = R.CARDS.map(function (c) {
    return c.id;
  });
  assert.strictEqual(new Set(ids).size, 16);
  var good = R.CARDS.filter(function (c) {
    return c.good;
  }).length;
  assert.strictEqual(good, 10);
  R.CARDS.forEach(function (c) {
    assert.ok(c.name && c.text, c.id);
  });
});

test('ไพ่ทุกใบ: ไม่มีใครเสียเกิน 60 ต่อใบ · เงินไม่ติดลบ · เกมเดินต่อจนจบได้ (ทั้ง 2 แผนที่)', function () {
  R.MAP_IDS.forEach(function (map) {
    R.CARDS.forEach(function (c, ci) {
      for (var k = 0; k < 6; k++) {
        var s = game(3, 500 + ci * 17 + k, 'short', map);
        var cardPos = s.board
          .map(function (sp, i) {
            return sp.t === 'card' ? i : -1;
          })
          .filter(function (i) {
            return i > 0;
          })[0];
        s.players.forEach(function (p, i) {
          p.gold = [0, 90, 900][(i + k) % 3];
        });
        s.towns[0].owner = 1;
        s.towns[1].owner = 0;
        s.players[1].pos = 12;
        s.players[2].pos = 13;
        s.players[0].pos = cardPos - 1;
        s.deck = [ci];
        var before = s.players.map(function (p) {
          return p.gold;
        });
        var evs = R.act(s, { type: 'roll', forced: 1 });
        assert.ok(kinds(evs).indexOf('card') !== -1, map + ' ' + c.id + ' ต้องเปิดไพ่');
        // เทียบเฉพาะผลของไพ่ (ก่อนมีค่าผ่านทาง/ต่อสู้ที่ไพ่พาไป)
        var fx = evs.filter(function (e) {
          return e.k === 'card-fx' && e.v < 0;
        });
        fx.forEach(function (e) {
          assert.ok(-e.v <= 60, c.id + ' เสีย ' + -e.v);
        });
        s.players.forEach(function (p, i) {
          assert.ok(p.gold >= 0, c.id + ' เงินติดลบ');
          if (c.id !== 'wind' && c.id !== 'bridge' && c.id !== 'ambush') assert.ok(before[i] - p.gold <= 60, c.id + ' ผู้เล่น ' + i + ' เสีย ' + (before[i] - p.gold));
        });
        R.autoplay(s);
        assert.strictEqual(s.phase, 'over');
      }
    });
  });
});

test('ไพ่เทศกาลโคมลอย: ค่าผ่านทาง ×2 ครบหนึ่งรอบ (ทุกคนรวมคนจั่ว) แล้วกลับปกติ', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 2;
  drawCard(s, 'festival'); // จั่วแล้วจบตาทันที → เหลือ 2 ตา (อีกฝ่าย 1 + คนจั่ว 1)
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.fest, 2);
  assert.strictEqual(R.tollFor(s, s.towns[0], 0), R.toll(s.towns[0]) * 2);
  // เดินไปจนครบหนึ่งรอบ
  var guard = 0;
  while (s.fest > 0 && guard++ < 200) R.act(s, R.cpuAct(s));
  assert.strictEqual(s.fest, 0);
  assert.strictEqual(s.turn, 1, 'หมดเทศกาลตอนเริ่มตาที่ 2 ของอีกฝ่าย');
  assert.strictEqual(R.tollFor(s, s.towns[0], 0), R.toll(s.towns[0]));
});

test('ไพ่ร้ายมีเพดาน + ยันต์กันได้: โจรปล้นไม่เกิน 60 · พายุคนละไม่เกิน 40 · บรรณาการคนละไม่เกิน 30', function () {
  var s = game(3);
  s.players[0].gold = 2000;
  drawCard(s, 'bandit');
  assert.strictEqual(s.players[0].gold, 1940);
  var t = game(3);
  t.players.forEach(function (p) {
    p.gold = 1000;
  });
  t.players[2].ward = 1;
  drawCard(t, 'storm');
  assert.deepStrictEqual(
    t.players.map(function (p) {
      return p.gold;
    }),
    [960, 960, 1000]
  );
  assert.strictEqual(t.players[2].ward, 0);
  var u = game(3);
  u.players.forEach(function (p) {
    p.gold = 1000;
  });
  drawCard(u, 'tribute');
  assert.deepStrictEqual(
    u.players.map(function (p) {
      return p.gold;
    }),
    [1060, 970, 970]
  );
  var w = game(2);
  w.players[0].ward = 1;
  var g = w.players[0].gold;
  drawCard(w, 'bandit');
  assert.strictEqual(w.players[0].gold, g, 'ยันต์ต้องกันโจร');
});

test('ไพ่เคลื่อนที่: ลมส่งท้าย +3 ช่อง · ทางลัด = ถึงลานรับเงินหลวง · สะพานสายรุ้ง = ไปเมืองว่างข้างหน้า', function () {
  var s = game(2);
  drawCard(s, 'wind');
  assert.strictEqual(s.players[0].pos, 7);
  var t = game(2);
  var evs = drawCard(t, 'gate');
  assert.strictEqual(t.players[0].pos, 0);
  assert.ok(kinds(evs).indexOf('salary') !== -1);
  assert.ok(kinds(evs).indexOf('warp') !== -1);
  var u = game(2);
  drawCard(u, 'bridge');
  assert.strictEqual(u.players[0].pos, 5, 'เมืองว่างถัดจากศาลาช่อง 4 คือช่อง 5');
  assert.strictEqual(u.pending.kind, 'town');
});

/* ---------- คอม + สมดุล ---------- */

test('คอมเลือกการกระทำที่ใช้ได้เสมอ (สุ่ม 300 เกม ทุกนิสัย ทั้ง 2 แผนที่)', function () {
  var styles = ['normal', 'bold', 'meek', 'hoard', 'tycoon', 'brute', 'always', 'geared', 'nogear', 'c-purse', 'c-feather', 'c-tome', 'c-seal'];
  for (var g = 0; g < 300; g++) {
    var defs = [0, 1, 2].map(function (i) {
      return { name: 'P' + i, cpu: true, style: styles[(g + i) % styles.length] };
    });
    var s = R.newGame({ players: defs, length: ['short', 'mid', 'long'][g % 3], map: R.MAP_IDS[g % 2], seed: g * 31 + 5 });
    R.autoplay(s); // โยน error ถ้าคอมเลือกผิด
    assert.strictEqual(s.phase, 'over');
  }
});

test('คอมขยายเมืองจริง (ต้องสู้ก่อน) · สำเร็จส่วนใหญ่ของที่ลอง', function () {
  var tries = 0;
  var wins = 0;
  for (var g = 0; g < 200; g++) {
    var s = game(3, 7000 + g, 'mid', R.MAP_IDS[g % 2]);
    R.autoplay(s);
    s.players.forEach(function (p) {
      tries += p.st.upTry || 0;
      wins += p.st.upWin || 0;
    });
  }
  assert.ok(tries / 200 >= 2, 'ลองขยายเฉลี่ย ' + (tries / 200).toFixed(1) + ' ครั้งต่อเกม');
  assert.ok(wins / tries >= 0.6, 'สำเร็จ ' + ((wins / tries) * 100).toFixed(0) + '%');
});

// 900 เกม: ค่าคลาดเคลื่อนสุ่ม ~1.6% → กรอบ 27–40% (ผลจริง 3000 เกม ≈ 33/31/35 · ดู tests/realm-sim.js)
test('สมดุลคร่าว ๆ: 3 คน 900 เกม (แดนมนตร์ + หมู่เกาะ) อัตราชนะทุกที่นั่ง 27–40% · ยึดเมืองได้เฉลี่ย ≥ 3 เมือง', function () {
  R.MAP_IDS.forEach(function (map) {
    var wins = [0, 0, 0];
    var owned = 0;
    var G = 900;
    for (var g = 0; g < G; g++) {
      var s = game(3, 5000 + g, 'mid', map);
      R.autoplay(s);
      if (s.result.winner >= 0) wins[s.result.winner]++;
      owned += s.towns.filter(function (t) {
        return t.owner >= 0;
      }).length;
    }
    wins.forEach(function (w, i) {
      var r = w / G;
      assert.ok(r >= 0.27 && r <= 0.4, map + ' ที่นั่ง ' + (i + 1) + ' ชนะ ' + (r * 100).toFixed(1) + '%');
    });
    assert.ok(owned / G >= 3, map + ' ยึดเมืองเฉลี่ย ' + (owned / G).toFixed(1));
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
