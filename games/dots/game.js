/* ลากเส้นปิดกล่อง — 2 คน หรือเล่นกับคอม (ai.js), 3×3 / 4×4 / 5×5 กล่อง, แตะใกล้ขอบ (กดค้างแล้วเลื่อนนิ้วเลือกเส้นได้), ปิดกล่อง = ได้แต้ม + เล่นต่อ */
(function () {
  'use strict';

  var KEY = 'dots:state';
  var SIZE_KEY = 'dots:size';
  var SIZES = [3, 4, 5];
  var NS = 'http://www.w3.org/2000/svg';
  var PICK_RADIUS = 0.62; // หน่วย = ความกว้าง 1 กล่อง
  var CHIP = [
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/></svg>',
    '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" fill="currentColor"/></svg>'
  ];

  var svg = document.getElementById('board');
  var duo = FGDuo.create({
    id: 'dots',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function (p) {
      return CHIP[p];
    },
    ai: true
  });

  // S = { n, lines:[-1|0|1], boxes:[-1|0|1], turn, starter, last, over: null | { w } | { draw:true } }
  var S;
  var cand = -1;
  var pointerId = null;
  var endedAt = 0;
  var justClosed = [];

  function hCount(n) {
    return (n + 1) * n;
  }

  // เส้นที่ k → [x1,y1,x2,y2] (หน่วยกล่อง)
  function seg(n, k) {
    var H = hCount(n);
    if (k < H) {
      var r = Math.floor(k / n);
      var c = k % n;
      return [c, r, c + 1, r];
    }
    k -= H;
    var r2 = Math.floor(k / (n + 1));
    var c2 = k % (n + 1);
    return [c2, r2, c2, r2 + 1];
  }

  function boxEdges(n, r, c) {
    var H = hCount(n);
    return [r * n + c, (r + 1) * n + c, H + r * (n + 1) + c, H + r * (n + 1) + c + 1];
  }

  function fresh(n, starter) {
    var lines = [];
    var boxes = [];
    for (var i = 0; i < hCount(n) * 2; i++) lines.push(-1);
    for (var j = 0; j < n * n; j++) boxes.push(-1);
    return { n: n, lines: lines, boxes: boxes, turn: starter, starter: starter, last: -1, over: null };
  }

  function drawn() {
    return S.lines.filter(function (v) {
      return v !== -1;
    }).length;
  }

  function points(p) {
    return S.boxes.filter(function (v) {
      return v === p;
    }).length;
  }

  function play(k) {
    if (S.over || S.lines[k] !== -1) return;
    var p = S.turn;
    S.lines[k] = p;
    S.last = k;
    var closed = 0;
    for (var r = 0; r < S.n; r++)
      for (var c = 0; c < S.n; c++) {
        var b = r * S.n + c;
        if (S.boxes[b] !== -1) continue;
        var e = boxEdges(S.n, r, c);
        if (S.lines[e[0]] !== -1 && S.lines[e[1]] !== -1 && S.lines[e[2]] !== -1 && S.lines[e[3]] !== -1) {
          S.boxes[b] = p;
          closed++;
          justClosed.push(b);
        }
      }
    setTimeout(function () {
      justClosed = [];
    }, 400);
    FG.buzz(closed ? 25 : 8);
    if (drawn() === S.lines.length) {
      var a = points(0);
      var bpts = points(1);
      if (a === bpts) {
        S.over = { draw: true };
        duo.draw();
      } else {
        S.over = { w: a > bpts ? 0 : 1 };
        duo.win(S.over.w);
      }
      endedAt = Date.now();
      setTimeout(showResult, 700);
    } else if (!closed) {
      S.turn = 1 - p;
    } else if (!duo.isCPU(p)) {
      FG.toast(duo.name(p) + 'ปิดได้ ' + closed + ' กล่อง — เล่นต่ออีกตา', 1400);
    }
    render();
    save();
    if (!S.over) cpuTurn(closed > 0);
  }

  // ถึงตาคอม → คิดแล้วลากเส้น (ปิดกล่องได้ = ลากต่อทันทีแบบเร็วขึ้น)
  function cpuTurn(chain) {
    if (S.over || !duo.isCPU(S.turn)) return;
    duo.cpuMove(
      function () {
        return DotsAI.choose(S.n, S.lines, duo.level());
      },
      function (k) {
        if (!S.over && duo.isCPU(S.turn) && k >= 0 && S.lines[k] === -1) play(k);
      },
      chain ? { min: 320 } : null
    );
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    S = fresh(FG.store.get(SIZE_KEY, 4), 1 - S.starter);
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    S = fresh(FG.store.get(SIZE_KEY, 4), S.starter);
    render();
    save();
    cpuTurn();
  }

  function showResult() {
    if (!S.over) return;
    var txt = duo.name(0) + ' ' + points(0) + ' กล่อง · ' + duo.name(1) + ' ' + points(1) + ' กล่อง';
    if (S.over.draw) duo.showResult({ title: 'เสมอ', text: txt, onNext: nextRound });
    else duo.showResult({ title: duo.name(S.over.w) + 'ชนะ!', text: txt, onNext: nextRound, faceTo: S.over.w });
  }

  /* ---------- render (SVG) ---------- */
  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function lineEl(n, k, cls, p) {
    var s = seg(n, k);
    var a = { x1: s[0], y1: s[1], x2: s[2], y2: s[3], class: cls };
    if (p != null) a['data-p'] = String(p);
    return el('line', a);
  }

  function render() {
    var n = S.n;
    svg.setAttribute('viewBox', '-0.5 -0.5 ' + (n + 1) + ' ' + (n + 1));
    svg.textContent = '';
    for (var r = 0; r < n; r++)
      for (var c = 0; c < n; c++) {
        var o = S.boxes[r * n + c];
        if (o === -1) continue;
        svg.appendChild(el('rect', { x: c + 0.06, y: r + 0.06, width: 0.88, height: 0.88, rx: 0.08, class: 'dots-box', 'data-p': String(o) }));
        var isNew = justClosed.indexOf(r * n + c) !== -1;
        svg.appendChild(el('rect', { x: c + 0.34, y: r + 0.34, width: 0.32, height: 0.32, rx: 0.07, class: 'dots-box__mark' + (isNew ? ' is-new' : ''), 'data-p': String(o) }));
      }
    for (var k = 0; k < S.lines.length; k++) if (S.lines[k] === -1) svg.appendChild(lineEl(n, k, 'dots-guide'));
    if (S.last !== -1 && !S.over) svg.appendChild(lineEl(n, S.last, 'dots-last'));
    for (k = 0; k < S.lines.length; k++) if (S.lines[k] !== -1) svg.appendChild(lineEl(n, k, 'dots-line', S.lines[k]));
    if (cand !== -1) svg.appendChild(lineEl(n, cand, 'dots-cand', S.turn));
    var dotR = n >= 5 ? 0.1 : n === 4 ? 0.085 : 0.07;
    for (var y = 0; y <= n; y++) for (var x = 0; x <= n; x++) svg.appendChild(el('circle', { cx: x, cy: y, r: dotR, class: 'dots-dot' }));

    duo.setLive(0, String(points(0)));
    duo.setLive(1, String(points(1)));
    duo.setResult(S.over ? (S.over.draw ? 'draw' : S.over.w) : null);
    duo.setTurn(S.over ? null : S.turn);
    svg.setAttribute('aria-label', 'กระดาน ' + n + ' คูณ ' + n + ' กล่อง ลากแล้ว ' + drawn() + ' จาก ' + S.lines.length + ' เส้น');
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.over && drawn() > 0);
  }

  /* ---------- pointer: หาเส้นที่ยังไม่ลากที่ใกล้นิ้วที่สุด ---------- */
  function nearest(e) {
    var rect = svg.getBoundingClientRect();
    var span = S.n + 1;
    var px = ((e.clientX - rect.left) / rect.width) * span - 0.5;
    var py = ((e.clientY - rect.top) / rect.height) * span - 0.5;
    var best = -1;
    var bestD = PICK_RADIUS;
    for (var k = 0; k < S.lines.length; k++) {
      if (S.lines[k] !== -1) continue;
      var s = seg(S.n, k);
      // ระยะจากจุดถึงเส้นตรงสั้น ๆ (แนวนอนหรือแนวตั้งเท่านั้น)
      var dx;
      var dy;
      if (s[1] === s[3]) {
        dx = px < s[0] ? s[0] - px : px > s[2] ? px - s[2] : 0;
        dy = py - s[1];
      } else {
        dy = py < s[1] ? s[1] - py : py > s[3] ? py - s[3] : 0;
        dx = px - s[0];
      }
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    return best;
  }

  function setCand(k) {
    if (k === cand) return;
    cand = k;
    render();
  }

  svg.addEventListener('pointerdown', function (e) {
    if (FG.isSheetOpen() || pointerId !== null) return;
    if (S.over) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (duo.isCPU(S.turn)) return; // รอคอมเดิน
    pointerId = e.pointerId;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch (err) {}
    setCand(nearest(e));
  });
  svg.addEventListener('pointermove', function (e) {
    if (e.pointerId !== pointerId) return;
    setCand(nearest(e));
  });
  svg.addEventListener('pointerup', function (e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    var k = nearest(e);
    cand = -1;
    if (k !== -1 && !duo.isCPU(S.turn)) play(k);
    else render();
  });
  svg.addEventListener('pointercancel', function (e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    setCand(-1);
  });

  /* ---------- buttons ---------- */
  document.getElementById('restart').addEventListener('click', function () {
    if (S.over) {
      nextRound();
      return;
    }
    if (drawn() === 0) {
      restartRound();
      return;
    }
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'กระดานตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  document.getElementById('settings').addEventListener('click', function () {
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !S.over && drawn() > 0;
      },
      onModeChange: function () {
        S = fresh(FG.store.get(SIZE_KEY, 4), 0);
        cand = -1;
        render();
        save();
        cpuTurn();
      },
      build: function (body) {
        body.appendChild(FG.label('ขนาดกระดาน (ใช้ตั้งแต่ตาใหม่)'));
        body.appendChild(
          FG.choice(
            SIZES.map(function (s) {
              return { value: s, label: s + '×' + s };
            }),
            FG.store.get(SIZE_KEY, 4),
            function (v) {
              FG.store.set(SIZE_KEY, v);
              if (S.over || drawn() === 0) {
                duo.cancelCPU();
                S = fresh(v, S.starter);
                render();
                save();
                cpuTurn();
              } else {
                FG.toast('ขนาด ' + v + '×' + v + ' จะเริ่มตาหน้า');
              }
            }
          )
        );
      }
    });
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && SIZES.indexOf(saved.n) !== -1 && Array.isArray(saved.lines) && saved.lines.length === hCount(saved.n) * 2) {
    S = saved;
  } else {
    S = fresh(FG.store.get(SIZE_KEY, 4), 0);
  }
  render();
  save();
  cpuTurn();
})();
