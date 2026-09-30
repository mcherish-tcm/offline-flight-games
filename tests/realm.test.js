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

// เซฟรุ่น 2 (ก่อน v9): ไม่มีของช่วยรบ ไม่มีสถิติปล้น · ประลองไม่มี items · การต่อสู้ไม่มี oil/block/peek
function v2Save(seed, map) {
  var s = game(3, seed || 21, 'short', map || 'classic');
  s.v = 2;
  s.players.forEach(function (p) {
    delete p.oil;
    delete p.buckler;
    delete p.scroll;
    ['robTry', 'robWin', 'robGot', 'robLost', 'defGot', 'defLost'].forEach(function (k) {
      delete p.st[k];
    });
  });
  return s;
}

test('เซฟรุ่น 2 (ก่อน v9) โหลดได้: เติมค่าเริ่มต้นของใหม่ครบ แล้วเล่นต่อจนจบ (ทั้ง 2 แผนที่)', function () {
  R.MAP_IDS.forEach(function (map) {
    for (var k = 0; k < 20; k++) {
      var s = v2Save(300 + k, map);
      // เล่นไปครึ่งทางด้วยรุ่นปัจจุบันก่อน แล้วลบฟิลด์ใหม่ทิ้ง = จำลองเซฟเก่ากลางเกม
      for (var i = 0; i < 40 + k * 3 && s.phase !== 'over'; i++) R.act(s, R.cpuAct(s));
      s.v = 2;
      s.players.forEach(function (p) {
        delete p.oil;
        delete p.buckler;
        delete p.scroll;
        delete p.st.robTry;
        delete p.st.defLost;
      });
      if (s.battle) {
        delete s.battle.oil;
        delete s.battle.block;
        delete s.battle.peek;
      }
      if (s.duel) delete s.duel.items;
      var m = R.migrate(clone(s));
      assert.ok(m, 'ต้องโหลดได้');
      assert.strictEqual(m.v, R.VERSION);
      m.players.forEach(function (p) {
        R.FIGHT_ITEMS.forEach(function (id) {
          assert.strictEqual(typeof p[id], 'number', id);
        });
        assert.strictEqual(p.st.robTry, 0);
        assert.strictEqual(p.st.defLost, 0);
      });
      R.autoplay(m);
      assert.strictEqual(m.phase, 'over');
    }
  });
});

test('เซฟรุ่น 2 ค้างกลางการต่อสู้ / กลางประลอง (ไม่มีช่องใหม่) → เล่นต่อได้ ใช้ของช่วยรบได้', function () {
  var s = v2Save(31);
  moveTo(s, 0, 3);
  assert.strictEqual(s.phase, 'battle');
  delete s.battle.oil;
  delete s.battle.block;
  delete s.battle.peek;
  var m = R.migrate(clone(s));
  assert.ok(m);
  m.players[0].oil = 1;
  assert.ok(R.act(m, { type: 'use', item: 'oil' }));
  assert.ok(R.act(m, { type: 'move', m: 'A' }));
  // กลางประลอง: ผู้ท้าวางแผนไปแล้ว
  var d = v2Save(32);
  d.players[1].pos = 5;
  R.act(d, { type: 'roll', forced: 5 });
  R.act(d, { type: 'duel', target: 1 });
  R.act(d, { type: 'plan', moves: ['A', 'H', 'D'] });
  delete d.duel.items;
  var md = R.migrate(clone(d));
  assert.ok(md);
  var evs = R.act(md, { type: 'plan', moves: ['D', 'D', 'D'] });
  assert.ok(kinds(evs).indexOf('duel-result') !== -1);
  R.autoplay(md);
  assert.strictEqual(md.phase, 'over');
});

test('เซฟรุ่น 1 ผ่านรุ่น 2 มาถึงรุ่นปัจจุบันในครั้งเดียว (มีของช่วยรบ = 0)', function () {
  var m = R.migrate(v1Save(7));
  assert.ok(m);
  assert.strictEqual(m.v, R.VERSION);
  m.players.forEach(function (p) {
    assert.strictEqual(p.oil, 0);
    assert.strictEqual(p.scroll, 0);
    assert.strictEqual(p.st.robWin, 0);
  });
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

test('ตกเมืองคนอื่น = ต้องเลือก พัก/ปล้น (ไม่หักเงินอัตโนมัติ · ไม่มีทางผ่านฟรี)', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 3;
  var g0 = s.players[0].gold;
  var g1 = s.players[1].gold;
  moveTo(s, 0, 2); // ช่อง 2 = เมืองแรก
  assert.strictEqual(s.phase, 'decide');
  assert.strictEqual(s.pending.kind, 'visit');
  assert.strictEqual(s.pending.town, 0);
  assert.strictEqual(s.players[0].gold, g0, 'ยังไม่หักเงิน');
  assert.strictEqual(s.players[1].gold, g1);
  assert.strictEqual(R.decider(s), 0, 'คนแวะเป็นคนเลือก');
  // ทางอื่นทั้งหมดใช้ไม่ได้ (ไม่มีผ่านฟรี)
  ['skip', 'pass', 'leave', 'fight', 'roll'].forEach(function (t) {
    assert.strictEqual(R.act(s, { type: t }), null, t + ' ต้องใช้ไม่ได้');
  });
  assert.strictEqual(R.act(s, { type: 'invest', levels: 0 }), null);
  assert.strictEqual(s.pending.kind, 'visit');
  assert.strictEqual(s.players[0].gold, g0);
});

test('พักค้างคืน = จ่ายค่าผ่านทางให้เจ้าของ (เงินรวมไม่หาย) + พลังชีวิตเต็ม', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 3;
  var before = s.players[0].gold + s.players[1].gold;
  var fee = R.toll(s.towns[0]);
  moveTo(s, 0, 2);
  s.players[0].hp = 4;
  var evs = R.act(s, { type: 'rest' });
  assert.ok(evs);
  assert.strictEqual(s.players[1].gold + s.players[0].gold, before);
  assert.strictEqual(s.players[0].st.tollPaid, fee);
  assert.strictEqual(s.players[1].st.tollGot, fee);
  assert.strictEqual(s.players[0].hp, s.players[0].mhp, 'พลังชีวิตเต็ม');
  assert.ok(kinds(evs).indexOf('toll') !== -1);
  assert.strictEqual(s.turn, 1);
});

test('พักค้างคืน: เทศกาล ×2 · ตราผ่านแดนครึ่งเดียว ยังใช้ตามเดิม', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 2;
  s.fest = 3;
  moveTo(s, 0, 2);
  R.act(s, { type: 'rest' });
  assert.strictEqual(s.players[0].st.tollPaid, R.toll(s.towns[0]) * 2);
  var c = game(2);
  c.towns[0].owner = 1;
  c.towns[0].level = 4;
  c.players[0].ch = R.CHARMS.map(function (x) { return x.id; }).indexOf('seal');
  moveTo(c, 0, 2);
  assert.strictEqual(R.visitInfo(c, 0, 0).fee, Math.round(R.toll(c.towns[0]) * 0.5));
  R.act(c, { type: 'rest' });
  assert.strictEqual(c.players[0].st.tollPaid, Math.round(R.toll(c.towns[0]) * 0.5));
});

test('เงินไม่พอค่าพัก = ยังพักได้ จ่ายเท่าที่มี นับว่าหมดตัว (พลังชีวิตเต็ม)', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 5;
  s.players[0].gold = 5;
  moveTo(s, 0, 2);
  s.players[0].hp = 3;
  var g1 = s.players[1].gold;
  R.act(s, { type: 'rest' });
  assert.strictEqual(s.players[0].gold, 0);
  assert.strictEqual(s.players[1].gold, g1 + 5);
  assert.strictEqual(s.players[0].st.broke, 1);
  assert.strictEqual(s.players[0].hp, s.players[0].mhp);
});

