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

function game(n, seed, length) {
  return R.newGame({ players: cpus(n || 2), length: length || 'short', seed: seed == null ? 42 : seed });
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function kinds(evs) {
  return evs.map(function (e) {
    return e.k;
  });
}

console.log('ชิงเมืองแดนมนตร์ — engine self-tests');

test('กระดาน 30 ช่อง มีเมือง 7 · มอนสเตอร์ 8 แบบ · ช่องเริ่มอยู่ช่อง 0', function () {
  assert.strictEqual(R.SIZE, 30);
  assert.strictEqual(R.LAYOUT[0], 'start');
  var towns = R.LAYOUT.filter(function (k) {
    return k.indexOf('town') === 0;
  });
  assert.strictEqual(towns.length, 7);
  assert.strictEqual(R.TOWNS.length, 7);
  assert.strictEqual(R.MONSTERS.length, 8);
  ['gold', 'monster', 'chest', 'shop', 'rest'].forEach(function (k) {
    assert.ok(R.LAYOUT.indexOf(k) !== -1, 'ไม่มีช่อง ' + k);
  });
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
  assert.strictEqual(s.rounds, R.LENGTHS.short);
  assert.ok(s.players[1].gold > s.players[0].gold && s.players[2].gold > s.players[1].gold);
  assert.deepStrictEqual(clone(s), s);
});

test('เล่นคอมล้วนจนจบได้ทุกความยาว ทั้ง 2 และ 3 คน (จบตรงจำนวนรอบ มีผลอันดับ)', function () {
  ['short', 'mid', 'long'].forEach(function (len) {
    [2, 3].forEach(function (n) {
      for (var k = 0; k < 20; k++) {
        var s = game(n, 1000 + k, len);
        R.autoplay(s);
        assert.strictEqual(s.phase, 'over', len + ' ' + n + ' คน ยังไม่จบ');
        assert.strictEqual(s.round, s.rounds);
        assert.strictEqual(s.result.rank.length, n);
        s.players.forEach(function (p) {
          assert.ok(p.gold >= 0, 'เงินติดลบ');
          assert.ok(p.hp >= 0 && p.hp <= p.mhp, 'พลังชีวิตผิด');
        });
      }
    });
  });
});

test('สุ่มด้วย seed ในสถานะ: seed เดียวกัน = ผลเหมือนกันทุกครั้ง', function () {
  var a = game(3, 7, 'mid');
  var b = game(3, 7, 'mid');
  R.autoplay(a);
  R.autoplay(b);
  assert.deepStrictEqual(a.result, b.result);
});

test('บันทึกกลางเกม (JSON) แล้วเล่นต่อ = ผลเหมือนเล่นรวดเดียว', function () {
  var a = game(3, 99, 'mid');
  var b = game(3, 99, 'mid');
  var steps = 0;
  while (steps < 120) {
    R.act(b, R.cpuAct(b));
    steps++;
  }
  b = clone(b); // จำลองปิดแอปแล้วเปิดใหม่
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
  assert.deepStrictEqual(s, before);
});

test('ผ่านลานประตูเมือง = ได้เงินหลวง · มีเมือง = ได้เลือกลงทุน 1 เมือง', function () {
  var s = game(2);
  s.towns[0].owner = 0;
  s.players[0].pos = 27;
  s.players[1].pos = 5;
  var g0 = s.players[0].gold;
  var evs = R.act(s, { type: 'roll', forced: 4 }); // 27 → 1 (ถุงเงิน)
  assert.ok(kinds(evs).indexOf('salary') !== -1, 'ต้องได้เงินหลวง');
  assert.ok(s.players[0].gold >= g0 + 60, 'เงินหลวง 50 + 10 ต่อเมือง');
  assert.strictEqual(s.phase, 'decide');
  assert.strictEqual(s.pending.kind, 'invest');
  assert.deepStrictEqual(s.pending.towns, [0]);
  var cost = R.investCost(s.towns[0]);
  var g1 = s.players[0].gold;
  var v0 = R.townValue(s.towns[0]);
  R.act(s, { type: 'invest', town: 0, levels: 1 });
  assert.strictEqual(s.towns[0].level, 2);
  assert.strictEqual(s.players[0].gold, g1 - cost);
  assert.strictEqual(R.townValue(s.towns[0]), v0 + cost, 'เงินที่ลง = มูลค่าเมืองที่เพิ่ม');
  assert.strictEqual(s.turn, 1, 'ลงทุนแล้วจบตา');
});

test('ตกเมืองคนอื่น = จ่ายค่าผ่านทางให้เจ้าของ (เงินรวมไม่หาย)', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 3;
  s.players[0].pos = 0;
  s.players[1].pos = 20;
  var before = s.players[0].gold + s.players[1].gold;
  var fee = R.toll(s.towns[0]);
  R.act(s, { type: 'roll', forced: 3 }); // ช่อง 3 = เมืองแรก
  assert.strictEqual(s.players[1].gold + s.players[0].gold, before);
  assert.strictEqual(s.players[0].st.tollPaid, fee);
  assert.strictEqual(s.turn, 1);
});

