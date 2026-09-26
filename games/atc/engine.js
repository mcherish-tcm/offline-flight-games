/*
 * หอบังคับการบิน — ตรรกะล้วน (ไม่มีภาพ) · ใช้ได้ทั้งในเบราว์เซอร์ (window.ATC) และใน node (require)
 *
 * โลกของเกม: กว้าง 100 หน่วยเสมอ · สูง h หน่วย (ตามสัดส่วนจอ, 120–220) · แกน y ชี้ลง · มุม (heading) เป็นเรเดียน, 0 = ไปทางขวา
 * อากาศยาน 3 แบบ: small = เครื่องบินเล็ก → รันเวย์สั้น · jet = เครื่องบินใหญ่ → รันเวย์ยาว · heli = เฮลิคอปเตอร์ → ลานจอด H
 * ลงจอด = เข้า "ปากรันเวย์" (ปลายที่มีลูกศร) ของสีเดียวกัน โดยหันหัวไปตามทิศรันเวย์ (คลาดได้ไม่เกิน 55°) · เฮลิคอปเตอร์ลงลานจอดทิศไหนก็ได้
 * ชนกัน = จบเกม · ใกล้กันเกินไป = เตือน
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ATC = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = 100;
  var TYPES = {
    small: { speed: 6.5, r: 2.5, label: 'เครื่องบินเล็ก' },
    jet: { speed: 8.8, r: 3.4, label: 'เครื่องบินใหญ่' },
    heli: { speed: 4.6, r: 2.5, label: 'เฮลิคอปเตอร์' }
  };
  var HEADING_TOL = (55 * Math.PI) / 180;
  var WARN_GAP = 8; // หน่วย · ระยะห่างขอบถึงขอบที่เริ่มเตือน
  var ENTRY_WAIT = 2.2; // วินาที · ขึ้นลูกศรเตือนที่ขอบจอก่อนเครื่องบินเข้ามา
  var SPACING = 2; // หน่วย · ระยะห่างจุดบนเส้นทางที่วาด
  var STEP = 1 / 50; // วินาที · ขั้นจำลองย่อย (กันเครื่องบินทะลุกันเมื่อเครื่องช้า)

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
  }

  function angleDiff(a, b) {
    var d = (a - b) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  }

  /* ---------- สนามบิน ---------- */
  function runway(type, x1, y1, x2, y2, width) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var len = Math.hypot(dx, dy);
    return { type: type, x1: x1, y1: y1, x2: x2, y2: y2, width: width, len: len, ux: dx / len, uy: dy / len, dir: Math.atan2(dy, dx) };
  }

  /*
   * ผังสำหรับจอแนวตั้ง:
   *  - รันเวย์ยาว (เครื่องบินใหญ่) แนวตั้งฝั่งซ้าย · ปากรันเวย์อยู่ปลายล่าง บินขึ้นไปทางบน
   *  - รันเวย์สั้น (เครื่องบินเล็ก) แนวนอนฝั่งขวา · ปากรันเวย์อยู่ปลายซ้าย บินไปทางขวา
   *  - ลานจอดเฮลิคอปเตอร์ (H) มุมขวาล่าง
   * แต่ละเป้าหันคนละทิศ → เส้นทางเข้าไม่ทับกัน และมีที่ว่างให้เลี้ยวก่อนเข้าปากรันเวย์
   */
  function makeField(h) {
    h = Math.max(120, Math.min(220, h || 160));
    return {
      w: W,
      h: h,
      runways: [runway('jet', 30, h * 0.72, 30, h * 0.72 - Math.min(70, h * 0.42), 7.5), runway('small', 54, h * 0.44, 86, h * 0.44, 6.5)],
      pad: { type: 'heli', x: 73, y: h * 0.75, r: 6.5 }
    };
  }

  // จุดนี้อยู่ใน "ปากรันเวย์" ไหม (ช่วงสั้น ๆ รอบปลายที่มีลูกศร)
  function inEntry(rw, x, y) {
    var dx = x - rw.x1;
    var dy = y - rw.y1;
    var along = dx * rw.ux + dy * rw.uy;
    var across = Math.abs(-dx * rw.uy + dy * rw.ux);
    return along >= -5 && along <= 8 && across <= rw.width / 2 + 2.5;
  }

  // อากาศยานแบบ type ที่ (x, y) หันหัว heading → ลงเป้าไหนได้ (null = ไม่ได้)
  function landingTarget(field, type, x, y, heading) {
    if (type === 'heli') {
      var p = field.pad;
      return dist(x, y, p.x, p.y) <= p.r ? p : null;
    }
    for (var k = 0; k < field.runways.length; k++) {
      var rw = field.runways[k];
      if (rw.type === type && inEntry(rw, x, y) && angleDiff(heading, rw.dir) <= HEADING_TOL) return rw;
    }
    return null;
  }

  /* ---------- เส้นทาง ---------- */
  function clampPt(field, pt) {
    return { x: Math.max(1, Math.min(field.w - 1, pt.x)), y: Math.max(1, Math.min(field.h - 1, pt.y)) };
  }

  // ต่อเส้นทาง path (เริ่มจาก from ถ้ายังว่าง) ไปถึง pt โดยเติมจุดห่างกัน spacing เท่า ๆ กัน · คืนจำนวนจุดที่เพิ่ม
  function extendPath(path, from, pt, spacing, field) {
    spacing = spacing || SPACING;
    if (field) pt = clampPt(field, pt);
    var last = path.length ? path[path.length - 1] : from;
    var dx = pt.x - last.x;
    var dy = pt.y - last.y;
    var L = Math.hypot(dx, dy);
    if (L < spacing) return 0;
    var n = Math.floor(L / spacing);
    for (var k = 1; k <= n; k++) path.push({ x: last.x + (dx * k * spacing) / L, y: last.y + (dy * k * spacing) / L });
    return n;
  }

  // สุ่มจุดใหม่ให้ห่างเท่ากันตลอดเส้น (ความยาวรวมเท่าเดิม) — จุดแรกคงเดิม
  function resample(points, spacing) {
    if (points.length < 2) return points.slice();
    var out = [{ x: points[0].x, y: points[0].y }];
    var carry = 0;
    for (var i = 1; i < points.length; i++) {
      var a = points[i - 1];
      var b = points[i];
      var seg = dist(a.x, a.y, b.x, b.y);
      var d = spacing - carry;
      while (d <= seg) {
        out.push({ x: a.x + ((b.x - a.x) * d) / seg, y: a.y + ((b.y - a.y) * d) / seg });
        d += spacing;
      }
      carry = seg - (d - spacing);
    }
    return out;
  }

  // ทำให้เส้นเรียบ (เฉลี่ยกับจุดข้าง ๆ) · จุดแรก/จุดสุดท้ายคงเดิม · จำนวนจุดเท่าเดิม
  function smoothPath(points, passes) {
    var p = points.map(function (q) {
      return { x: q.x, y: q.y };
    });
    for (var n = 0; n < (passes || 1); n++) {
      var next = p.map(function (q) {
        return { x: q.x, y: q.y };
      });
      for (var i = 1; i < p.length - 1; i++) {
        next[i].x = (p[i - 1].x + 2 * p[i].x + p[i + 1].x) / 4;
        next[i].y = (p[i - 1].y + 2 * p[i].y + p[i + 1].y) / 4;
      }
      p = next;
    }
    return p;
  }

  // เส้นทางของเครื่องนี้พาไปลงจอดได้ไหม → { i: จุดที่เริ่มลง, target } หรือ null
  function pathLands(plane, field) {
    var px = plane.x;
    var py = plane.y;
    for (var i = 0; i < plane.path.length; i++) {
      var q = plane.path[i];
      var hd = Math.atan2(q.y - py, q.x - px);
      var t = landingTarget(field, plane.type, q.x, q.y, hd);
      if (t) return { i: i, target: t };
      px = q.x;
      py = q.y;
    }
    return null;
  }

  // เครื่องที่ใกล้จุดแตะที่สุด (ในรัศมี) ที่ยังบินอยู่และเข้าจอแล้ว
  function pickPlane(planes, x, y, radius) {
    var best = null;
    var bd = Infinity;
    planes.forEach(function (p) {
      if (p.state !== 'fly' || p.wait > 0) return;
      var d = dist(p.x, p.y, x, y);
      var lim = Math.max(radius || 8, TYPES[p.type].r + 5);
      if (d <= lim && d < bd) {
        bd = d;
        best = p;
      }
    });
    return best;
  }

  /* ---------- การเคลื่อนที่ ---------- */
  function moveAlong(p, d) {
    while (d > 0 && p.path.length) {
      var q = p.path[0];
      var dx = q.x - p.x;
      var dy = q.y - p.y;
      var L = Math.hypot(dx, dy);
      if (L < 1e-6) {
        p.path.shift();
        continue;
      }
      p.heading = Math.atan2(dy, dx);
      if (L <= d) {
        p.x = q.x;
        p.y = q.y;
        d -= L;
        p.path.shift();
      } else {
        p.x += (dx / L) * d;
        p.y += (dy / L) * d;
        d = 0;
      }
    }
    if (d > 0) {
      p.x += Math.cos(p.heading) * d;
      p.y += Math.sin(p.heading) * d;
    }
  }

  function startLanding(p, t) {
    p.state = 'landing';
    p.land = 0;
    if (t.type === 'heli') {
      p.path = [{ x: t.x, y: t.y }];
    } else {
      p.path = [
        { x: t.x1 + t.ux * 6, y: t.y1 + t.uy * 6 },
        { x: t.x1 + t.ux * t.len * 0.85, y: t.y1 + t.uy * t.len * 0.85 }
      ];
    }
  }

  // เดิน 1 ขั้น · คืน 'landed' เมื่อลงจอดเสร็จ (ลบออกจากจอได้)
  function stepPlane(p, dt, field) {
    if (p.wait > 0) {
      p.wait -= dt;
      return null;
    }
    var T = TYPES[p.type];
    p.age = (p.age || 0) + dt;
    if (p.state === 'landing') {
      p.land += dt;
      moveAlong(p, T.speed * (p.type === 'heli' ? 0.7 : 0.9) * dt);
      if (!p.path.length) {
        if (p.type !== 'heli') return 'landed';
        p.settle = (p.settle || 0) + dt;
        if (p.settle >= 0.6) return 'landed';
      }
      p.rot = turnToward(p.rot, p.heading, dt * 8);
      return null;
    }
    moveAlong(p, T.speed * dt);
    p.rot = turnToward(p.rot, p.heading, dt * 8);
    var r = T.r;
    if (!p.inside && p.x >= r && p.x <= field.w - r && p.y >= r && p.y <= field.h - r) p.inside = true;
    if (p.inside && !p.path.length) {
      // ไม่มีเส้นทาง: ชนขอบจอแล้วเลี้ยวกลับเข้ามา
      var c = Math.cos(p.heading);
      var s = Math.sin(p.heading);
      if ((p.x < r && c < 0) || (p.x > field.w - r && c > 0)) p.heading = Math.PI - p.heading;
      if ((p.y < r && s < 0) || (p.y > field.h - r && s > 0)) p.heading = -p.heading;
    }
    var t = landingTarget(field, p.type, p.x, p.y, p.heading);
    if (t) startLanding(p, t);
    return null;
  }

  function turnToward(a, b, k) {
    if (a == null) return b;
    var d = (b - a) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return a + d * Math.min(1, k);
  }

  /* ---------- ระยะใกล้ / ชน ---------- */
  function proximity(planes) {
    var warn = {};
    var crash = null;
    var live = planes.filter(function (p) {
      return p.state === 'fly' && !(p.wait > 0);
    });
    for (var i = 0; i < live.length; i++) {
      for (var j = i + 1; j < live.length; j++) {
        var a = live[i];
        var b = live[j];
        var rr = TYPES[a.type].r + TYPES[b.type].r;
        var d = dist(a.x, a.y, b.x, b.y);
        if (d < rr * 0.85) {
          if (!crash) crash = { a: a.id, b: b.id, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        } else if (d < rr + WARN_GAP) {
          warn[a.id] = true;
          warn[b.id] = true;
        }
      }
    }
    return { warn: warn, crash: crash };
  }

  /* ---------- เกิดเครื่องบินใหม่ ---------- */
  // ช่วงห่างระหว่างเครื่องใหม่ (วินาที) ตามเวลาที่เล่นไป: 8 วิ ตอนเริ่ม → เร็วขึ้นเรื่อย ๆ จนเหลือ 2.6 วิ (ราว 2.5 นาที)
  function spawnInterval(t) {
    return Math.max(2.6, 8 - t * 0.036);
  }

  function pickType(r) {
    return r < 0.42 ? 'small' : r < 0.76 ? 'jet' : 'heli';
  }

  function makePlane(world) {
    var rnd = world.rnd;
    var f = world.field;
    var type = pickType(rnd());
    var p = null;
    for (var tries = 0; tries < 12; tries++) {
      var edge = Math.floor(rnd() * 4);
      var u = 0.12 + rnd() * 0.76;
      var x;
      var y;
      if (edge === 0) {
        x = u * f.w;
        y = -3;
      } else if (edge === 1) {
        x = f.w + 3;
        y = u * f.h;
      } else if (edge === 2) {
        x = u * f.w;
        y = f.h + 3;
      } else {
        x = -3;
        y = u * f.h;
      }
      var tx = 20 + rnd() * 60;
      var ty = f.h * (0.2 + rnd() * 0.6);
      var far = world.planes.every(function (q) {
        return q.state !== 'fly' || dist(q.x, q.y, x, y) > 24;
      });
      p = { x: x, y: y, heading: Math.atan2(ty - y, tx - x), edge: edge };
      if (far) break;
    }
    world.seq += 1;
    return {
      id: world.seq,
      type: type,
      x: p.x,
      y: p.y,
      heading: p.heading,
      rot: p.heading,
      edge: p.edge,
      path: [],
      state: 'fly',
      wait: ENTRY_WAIT,
      inside: false,
      land: 0,
      age: 0
    };
  }

  /* ---------- โลก ---------- */
  function createWorld(field, seed) {
    return { field: field, t: 0, rnd: rng(seed == null ? 1 : seed), next: 1.0, planes: [], landed: 0, over: false, crash: null, warn: {}, seq: 0 };
  }

  // เดินเวลา dt วินาที → { landed: จำนวนที่เพิ่งลง, spawned, crash }
  function update(world, dt) {
    var ev = { landed: 0, spawned: 0, crash: null };
    if (world.over || !(dt > 0)) return ev;
    var steps = Math.max(1, Math.ceil(dt / STEP));
    var h = dt / steps;
    for (var s = 0; s < steps; s++) {
      world.t += h;
      world.next -= h;
      if (world.next <= 0) {
        world.planes.push(makePlane(world));
        ev.spawned += 1;
        world.next = spawnInterval(world.t) * (0.8 + world.rnd() * 0.4);
      }
      for (var i = world.planes.length - 1; i >= 0; i--) {
        if (stepPlane(world.planes[i], h, world.field) === 'landed') {
          world.planes.splice(i, 1);
          world.landed += 1;
          ev.landed += 1;
        }
      }
      var px = proximity(world.planes);
      world.warn = px.warn;
      if (px.crash) {
        world.over = true;
        world.crash = px.crash;
        ev.crash = px.crash;
        break;
      }
    }
    return ev;
  }

  return {
    W: W,
    TYPES: TYPES,
    HEADING_TOL: HEADING_TOL,
    SPACING: SPACING,
    ENTRY_WAIT: ENTRY_WAIT,
    rng: rng,
    dist: dist,
    angleDiff: angleDiff,
    makeField: makeField,
    inEntry: inEntry,
    landingTarget: landingTarget,
    extendPath: extendPath,
    resample: resample,
    smoothPath: smoothPath,
    pathLands: pathLands,
    pickPlane: pickPlane,
    stepPlane: stepPlane,
    proximity: proximity,
    spawnInterval: spawnInterval,
    pickType: pickType,
    makePlane: makePlane,
    createWorld: createWorld,
    update: update
  };
});
