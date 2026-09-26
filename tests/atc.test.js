/*
 * เทสตรรกะหอบังคับการบิน — รันด้วย:  node tests/atc.test.js
 * (ไฟล์นี้ไม่ได้อยู่ในรายการเก็บออฟไลน์ของ service worker — ใช้ตอนพัฒนาเท่านั้น)
 */
'use strict';

var assert = require('assert');
var A = require('../games/atc/engine.js');

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

function near(a, b, eps, msg) {
  assert.ok(Math.abs(a - b) <= (eps || 1e-6), (msg || '') + ' ได้ ' + a + ' ควรเป็น ' + b);
}

function plane(type, x, y, heading, id) {
  return { id: id || 1, type: type, x: x, y: y, heading: heading, rot: heading, path: [], state: 'fly', wait: 0, inside: true, land: 0 };
}

var UP = -Math.PI / 2;
var DOWN = Math.PI / 2;
var RIGHT = 0;
var LEFT = Math.PI;

console.log('หอบังคับการบิน — engine self-tests');

var F = A.makeField(160);
var JET = F.runways[0];
var SMALL = F.runways[1];

test('สนาม: รันเวย์ยาวบินขึ้นทางบน · รันเวย์สั้นบินไปทางขวา · ลานจอดอยู่ในจอ', function () {
  assert.strictEqual(JET.type, 'jet');
  near(JET.dir, UP, 1e-9, 'ทิศรันเวย์ยาว');
  assert.strictEqual(SMALL.type, 'small');
  near(SMALL.dir, RIGHT, 1e-9, 'ทิศรันเวย์สั้น');
  assert.ok(JET.len > SMALL.len, 'รันเวย์ยาวต้องยาวกว่า');
  assert.ok(F.pad.x > 0 && F.pad.x < 100 && F.pad.y > 0 && F.pad.y < F.h);
  // จอเตี้ย/สูงผิดปกติ ถูกบีบให้อยู่ในช่วง
  assert.strictEqual(A.makeField(50).h, 120);
  assert.strictEqual(A.makeField(900).h, 220);
});

test('ลงจอด: ถูกแบบ + ถูกทิศ + อยู่ปากรันเวย์ = ลงได้', function () {
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x1, JET.y1 + 2, UP), JET);
  assert.strictEqual(A.landingTarget(F, 'small', SMALL.x1 - 2, SMALL.y1, RIGHT), SMALL);
  // คลาดทิศ 40° ยังได้
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x1, JET.y1, UP + (40 * Math.PI) / 180), JET);
});

test('ลงจอดไม่ได้: ผิดทิศ · ผิดแบบ · เข้าปลายผิดด้าน · ห่างรันเวย์', function () {
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x1, JET.y1, DOWN), null, 'ผิดทิศ (สวนทาง)');
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x1, JET.y1, RIGHT), null, 'ตั้งฉาก 90°');
  assert.strictEqual(A.landingTarget(F, 'small', JET.x1, JET.y1, UP), null, 'เครื่องเล็กลงรันเวย์ยาวไม่ได้');
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x2, JET.y2, UP), null, 'ปลายไกล (ไม่มีลูกศร)');
  assert.strictEqual(A.landingTarget(F, 'jet', JET.x1 + 15, JET.y1, UP), null, 'ห่างเกิน');
});

test('เฮลิคอปเตอร์: ลงลานจอดได้ทุกทิศ แต่ลงรันเวย์ไม่ได้', function () {
  [UP, DOWN, LEFT, RIGHT, 1].forEach(function (h) {
    assert.strictEqual(A.landingTarget(F, 'heli', F.pad.x + 2, F.pad.y - 1, h), F.pad);
  });
  assert.strictEqual(A.landingTarget(F, 'heli', JET.x1, JET.y1, UP), null);
  assert.strictEqual(A.landingTarget(F, 'jet', F.pad.x, F.pad.y, UP), null);
});

