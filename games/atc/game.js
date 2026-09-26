/*
 * หอบังคับการบิน — ลากนิ้วจากเครื่องบินเพื่อวาดเส้นทาง พาไปลงรันเวย์/ลานจอดสีเดียวกัน ห้ามชนกัน
 * คนเดียว (เก็บสถิติ) หรือ 2 คนผลัดกันเล่นคนละรอบ แล้วเทียบกัน
 * canvas + requestAnimationFrame เฉพาะตอนเล่น · หยุดเองเมื่อสลับแอป/หมุนจอ · สนามบินวาดครั้งเดียวเก็บไว้ (เบาเครื่อง)
 */
(function () {
  'use strict';

  var E = window.ATC;
  var BEST = 'atc:best';
  var DUO = 'atc:duo';
  var NAMES = ['แดง', 'ฟ้า'];

  var wrap = document.getElementById('wrap');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title');
  var ovText = document.getElementById('ov-text');
  var ovLegend = document.getElementById('ov-legend');
  var ovMode = document.getElementById('ov-mode');
  var ovGo = document.getElementById('ov-go');
  var pauseBtn = document.getElementById('pause');
  var scoreEl = document.getElementById('score');
  var scoreLabel = document.getElementById('score-label');
  var bestEl = document.getElementById('best');
  var bestLabel = document.getElementById('best-label');

  var mode = FG.store.get('atc:mode', 'solo') === 'duo' ? 'duo' : 'solo';
  var status = 'ready'; // ready | play | paused | over | handoff
  var field = null;
  var world = null;
  var seed = 1;
  var round = 0; // 2 คน: 0 = แดงเล่น · 1 = ฟ้าเล่น
  var duoScores = [0, 0];
  var colors = {};
  var cssW = 0;
  var cssH = 0;
  var dpr = 1;
  var scale = 1;
  var offX = 0;
  var offY = 0;
  var ground = null;
  var raf = 0;
  var lastTs = 0;
  var clock = 0;
  var drags = {};
  var shownAt = 0;
  var overTimer = 0;

  /* ---------- ขนาด + สี ---------- */
  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(n) {
      return cs.getPropertyValue(n).trim();
    }
    colors = {
      ground: v('--atc-ground'),
      grid: v('--atc-grid'),
      asphalt: v('--atc-asphalt'),
      mark: v('--atc-mark'),
      jet: v('--atc-jet'),
      small: v('--atc-small'),
      heli: v('--atc-heli'),
      outline: v('--atc-outline'),
      warn: v('--atc-warn')
    };
  }

  function fitField() {
    field = E.makeField((100 * cssH) / Math.max(1, cssW));
  }

  function layout() {
    cssW = wrap.clientWidth;
    cssH = wrap.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    if (!field) fitField();
    scale = Math.min(cssW / field.w, cssH / field.h);
    offX = (cssW - field.w * scale) / 2;
    offY = (cssH - field.h * scale) / 2;
    buildGround();
  }

  function worldTransform(c) {
    c.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offX, dpr * offY);
  }

  /* ---------- วาดสนามบิน (ครั้งเดียว เก็บไว้ใน canvas แยก) ---------- */
  function buildGround() {
    if (!ground) ground = document.createElement('canvas');
    ground.width = canvas.width;
    ground.height = canvas.height;
    var g = ground.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = colors.ground;
    g.fillRect(0, 0, ground.width, ground.height);
    worldTransform(g);
    // จุดตาราง
    g.fillStyle = colors.grid;
    for (var x = 5; x < field.w; x += 10) for (var y = 5; y < field.h; y += 10) g.fillRect(x - 0.35, y - 0.35, 0.7, 0.7);
    field.runways.forEach(function (rw) {
      drawRunway(g, rw);
    });
    drawPad(g, field.pad);
  }

  function drawRunway(g, rw) {
    var col = colors[rw.type];
    var hw = rw.width / 2;
    g.save();
    g.translate(rw.x1, rw.y1);
    g.rotate(rw.dir);
    // ตัวรันเวย์
    g.fillStyle = colors.asphalt;
    roundRect(g, -1, -hw, rw.len + 2, rw.width, 1.2);
    g.fill();
    g.strokeStyle = colors.mark;
    g.globalAlpha = 0.55;
    g.lineWidth = 0.25;
    g.beginPath();
    g.moveTo(0, -hw + 0.6);
    g.lineTo(rw.len, -hw + 0.6);
    g.moveTo(0, hw - 0.6);
    g.lineTo(rw.len, hw - 0.6);
    g.stroke();
    // เส้นกลาง
    g.globalAlpha = 0.8;
    g.lineWidth = 0.35;
    g.setLineDash([2.2, 1.8]);
    g.beginPath();
    g.moveTo(8, 0);
    g.lineTo(rw.len - 3, 0);
    g.stroke();
    g.setLineDash([]);
    // ปากรันเวย์: แถบสีของเป้า + ลายขาว
    g.globalAlpha = 1;
    g.fillStyle = col;
    g.fillRect(0, -hw, 1.1, rw.width);
    g.fillStyle = colors.mark;
    for (var k = -hw + 1; k < hw - 0.8; k += 1.3) g.fillRect(2, k, 3.4, 0.6);
    // ลูกศรนำทางก่อนเข้า (ชี้ทิศที่ต้องบินเข้า)
    g.strokeStyle = col;
    g.lineWidth = 0.7;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (var c = 0; c < 3; c++) {
      var ax = -3 - c * 3.2;
      g.globalAlpha = 1 - c * 0.28;
      g.beginPath();
      g.moveTo(ax - 1.4, -2);
      g.lineTo(ax, 0);
      g.lineTo(ax - 1.4, 2);
      g.stroke();
    }
    // ป้ายแบบเครื่องบินที่ปลายรันเวย์
    g.globalAlpha = 1;
    g.translate(rw.len - 6, 0);
    g.rotate(-rw.dir);
    badge(g, rw.type, col);
    g.restore();
  }

  function drawPad(g, p) {
    g.save();
    g.translate(p.x, p.y);
    g.fillStyle = colors.asphalt;
    g.beginPath();
    g.arc(0, 0, p.r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = colors.heli;
    g.lineWidth = 0.8;
    g.beginPath();
    g.arc(0, 0, p.r - 0.9, 0, Math.PI * 2);
    g.stroke();
    // ตัว H
    g.lineWidth = 0.9;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(-1.8, -2.4);
    g.lineTo(-1.8, 2.4);
    g.moveTo(1.8, -2.4);
    g.lineTo(1.8, 2.4);
    g.moveTo(-1.8, 0);
    g.lineTo(1.8, 0);
    g.strokeStyle = colors.mark;
    g.stroke();
    g.restore();
  }

  function badge(g, type, col) {
    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = colors.asphalt;
    g.beginPath();
    g.arc(0, 0, 3.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = col;
    g.lineWidth = 0.4;
    g.stroke();
    g.rotate(-Math.PI / 2);
    g.scale(0.55, 0.55);
    craft(g, type, col, 0);
    g.restore();
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------- อากาศยาน (หัวชี้ +x) ---------- */
  function poly(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
  }

  function craft(g, type, col, t) {
    g.fillStyle = col;
    g.strokeStyle = colors.outline;
    g.lineWidth = 0.35;
    g.lineJoin = 'round';
    if (type === 'jet') {
      poly(g, [4.4, 0, 3.4, -0.75, -3.6, -0.7, -4.4, 0, -3.6, 0.7, 3.4, 0.75]);
      g.fill();
      g.stroke();
      poly(g, [1.2, -0.6, -1.4, -4.4, -2.5, -4.4, -1.2, -0.6, -1.2, 0.6, -2.5, 4.4, -1.4, 4.4, 1.2, 0.6]);
      g.fill();
      g.stroke();
      poly(g, [-3, -0.5, -4.1, -2, -4.7, -2, -4.3, 0, -4.7, 2, -4.1, 2, -3, 0.5]);
      g.fill();
      g.stroke();
    } else if (type === 'small') {
      poly(g, [2.9, 0, 2.3, -0.55, -2.6, -0.4, -2.9, 0, -2.6, 0.4, 2.3, 0.55]);
      g.fill();
      g.stroke();
      poly(g, [1.1, -3.1, 0, -3.1, 0, 3.1, 1.1, 3.1]);
      g.fill();
      g.stroke();
      poly(g, [-1.9, -1.3, -2.6, -1.3, -2.6, 1.3, -1.9, 1.3]);
      g.fill();
      g.stroke();
    } else {
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-0.8, 0);
      g.lineTo(-3.6, 0);
      g.lineWidth = 0.7;
      g.strokeStyle = col;
      g.stroke();
      g.fillRect(-3.9, -1, 0.5, 2);
      g.beginPath();
      g.ellipse(0, 0, 1.9, 1.35, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = colors.outline;
      g.lineWidth = 0.35;
      g.stroke();
      // ใบพัดหมุน
      var a = t * 18;
      g.strokeStyle = colors.mark;
      g.lineWidth = 0.4;
      g.globalAlpha *= 0.85;
      g.beginPath();
      g.moveTo(Math.cos(a) * 3.3, Math.sin(a) * 3.3);
      g.lineTo(-Math.cos(a) * 3.3, -Math.sin(a) * 3.3);
      g.moveTo(Math.cos(a + 1.57) * 3.3, Math.sin(a + 1.57) * 3.3);
      g.lineTo(-Math.cos(a + 1.57) * 3.3, -Math.sin(a + 1.57) * 3.3);
      g.stroke();
    }
  }

  /* ---------- วาดทั้งฉาก ---------- */
  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(ground, 0, 0);
    if (!world) return;
    worldTransform(ctx);
    var t = clock;
    var planes = world.planes;
    var i;
    var p;

    // เส้นทาง
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (i = 0; i < planes.length; i++) {
      p = planes[i];
      if (!p.path.length || p.state !== 'fly') continue;
      var lands = E.pathLands(p, field);
      var end = lands ? lands.i + 1 : p.path.length;
      ctx.strokeStyle = colors[p.type];
      ctx.globalAlpha = lands ? 0.95 : 0.6;
      ctx.lineWidth = lands ? 0.75 : 0.55;
      ctx.setLineDash(lands ? [] : [1.5, 1.3]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      for (var k = 0; k < end; k++) ctx.lineTo(p.path[k].x, p.path[k].y);
      ctx.stroke();
      ctx.setLineDash([]);
      var last = p.path[end - 1];
      ctx.fillStyle = colors[p.type];
      ctx.beginPath();
      ctx.arc(last.x, last.y, lands ? 1.2 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // เครื่องที่กำลังจะเข้าจอ: ลูกศรกะพริบที่ขอบ
    for (i = 0; i < planes.length; i++) {
      p = planes[i];
      if (!(p.wait > 0)) continue;
      var ix = Math.max(3, Math.min(field.w - 3, p.x));
      var iy = Math.max(3, Math.min(field.h - 3, p.y));
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(p.heading);
      ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(t * 5));
      ctx.fillStyle = colors[p.type];
      ctx.strokeStyle = colors.outline;
      ctx.lineWidth = 0.3;
      poly(ctx, [2.2, 0, -1.4, -1.8, -0.6, 0, -1.4, 1.8]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // เครื่องบิน
    for (i = 0; i < planes.length; i++) {
      p = planes[i];
      if (p.wait > 0) continue;
      var s = p.state === 'landing' ? Math.max(0.5, 1 - p.land * 0.3) : 1;
      ctx.save();
      ctx.translate(p.x, p.y);
      if (world.warn[p.id]) {
        ctx.strokeStyle = colors.warn;
        ctx.lineWidth = 0.55;
        ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(t * 9));
        ctx.beginPath();
        ctx.arc(0, 0, E.TYPES[p.type].r + 2.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.rotate(p.rot);
      ctx.scale(s, s);
      if (p.state === 'landing') ctx.globalAlpha = 0.85;
      craft(ctx, p.type, colors[p.type], t + p.id);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // จุดชน
    if (world.crash) {
      var c = world.crash;
      ctx.strokeStyle = colors.warn;
      ctx.fillStyle = colors.warn;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* ---------- รอบเกม ---------- */
  function frame(ts) {
    raf = 0;
    if (status !== 'play') return;
    var dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    clock += dt;
    var ev = E.update(world, dt);
    if (ev.landed) {
      FG.buzz(15);
      paintStats();
    }
    for (var id in drags) {
      var p = drags[id];
      if (p.state !== 'fly' || world.planes.indexOf(p) === -1) delete drags[id];
    }
    draw();
    if (ev.crash) {
      crashed();
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function loop() {
    if (!raf) {
      lastTs = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function startRound() {
    clearTimeout(overTimer);
    fitField();
    layout();
    world = E.createWorld(field, seed);
    drags = {};
    clock = 0;
    status = 'play';
    overlay.hidden = true;
    pauseBtn.disabled = false;
    setPauseIcon();
    paintStats();
    draw();
    loop();
  }

  function startGame() {
    seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    round = 0;
    duoScores = [0, 0];
    startRound();
  }

  function pause() {
    if (status !== 'play') return;
    status = 'paused';
    cancelAnimationFrame(raf);
    raf = 0;
    drags = {};
    setPauseIcon();
    show('หยุดอยู่', 'เครื่องบินทุกลำหยุดรอ แตะเล่นต่อเมื่อพร้อม', 'เล่นต่อ', false);
  }

  function resume() {
    if (status !== 'paused') return;
    status = 'play';
    overlay.hidden = true;
    setPauseIcon();
    loop();
  }

  function crashed() {
    status = 'over';
    drags = {};
    pauseBtn.disabled = true;
    setPauseIcon();
    FG.buzz([60, 40, 140]);
    var n = world.landed;
    var best = FG.store.get(BEST, 0) || 0;
    var isBest = n > best;
    if (isBest) FG.store.set(BEST, n);
    saveHub();
    paintStats();
    overTimer = setTimeout(function () {
      if (mode === 'solo') {
        show('ชนกันแล้ว!', 'ลงจอดได้ <b>' + n + '</b> ลำ' + (isBest && n > 0 ? ' — สถิติใหม่!' : ' · สถิติ ' + Math.max(best, n) + ' ลำ'), 'เล่นอีกครั้ง', true);
        return;
      }
      duoScores[round] = n;
      if (round === 0) {
        status = 'handoff';
        show(
          'แดงได้ ' + n + ' ลำ',
          'ส่งเครื่องให้<b>ฟ้า</b> — ฟ้าต้องลงจอดให้ได้มากกว่า ' + n + ' ลำ (เครื่องบินมาชุดเดียวกัน)',
          'ฟ้าเริ่มเล่น',
          false
        );
        return;
      }
      var tally = FG.store.get(DUO, null);
      if (!tally || !Array.isArray(tally.w)) tally = { w: [0, 0], d: 0 };
      var w = duoScores[0] === duoScores[1] ? 'draw' : duoScores[0] > duoScores[1] ? 0 : 1;
      if (w === 'draw') tally.d += 1;
      else tally.w[w] += 1;
      FG.store.set(DUO, tally);
      saveHub();
      show(
        w === 'draw' ? 'เสมอ!' : NAMES[w] + 'ชนะ!',
        'แดง ' + duoScores[0] + ' ลำ · ฟ้า ' + duoScores[1] + ' ลำ<br>สกอร์รวม: แดง ' + tally.w[0] + ' · ฟ้า ' + tally.w[1] + ' · เสมอ ' + tally.d,
        'เล่นอีกรอบ',
        true
      );
    }, 900);
  }

  function saveHub() {
    var best = FG.store.get(BEST, 0) || 0;
    FG.hubNote('atc', { note: best ? 'สถิติ ' + best + ' ลำ' : '' });
  }

  function paintStats() {
    var n = world ? world.landed : 0;
    var best = FG.store.get(BEST, 0) || 0;
    scoreEl.textContent = n;
    if (mode === 'duo') {
      scoreLabel.textContent = NAMES[round] + ' ลงจอด';
      bestLabel.textContent = round === 1 ? 'แดงได้' : 'สถิติ';
      bestEl.textContent = round === 1 ? duoScores[0] : best;
    } else {
      scoreLabel.textContent = 'ลงจอด';
      bestLabel.textContent = 'สถิติ';
      bestEl.textContent = best;
    }
  }

  /* ---------- หน้าทับ (เริ่ม/หยุด/จบ/ส่งเครื่อง) ---------- */
  var modeChoice = FG.choice(
    [
      { value: 'solo', label: 'คนเดียว' },
      { value: 'duo', label: '2 คนผลัดกัน' }
    ],
    mode,
    function (v) {
      mode = v;
      FG.store.set('atc:mode', v);
      paintStats();
    }
  );
  ovMode.appendChild(modeChoice);

  function show(title, html, go, withMode) {
    ovTitle.textContent = title;
    ovText.innerHTML = html;
    ovGo.lastChild.textContent = go;
    ovMode.hidden = !withMode;
    ovLegend.hidden = !(status === 'ready' || status === 'paused');
    overlay.hidden = false;
    shownAt = Date.now();
  }

  function setPauseIcon() {
    var paused = status !== 'play';
    pauseBtn.innerHTML = FG.icon(paused ? 'play' : 'pause');
    pauseBtn.setAttribute('aria-label', paused ? 'เล่นต่อ' : 'หยุดชั่วคราว');
  }

  ovGo.addEventListener('click', function () {
    if (Date.now() - shownAt < 350) return;
    if (status === 'paused') resume();
    else if (status === 'handoff') {
      round = 1;
      startRound();
    } else startGame();
  });

  pauseBtn.addEventListener('click', function () {
    if (status === 'play') pause();
    else if (status === 'paused') resume();
  });

  /* ---------- นิ้ว/เมาส์: ลากจากเครื่องบินเพื่อวาดเส้นทาง ---------- */
  function toWorld(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale };
  }

  canvas.addEventListener('pointerdown', function (e) {
    if (status !== 'play') return;
    e.preventDefault();
    var pt = toWorld(e);
    var p = E.pickPlane(world.planes, pt.x, pt.y, 9);
    if (!p) return;
    for (var id in drags) if (drags[id] === p) delete drags[id];
    drags[e.pointerId] = p;
    p.path = [];
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {}
    FG.buzz(6);
  });

  canvas.addEventListener('pointermove', function (e) {
    var p = drags[e.pointerId];
    if (!p || status !== 'play') return;
    e.preventDefault();
    var list = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : null;
    if (!list || !list.length) list = [e];
    for (var k = 0; k < list.length; k++) E.extendPath(p.path, p, toWorld(list[k]), E.SPACING, field);
  });

  function endDrag(e) {
    var p = drags[e.pointerId];
    if (!p) return;
    delete drags[e.pointerId];
    if (p.path.length > 2) p.path = E.smoothPath(p.path, 2);
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  });
  wrap.addEventListener(
    'touchmove',
    function (e) {
      e.preventDefault();
    },
    { passive: false }
  );

  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'p') {
      e.preventDefault();
      if (status === 'play') pause();
      else if (status === 'paused') resume();
    }
  });

  FG.onVisibility(function (hidden) {
    if (hidden) pause();
  });

  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (wrap.clientWidth === cssW && wrap.clientHeight === cssH) return;
      if (status === 'play') pause();
      if (status === 'ready') fitField();
      layout();
      draw();
    }, 120);
  });

  /* ---------- boot ---------- */
  readColors();
  layout();
  draw();
  saveHub();
  paintStats();
  setPauseIcon();
  pauseBtn.disabled = true;
  show(
    'หอบังคับการบิน',
    '<b>ลากนิ้วจากเครื่องบิน</b> ไปที่ปากรันเวย์สีเดียวกัน (ฝั่งที่มีลูกศร) · ห้ามชนกัน',
    'เริ่มเล่น',
    true
  );
})();
