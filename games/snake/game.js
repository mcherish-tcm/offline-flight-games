/* งู — ปัดนิ้ว + ปุ่มทิศ, 3 ความเร็ว, สถิติต่อความเร็ว, หยุดเองเมื่อสลับแอป · ไม่มี loop วิ่งตอนไม่ได้เล่น */
(function () {
  'use strict';

  var SPEEDS = {
    slow: { label: 'ช้า', ms: 190 },
    mid: { label: 'กลาง', ms: 130 },
    fast: { label: 'เร็ว', ms: 85 }
  };
  var COLS = 15;
  var BEST = 'snake:best';
  var DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };

  var wrap = document.getElementById('wrap');
  var canvas = document.getElementById('canvas');
  var ctx = canvas.getContext('2d');
  var overlay = document.getElementById('overlay');
  var ovTitle = document.getElementById('ov-title');
  var ovText = document.getElementById('ov-text');
  var ovSpeed = document.getElementById('ov-speed');
  var ovGo = document.getElementById('ov-go');
  var pauseBtn = document.getElementById('pause');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var speedNameEl = document.getElementById('speed-name');

  // ความเร็วที่ตั้งไว้ ('snake:speed') · speed = ความเร็วของตาที่กำลังเล่น (เปลี่ยนกลางตาแล้วเลือก "ใช้ตาหน้า" จะยังไม่เปลี่ยน)
  function prefSpeed() {
    var s = FG.store.get('snake:speed', 'mid');
    return SPEEDS[s] ? s : 'mid';
  }
  var speed = prefSpeed();
  var status = 'ready'; // ready | play | paused | over
  var snake, dir, queue, food, score, rows, cell, timer, colors;

  /* ---------- sizing ---------- */
  function size() {
    var W = wrap.clientWidth;
    var H = wrap.clientHeight;
    cell = Math.floor(W / COLS);
    rows = Math.max(12, Math.min(28, Math.floor(H / cell)));
    if (rows * cell > H) cell = Math.floor(H / rows);
    var dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.style.width = COLS * cell + 'px';
    canvas.style.height = rows * cell + 'px';
    canvas.width = COLS * cell * dpr;
    canvas.height = rows * cell * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function v(name) {
      return cs.getPropertyValue(name).trim();
    }
    colors = { field: v('--sn-field'), dot: v('--sn-dot'), body: v('--sn-body'), head: v('--sn-head'), eye: v('--sn-eye'), food: v('--sn-food') };
  }

  /* ---------- game ---------- */
  function reset() {
    size();
    readColors();
    var cy = Math.floor(rows / 2);
    snake = [
      [4, cy],
      [3, cy],
      [2, cy]
    ];
    dir = 'right';
    queue = [];
    score = 0;
    placeFood();
    draw();
    paintScore();
  }

  function placeFood() {
    var free = [];
    var taken = new Set(
      snake.map(function (p) {
        return p[0] + ',' + p[1];
      })
    );
    for (var x = 0; x < COLS; x++) for (var y = 0; y < rows; y++) if (!taken.has(x + ',' + y)) free.push([x, y]);
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function turn(d) {
    if (status === 'ready' || status === 'over') return;
    if (status === 'paused') resume();
    var last = queue.length ? queue[queue.length - 1] : dir;
    if (d === last || d === OPP[last]) return;
    if (queue.length < 2) queue.push(d);
  }

  function step() {
    timer = 0;
    if (status !== 'play') return;
    if (queue.length) dir = queue.shift();
    var v = DIRS[dir];
    var head = [snake[0][0] + v[0], snake[0][1] + v[1]];
    var eating = food && head[0] === food[0] && head[1] === food[1];
    // ชนกำแพง / ชนตัวเอง (หางจะขยับออก ถ้าไม่ได้กิน)
    var body = eating ? snake : snake.slice(0, -1);
    var hitSelf = body.some(function (p) {
      return p[0] === head[0] && p[1] === head[1];
    });
    if (head[0] < 0 || head[0] >= COLS || head[1] < 0 || head[1] >= rows || hitSelf) {
      gameOver();
      return;
    }
    snake.unshift(head);
    if (eating) {
      score++;
      FG.buzz(10);
      placeFood();
      paintScore();
    } else snake.pop();
    draw();
    timer = setTimeout(step, SPEEDS[speed].ms);
  }

  function start() {
    speed = prefSpeed();
    reset();
    status = 'play';
    overlay.hidden = true;
    pauseBtn.disabled = false;
    setPauseIcon();
    timer = setTimeout(step, SPEEDS[speed].ms);
  }

  function pause() {
    if (status !== 'play') return;
    status = 'paused';
    clearTimeout(timer);
    timer = 0;
    setPauseIcon();
    showOverlay('หยุดอยู่', 'แตะเล่นต่อ หรือปัดนิ้วเพื่อไปต่อทันที', 'เล่นต่อ', false);
  }

  function resume() {
    if (status !== 'paused') return;
    status = 'play';
    overlay.hidden = true;
    setPauseIcon();
    if (!timer) timer = setTimeout(step, SPEEDS[speed].ms);
  }

  function gameOver() {
    status = 'over';
    clearTimeout(timer);
    timer = 0;
    FG.buzz(90);
    setPauseIcon();
    pauseBtn.disabled = true;
    var bests = FG.store.get(BEST, {});
    var isBest = score > (bests[speed] || 0);
    if (isBest) {
      bests[speed] = score;
      FG.store.set(BEST, bests);
    }
    paintScore();
    saveHub();
    draw(true);
    showOverlay('ชนแล้ว!', 'ได้ ' + score + ' คะแนน' + (isBest && score > 0 ? ' — สถิติใหม่ของความเร็ว' + SPEEDS[speed].label : ''), 'เล่นอีกครั้ง', true);
  }

  function saveHub() {
    var bests = FG.store.get(BEST, {});
    var top = Math.max(bests.slow || 0, bests.mid || 0, bests.fast || 0);
    FG.hubNote('snake', { note: top ? 'สถิติ ' + top : '' });
  }

  /* ---------- drawing (only on tick — no idle animation loop) ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function draw(dead) {
    var W = COLS * cell;
    var H = rows * cell;
    ctx.fillStyle = colors.field;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = colors.dot;
    for (var x = 0; x < COLS; x++)
      for (var y = 0; y < rows; y++) {
        ctx.fillRect(x * cell + cell / 2 - 1, y * cell + cell / 2 - 1, 2, 2);
      }
    if (food) {
      ctx.fillStyle = colors.food;
      ctx.beginPath();
      ctx.arc(food[0] * cell + cell / 2, food[1] * cell + cell / 2, cell * 0.36, 0, Math.PI * 2);
      ctx.fill();
    }
    var pad = Math.max(1, cell * 0.08);
    for (var i = snake.length - 1; i >= 0; i--) {
      var p = snake[i];
      ctx.fillStyle = i === 0 ? colors.head : colors.body;
      ctx.globalAlpha = dead && i > 0 ? 0.55 : 1;
      rr(p[0] * cell + pad, p[1] * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.28);
    }
    ctx.globalAlpha = 1;
    // eyes
    var h = snake[0];
    var v = DIRS[dir];
    var cx = h[0] * cell + cell / 2;
    var cy = h[1] * cell + cell / 2;
    var ex = v[1] !== 0 ? cell * 0.2 : 0;
    var ey = v[0] !== 0 ? cell * 0.2 : 0;
    ctx.fillStyle = colors.eye;
    [-1, 1].forEach(function (s) {
      ctx.beginPath();
      ctx.arc(cx + v[0] * cell * 0.15 + ex * s, cy + v[1] * cell * 0.15 + ey * s, Math.max(1.5, cell * 0.09), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function paintScore() {
    var bests = FG.store.get(BEST, {});
    scoreEl.textContent = score || 0;
    bestEl.textContent = bests[speed] || 0;
    speedNameEl.textContent = SPEEDS[speed].label;
  }

  /* ---------- overlay ---------- */
  var SPEED_CHOICES = Object.keys(SPEEDS).map(function (k) {
    return { value: k, label: SPEEDS[k].label };
  });

  // ตัวเลือกความเร็วบนหน้าทับ (ก่อนเริ่ม/หลังจบ) — ตรงกับค่าที่ตั้งไว้เสมอ
  function paintSpeedChoice() {
    ovSpeed.innerHTML = '';
    ovSpeed.appendChild(
      FG.choice(SPEED_CHOICES, prefSpeed(), function (v) {
        FG.store.set('snake:speed', v);
        speed = v;
        paintScore();
      })
    );
  }
  paintSpeedChoice();

  function showOverlay(title, text, go, withSpeed) {
    ovTitle.textContent = title;
    ovText.textContent = text;
    ovGo.lastChild.textContent = go;
    if (withSpeed) paintSpeedChoice();
    ovSpeed.hidden = !withSpeed;
    overlay.hidden = false;
    ovGo.focus({ preventScroll: true });
  }

  function showReady() {
    status = 'ready';
    clearTimeout(timer);
    timer = 0;
    speed = prefSpeed();
    reset();
    setPauseIcon();
    pauseBtn.disabled = true;
    showOverlay('งู', 'ปัดนิ้วบนสนาม หรือกดปุ่มลูกศรด้านล่าง · ชนกำแพงหรือตัวเองแล้วจบ', 'เริ่มเล่น', true);
  }

  // ⚙️: ความเร็ว (เปลี่ยนกลางตา → ถามเริ่มใหม่ / ใช้ตาหน้า) · เปิดตอนกำลังเล่น = หยุดเกมก่อน
  FG.openSettings = function () {
    pause();
    var cur = prefSpeed();
    var sp = cur;
    FG.settings({
      build: function (body) {
        body.appendChild(
          FG.group(
            'ความเร็ว',
            FG.choice(SPEED_CHOICES, sp, function (v) {
              sp = v;
            }),
            'สถิติแยกตามความเร็ว'
          )
        );
      },
      needsNew: function () {
        return sp !== speed;
      },
      save: function () {
        FG.store.set('snake:speed', sp);
      },
      inProgress: function () {
        return status === 'paused' || status === 'play';
      },
      // ยังไม่เริ่ม/จบแล้ว = เปลี่ยนความเร็วบนหน้าเริ่มเลย · เล่นค้าง = กลับไปหน้าเริ่ม (ไม่ออกตัวเอง)
      restart: showReady
    });
  };

  function setPauseIcon() {
    var paused = status !== 'play';
    pauseBtn.innerHTML = FG.icon(paused ? 'play' : 'pause');
    pauseBtn.setAttribute('aria-label', paused ? 'เล่นต่อ' : 'หยุดชั่วคราว');
  }

  /* ---------- input ---------- */
  ovGo.addEventListener('click', function () {
    if (status === 'paused') resume();
    else start();
  });
  pauseBtn.addEventListener('click', function () {
    if (status === 'play') pause();
    else if (status === 'paused') resume();
  });
  FG.swipe(wrap, turn, { threshold: 18, continuous: true });
  document.querySelectorAll('.sn-key').forEach(function (b) {
    b.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      turn(b.getAttribute('data-dir'));
    });
  });
  document.addEventListener('keydown', function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (map[e.key]) {
      e.preventDefault();
      turn(map[e.key]);
    } else if (e.key === ' ' || e.key === 'p') {
      e.preventDefault();
      if (status === 'play') pause();
      else if (status === 'paused') resume();
      else start();
    }
  });

  FG.onVisibility(function (hidden) {
    if (hidden) pause();
  });
  // หมุนจอ/เปลี่ยนขนาดระหว่างเล่น: หยุดไว้ก่อน (สนามเดิมไม่เปลี่ยนขนาดกลางเกม) · ถ้ายังไม่เริ่ม/จบแล้ว จัดสนามใหม่ให้พอดี
  var resizeTimer = 0;
  var lastW = wrap.clientWidth;
  var lastH = wrap.clientHeight;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var w = wrap.clientWidth;
      var h = wrap.clientHeight;
      // แถบที่อยู่ของเบราว์เซอร์ยืด/หดนิดหน่อย ไม่ต้องสนใจ
      if (w === lastW && Math.abs(h - lastH) < 80) return;
      lastW = w;
      lastH = h;
      if (status === 'play') pause();
      else if (status === 'ready' || status === 'over') reset();
    }, 120);
  });

  /* ---------- boot ---------- */
  saveHub();
  showReady();
})();