// ปล้นโดยกำหนดผลเต๋า: หา seed ที่ทอยออกมาได้ (คนปล้น a, เจ้าเมือง b) ตามต้องการ
function robWith(level, a, b, setup) {
  for (var seed = 1; seed < 20000; seed++) {
    var s = game(2, 9);
    s.towns[0].owner = 1;
    s.towns[0].level = level;
    moveTo(s, 0, 2);
    if (setup) setup(s);
    s.seed = seed;
    var probe = clone(s);
    var evs = R.act(probe, { type: 'rob' });
    var e = evs.filter(function (x) {
      return x.k === 'rob';
    })[0];
    if (e.a === a && e.b === b) {
      var real = R.act(s, { type: 'rob' });
      return { s: s, e: real.filter(function (x) { return x.k === 'rob'; })[0], evs: real };
    }
  }
  throw new Error('หา seed ไม่เจอ');
}

test('ปล้นสำเร็จ: เจ้าเมืองจ่าย 3 เท่าของค่าผ่านทาง · สถิติครบ', function () {
  var r = robWith(1, 5, 2);
  var s = r.s;
  var fee = R.toll(s.towns[0]);
  assert.strictEqual(r.e.ok, true);
  assert.strictEqual(r.e.v, fee * 3);
  assert.strictEqual(r.e.bonus, 0, 'เมืองระดับ 1 เจ้าเมืองไม่มีแต้มบวก');
  assert.strictEqual(s.players[0].gold, R.START_GOLD + fee * 3);
  assert.strictEqual(s.players[1].gold, R.START_GOLD + 45 - fee * 3);
  var st = s.players[0].st;
  assert.strictEqual(st.robTry, 1);
  assert.strictEqual(st.robWin, 1);
  assert.strictEqual(st.robGot, fee * 3);
  assert.strictEqual(s.players[1].st.defLost, fee * 3);
  assert.strictEqual(st.tollPaid, 0, 'ปล้นไม่นับเป็นค่าผ่านทาง');
  assert.strictEqual(s.turn, 1);
});

test('ปล้นไม่สำเร็จ: จ่ายค่าปรับ 2 เท่าให้เจ้าเมือง · ทอยเสมอ = เจ้าเมืองชนะ', function () {
  var r = robWith(1, 4, 4);
  var s = r.s;
  var fee = R.toll(s.towns[0]);
  assert.strictEqual(r.e.ok, false, 'เสมอ = ปล้นไม่สำเร็จ');
  assert.strictEqual(r.e.v, fee * 2);
  assert.strictEqual(s.players[0].gold, R.START_GOLD - fee * 2);
  assert.strictEqual(s.players[1].gold, R.START_GOLD + 45 + fee * 2);
  assert.strictEqual(s.players[0].st.robLost, fee * 2);
  assert.strictEqual(s.players[1].st.defGot, fee * 2);
  assert.strictEqual(s.players[0].st.robWin, 0);
  var r2 = robWith(1, 2, 5);
  assert.strictEqual(r2.e.ok, false);
});

test('ปล้น: เจ้าเมืองระดับสูงได้แต้มบวก (ทอยสูงกว่าแต่ไม่พ้นแต้มบวก = ไม่สำเร็จ) · โอกาสตรงสูตร', function () {
  assert.strictEqual(R.robBonus({ level: 1 }), 0);
  for (var lv = 1; lv <= R.MAX_TOWN_LEVEL; lv++) {
    assert.ok(R.robBonus({ level: lv }) >= R.robBonus({ level: Math.max(1, lv - 1) }), 'แต้มบวกไม่ลดตามระดับ');
  }
  var lvB = 0;
  for (lv = 1; lv <= R.MAX_TOWN_LEVEL; lv++) if (!lvB && R.robBonus({ level: lv }) > 0) lvB = lv;
  assert.ok(lvB > 0, 'ต้องมีระดับที่เจ้าเมืองได้แต้มบวก');
  var bonus = R.robBonus({ level: lvB });
  // คนปล้นทอยสูงกว่า 1 แต้ม แต่ไม่พ้นแต้มบวก = ไม่สำเร็จ
  var r = robWith(lvB, 4, 4 - bonus);
  assert.strictEqual(r.e.bonus, bonus);
  assert.strictEqual(r.e.ok, false);
  // พ้นแต้มบวก = สำเร็จ
  var r2 = robWith(lvB, 6, 5 - bonus);
  assert.strictEqual(r2.e.ok, true);
  // โอกาส: ไม่มีแต้มบวก = 15/36 · +1 = 10/36 · +2 = 6/36
  assert.strictEqual(R.robChance({ level: 1 }), 15 / 36);
  var want = { 0: 15 / 36, 1: 10 / 36, 2: 6 / 36, 3: 3 / 36 };
  for (lv = 1; lv <= R.MAX_TOWN_LEVEL; lv++) assert.strictEqual(R.robChance({ level: lv }), want[R.robBonus({ level: lv })]);
});

test('ปล้นสำเร็จแต่เจ้าเมืองเงินน้อย = ได้เท่าที่เจ้าเมืองมี (เจ้าเมืองไม่นับว่าหมดตัว)', function () {
  var r = robWith(3, 6, 1, function (s) {
    s.players[1].gold = 7;
  });
  var s = r.s;
  assert.strictEqual(r.e.ok, true);
  assert.strictEqual(r.e.v, 7);
  assert.strictEqual(s.players[1].gold, 0);
  assert.strictEqual(s.players[1].st.broke, 0);
  assert.strictEqual(s.players[0].gold, R.START_GOLD + 7);
});

test('ปล้นไม่สำเร็จแต่เงินไม่พอค่าปรับ = จ่ายเท่าที่มี นับว่าหมดตัว (ข้อความหมดตัวขึ้นหลังผลปล้น)', function () {
  var r = robWith(1, 1, 6, function (s) {
    s.players[0].gold = 10;
  });
  var s = r.s;
  assert.strictEqual(r.e.ok, false);
  assert.strictEqual(r.e.v, 10);
  assert.strictEqual(s.players[0].gold, 0);
  assert.strictEqual(s.players[0].st.broke, 1);
  var k = kinds(r.evs);
  assert.ok(k.indexOf('rob') < k.indexOf('broke'));
});

test('ปล้น: ฐาน 3×/2× ใช้ค่าผ่านทางเดียวกับค่าพัก (รวมเทศกาล ×2)', function () {
  var r = robWith(1, 6, 1, function (s) {
    s.fest = 3;
  });
  assert.strictEqual(r.e.fee, R.toll(r.s.towns[0]) * 2);
  assert.strictEqual(r.e.v, R.toll(r.s.towns[0]) * 2 * 3);
});