test('เส้นทาง: เติมจุดห่างเท่ากัน · ขยับนิดเดียวไม่เพิ่มจุด · ไม่หลุดขอบสนาม', function () {
  var path = [];
  var n = A.extendPath(path, { x: 10, y: 10 }, { x: 20, y: 10 }, 2);
  assert.strictEqual(n, 5);
  near(path[4].x, 20, 1e-9);
  assert.strictEqual(A.extendPath(path, null, { x: 21, y: 10 }, 2), 0);
  A.extendPath(path, null, { x: 20, y: -50 }, 2, F);
  path.forEach(function (p) {
    assert.ok(p.y >= 1 && p.x <= 99, 'จุดหลุดขอบ ' + JSON.stringify(p));
  });
});

test('resample: ระยะห่างเท่ากันทุกช่วง แม้จุดเดิมห่างไม่เท่ากัน', function () {
  var pts = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 5 }];
  var out = A.resample(pts, 2);
  assert.deepStrictEqual(out[0], { x: 0, y: 0 });
  assert.strictEqual(out.length, 7); // ยาว 12 → จุดที่ 0,2,4,...,12
  for (var i = 1; i < out.length; i++) {
    // วัดตามแนวเส้น (มุมหักอยู่ที่ x=7) — เช็คว่าไม่มีช่วงไหนยาวเกิน 2
    assert.ok(A.dist(out[i].x, out[i].y, out[i - 1].x, out[i - 1].y) <= 2 + 1e-9);
  }
  near(out[3].x, 6, 1e-9);
  near(out[4].x, 7, 1e-9);
  near(out[4].y, 1, 1e-9);
});

test('smoothPath: หัวท้ายคงเดิม · จำนวนจุดเท่าเดิม · มุมหักถูกลบให้มน', function () {
  var zig = [{ x: 0, y: 0 }, { x: 2, y: 4 }, { x: 4, y: 0 }, { x: 6, y: 4 }, { x: 8, y: 0 }];
  var s = A.smoothPath(zig, 2);
  assert.strictEqual(s.length, zig.length);
  assert.deepStrictEqual(s[0], zig[0]);
  assert.deepStrictEqual(s[4], zig[4]);
  assert.ok(s[1].y < 4 && s[2].y > 0, 'จุดกลางถูกเกลี่ย');
  assert.deepStrictEqual(zig[1], { x: 2, y: 4 }, 'ไม่แก้ array เดิม');
});

test('เคลื่อนที่: ไม่มีเส้นทาง = บินตรง ตามความเร็วของแบบ', function () {
  var p = plane('small', 50, 80, RIGHT);
  A.stepPlane(p, 1, F);
  near(p.x, 50 + A.TYPES.small.speed, 1e-9);
  near(p.y, 80, 1e-9);
  assert.ok(A.TYPES.jet.speed > A.TYPES.small.speed && A.TYPES.small.speed > A.TYPES.heli.speed, 'ใหญ่เร็วสุด เฮลิช้าสุด');
  assert.ok(A.TYPES.jet.r > A.TYPES.small.r, 'ใหญ่ตัวใหญ่กว่า');
});

test('เคลื่อนที่: บินตามเส้นทาง กินจุดที่ผ่านแล้ว หันหัวตามเส้น', function () {
  var p = plane('heli', 10, 10, RIGHT);
  p.path = [{ x: 12, y: 10 }, { x: 12, y: 12 }, { x: 12, y: 30 }];
  A.stepPlane(p, 1, F); // เฮลิ 4.6 หน่วย: ไป 2 ทางขวา แล้วลง 2.6
  near(p.x, 12, 1e-9);
  near(p.y, 12.6, 1e-9);
  assert.strictEqual(p.path.length, 1);
  near(p.heading, DOWN, 1e-9);
});

test('ขอบจอ: ไม่มีเส้นทางแล้วชนขอบ = เลี้ยวกลับเข้าจอ', function () {
  var p = plane('small', 99, 60, RIGHT);
  A.stepPlane(p, 0.1, F);
  assert.ok(Math.cos(p.heading) < 0, 'หันกลับไปทางซ้าย');
  var q = plane('small', 50, 0.5, UP);
  A.stepPlane(q, 0.1, F);
  assert.ok(Math.sin(q.heading) > 0, 'หันกลับลงล่าง');
});