test('เงินไม่พอจ่ายค่าผ่านทาง = จ่ายเท่าที่มี นับว่าหมดตัว', function () {
  var s = game(2);
  s.towns[0].owner = 1;
  s.towns[0].level = 5;
  s.players[0].gold = 5;
  s.players[1].pos = 20;
  R.act(s, { type: 'roll', forced: 3 });
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
  s.players[1].pos = 20;
  R.act(s, { type: 'roll', forced: 3 });
  assert.strictEqual(s.pending.kind, 'town');
  R.act(s, { type: 'fight' });
  assert.strictEqual(s.phase, 'battle');
  s.battle.hp = 1;
  s.battle.bias = [1, 0, 0]; // ผู้เฝ้าโจมตีแน่ ๆ → เราป้องกันสวนกลับ
  var g = s.players[0].gold;
  var evs = R.act(s, { type: 'move', m: 'D' });
  assert.ok(kinds(evs).indexOf('capture') !== -1, 'ต้องยึดได้');
  assert.strictEqual(s.towns[0].owner, 0);
  assert.ok(s.players[0].gold < g, 'ต้องหักค่าฟื้นฟู (หลังได้เงินรางวัล)');
});

test('ชนะผู้เฝ้าแต่เงินไม่พอค่าฟื้นฟู = เมืองยังว่าง', function () {
  var s = game(2);
  s.players[1].pos = 20;
  s.players[0].gold = 0;
  R.act(s, { type: 'roll', forced: 3 });
  R.act(s, { type: 'fight' });
  s.battle.hp = 1;
  s.battle.tier = 0; // รางวัลเงินน้อยมาก
  s.battle.bias = [1, 0, 0];
  var evs = R.act(s, { type: 'move', m: 'D' });
  if (s.players[0].gold + 0 < R.claimFee(0)) {
    assert.ok(kinds(evs).indexOf('nofee') !== -1);
    assert.strictEqual(s.towns[0].owner, -1);
  }
});

test('แพ้การต่อสู้ = เหรียญหล่น 20% + ข้าม 1 ตา แล้วกลับมาพลังชีวิตเต็ม', function () {
  var s = game(2);
  s.players[1].pos = 20;
  s.players[0].gold = 200;
  R.act(s, { type: 'roll', forced: 2 }); // ช่อง 2 = ป่ามอนสเตอร์
  assert.strictEqual(s.phase, 'battle');
  s.players[0].hp = 1;
  s.battle.bias = [0, 1, 0]; // โจมตีแรงแน่ ๆ → เราป้องกัน = แพ้ยกนี้
  var evs = R.act(s, { type: 'move', m: 'D' });
  assert.ok(kinds(evs).indexOf('lose') !== -1);
  assert.strictEqual(s.players[0].gold, 160);
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
  s.players[1].pos = 20;
  s.players[0].smoke = 1;
  R.act(s, { type: 'roll', forced: 2 });
  var g = s.players[0].gold;
  R.act(s, { type: 'use', item: 'smoke' });
  assert.strictEqual(s.players[0].smoke, 0);
  assert.strictEqual(s.players[0].gold, g);
  assert.strictEqual(s.turn, 1);
});

test('ร้านค้า: ซื้อแล้วเงินลด · ยามีได้ไม่เกินเพดาน · อาวุธอัปเกรดทีละขั้น', function () {
  var s = game(2);
  s.players[1].pos = 20;
  s.players[0].gold = 1000;
  R.act(s, { type: 'roll', forced: 6 }); // ช่อง 6 = ร้าน
  assert.strictEqual(s.pending.kind, 'shop');
  for (var k = 0; k < 5; k++) R.act(s, { type: 'buy', item: 'potion' });
  assert.strictEqual(s.players[0].potion, R.ITEMS.potion.max);
  var atk = R.atkOf(s.players[0]);
  R.act(s, { type: 'buy', item: 'w' });
  assert.strictEqual(R.atkOf(s.players[0]), atk + R.WEAPONS[0].atk);
  R.act(s, { type: 'buy', item: 'w' });
  assert.strictEqual(R.atkOf(s.players[0]), atk + R.WEAPONS[1].atk);
  assert.strictEqual(R.act(s, { type: 'buy', item: 'w' }), null, 'ไม่มีดาบขั้นต่อไปแล้ว');
  R.act(s, { type: 'leave' });
  assert.strictEqual(s.turn, 1);
});