test('คอมเลือก พัก/ปล้น ได้ทั้งสองแบบ (ไม่ปล้นทุกครั้ง ไม่พักทุกครั้ง)', function () {
  var n = { rest: 0, rob: 0 };
  for (var g = 0; g < 150; g++) {
    var s = game(3, 8100 + g, 'mid', R.MAP_IDS[g % 2]);
    while (s.phase !== 'over') {
      var a = R.cpuAct(s);
      if (s.phase === 'decide' && s.pending.kind === 'visit') n[a.type]++;
      assert.ok(R.act(s, a));
    }
  }
  assert.ok(n.rest > 50 && n.rob > 50, JSON.stringify(n));
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

test('ร้านค้า: อาวุธ/เกราะ 6 ขั้นอัปเกรดทีละขั้น · ค่าพลังตรงตาราง · ของใช้มีได้ไม่เกินเพดาน', function () {
  assert.strictEqual(R.WEAPONS.length, 6);
  assert.strictEqual(R.ARMORS.length, 6);
  for (var i = 1; i < 6; i++) {
    assert.ok(R.WEAPONS[i].atk > R.WEAPONS[i - 1].atk && R.WEAPONS[i].price > R.WEAPONS[i - 1].price);
    assert.ok(R.ARMORS[i].def > R.ARMORS[i - 1].def && R.ARMORS[i].price > R.ARMORS[i - 1].price);
  }
  var s = game(2);
  s.players[0].gold = 10000; // อาวุธ + เกราะครบ 6 ขั้น + ของใช้เต็มกระเป๋า ~5,300
  moveTo(s, 0, 6); // ช่อง 6 = ร้าน
  assert.strictEqual(s.pending.kind, 'shop');
  R.ITEM_IDS.forEach(function (id) {
    for (var k = 0; k < 5; k++) R.act(s, { type: 'buy', item: id });
    assert.strictEqual(s.players[0][id], R.ITEMS[id].max, id);
  });
  var p = s.players[0];
  var atk = R.atkOf(p);
  var def = R.defOf(p);
  for (var w = 0; w < 6; w++) {
    // ร้านเสนอขั้นถัดไปทีละขั้นเสมอ
    var offer = R.shopList(p).filter(function (it) {
      return it.id === 'w';
    })[0];
    assert.strictEqual(offer.name, R.WEAPONS[w].name, 'ร้านเสนออาวุธขั้น ' + (w + 1));
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

test('คะแนนท้ายเกม: อุปกรณ์ที่ถืออยู่ (อาวุธ เกราะ เครื่องราง) นับ 50% ของราคาซื้อ · ของใช้ไม่นับ · ขั้นเก่าที่ถูกแทนไม่นับ', function () {
  var s = game(2);
  var p = s.players[0];
  var base = R.total(s, 0);
  assert.strictEqual(R.gearValue(p), 0, 'ตัวเปล่า = 0');
  assert.strictEqual(R.GEAR_RATE, 0.5);
  // ของใช้ไม่นับ
  R.ITEM_IDS.forEach(function (id) {
    p[id] = R.ITEMS[id].max;
  });
  assert.strictEqual(R.gearValue(p), 0, 'ของใช้ไม่นับ');
  assert.strictEqual(R.total(s, 0), base);
  // อาวุธ
  p.w = 0;
  assert.strictEqual(R.gearValue(p), R.WEAPONS[0].price * 0.5);
  assert.strictEqual(R.total(s, 0), base + R.WEAPONS[0].price * 0.5);
  // อัปเกรดอาวุธ: นับเฉพาะขั้นที่ถืออยู่ (ไม่นับขั้นเก่าซ้ำ)
  p.w = 2;
  assert.strictEqual(R.gearValue(p), R.WEAPONS[2].price * 0.5);
  // เกราะ + เครื่องราง
  p.ar = 1;
  p.ch = 3;
  var expect = (R.WEAPONS[2].price + R.ARMORS[1].price + R.CHARMS[3].price) * 0.5;
  assert.strictEqual(R.gearValue(p), expect);
  assert.strictEqual(R.total(s, 0), base + expect);
  // เปลี่ยนเครื่องราง = นับเฉพาะชิ้นใหม่
  p.ch = 0;
  assert.strictEqual(R.gearValue(p), (R.WEAPONS[2].price + R.ARMORS[1].price + R.CHARMS[0].price) * 0.5);
  // ซื้อจริงในร้าน: เงินลดเต็มราคา แต่ทรัพย์รวมลดแค่ครึ่งเดียว
  var s2 = game(2);
  s2.players[0].gold = 1000;
  moveTo(s2, 0, 6);
  var t0 = R.total(s2, 0);
  R.act(s2, { type: 'buy', item: 'w' });
  assert.strictEqual(R.total(s2, 0), t0 - R.WEAPONS[0].price * 0.5);
  R.act(s2, { type: 'buy', item: 'potion' });
  assert.strictEqual(R.total(s2, 0), t0 - R.WEAPONS[0].price * 0.5 - R.ITEMS.potion.price, 'ของใช้ซื้อแล้วทรัพย์รวมลดเต็มราคา');
  // เซฟเก่าที่ไม่มีช่อง ch ก็คำนวณได้
  assert.strictEqual(R.gearValue({ gold: 100, w: -1, ar: -1 }), 0);
});

test('จบเกม: อันดับ/ผู้ชนะนับอุปกรณ์ครึ่งราคา · standings มีช่อง gear · isLast ใช้ทรัพย์รวมตัวเดียวกัน', function () {
  var s = game(2);
  s.players[0].gold = 200;
  s.players[1].gold = 150;
  assert.strictEqual(R.isLast(s, 1), true, 'ยังไม่มีอุปกรณ์: คนเงินน้อยสุดรั้งท้าย');
  s.players[1].w = 3;
  s.players[1].ar = 3; // ครึ่งราคา (440 + 400) / 2 = 420
  var rank = R.standings(s);
  assert.strictEqual(rank[0].p, 1, 'คนถืออุปกรณ์แพงนำ');
  assert.strictEqual(rank[0].gear, 420);
  assert.strictEqual(rank[0].total, 150 + 420);
  assert.strictEqual(rank[1].gear, 0);
  assert.strictEqual(R.isLast(s, 1), false, 'มีอุปกรณ์แล้วไม่รั้งท้าย');
  assert.strictEqual(R.isLast(s, 0), true, 'คนไม่มีอุปกรณ์กลายเป็นรั้งท้าย');
  // คอมล้วนจนจบ: แถวอันดับตรงสูตร
  var g = game(3, 77, 'short');
  R.autoplay(g);
  g.result.rank.forEach(function (x) {
    assert.strictEqual(x.total, x.gold + x.towns + x.gear);
    assert.strictEqual(x.gear, R.gearValue(g.players[x.p]));
  });
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
  R.act(c, { type: 'rest' });
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

test('อุปกรณ์ขั้น 5–6: ร้านเสนอหลังซื้อขั้น 4 · นับครึ่งราคาท้ายเกม · แรงกว่าขั้น 4 ชัดเจน', function () {
  var p = game(2).players[0];
  p.w = 3;
  p.ar = 3;
  p.gold = 5000;
  var list = R.shopList(p);
  var w = list.filter(function (it) { return it.id === 'w'; })[0];
  var ar = list.filter(function (it) { return it.id === 'ar'; })[0];
  assert.strictEqual(w.name, R.WEAPONS[4].name);
  assert.strictEqual(ar.name, R.ARMORS[4].name);
  assert.ok(w.ok && ar.ok);
  p.w = 5;
  p.ar = 5;
  assert.strictEqual(R.gearValue(p), (R.WEAPONS[5].price + R.ARMORS[5].price) * 0.5);
  assert.ok(R.WEAPONS[5].atk >= R.WEAPONS[3].atk * 1.6, 'อาวุธขั้น 6 แรงกว่าขั้น 4 ชัดเจน');
  assert.ok(R.ARMORS[5].def >= R.ARMORS[3].def * 1.6);
  assert.ok(
    R.shopList(p).every(function (it) {
      return it.id !== 'w' && it.id !== 'ar';
    }),
    'ขั้น 6 แล้วไม่มีขายต่อ'
  );
});

/* ---------- ของช่วยรบ (v9) ---------- */

function toBattle(seed) {
  var s = game(2, seed || 11);
  moveTo(s, 0, 3); // ป่ามอนสเตอร์
  assert.strictEqual(s.phase, 'battle');
  s.battle.hp = 200;
  s.battle.mhp = 200;
  return s;
}

test('ของช่วยรบมีขายในร้าน (กลุ่มแยก) · มีเพดาน · ไม่เสียยก', function () {
  R.FIGHT_ITEMS.forEach(function (id) {
    assert.ok(R.ITEMS[id] && R.ITEMS[id].max >= 1 && R.ITEMS[id].price > 0, id);
    assert.ok(R.ITEM_IDS.indexOf(id) !== -1, id + ' ต้องอยู่ในร้าน');
  });
  var p = game(2).players[0];
  p.gold = 1000;
  R.shopList(p)
    .filter(function (it) { return R.FIGHT_ITEMS.indexOf(it.id) !== -1; })
    .forEach(function (it) {
      assert.strictEqual(it.group, 'fight');
    });
  assert.strictEqual(p.oil + p.buckler + p.scroll, 0, 'เริ่มเกมไม่มีของช่วยรบ');
});

test('น้ำมันเคลือบดาบ: โจมตี +' + R.OIL_ATK + ' จนจบการต่อสู้ · ใช้ซ้ำในการต่อสู้เดียวไม่ได้ · ไม่เสียยก', function () {
  var s = toBattle();
  var p = s.players[0];
  p.oil = 2;
  var hp = p.hp;
  var evs = R.act(s, { type: 'use', item: 'oil' });
  assert.ok(evs && kinds(evs).indexOf('fight-item') !== -1);
  assert.strictEqual(p.oil, 1);
  assert.strictEqual(s.battle.oil, R.OIL_ATK);
  assert.strictEqual(s.battle.n, 0, 'ไม่เสียยก');
  assert.strictEqual(p.hp, hp, 'อีกฝ่ายไม่ได้สวน');
  assert.strictEqual(R.act(s, { type: 'use', item: 'oil' }), null, 'ใช้ซ้ำไม่ได้');
  // แรงที่ทำเพิ่มจริง: เทียบยกเดียวกัน (seed เดียวกัน) มี/ไม่มีน้ำมัน
  var a = clone(s);
  var b = clone(s);
  b.battle.oil = 0;
  a.battle.bias = b.battle.bias = [0, 0, 1]; // ศัตรูป้องกัน → เราโจมตีแรงชนะ
  R.act(a, { type: 'move', m: 'H' });
  R.act(b, { type: 'move', m: 'H' });
  assert.ok(a.battle.last.dealt > b.battle.last.dealt, a.battle.last.dealt + ' > ' + b.battle.last.dealt);
});

test('โล่ไม้ไผ่สาน: กันการโดนตีครั้งถัดไป (ไม่เจ็บ) แล้วหมด · ใช้ตอนดื่มยาก็กันได้', function () {
  var s = toBattle();
  var p = s.players[0];
  p.buckler = 1;
  R.act(s, { type: 'use', item: 'buckler' });
  assert.strictEqual(p.buckler, 0);
  assert.strictEqual(s.battle.block, 1);
  s.battle.bias = [0, 1, 0]; // ศัตรูโจมตีแรง → เราป้องกัน = โดนเต็ม ๆ
  var hp = p.hp;
  var evs = R.act(s, { type: 'move', m: 'D' });
  assert.strictEqual(p.hp, hp, 'โล่กันไว้');
  assert.ok(evs.filter(function (e) { return e.k === 'hit'; })[0].blocked > 0);
  assert.strictEqual(s.battle.block, 0);
  R.act(s, { type: 'move', m: 'D' });
  assert.ok(p.hp < hp, 'ครั้งถัดไปโดนตามปกติ');
  // ดื่มยาแล้วโดนตีฟรี: โล่กันได้
  var t = toBattle(12);
  var q = t.players[0];
  q.buckler = 1;
  q.potion = 1;
  q.hp = 10;
  R.act(t, { type: 'use', item: 'buckler' });
  t.battle.bias = [1, 0, 0];
  R.act(t, { type: 'use', item: 'potion' });
  assert.strictEqual(q.hp, Math.min(q.mhp, 10 + Math.ceil(q.mhp / 2)));
});

test('ม้วนคัมภีร์อ่านใจ: บอกท่าอีกฝ่ายยกถัดไป แล้วอีกฝ่ายออกท่านั้นจริง', function () {
  for (var k = 0; k < 20; k++) {
    var s = toBattle(100 + k);
    var p = s.players[0];
    p.scroll = 1;
    var evs = R.act(s, { type: 'use', item: 'scroll' });
    var peek = evs.filter(function (e) { return e.k === 'fight-item'; })[0].peek;
    assert.ok(R.MOVES.indexOf(peek) !== -1);
    assert.strictEqual(s.battle.peek, peek);
    assert.strictEqual(R.act(s, { type: 'use', item: 'scroll' }), null, 'ไม่มีคัมภีร์แล้ว');
    R.act(s, { type: 'move', m: R.BEATS[peek] });
    assert.strictEqual(s.battle.last.foe, peek);
    assert.strictEqual(s.battle.last.took, 0, 'ออกท่าที่ชนะ = ไม่โดน');
    assert.strictEqual(s.battle.peek, null);
  }
});

test('ของช่วยรบใช้กับผู้เฝ้าเมืองได้ · ไม่มีของ = ใช้ไม่ได้', function () {
  var s = game(2);
  moveTo(s, 0, 2);
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.battle.town, 0);
  R.FIGHT_ITEMS.forEach(function (id) {
    assert.strictEqual(R.act(s, { type: 'use', item: id }), null, id);
  });
  s.players[0].oil = 1;
  assert.ok(R.act(s, { type: 'use', item: 'oil' }));
});

test('ประลอง: น้ำมันดาบ/โล่ไม้ ใช้ได้ (หักของตอนเปิดผล) · คัมภีร์ใช้ไม่ได้ · ของที่ไม่มี = วางแผนไม่ได้', function () {
  function duel(seed) {
    var s = game(2, seed);
    s.players[1].pos = 5;
    s.players[0].pos = 0;
    R.act(s, { type: 'roll', forced: 5 });
    assert.strictEqual(s.pending.kind, 'duel-offer');
    R.act(s, { type: 'duel', target: 1 });
    return s;
  }
  var s = duel(3);
  assert.strictEqual(R.act(s, { type: 'plan', moves: ['A', 'A', 'A'], items: ['oil'] }), null, 'ไม่มีน้ำมัน');
  s.players[0].oil = 1;
  s.players[0].scroll = 1;
  assert.strictEqual(R.act(s, { type: 'plan', moves: ['A', 'A', 'A'], items: ['scroll'] }), null, 'คัมภีร์ใช้ในประลองไม่ได้');
  assert.ok(R.act(s, { type: 'plan', moves: ['A', 'A', 'A'], items: ['oil'] }));
  s.players[1].buckler = 1;
  var evs = R.act(s, { type: 'plan', moves: ['A', 'A', 'A'], items: ['buckler'] });
  var e = evs.filter(function (x) { return x.k === 'duel-result'; })[0];
  assert.deepStrictEqual(e.used, [['oil'], ['buckler']]);
  assert.strictEqual(s.players[0].oil, 0);
  assert.strictEqual(s.players[1].buckler, 0);
  assert.strictEqual(e.rounds[0].db > 0, true, 'ผู้ท้าโดนตีตามปกติ');
  assert.strictEqual(e.rounds[0].da, 0, 'ยกแรกโล่ไม้ของอีกฝ่ายกันไว้');
  assert.ok(e.rounds[0].bb > 0);
  // เทียบกับไม่มีของ: โจมตีเท่ากันทั้งคู่ → น้ำมันทำให้ยก 2–3 แรงกว่า
  var t = duel(3);
  R.act(t, { type: 'plan', moves: ['A', 'A', 'A'] });
  var e2 = R.act(t, { type: 'plan', moves: ['A', 'A', 'A'] }).filter(function (x) { return x.k === 'duel-result'; })[0];
  assert.ok(e.rounds[1].da + e.rounds[2].da > e2.rounds[1].da + e2.rounds[2].da);
});

test('หีบสมบัติให้ของช่วยรบได้ (ไม่เกินเพดาน)', function () {
  var got = {};
  for (var g = 0; g < 1500; g++) {
    var s = game(2, 9000 + g);
    var evs = moveTo(s, 0, 1);
    evs.forEach(function (e) {
      if (e.k === 'chest') got[e.got] = (got[e.got] || 0) + 1;
    });
  }
  R.FIGHT_ITEMS.forEach(function (id) {
    assert.ok(got[id] > 0, 'หีบต้องให้ ' + id + ' ได้ ' + JSON.stringify(got));
  });
  assert.strictEqual(R.CHEST_W.length, 11);
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

/* ---------- v10: โหมดไม่จำกัดรอบ + บอส ---------- */

function endless(n, seed, map) {
  return R.newGame({ players: cpus(n || 2), length: 'endless', seed: seed == null ? 42 : seed, map: map });
}

// ใส่การ์ดบอสไว้ในกองแล้วให้ผู้เล่น 0 เดินไปเปิดที่ศาลา (ช่อง 4)
function summon(s) {
  s.boss.stage = 'deck';
  return moveTo(s, 0, 4);
}

// ช่องกระดานของเมืองลำดับ k
function squareOf(s, k) {
  for (var i = 0; i < s.board.length; i++) if (s.board[i].t === 'town' && s.board[i].town === k) return i;
  return -1;
}

// ผู้เล่นคนปัจจุบันเดินไปหยุดที่เมืองลำดับ k (คนอื่นไปยืนช่องอื่นให้พ้นทาง)
function landOnTown(s, k) {
  var sq = squareOf(s, k);
  var me = s.turn;
  s.players.forEach(function (q, i) {
    if (i !== me) q.pos = (sq + 7) % s.board.length;
  });
  s.players[me].pos = (sq - 1 + s.board.length) % s.board.length;
  return R.act(s, { type: 'roll', forced: 1 });
}

// จบตาคนปัจจุบันแบบไม่มีอะไรเกิด: เดินไปแช่น้ำพุร้อน (ช่อง 13 ของแดนมนตร์)
function restTurn(s) {
  var me = s.turn;
  s.players.forEach(function (q, i) {
    if (i !== me) q.pos = 20;
  });
  s.players[me].pos = 11;
  return R.act(s, { type: 'roll', forced: 2 });
}

// ตั้งบอสไว้ที่เมืองลำดับ k (เจ้าของ = owner) · ตาของผู้เล่น 0
function bossAt(n, k, owner, seed) {
  var s = endless(n, seed);
  s.towns[k].owner = owner;
  s.towns[k].level = 2;
  s.boss.stage = 'out';
  s.boss.town = k;
  s.boss.left = 99;
  return s;
}

test('ไม่จำกัดรอบ: เกมใหม่ไม่มีจำนวนรอบ (rounds 0) · บอสรออยู่ · ตัวเลือกความยาวมี 4 แบบ · เกมปกติไม่มีบอส', function () {
  assert.deepStrictEqual(R.LENGTH_IDS, ['short', 'mid', 'long', 'endless']);
  var s = endless(3);
  assert.strictEqual(s.endless, true);
  assert.strictEqual(s.rounds, 0);
  assert.strictEqual(s.boss.stage, 'wait');
  assert.strictEqual(s.v, R.VERSION);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s)), s, 'แปลงเป็น JSON ได้ทั้งก้อน');
  var f = game(2, 1, 'long');
  assert.strictEqual(f.endless, false);
  assert.strictEqual(f.boss, null);
  assert.strictEqual(f.rounds, 30);
});

test('ไม่จำกัดรอบ: ไม่จบตามจำนวนรอบ (เล่นเกิน 60 รอบยังไม่จบ) · ความคืบหน้าเกมไม่เกิน 1 · เงินไม่เป็น NaN', function () {
  var s = endless(3, 11);
  s.boss.stage = 'dead'; // ปิดบอสไว้ (ทดสอบเฉพาะว่าไม่มีเพดานรอบ)
  var guard = 0;
  while (s.round <= 60 && guard++ < 20000) R.act(s, R.cpuAct(s));
  assert.ok(s.round > 60, 'ต้องเล่นเกิน 60 รอบได้');
  assert.notStrictEqual(s.phase, 'over');
  assert.strictEqual(R.progress(s), 1);
  s.players.forEach(function (p) {
    assert.ok(isFinite(p.gold) && p.gold >= 0, 'เงินผิด ' + p.gold);
  });
  var f = game(2, 3, 'short');
  f.round = 5;
  assert.strictEqual(R.progress(f), 5 / 15, 'เกมปกติยังใช้ รอบ/จำนวนรอบ เหมือนเดิม');
});

test('ไม่จำกัดรอบ: คนแรกถึง Lv 6 = การ์ดบอสลงกอง (ครั้งเดียว) · ไพ่ใบถัดไปของใครก็ได้ = อัญเชิญบอสแน่นอน · กองเดิมไม่ถูกแตะ', function () {
  var s = endless(2);
  s.towns[0].owner = 0;
  s.towns[4].owner = 1;
  var p = s.players[0];
  p.lv = 5;
  p.xp = R.xpNeed(5) - 1;
  moveTo(s, 0, 3); // ป่ามอนสเตอร์
  var evs = winFight(s);
  assert.strictEqual(p.lv, 6);
  assert.strictEqual(count(kinds(evs), 'boss-card'), 1);
  assert.strictEqual(s.boss.stage, 'deck');
  assert.strictEqual(s.boss.lv6, s.round);
  // ผู้เล่นอีกคนถึง Lv 6 ทีหลัง = ไม่ใส่ซ้ำ
  var q = s.players[1];
  q.lv = 5;
  q.xp = R.xpNeed(5) - 1;
  assert.strictEqual(s.turn, 1);
  s.players[0].pos = 20;
  q.pos = 0;
  R.act(s, { type: 'roll', forced: 3 });
  var e2 = winFight(s);
  assert.strictEqual(q.lv, 6);
  assert.strictEqual(count(kinds(e2), 'boss-card'), 0, 'การ์ดบอสลงกองครั้งเดียว');
  // ตาผู้เล่น 0 เปิดไพ่: กองมีไพ่อื่นอยู่ แต่ต้องได้การ์ดบอส
  s.deck = [0, 1, 2];
  var e3 = moveTo(s, 0, 4);
  var card = e3.filter(function (e) {
    return e.k === 'card';
  })[0];
  assert.strictEqual(card.card, 'summon');
  assert.strictEqual(card.boss, true);
  assert.deepStrictEqual(s.deck, [0, 1, 2], 'กองไพ่ปกติไม่ถูกแตะ');
  assert.strictEqual(s.boss.stage, 'out');
  assert.ok(kinds(e3).indexOf('boss') !== -1);
  // ใบถัดไป = ไพ่ปกติจากกอง (ย้ายบอสไปเมือง 4 ช่อง 12 ให้พ้นทาง — v10.1 บอสขวางทางที่ช่อง 2 ได้)
  s.boss.town = 4;
  s.turn = 0;
  s.phase = 'roll';
  var e4 = moveTo(s, 0, 4);
  assert.notStrictEqual(
    e4.filter(function (e) {
      return e.k === 'card';
    })[0].card,
    'summon'
  );
});

test('ไม่จำกัดรอบ: เกมจำนวนรอบคงที่ถึง Lv 6 = ไม่มีการ์ดบอส', function () {
  var s = game(2);
  var p = s.players[0];
  p.lv = 5;
  p.xp = R.xpNeed(5) - 1;
  moveTo(s, 0, 3);
  var evs = winFight(s);
  assert.strictEqual(p.lv, 6);
  assert.strictEqual(count(kinds(evs), 'boss-card'), 0);
  assert.strictEqual(s.boss, null);
});

test('บอสออกที่เมืองที่มีเจ้าของ (สุ่ม) · สถานะ/เหตุการณ์ครบ · ไม่มีเมืองไหนมีเจ้าของ = สุ่มจากทุกเมือง', function () {
  var seen = {};
  for (var g = 0; g < 40; g++) {
    var s = endless(2, 100 + g);
    s.towns[1].owner = 1;
    s.towns[6].owner = 0;
    s.towns[8].owner = 1;
    var evs = summon(s);
    assert.strictEqual(s.boss.stage, 'out');
    assert.ok([1, 6, 8].indexOf(s.boss.town) !== -1, 'ต้องเป็นเมืองที่มีเจ้าของ: ' + s.boss.town);
    assert.ok(R.bossHere(s, s.boss.town));
    var be = evs.filter(function (e) {
      return e.k === 'boss';
    })[0];
    assert.strictEqual(be.town, s.boss.town);
    assert.strictEqual(be.owner, s.towns[s.boss.town].owner);
    seen[s.boss.town] = 1;
  }
  assert.strictEqual(Object.keys(seen).length, 3, 'สุ่มได้ครบทุกเมืองที่มีเจ้าของ');
  var t = endless(2, 5);
  summon(t);
  assert.ok(t.boss.town >= 0 && t.boss.town < t.towns.length, 'ไม่มีเจ้าของเลย = ยังออกได้');
});

test('บอสย้ายเมืองทุก 1 รอบ (ทุกคนได้เล่น 1 ตาก่อน) ไปเมืองที่มีเจ้าของเมืองอื่น · มีเมืองเดียว = อยู่ที่เดิม', function () {
  [2, 3].forEach(function (n) {
    var s = endless(n, 7);
    s.towns[1].owner = 1;
    s.towns[6].owner = 0;
    s.towns[8].owner = 1;
    summon(s);
    var at = s.boss.town;
    var moved = false;
    for (var k = 0; k < n; k++) {
      assert.strictEqual(s.boss.town, at, n + ' คน: ยังไม่ครบรอบ ห้ามย้าย (ตาที่ ' + k + ')');
      var evs = restTurn(s);
      if (kinds(evs).indexOf('boss-move') !== -1) moved = k === n - 1;
    }
    assert.ok(moved, n + ' คน: ต้องย้ายเมื่อครบ 1 รอบพอดี');
    assert.notStrictEqual(s.boss.town, at);
    assert.ok([1, 6, 8].indexOf(s.boss.town) !== -1);
    var at2 = s.boss.town;
    for (var j = 0; j < n; j++) restTurn(s);
    assert.notStrictEqual(s.boss.town, at2, 'รอบถัดไปย้ายอีก');
  });
  var one = endless(2, 9);
  one.towns[6].owner = 0;
  summon(one);
  assert.strictEqual(one.boss.town, 6);
  for (var r = 0; r < 6; r++) restTurn(one);
  assert.strictEqual(one.boss.town, 6, 'มีเมืองที่มีเจ้าของเมืองเดียว = อยู่ที่เดิม');
});

test('ตกเมืองที่บอสยึด = เลือกสู้บอส/ไม่สู้ · ไม่มีค่าผ่านทาง ปล้น/พักไม่ได้ · ไม่สู้ = ไม่มีอะไรเกิดขึ้น (รวมเจ้าเมืองเอง)', function () {
  var s = bossAt(2, 3, 1);
  var g0 = s.players[0].gold;
  var g1 = s.players[1].gold;
  landOnTown(s, 3);
  assert.strictEqual(s.phase, 'decide');
  assert.strictEqual(s.pending.kind, 'boss');
  ['rob', 'rest', 'invest', 'leave', 'roll'].forEach(function (t) {
    assert.strictEqual(R.act(s, { type: t, levels: 1, town: 3 }), null, t + ' ต้องใช้ไม่ได้');
  });
  var evs = R.act(s, { type: 'skip' });
  assert.ok(kinds(evs).indexOf('pass') !== -1);
  assert.strictEqual(s.players[0].gold, g0);
  assert.strictEqual(s.players[1].gold, g1);
  assert.strictEqual(s.turn, 1);
  assert.strictEqual(s.boss.tries, 0);
  // เจ้าเมืองตกเมืองตัวเองที่บอสยึด = เจอบอสเหมือนกัน (ไม่ได้ขยาย)
  s.players[1].gold = 999;
  landOnTown(s, 3);
  assert.strictEqual(s.pending.kind, 'boss');
  assert.strictEqual(R.decider(s), 1);
});

test('เมืองที่บอสยึดขยายไม่ได้ตอนผ่านลานประตูเมือง (เมืองอื่นยังขยายได้)', function () {
  var s = bossAt(2, 3, 0);
  s.towns[0].owner = 0;
  s.players[0].gold = 500;
  s.players[1].pos = 5;
  s.players[0].pos = 26;
  R.act(s, { type: 'roll', forced: 4 }); // หยุดที่ลานพอดี → สิทธิ์ขยาย 1 เมือง
  assert.strictEqual(s.pending.kind, 'invest');
  assert.deepStrictEqual(s.pending.towns, [0], 'เมือง 3 (บอสยึด) ต้องไม่อยู่ในรายการ');
});

test('สู้บอส: บอสพลังชีวิตเต็มทุกครั้ง (ความเสียหายไม่ค้าง) · ค่าพลังตรงตาราง · ใช้ของช่วยรบได้', function () {
  var s = bossAt(2, 3, 1);
  s.players[0].smoke = 2;
  s.players[0].oil = 1;
  landOnTown(s, 3);
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.phase, 'battle');
  assert.strictEqual(s.battle.boss, true);
  assert.strictEqual(s.battle.hp, R.BOSS.hp);
  assert.strictEqual(s.battle.atk, R.BOSS.atk);
  assert.strictEqual(s.battle.def, R.BOSS.def);
  assert.ok(R.act(s, { type: 'use', item: 'oil' }), 'ใช้น้ำมันดาบกับบอสได้');
  s.battle.hp = 20; // ตีบอสไปเยอะแล้ว
  R.act(s, { type: 'use', item: 'smoke' }); // หนี
  assert.strictEqual(s.boss.stage, 'out', 'หนีแล้วบอสยังอยู่');
  restTurn(s); // ตาผู้เล่น 1
  landOnTown(s, 3); // ผู้เล่น 0 สู้ใหม่
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.battle.hp, R.BOSS.hp);
  assert.strictEqual(s.boss.tries, 2);
  assert.strictEqual(s.players[0].st.bossTry, 2);
});

/* ---------- v10.1: บอสขวางทาง + ค่าบอสใหม่ ---------- */

test('v10.1 ค่าบอส: พลังชีวิต 120 · โจมตี 26 · ป้องกัน 8 · คอมนิสัยปกติยอมสู้เมื่อโอกาส ≥ 0.15', function () {
  assert.strictEqual(R.BOSS.hp, 120);
  assert.strictEqual(R.BOSS.atk, 26);
  assert.strictEqual(R.BOSS.def, 8);
  assert.strictEqual(R.BOSS_TUNE.need, 0.15);
  var f = R.bossFoe();
  assert.strictEqual(f.hp, 120);
  assert.strictEqual(f.boss, true);
});

test('บอสขวางทาง: เดินผ่านเมืองบอส = หยุดตรงนั้น ก้าวที่เหลือหาย · ถามสู้/ไม่สู้เหมือนหยุดพอดี', function () {
  var s = bossAt(2, 3, 1); // เมือง 3 = ช่อง 10
  s.players[1].pos = 20;
  s.players[0].pos = 8;
  var evs = R.act(s, { type: 'roll', forced: 5 }); // จะไปช่อง 13 แต่ติดบอสที่ช่อง 10
  assert.strictEqual(s.players[0].pos, 10);
  var mv = evs.filter(function (e) {
    return e.k === 'move';
  })[0];
  assert.strictEqual(mv.steps, 2, 'แอนิเมชันเดินแค่ 2 ช่อง');
  var bl = evs.filter(function (e) {
    return e.k === 'boss-block';
  })[0];
  assert.ok(bl, 'ต้องมีเหตุการณ์บอสขวางทาง');
  assert.strictEqual(bl.lost, 3);
  assert.strictEqual(bl.town, 3);
  assert.strictEqual(s.phase, 'decide');
  assert.strictEqual(s.pending.kind, 'boss');
  // หยุดพอดีที่เมืองบอส = ไม่มีเหตุการณ์ขวางทาง (แค่ถาม)
  var t = bossAt(2, 3, 1);
  t.players[1].pos = 20;
  t.players[0].pos = 8;
  var e2 = R.act(t, { type: 'roll', forced: 2 });
  assert.strictEqual(count(kinds(e2), 'boss-block'), 0);
  assert.strictEqual(t.pending.kind, 'boss');
});

test('บอสขวางทาง: ไม่สู้ = ยืนอยู่ที่เมืองบอส จบตา (ไม่เดินต่อ) · สู้ = สู้บอสตามปกติ', function () {
  var s = bossAt(2, 3, 1);
  s.players[1].pos = 20;
  s.players[0].pos = 8;
  var g0 = s.players[0].gold;
  R.act(s, { type: 'roll', forced: 6 });
  R.act(s, { type: 'skip' });
  assert.strictEqual(s.players[0].pos, 10, 'ยังยืนที่เมืองบอส');
  assert.strictEqual(s.players[0].gold, g0, 'ไม่เสียอะไร');
  assert.strictEqual(s.turn, 1);
  var t = bossAt(2, 3, 1);
  t.players[1].pos = 20;
  t.players[0].pos = 9;
  R.act(t, { type: 'roll', forced: 4 });
  R.act(t, { type: 'fight' });
  assert.strictEqual(t.phase, 'battle');
  assert.strictEqual(t.battle.boss, true);
});

test('บอสขวางทางก่อนถึงลานประตูเมือง = ไม่ได้เงินหลวง (ยังไม่ได้ผ่านลาน) · ประลองช่องเดียวกันยังเกิดก่อน', function () {
  var s = bossAt(2, 9, 1); // เมือง 9 = ช่อง 26
  s.players[1].pos = 5;
  s.players[0].pos = 24;
  var g0 = s.players[0].gold;
  var evs = R.act(s, { type: 'roll', forced: 6 }); // จะผ่านลานไปช่อง 0
  assert.strictEqual(s.players[0].pos, 26);
  assert.strictEqual(count(kinds(evs), 'salary'), 0);
  assert.strictEqual(s.players[0].gold, g0);
  assert.strictEqual(s.pending.kind, 'boss');
  // มีผู้เล่นอื่นยืนที่เมืองบอส = ถามประลองก่อน แล้วค่อยเจอบอส
  var d = bossAt(2, 3, 1);
  d.players[1].pos = 10;
  d.players[1].gold = 10; // กันคอมท้า
  d.players[0].pos = 8;
  R.act(d, { type: 'roll', forced: 5 });
  assert.strictEqual(d.pending.kind, 'duel-offer');
  R.act(d, { type: 'skip' });
  assert.strictEqual(d.pending.kind, 'boss');
});

test('บอสขวางทาง: ไพ่ลมส่งท้ายเรือ (เดิน 3 ช่อง) ถูกขวาง · ไพ่ทางลัด (วาร์ป) ไม่ถูกขวาง ได้เงินหลวงตามเดิม', function () {
  var idx = function (id) {
    return R.CARDS.map(function (c) {
      return c.id;
    }).indexOf(id);
  };
  var s = bossAt(2, 5, 1); // เมือง 5 = ช่อง 16
  s.players[1].pos = 5;
  s.deck = [idx('wind')];
  s.players[0].pos = 11;
  R.act(s, { type: 'roll', forced: 3 }); // 11 → 14 (ผ่าน 12 เมือง 4 ไม่มีบอส) เปิดไพ่ลม +3 → ติดบอสช่อง 16
  assert.strictEqual(s.players[0].pos, 16);
  assert.strictEqual(s.pending.kind, 'boss');
  var g = bossAt(2, 9, 1); // เมือง 9 = ช่อง 26
  g.players[1].pos = 5;
  g.players[0].pos = 20;
  g.deck = [idx('gate')];
  var evs = R.act(g, { type: 'roll', forced: 3 }); // 20 → ศาลาช่อง 23 → ทางลัดวาร์ปไปลาน ผ่านช่อง 26
  assert.strictEqual(g.players[0].pos, 0);
  assert.ok(kinds(evs).indexOf('salary') !== -1);
  assert.strictEqual(count(kinds(evs), 'boss-block'), 0);
});

test('ปราบบอส = จบเกมทันที · คนปราบอันดับ 1 (แม้จนสุด) · ที่เหลือเรียงตามทรัพย์รวม', function () {
  var s = bossAt(3, 3, 1);
  s.players[0].gold = 0;
  s.players[1].gold = 5000;
  s.players[2].gold = 900;
  landOnTown(s, 3);
  R.act(s, { type: 'fight' });
  var evs = winFight(s);
  assert.strictEqual(s.phase, 'over');
  assert.ok(kinds(evs).indexOf('over') !== -1);
  assert.strictEqual(s.result.slayer, 0);
  assert.strictEqual(s.result.winner, 0);
  assert.strictEqual(s.result.rank[0].p, 0);
  assert.strictEqual(s.result.rank[0].slayer, true);
  assert.strictEqual(s.result.rank[1].p, 1);
  assert.strictEqual(s.result.rank[2].p, 2);
  assert.ok(s.result.rank[1].total >= s.result.rank[2].total);
  assert.strictEqual(s.boss.stage, 'dead');
  assert.strictEqual(s.boss.slayer, 0);
  assert.strictEqual(R.decider(s), -1);
  assert.strictEqual(R.act(s, { type: 'roll' }), null, 'จบแล้วทำอะไรต่อไม่ได้');
});

test('แพ้บอส = โทษแพ้ปกติ (เหรียญหล่น 15% + พักฟื้น 1 ตา) · บอสยังอยู่ที่เดิม เกมเดินต่อ', function () {
  var s = bossAt(2, 3, 1);
  s.players[0].gold = 200;
  landOnTown(s, 3);
  R.act(s, { type: 'fight' });
  var evs = loseFight(s);
  assert.ok(kinds(evs).indexOf('lose') !== -1);
  assert.strictEqual(s.players[0].gold, 170);
  assert.strictEqual(s.players[0].skip, 1);
  assert.strictEqual(s.boss.stage, 'out');
  assert.strictEqual(s.boss.town, 3);
  assert.notStrictEqual(s.phase, 'over');
  assert.strictEqual(s.turn, 1);
});

test('บันทึกกลางเกมตอนบอสออก / กลางการสู้บอส / การ์ดรอในกอง (JSON) แล้วเล่นต่อ = ผลเหมือนเล่นรวดเดียว', function () {
  var a = endless(3, 21);
  var guard = 0;
  while (a.boss.stage !== 'out' && guard++ < 20000) R.act(a, R.cpuAct(a));
  assert.strictEqual(a.boss.stage, 'out');
  var b = R.migrate(clone(a));
  assert.ok(b);
  assert.deepStrictEqual(b.boss, a.boss);
  R.autoplay(a, 200000);
  R.autoplay(b, 200000);
  assert.strictEqual(a.phase, 'over');
  assert.deepStrictEqual(a.result, b.result);
  var c = bossAt(2, 3, 1, 33);
  landOnTown(c, 3);
  R.act(c, { type: 'fight' });
  R.act(c, { type: 'move', m: 'A' });
  var d = R.migrate(clone(c));
  assert.strictEqual(d.battle.boss, true);
  assert.strictEqual(d.battle.hp, c.battle.hp);
  R.autoplay(c, 200000);
  R.autoplay(d, 200000);
  assert.deepStrictEqual(c.result, d.result);
  var e = endless(2, 44);
  e.boss.stage = 'deck';
  var f = R.migrate(clone(e));
  assert.strictEqual(f.boss.stage, 'deck');
  summon(f);
  assert.strictEqual(f.boss.stage, 'out');
});

test('เซฟรุ่น 3 (v9) โหลดได้เป็นเกมจำนวนรอบเดิม แล้วเล่นจนจบตรงรอบ · เซฟไม่จำกัดที่ไม่มีข้อมูลบอส = เสีย', function () {
  R.MAP_IDS.forEach(function (map) {
    ['short', 'long'].forEach(function (len) {
      var s = game(3, 77, len, map);
      for (var i = 0; i < 60; i++) R.act(s, R.cpuAct(s));
      s.v = 3;
      delete s.endless;
      delete s.boss;
      var m = R.migrate(clone(s));
      assert.ok(m, 'ต้องโหลดได้');
      assert.strictEqual(m.v, R.VERSION);
      assert.strictEqual(m.endless, false);
      assert.strictEqual(m.boss, null);
      R.autoplay(m);
      assert.strictEqual(m.phase, 'over');
      assert.strictEqual(m.round, m.rounds);
      assert.strictEqual(m.rounds, R.LENGTHS[len]);
    });
  });
  var bad = endless(2);
  delete bad.boss;
  assert.strictEqual(R.migrate(clone(bad)), null);
});

test('คอมเล่นโหมดไม่จำกัดจนจบได้ทั้ง 2 แผนที่ × 2/3 คน · จบด้วยการปราบบอสเสมอ · คนปราบ = ผู้ชนะ', function () {
  R.MAP_IDS.forEach(function (map) {
    [2, 3].forEach(function (n) {
      for (var k = 0; k < 6; k++) {
        var s = endless(n, 600 + k, map);
        R.autoplay(s, 200000);
        assert.strictEqual(s.phase, 'over', map + ' ' + n + ' คน ยังไม่จบ');
        assert.ok(s.result.slayer >= 0);
        assert.strictEqual(s.result.winner, s.result.slayer);
        assert.strictEqual(s.result.rank[0].p, s.result.slayer);
        assert.ok(s.boss.lv6 > 0 && s.boss.out >= s.boss.lv6);
        s.players.forEach(function (p) {
          assert.ok(p.gold >= 0 && p.hp >= 0 && p.hp <= p.mhp);
        });
      }
    });
  });
});

test('คอมตัดสินใจสู้บอสตามโอกาสชนะ: Lv 6 ไม่มีอุปกรณ์ = ไม่สู้ · Lv 8 อุปกรณ์ขั้น 4 + ของช่วยรบ = สู้ · ไม่แตะ seed เกม', function () {
  var weak = bossAt(2, 3, 1, 5);
  landOnTown(weak, 3);
  var p = weak.players[0];
  for (var l0 = 1; l0 < 6; l0++) {
    p.mhp += 5;
    p.atk += 2;
    p.def += 1;
  }
  p.lv = 6;
  p.hp = p.mhp;
  var seed = weak.seed;
  assert.deepStrictEqual(R.cpuAct(weak), { type: 'skip' });
  assert.strictEqual(weak.seed, seed, 'ประเมินโอกาสไม่ใช้ seed เกมจริง');
  assert.ok(R.bossOdds(weak, 0) < 0.1);
  var strong = bossAt(2, 3, 1, 5);
  landOnTown(strong, 3);
  var q = strong.players[0];
  for (var l = 1; l < 8; l++) {
    q.mhp += 5;
    q.atk += 2;
    q.def += 1;
  }
  q.lv = 8;
  q.hp = q.mhp;
  q.w = 3;
  q.ar = 3;
  q.oil = 1;
  q.scroll = 1;
  q.buckler = 1;
  q.bomb = 1;
  q.potion = 2;
  assert.ok(R.bossOdds(strong, 0) >= 0.4, 'โอกาส ' + R.bossOdds(strong, 0));
  assert.deepStrictEqual(R.cpuAct(strong), { type: 'fight' });
});

/* ---------- v10: เหตุผลที่ขยายเมืองไม่ได้ · หยุดที่ลานประตูเมือง = พลังชีวิตเต็ม ---------- */

test('ตกเมืองตัวเองแต่ขยายไม่ได้ = บอกเหตุผล (เต็มระดับ 5 / เงินไม่พอ บอกจำนวน) · กติกาเดิม', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  s.towns[0].level = 5;
  var evs = moveTo(s, 0, 2);
  var home = evs.filter(function (e) {
    return e.k === 'home';
  })[0];
  assert.ok(home, 'ต้องมีเหตุการณ์ home');
  assert.ok(home.t.indexOf('เต็มระดับ 5') !== -1, home.t);
  assert.strictEqual(home.full, true);
  assert.strictEqual(s.turn, 1, 'จบตาเหมือนเดิม');
  var t = game(2);
  t.towns[0].owner = 0;
  t.players[0].gold = 10;
  var e2 = moveTo(t, 0, 2);
  var h2 = e2.filter(function (e) {
    return e.k === 'home';
  })[0];
  var cost = R.investCost(t.towns[0]);
  assert.ok(h2.t.indexOf('ระดับ 2') !== -1 && h2.t.indexOf('ต้องมี ' + cost + ' เหรียญ') !== -1 && h2.t.indexOf('ตอนนี้มี 10') !== -1, h2.t);
  assert.strictEqual(t.players[0].gold, 10, 'ไม่เปลี่ยนเงิน');
});

test('ผ่านลานประตูเมืองแต่ขยายไม่ได้สักเมือง = บอกเหตุผล (เงินไม่พอ / เต็มทุกเมือง) · ไม่มีเมือง = ไม่ต้องบอก', function () {
  var s = game(2);
  s.towns[7].owner = 0; // นครทรายทอง ค่าลงทุน 132
  s.players[0].gold = 0;
  s.players[1].pos = 5;
  s.players[0].pos = 26;
  var evs = R.act(s, { type: 'roll', forced: 4 }); // หยุดที่ลานพอดี
  var n = evs.filter(function (e) {
    return e.k === 'noinvest';
  })[0];
  assert.ok(n, 'ต้องบอกเหตุผล');
  assert.ok(n.t.indexOf('ต้องมี 132 เหรียญ') !== -1 && n.t.indexOf('ตอนนี้มี ' + s.players[0].gold) !== -1, n.t);
  var f = game(2);
  f.towns[0].owner = 0;
  f.towns[0].level = 5;
  f.players[1].pos = 5;
  f.players[0].pos = 26;
  var e2 = R.act(f, { type: 'roll', forced: 4 });
  assert.ok(
    e2.some(function (e) {
      return e.k === 'noinvest' && e.t.indexOf('เต็มระดับ 5') !== -1;
    })
  );
  var z = game(2);
  z.players[1].pos = 5;
  z.players[0].pos = 26;
  var e3 = R.act(z, { type: 'roll', forced: 4 });
  assert.strictEqual(count(kinds(e3), 'noinvest'), 0);
});

test('หยุดพอดีที่ลานประตูเมือง = โบนัสเงิน + พลังชีวิตเต็ม · เดินผ่านเฉย ๆ = ไม่ฟื้นพลัง', function () {
  var s = game(2);
  s.players[0].hp = 5;
  s.players[1].pos = 5;
  s.players[0].pos = 26;
  var g0 = s.players[0].gold;
  var evs = R.act(s, { type: 'roll', forced: 4 });
  assert.strictEqual(s.players[0].hp, s.players[0].mhp);
  assert.ok(s.players[0].gold >= g0 + R.SALARY + Math.round(R.SALARY / 2));
  assert.ok(
    evs.some(function (e) {
      return e.k === 'gold' && e.t.indexOf('พลังชีวิตเต็ม') !== -1;
    })
  );
  var t = game(2);
  t.players[0].hp = 5;
  t.players[1].pos = 5;
  t.players[0].pos = 28;
  R.act(t, { type: 'roll', forced: 4 }); // ผ่านลาน → หยุดเมืองว่างช่อง 2
  assert.strictEqual(t.players[0].hp, 5, 'ผ่านเฉย ๆ ไม่ฟื้น');
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