test('ยังไม่เข้าจอ (รอเข้า) = ไม่ขยับ ไม่ชนใคร', function () {
  var p = plane('jet', -3, 50, RIGHT);
  p.wait = 1;
  A.stepPlane(p, 0.5, F);
  near(p.x, -3, 1e-9);
  var q = plane('jet', -3, 50, RIGHT, 2);
  assert.strictEqual(A.proximity([p, q]).crash, null);
});

test('ใกล้กันเกินไป = เตือนทั้งคู่ · ทับกัน = ชน', function () {
  var a = plane('small', 50, 50, RIGHT, 1);
  var b = plane('small', 58, 50, LEFT, 2);
  var c = plane('small', 90, 10, LEFT, 3);
  var r = A.proximity([a, b, c]);
  assert.strictEqual(r.crash, null);
  assert.ok(r.warn[1] && r.warn[2] && !r.warn[3]);
  b.x = 53;
  r = A.proximity([a, b, c]);
  assert.ok(r.crash, 'ควรชน');
  near(r.crash.x, 51.5, 1e-9);
  // เครื่องที่กำลังลงจอดไม่นับชน
  b.state = 'landing';
  assert.strictEqual(A.proximity([a, b]).crash, null);
});

test('เส้นทางเข้าปากรันเวย์ถูกทิศ → pathLands บอกล่วงหน้าว่าจะลงได้', function () {
  var p = plane('jet', JET.x1, JET.y1 + 30, UP);
  A.extendPath(p.path, p, { x: JET.x1, y: JET.y1 - 4 }, 2, F);
  var hit = A.pathLands(p, F);
  assert.ok(hit && hit.target === JET);
  // เส้นทางย้อนจากบนลงล่าง (ผิดทิศ) = ไม่ลง
  var q = plane('jet', JET.x1, JET.y1 - 30, DOWN);
  A.extendPath(q.path, q, { x: JET.x1, y: JET.y1 + 10 }, 2, F);
  assert.strictEqual(A.pathLands(q, F), null);
});

test('จำลองจริง: เครื่องใหญ่บินตามเส้นเข้ารันเวย์ → ลงจอด นับ 1 ลำ', function () {
  var world = A.createWorld(F, 1);
  world.next = 999; // ปิดการเกิดเครื่องใหม่
  var p = plane('jet', JET.x1 - 20, JET.y1 + 25, RIGHT, 99);
  world.planes.push(p);
  A.extendPath(p.path, p, { x: JET.x1, y: JET.y1 + 12 }, 2, F);
  A.extendPath(p.path, p, { x: JET.x1, y: JET.y1 - 3 }, 2, F);
  p.path = A.smoothPath(p.path, 2);
  var landedAt = -1;
  for (var t = 0; t < 40 * 20 && landedAt < 0; t++) {
    var ev = A.update(world, 1 / 20);
    if (ev.landed) landedAt = t;
  }
  assert.ok(landedAt > 0, 'ไม่ได้ลงจอด');
  assert.strictEqual(world.landed, 1);
  assert.strictEqual(world.planes.length, 0);
});

test('จำลองจริง: เฮลิคอปเตอร์บินผ่านลานจอด → ลงจอด', function () {
  var world = A.createWorld(F, 2);
  world.next = 999;
  world.planes.push(plane('heli', F.pad.x - 20, F.pad.y, RIGHT, 5));
  for (var t = 0; t < 400 && !world.landed; t++) A.update(world, 1 / 20);
  assert.strictEqual(world.landed, 1);
});