test('ประลอง: วางแผนคนละ 3 ท่า · ผู้ชนะได้เงินผู้แพ้ 15% · เงินรวมไม่หาย · ไม่เสียพลังชีวิต', function () {
  var s = game(2);
  s.players[1].pos = 1; // ถุงเงิน
  s.players[0].pos = 0;
  R.act(s, { type: 'roll', forced: 1 });
  assert.strictEqual(s.pending.kind, 'duel-offer');
  R.act(s, { type: 'duel', target: 1 });
  assert.strictEqual(R.decider(s), 0);
  assert.strictEqual(R.act(s, { type: 'plan', moves: ['A', 'A'] }), null, 'ต้องครบ 3 ท่า');
  R.act(s, { type: 'plan', moves: ['H', 'H', 'H'] });
  assert.strictEqual(R.decider(s), 1, 'ถึงคิวอีกฝ่ายวางแผน');
  var total = s.players[0].gold + s.players[1].gold;
  var hp = [s.players[0].hp, s.players[1].hp];
  var g1 = s.players[1].gold;
  var evs = R.act(s, { type: 'plan', moves: ['D', 'D', 'D'] }); // แรง ชนะ ป้องกัน ทุกยก
  var res = evs.filter(function (e) {
    return e.k === 'duel-result';
  })[0];
  assert.strictEqual(res.winner, 0);
  assert.strictEqual(res.take, Math.floor(g1 * 0.15));
  assert.deepStrictEqual([s.players[0].hp, s.players[1].hp], hp);
  // หลังประลอง ผลของช่อง (ถุงเงิน) ยังเกิด → เงินรวมเพิ่มจากถุงเงินเท่านั้น
  var bag = evs.filter(function (e) {
    return e.k === 'gold';
  })[0];
  assert.ok(bag, 'ผลช่องต้องเกิดต่อหลังประลอง');
  assert.strictEqual(s.players[0].gold + s.players[1].gold, total + bag.v);
});

test('ไม่ท้าประลอง = ผลของช่องเกิดตามปกติ', function () {
  var s = game(2);
  s.players[1].pos = 13; // บ่อน้ำพุร้อน
  s.players[0].pos = 12;
  s.players[0].hp = 5;
  R.act(s, { type: 'roll', forced: 1 });
  R.act(s, { type: 'skip' });
  assert.strictEqual(s.players[0].hp, s.players[0].mhp);
});

test('เลเวลอัปเมื่อค่าประสบการณ์ถึง · ค่าพลังเพิ่ม', function () {
  var s = game(2);
  s.players[1].pos = 20;
  R.act(s, { type: 'roll', forced: 2 });
  s.battle.hp = 1;
  s.battle.tier = 2; // xp 12 ≥ 10
  s.battle.bias = [1, 0, 0];
  var atk = s.players[0].atk;
  var evs = R.act(s, { type: 'move', m: 'D' });
  assert.ok(kinds(evs).indexOf('level') !== -1);
  assert.strictEqual(s.players[0].lv, 2);
  assert.strictEqual(s.players[0].atk, atk + 2);
});

test('คอมเลือกการกระทำที่ใช้ได้เสมอ (สุ่ม 300 เกม ทุกนิสัย)', function () {
  var styles = ['normal', 'bold', 'meek', 'hoard', 'tycoon', 'brute', 'always'];
  for (var g = 0; g < 300; g++) {
    var defs = [0, 1, 2].map(function (i) {
      return { name: 'P' + i, cpu: true, style: styles[(g + i) % styles.length] };
    });
    var s = R.newGame({ players: defs, length: ['short', 'mid', 'long'][g % 3], seed: g * 31 + 5 });
    R.autoplay(s); // โยน error ถ้าคอมเลือกผิด
    assert.strictEqual(s.phase, 'over');
  }
});

// 900 เกม: ค่าคลาดเคลื่อนสุ่ม ~1.6% → กรอบ 27–40% (ผลจริง 3000 เกม ≈ 33/32/34 · ดู tests/realm-sim.js)
test('สมดุลคร่าว ๆ: 3 คน 900 เกม อัตราชนะทุกที่นั่ง 27–40% · ยึดเมืองได้เฉลี่ย ≥ 3 เมือง', function () {
  var wins = [0, 0, 0];
  var owned = 0;
  var G = 900;
  for (var g = 0; g < G; g++) {
    var s = game(3, 5000 + g, 'mid');
    R.autoplay(s);
    if (s.result.winner >= 0) wins[s.result.winner]++;
    owned += s.towns.filter(function (t) {
      return t.owner >= 0;
    }).length;
  }
  wins.forEach(function (w, i) {
    var r = w / G;
    assert.ok(r >= 0.27 && r <= 0.4, 'ที่นั่ง ' + (i + 1) + ' ชนะ ' + (r * 100).toFixed(1) + '%');
  });
  assert.ok(owned / G >= 3, 'ยึดเมืองเฉลี่ย ' + (owned / G).toFixed(1));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
