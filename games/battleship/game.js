/*
 * เรือรบ — เล่นกับคอม (ง่าย/ยาก) หรือ 2 คนเครื่องเดียว (ส่งเครื่องให้กัน มีจอบังระหว่างตา)
 * จอมือถือแสดงทีละกระดาน: สลับ "ทะเลศัตรู / ทะเลของเรา" · วางเรือ: สุ่มให้ก่อน แตะเรือ → แตะช่องที่จะย้าย · ปุ่มหมุน
 * กติกาการยิงเลือกในตั้งค่า: ผลัดกันนัดละครั้ง (ค่าเริ่มต้น) / ยิงโดนได้ยิงต่อ · เล่นค้างแล้วปิดแอป กลับมาเล่นต่อได้
 */
(function () {
  'use strict';

  var B = window.Battleship;
  var KEY = 'battleship:state';
  var OPTS = 'battleship:opts';
  var NAMES = ['แดง', 'ฟ้า'];
  var AI_NAMES = ['คุณ', 'คอม'];
  var LEVELS = { 1: 'ง่าย', 2: 'ยาก' };
  var RULES = { alt: 'ผลัดกันนัดละครั้ง', chain: 'ยิงโดนได้ยิงต่อ' };
  var N = B.N;

  var boardEl = document.getElementById('board');
  var viewEl = document.getElementById('view');
  var fleetEl = document.getElementById('fleet');
  var msgEl = document.getElementById('msg');
  var turnEl = document.getElementById('turn');
  var turnText = document.getElementById('turn-text');
  var scoreEl = document.getElementById('score');
  var placeEl = document.getElementById('place');
  var trayEl = document.getElementById('tray');
  var afterEl = document.getElementById('after');
  var coverEl = document.getElementById('cover');

  var opts = FG.store.get(OPTS, null) || {};
  opts = { ai: !!opts.ai, level: opts.level === 2 ? 2 : 1, rule: opts.rule === 'chain' ? 'chain' : 'alt' };

  // S = { g: เกมจาก engine, draft: เรือที่กำลังวาง, sel: ลำที่เลือก (-1 = ไม่มี), view: 'enemy'|'own', cover: {kind,p,report}|null, log: [นัดในตานี้] }
  var S;
  var score;
  var msg = '';
  var lock = false; // รอแสดงผล/รอคอม — ห้ามยิง
  var timer = 0;
  var coverAt = 0;
  var cellEls = [];

  /* ---------- กระดาน 11×11 (แถว/หลักแรก = ป้าย A–J, 1–10) ---------- */
  (function build() {
    var corner = document.createElement('span');
    corner.className = 'bs-lab';
    boardEl.appendChild(corner);
    for (var c = 0; c < N; c++) {
      var h = document.createElement('span');
      h.className = 'bs-lab';
      h.textContent = 'ABCDEFGHIJ'[c];
      boardEl.appendChild(h);
    }
    for (var r = 0; r < N; r++) {
      var l = document.createElement('span');
      l.className = 'bs-lab';
      l.textContent = String(r + 1);
      boardEl.appendChild(l);
      for (var cc = 0; cc < N; cc++) {
        var i = r * N + cc;
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'bs-cell';
        b.setAttribute('role', 'gridcell');
        b.addEventListener('click', onCell.bind(null, i));
        boardEl.appendChild(b);
        cellEls.push(b);
      }
    }
    B.FLEET.forEach(function (f, k) {
      var t = document.createElement('button');
      t.type = 'button';
      t.className = 'bs-chip';
      t.innerHTML = '<span class="bs-chip__bar" style="--len:' + f.len + '"></span><span class="bs-chip__name">' + f.len + ' ช่อง</span>';
      t.setAttribute('aria-label', f.name + ' ยาว ' + f.len + ' ช่อง');
      t.addEventListener('click', function () {
        if (S.g.phase !== 'place' || S.cover) return;
        S.sel = S.sel === k ? -1 : k;
        msg = S.sel === -1 ? '' : 'เลือก' + f.name + ' — แตะช่องที่จะให้หัวเรืออยู่ หรือกดหมุน';
        render();
      });
      trayEl.appendChild(t);
    });
  })();

  /* ---------- helpers ---------- */
  function name(p) {
    return (S.g.ai ? AI_NAMES : NAMES)[p];
  }

  function scoreKey(g) {
    return g.ai ? 'battleship:score:ai' + g.level : 'battleship:score';
  }

  function loadScore() {
    score = FG.store.get(scoreKey(S.g), null);
    if (!score || !Array.isArray(score.w)) score = { w: [0, 0], d: 0 };
  }

  function summary() {
    return name(0) + ' ' + score.w[0] + ' · ' + name(1) + ' ' + score.w[1];
  }

  // "เรา" = คนที่ถือเครื่องอยู่ตอนนี้
  function me() {
    var g = S.g;
    if (g.phase === 'place') return g.placing;
    if (g.ai) return 0;
    if (g.phase === 'over') return g.winner;
    return g.turn;
  }

  function inProgress() {
    var g = S.g;
    return g.phase === 'play' || (g.phase === 'place' && !g.ai && g.placing === 1);
  }

  function save() {
    FG.store.set(KEY, { g: S.g, draft: S.draft, sel: S.sel, view: S.view, cover: S.cover, log: S.log });
    var played = score.w[0] + score.w[1];
    FG.hubNote('battleship', {
      note: played ? (S.g.ai ? 'กับคอม' + LEVELS[S.g.level] + ': ' : '') + summary() : '',
      resume: inProgress()
    });
  }

  function say(text) {
    msg = text;
    msgEl.textContent = text;
  }

  function clearTimer() {
    clearTimeout(timer);
    timer = 0;
  }

  /* ---------- เกมใหม่ ---------- */
  function newGame(starter) {
    FG.closeSheet();
    clearTimer();
    lock = false;
    S = {
      g: B.newGame({ ai: opts.ai, level: opts.level, rule: opts.rule, starter: starter }),
      draft: B.randomFleet(),
      sel: -1,
      view: 'enemy',
      cover: null,
      log: []
    };
    loadScore();
    msg = '';
    if (!S.g.ai) setCover('place', 0, '', 0);
    else paintCover();
    render();
    save();
  }

  function nextGame() {
    newGame(1 - S.g.starter);
  }

  /* ---------- จอบัง (2 คน) ---------- */
  function setCover(kind, p, report, delay) {
    S.cover = { kind: kind, p: p, report: report || '' };
    clearTimer();
    if (delay) {
      lock = true;
      timer = setTimeout(function () {
        lock = false;
        paintCover();
      }, delay);
    }
    if (!delay) paintCover();
  }

  function paintCover() {
    var c = S.cover;
    if (!c || lock) {
      coverEl.hidden = true;
      return;
    }
    coverEl.setAttribute('data-p', String(c.p));
    document.getElementById('cover-chip').innerHTML = shipIcon();
    document.getElementById('cover-title').textContent = 'ส่งเครื่องให้' + NAMES[c.p];
    document.getElementById('cover-text').textContent =
      c.kind === 'place'
        ? 'ผู้เล่น' + NAMES[c.p] + 'วางเรือ — อีกฝ่ายหันหน้าไปก่อน อย่าแอบดู'
        : 'ตาของ' + NAMES[c.p] + ' — อีกฝ่ายหันหน้าไปก่อน อย่าแอบดูเรือ';
    var rep = document.getElementById('cover-report');
    rep.textContent = c.report;
    rep.hidden = !c.report;
    document.getElementById('cover-go').textContent = c.kind === 'place' ? 'แตะเพื่อเริ่มวางเรือ' : 'แตะเพื่อเริ่มตา';
    coverEl.hidden = false;
    coverAt = Date.now();
  }

  function openCover() {
    if (!S.cover || Date.now() - coverAt < 450) return;
    S.cover = null;
    S.view = 'enemy';
    msg = '';
    coverEl.hidden = true;
    render();
    save();
  }
  coverEl.addEventListener('click', openCover);

  function shipIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 14h18l-2.6 4.6a2 2 0 0 1-1.7 1H7.3a2 2 0 0 1-1.7-1z"/><path fill="currentColor" d="M7 13V9.5h4V6h2v3.5h3.5L18 13z"/></svg>';
  }

  /* ---------- วางเรือ ---------- */
  function onPlaceTap(i) {
    var occ = B.occupancy(S.draft, -1);
    var k = occ[i];
    if (k !== -1) {
      S.sel = S.sel === k ? -1 : k;
      say(S.sel === -1 ? '' : 'เลือก' + B.FLEET[k].name + ' — แตะช่องที่จะให้หัวเรืออยู่ หรือกดหมุน');
      render();
      return;
    }
    if (S.sel === -1) {
      FG.toast('แตะเรือที่จะย้ายก่อน แล้วค่อยแตะช่องปลายทาง', 2200);
      return;
    }
    var moved = B.moveShip(S.draft, S.sel, Math.floor(i / N), i % N);
    if (!moved) {
      FG.toast('วางตรงนี้ไม่ได้ — ทับเรือลำอื่น', 1800);
      FG.buzz(30);
      return;
    }
    S.draft = moved;
    FG.buzz(8);
    render();
    save();
  }

  document.getElementById('rotate').addEventListener('click', function () {
    if (S.g.phase !== 'place' || S.cover) return;
    if (S.sel === -1) {
      FG.toast('แตะเรือที่จะหมุนก่อน', 1800);
      return;
    }
    var r = B.rotateShip(S.draft, S.sel);
    if (!r) {
      FG.toast('หมุนไม่ได้ — ติดเรือลำอื่น ลองย้ายก่อน', 2000);
      FG.buzz(30);
      return;
    }
    S.draft = r;
    FG.buzz(8);
    render();
    save();
  });

  document.getElementById('shuffle').addEventListener('click', function () {
    if (S.g.phase !== 'place' || S.cover) return;
    S.draft = B.randomFleet();
    S.sel = -1;
    say('');
    render();
    save();
  });

  document.getElementById('ready').addEventListener('click', function () {
    if (S.g.phase !== 'place' || S.cover) return;
    var ng = B.ready(S.g, S.draft);
    if (!ng) return;
    S.g = ng;
    S.sel = -1;
    msg = '';
    if (ng.phase === 'place') {
      // 2 คน: ถึงคิวฟ้าวางเรือ
      S.draft = B.randomFleet();
      setCover('place', 1, '', 0);
    } else if (!ng.ai) {
      S.draft = null;
      setCover('turn', ng.turn, 'วางเรือครบทั้งสองฝ่ายแล้ว — ' + NAMES[ng.turn] + 'ยิงก่อน', 0);
    } else {
      S.draft = null;
      S.view = 'enemy';
      if (ng.turn === 1) FG.toast('คอมยิงก่อนตานี้', 1600);
    }
    render();
    save();
    aiTurn();
  });

  /* ---------- ยิง ---------- */
  function resultText(res, i) {
    var at = B.label(i) + ' — ';
    if (res.result === 'miss') return at + 'พลาด';
    if (res.result === 'hit') return at + 'โดน!';
    return at + 'จม' + B.FLEET[res.k].name + '!';
  }

  function onCell(i) {
    if (FG.isSheetOpen() || S.cover) return;
    var g = S.g;
    if (g.phase === 'place') {
      onPlaceTap(i);
      return;
    }
    if (g.phase !== 'play' || lock) return;
    if (g.ai && g.turn === 1) return;
    if (S.view !== 'enemy') {
      FG.toast('สลับไป "ทะเลศัตรู" ก่อน แล้วค่อยแตะเพื่อยิง', 2000);
      return;
    }
    if (g.sides[1 - g.turn].shots[i] !== 0) {
      FG.toast('ยิงช่องนี้ไปแล้ว', 1400);
      return;
    }
    shoot(i);
  }

  function shoot(i) {
    var shooter = S.g.turn;
    var res = B.play(S.g, i);
    if (!res) return;
    S.g = res.g;
    var text = resultText(res, i);
    S.log.push(text);
    feedback(res, shooter);
    if (res.over) {
      say(text);
      finish();
      return;
    }
    if (res.again) {
      say(text + ' ยิงต่อได้');
      render();
      save();
      return;
    }
    // เปลี่ยนตา
    say(text);
    if (S.g.ai) {
      render();
      save();
      lock = true;
      timer = setTimeout(aiTurn, res.result === 'sunk' ? 1300 : 900);
      return;
    }
    var report = NAMES[shooter] + 'ยิง ' + S.log.length + ' นัด: ' + S.log.join(' · ');
    S.log = [];
    setCover('turn', S.g.turn, report, res.result === 'sunk' ? 2000 : 1400);
    render();
    save();
  }

  function feedback(res, shooter) {
    if (res.result === 'sunk') {
      FG.toast((S.g.ai ? name(shooter) : NAMES[shooter]) + 'จม' + B.FLEET[res.k].name + '!', 2200);
      FG.buzz([40, 60, 80]);
    } else if (res.result === 'hit') FG.buzz(30);
    else FG.buzz(8);
  }

  /* ---------- คอม ---------- */
  function aiTurn() {
    var g = S.g;
    if (!(g.phase === 'play' && g.ai && g.turn === 1)) {
      lock = false;
      return;
    }
    clearTimer();
    lock = true;
    S.view = 'own';
    msg = 'คอมกำลังเล็ง…';
    render();
    timer = setTimeout(function step() {
      if (FG.isSheetOpen() || document.hidden) {
        timer = setTimeout(step, 400);
        return;
      }
      if (!(S.g.phase === 'play' && S.g.ai && S.g.turn === 1)) return;
      var i = B.aiShot(S.g);
      var res = B.play(S.g, i);
      if (!res) return;
      S.g = res.g;
      feedback(res, 1);
      say('คอมยิง ' + resultText(res, i));
      render();
      save();
      if (res.over) {
        finish();
        return;
      }
      if (res.again) {
        timer = setTimeout(step, 850);
        return;
      }
      timer = setTimeout(function () {
        lock = false;
        S.view = 'enemy';
        say(msg + ' · ถึงตาคุณ');
        render();
        save();
      }, 1300);
    }, 750);
  }

  /* ---------- จบเกม ---------- */
  function finish() {
    clearTimer();
    lock = false;
    var g = S.g;
    S.cover = null;
    S.view = 'enemy';
    score.w[g.winner] += 1;
    FG.store.set(scoreKey(g), score);
    render();
    save();
    var w = g.winner;
    var acc = g.shots[w] ? Math.round((g.hits[w] * 100) / g.shots[w]) : 0;
    timer = setTimeout(function () {
      FG.sheet({
        title: name(w) + 'ชนะ!',
        text: name(w) + 'ยิง ' + g.shots[w] + ' นัด โดน ' + g.hits[w] + ' นัด (' + acc + '%)<br>สกอร์รวม: ' + summary(),
        actions: [{ label: 'ดูกระดาน' }, { label: 'เกมใหม่', primary: true, onClick: nextGame }]
      });
    }, 900);
  }

  /* ---------- วาด ---------- */
  function segOf(ships) {
    var seg = {};
    ships.forEach(function (s) {
      var cs = B.cellsOf(s);
      cs.forEach(function (i, j) {
        seg[i] = { k: s.k, part: (s.v ? 'v' : 'h') + (j === 0 ? 's' : j === cs.length - 1 ? 'e' : 'm') };
      });
    });
    return seg;
  }

  function paintCell(el, o) {
    el.className = 'bs-cell' + (o.cls ? ' ' + o.cls : '');
    if (o.seg) el.setAttribute('data-seg', o.seg);
    else el.removeAttribute('data-seg');
    el.setAttribute('aria-label', o.label);
    el.setAttribute('aria-disabled', String(!!o.off));
  }

  function render() {
    var g = S.g;
    var placing = g.phase === 'place';
    var over = g.phase === 'over';
    var m = me();
    var shownP = placing ? m : S.view === 'own' ? m : 1 - m;
    var yourTurn = g.phase === 'play' && !lock && !(g.ai && g.turn === 1);

    // แถบบน: ตาใคร + สกอร์
    var tp = placing ? g.placing : over ? g.winner : g.turn;
    turnEl.setAttribute('data-p', String(tp));
    var tt;
    if (placing) tt = g.ai ? 'วางเรือของคุณ' : NAMES[g.placing] + 'วางเรือ';
    else if (over) tt = name(g.winner) + 'ชนะ!';
    else if (g.ai) tt = g.turn === 1 ? 'คอมกำลังยิง' : 'ตาคุณ';
    else tt = 'ตาของ' + NAMES[g.turn];
    turnText.textContent = tt;
    scoreEl.textContent = name(0) + ' ' + score.w[0] + ' : ' + score.w[1] + ' ' + name(1);

    // ปุ่มสลับกระดาน
    viewEl.hidden = placing;
    var vb = viewEl.querySelectorAll('button');
    vb[0].textContent = over && !g.ai ? 'ทะเล' + NAMES[1 - m] : 'ทะเลศัตรู';
    vb[1].textContent = over && !g.ai ? 'ทะเล' + NAMES[m] : 'ทะเลของเรา';
    vb[0].setAttribute('aria-checked', String(S.view === 'enemy'));
    vb[1].setAttribute('aria-checked', String(S.view === 'own'));

    placeEl.hidden = !placing;
    afterEl.hidden = !over;
    fleetEl.hidden = placing;
    boardEl.setAttribute('data-mode', placing ? 'place' : S.view === 'own' ? 'own' : 'enemy');
    boardEl.classList.toggle('is-aim', yourTurn && S.view === 'enemy');
    boardEl.setAttribute('aria-label', placing ? 'วางเรือ' : S.view === 'own' ? 'ทะเลของเรา' : 'ทะเลศัตรู');

    var i;
    if (placing) {
      var seg = segOf(S.draft);
      for (i = 0; i < N * N; i++) {
        var s = seg[i];
        paintCell(cellEls[i], {
          cls: s ? 'is-ship' + (s.k === S.sel ? ' is-sel' : '') : '',
          seg: s && s.part,
          label: B.label(i) + (s ? ' ' + B.FLEET[s.k].name : ' น้ำ')
        });
      }
      trayEl.querySelectorAll('.bs-chip').forEach(function (t, k) {
        t.setAttribute('aria-pressed', String(k === S.sel));
      });
      document.getElementById('rotate').disabled = S.sel === -1;
      msgEl.textContent = msg || 'แตะเรือเพื่อเลือก แล้วแตะช่องที่จะให้หัวเรืออยู่ · หรือกดสุ่มใหม่';
      return;
    }

    var side = g.sides[shownP];
    var own = shownP === m;
    var revealAll = own || over;
    var segs = segOf(side.ships);
    var sunk = {};
    side.ships.forEach(function (s) {
      if (B.isSunk(side, s.k)) sunk[s.k] = true;
    });
    for (i = 0; i < N * N; i++) {
      var sg = segs[i];
      var shot = side.shots[i];
      var showShip = sg && (revealAll || sunk[sg.k]);
      var cls = [];
      if (showShip) {
        cls.push('is-ship');
        if (sunk[sg.k]) cls.push('is-sunk');
        else if (!own) cls.push('is-ghost');
      }
      if (shot === 1) cls.push('is-miss');
      if (shot === 2) cls.push('is-hit');
      if (g.last[shownP] === i) cls.push('is-last');
      var lab = B.label(i) + ' ' + (shot === 1 ? 'พลาด' : shot === 2 ? (sg && sunk[sg.k] ? 'จม' : 'โดน') : showShip ? 'เรือ' : 'ยังไม่ยิง');
      paintCell(cellEls[i], {
        cls: cls.join(' '),
        seg: showShip ? sg.part : null,
        label: lab,
        off: !(yourTurn && S.view === 'enemy' && shot === 0)
      });
    }

    // สถานะเรือของกระดานที่ดูอยู่
    var left = B.FLEET.length - Object.keys(sunk).length;
    fleetEl.innerHTML =
      '<span class="bs-fleet__label">' +
      (own ? 'เรือเรา' : 'เรือศัตรู') +
      ' เหลือ <b class="num">' +
      left +
      '</b>/5</span>' +
      B.FLEET.map(function (f, k) {
        return '<span class="bs-mini' + (sunk[k] ? ' is-sunk' : '') + '" style="--len:' + f.len + '" title="' + f.name + '"></span>';
      }).join('');

    var def;
    if (over) def = 'จบเกม — ดูเรือที่เหลือได้ทั้งสองกระดาน';
    else if (g.ai && g.turn === 1) def = 'คอมกำลังเล็ง…';
    else if (S.view === 'own') def = 'ทะเลของเรา: จุด = อีกฝ่ายยิงพลาด · สีแดง = ถูกยิงโดน';
    else def = 'แตะช่องในทะเลศัตรูเพื่อยิง' + (g.rule === 'chain' ? ' · โดนแล้วยิงต่อได้' : '');
    msgEl.textContent = msg || def;
  }

  viewEl.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (S.cover) return;
      S.view = b.getAttribute('data-view');
      if (!lock) msg = '';
      render();
      save();
    });
  });

  /* ---------- ปุ่มบนแถบ ---------- */
  document.getElementById('again').addEventListener('click', nextGame);

  document.getElementById('restart').addEventListener('click', function () {
    if (S.g.phase === 'over') {
      nextGame();
      return;
    }
    if (!inProgress()) {
      newGame(S.g.starter);
      return;
    }
    FG.sheet({
      title: 'เริ่มเกมใหม่?',
      text: 'เกมที่เล่นอยู่จะหายไป สกอร์รวมยังอยู่',
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'เริ่มใหม่',
          primary: true,
          onClick: function () {
            newGame(S.g.starter);
          }
        }
      ]
    });
  });

  document.getElementById('settings').addEventListener('click', function () {
    var pending = { ai: opts.ai, level: opts.level, rule: opts.rule };
    var frag = document.createDocumentFragment();
    var levelGroup;

    function group(title, node, hintText) {
      var d = document.createElement('div');
      d.className = 'duo-group';
      d.appendChild(FG.label(title));
      d.appendChild(node);
      if (hintText) {
        var p = document.createElement('p');
        p.className = 'duo-hint';
        p.textContent = hintText;
        d.appendChild(p);
      }
      frag.appendChild(d);
      return d;
    }

    group(
      'โหมด',
      FG.choice(
        [
          { value: false, label: 'เล่น 2 คน' },
          { value: true, label: 'เล่นกับคอม' }
        ],
        pending.ai,
        function (v) {
          pending.ai = v;
          levelGroup.hidden = !v;
        }
      ),
      '2 คน: ส่งเครื่องให้กัน มีจอบังทุกครั้งที่เปลี่ยนตา'
    );
    levelGroup = group(
      'ความยากของคอม',
      FG.choice(
        [
          { value: 1, label: 'ง่าย' },
          { value: 2, label: 'ยาก' }
        ],
        pending.level,
        function (v) {
          pending.level = v;
        }
      ),
      'คุณเป็นฝั่งแดง · สลับกันเริ่มทุกเกม · สกอร์กับคอมนับแยกจากเล่น 2 คน'
    );
    levelGroup.hidden = !pending.ai;
    group(
      'กติกาการยิง',
      FG.choice(
        [
          { value: 'alt', label: RULES.alt },
          { value: 'chain', label: RULES.chain }
        ],
        pending.rule,
        function (v) {
          pending.rule = v;
        }
      ),
      'เปลี่ยนกติกาการยิงได้ทุกเมื่อ มีผลทันที'
    );
    var sc = document.createElement('p');
    sc.className = 'duo-hint';
    sc.textContent = 'สกอร์รวม' + (S.g.ai ? ' (กับคอม' + LEVELS[S.g.level] + ')' : '') + ': ' + summary();
    frag.appendChild(sc);

    var resetting = false;

    function applyMode() {
      opts.ai = pending.ai;
      opts.level = pending.level;
      FG.store.set(OPTS, opts);
      newGame(0);
      FG.toast(opts.ai ? 'เล่นกับคอม (' + LEVELS[opts.level] + ')' : 'เล่น 2 คน');
    }

    function finishSettings() {
      if (resetting) return;
      if (pending.rule !== opts.rule) {
        opts.rule = pending.rule;
        FG.store.set(OPTS, opts);
        S.g.rule = pending.rule;
        render();
        save();
        FG.toast('กติกา: ' + RULES[pending.rule], 2000);
      }
      var modeChanged = pending.ai !== opts.ai || (pending.ai && pending.level !== opts.level);
      if (!modeChanged) return;
      if (inProgress()) {
        setTimeout(function () {
          FG.sheet({
            title: 'เปลี่ยนโหมดแล้วเริ่มเกมใหม่?',
            text: 'เกมที่เล่นอยู่จะถูกล้าง สกอร์ที่เก็บไว้ยังอยู่',
            actions: [
              { label: 'ยกเลิก' },
              { label: 'เปลี่ยนเลย', primary: true, onClick: applyMode }
            ]
          });
        }, 0);
      } else {
        applyMode();
      }
    }

    FG.sheet({
      title: 'ตั้งค่า',
      body: frag,
      onDismiss: finishSettings,
      actions: [
        {
          label: 'ล้างสกอร์',
          onClick: function () {
            resetting = true;
            score = { w: [0, 0], d: 0 };
            FG.store.set(scoreKey(S.g), score);
            render();
            save();
            FG.toast('ล้างสกอร์แล้ว');
          }
        },
        { label: 'เสร็จ', primary: true, onClick: finishSettings }
      ]
    });
  });

  FG.onVisibility(function (hidden) {
    if (hidden && S) save();
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  var ok =
    saved &&
    saved.g &&
    (saved.g.phase === 'place' || saved.g.phase === 'play' || saved.g.phase === 'over') &&
    (saved.g.phase !== 'place' || B.validFleet(saved.draft)) &&
    (saved.g.phase === 'place' || (saved.g.sides && saved.g.sides[0] && saved.g.sides[1]));
  if (ok) {
    S = { g: saved.g, draft: saved.draft, sel: -1, view: saved.view === 'own' ? 'own' : 'enemy', cover: saved.cover || null, log: saved.log || [] };
    S.g.rule = opts.rule;
    loadScore();
    // 2 คนเล่นค้าง: เปิดกลับมาต้องมีจอบังก่อนเสมอ (กันเห็นเรืออีกฝ่าย)
    if (!S.g.ai && S.g.phase !== 'over' && !S.cover) {
      S.cover = { kind: S.g.phase === 'place' ? 'place' : 'turn', p: S.g.phase === 'place' ? S.g.placing : S.g.turn, report: '' };
    }
    paintCover();
    render();
    save();
    aiTurn();
  } else {
    newGame(0);
  }
})();