test('จำลองจริง: สองลำบินสวนกัน → ชน จบเกม และหยุดเดินเวลา', function () {
  var world = A.createWorld(F, 3);
  world.next = 999;
  world.planes.push(plane('small', 30, 20, RIGHT, 1));
  world.planes.push(plane('small', 70, 20, LEFT, 2));
  var crash = null;
  for (var t = 0; t < 200 && !crash; t++) crash = A.update(world, 1 / 20).crash;
  assert.ok(crash, 'ควรชน');
  assert.strictEqual(world.over, true);
  var tt = world.t;
  A.update(world, 1);
  assert.strictEqual(world.t, tt, 'จบแล้วเวลาไม่เดิน');
});

test('ช่วงเกิดเครื่องใหม่: เริ่ม 8 วิ เร็วขึ้นเรื่อย ๆ ไม่ต่ำกว่า 2.6 วิ', function () {
  near(A.spawnInterval(0), 8, 1e-9);
  var prev = Infinity;
  for (var t = 0; t <= 600; t += 10) {
    var s = A.spawnInterval(t);
    assert.ok(s <= prev, 'ต้องไม่ช้าลง');
    assert.ok(s >= 2.6);
    prev = s;
  }
  near(A.spawnInterval(600), 2.6, 1e-9);
});

test('เกิดเครื่องใหม่: มาจากนอกจอ หันเข้าจอ มีเวลาเตือนก่อนเข้า · ครบ 3 แบบ · seed เดิมได้ผลเดิม', function () {
  function run(seed) {
    var w = A.createWorld(F, seed);
    var types = {};
    var log = [];
    for (var k = 0; k < 60; k++) {
      var p = A.makePlane(w);
      types[p.type] = true;
      log.push(p.type + Math.round(p.x) + ',' + Math.round(p.y));
      var outside = p.x < 0 || p.x > 100 || p.y < 0 || p.y > F.h;
      assert.ok(outside, 'ต้องเกิดนอกจอ');
      // หันเข้าหากลางจอ
      var toCx = 50 - p.x;
      var toCy = F.h / 2 - p.y;
      assert.ok(Math.cos(p.heading) * toCx + Math.sin(p.heading) * toCy > 0, 'ต้องหันเข้าจอ');
      assert.strictEqual(p.wait, A.ENTRY_WAIT);
    }
    assert.ok(types.small && types.jet && types.heli, 'ต้องมีครบ 3 แบบ');
    return log.join('|');
  }
  assert.strictEqual(run(42), run(42));
  assert.notStrictEqual(run(42), run(43));
});

test('โลกเดินเอง 3 นาทีโดยไม่มีคนคุม: เครื่องเกิดเร็วขึ้นตามเวลา · ค่าไม่เพี้ยน (NaN)', function () {
  var world = A.createWorld(F, 7);
  var early = 0;
  var late = 0;
  for (var t = 0; t < 180 * 30 && !world.over; t++) {
    var ev = A.update(world, 1 / 30);
    if (world.t < 60) early += ev.spawned;
    else if (world.t >= 120) late += ev.spawned;
    world.planes.forEach(function (p) {
      assert.ok(isFinite(p.x) && isFinite(p.y) && isFinite(p.heading), 'ค่าตำแหน่งเพี้ยน');
    });
  }
  if (!world.over) assert.ok(late > early, 'นาทีหลังต้องมีเครื่องมาถี่กว่า (' + early + ' vs ' + late + ')');
  assert.ok(world.seq > 3, 'ต้องมีเครื่องเกิด');
});

test('แตะเลือกเครื่อง: เลือกลำที่ใกล้สุดในรัศมี ข้ามลำที่ยังไม่เข้าจอ/กำลังลง', function () {
  var a = plane('small', 50, 50, RIGHT, 1);
  var b = plane('jet', 56, 50, RIGHT, 2);
  var c = plane('heli', 51, 51, RIGHT, 3);
  c.state = 'landing';
  var d = plane('small', 49, 49, RIGHT, 4);
  d.wait = 1;
  assert.strictEqual(A.pickPlane([a, b, c, d], 55, 50, 8), b);
  assert.strictEqual(A.pickPlane([a, b, c, d], 51, 50, 8), a);
  assert.strictEqual(A.pickPlane([a, b, c, d], 90, 90, 8), null);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
