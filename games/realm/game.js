/*
 * ชิงเมืองแดนมนตร์ — เกมกระดาน RPG แฟนตาซี · 1 คน + คอม 1–2 ตัว หรือ 2 คน (ส่งเครื่องให้กัน) + คอม 1 ตัว
 * กติกาทั้งหมดอยู่ใน engine.js (window.Realm) · ไฟล์นี้ = วาดจอ + รับการแตะ + เดินคอม + บันทึกทุกการกระทำ
 * ปิดแอปกลางเกม → เปิดกลับมาถาม "เล่นต่อ" (บันทึกลง localStorage ผ่าน FG.store ซึ่งห่อ try/catch แล้ว)
 */
(function () {
  'use strict';

  var R = window.Realm;
  var KEY = 'realm:state';
  var OPTS = 'realm:opts';
  var STATS = 'realm:stats';
  var SEAT_CLASS = ['c0', 'c1', 'c2'];
  var LEN_LABEL = { short: 'สั้น', mid: 'กลาง', long: 'ยาว' };
  var LEN_TIME = { short: '~20 นาที', mid: '~30 นาที', long: '~40 นาที' };
  var MODES = {
    solo1: { label: '1 คน + คอม 1', short: 'คอม 1 ตัว', players: [{ name: 'คุณ' }, { name: 'คอมฟ้า', cpu: true }] },
    solo2: { label: '1 คน + คอม 2', short: 'คอม 2 ตัว', players: [{ name: 'คุณ' }, { name: 'คอมฟ้า', cpu: true }, { name: 'คอมเขียว', cpu: true }] },
    duo: { label: '2 คน + คอม 1', short: '2 คน + คอม', players: [{ name: 'แดง' }, { name: 'ฟ้า' }, { name: 'คอมเขียว', cpu: true }] }
  };

  var playersEl = document.getElementById('players');
  var boardEl = document.getElementById('board');
  var centerEl = document.getElementById('center');
  var roundEl = document.getElementById('round');
  var dieEl = document.getElementById('die');
  var logEl = document.getElementById('log');
  var msgEl = document.getElementById('msg');
  var actionsEl = document.getElementById('actions');
  var ovEl = document.getElementById('ov');
  var ovBox = document.getElementById('ov-box');
  var coverEl = document.getElementById('cover');

  var opts = FG.store.get(OPTS, null) || {};
  if (!MODES[opts.mode]) opts.mode = 'solo2';
  if (!R.LENGTHS[opts.length]) opts.length = 'short';
  if (R.MAP_IDS.indexOf(opts.map) === -1) opts.map = 'classic';

  // S = { s: สถานะเกมจาก engine, mode, holder: ผู้เล่น (คน) ที่ถือเครื่องอยู่, log: [ข้อความล่าสุด] }
  var S = null;
  var cells = [];
  var queue = [];
  var busy = false;
  var timer = 0;
  var anim = null; // { p, pos } ตำแหน่งตัวหมากระหว่างเดิน
  var view = null; // หน้าสรุปที่รอผู้เล่นแตะ "ไปต่อ" { kind: 'battle'|'duel', ... }
  var plan = []; // ท่าที่กำลังวางแผนประลอง
  var hideResult = false;
  var coverAt = 0;

  /* ---------- ไอคอนช่อง (วาดเอง) ---------- */
  var GL = {
    start: '<path d="M5 20V9a7 7 0 0 1 14 0v11"/><path d="M9 20v-6h6v6"/><path d="M12 2v3"/>',
    gold: '<circle cx="12" cy="12" r="7.5"/><path d="M12 8v8M9.5 10h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
    monster: '<path d="M5 5l3 5M19 5l-3 5"/><path d="M6 11a6 6 0 0 1 12 0v4a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><circle cx="9.5" cy="13" r="1" fill="currentColor"/><circle cx="14.5" cy="13" r="1" fill="currentColor"/><path d="M10 17l1-1 1 1 1-1 1 1"/>',
    chest: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 12h16M5 9a7 5 0 0 1 14 0"/><rect x="10.5" y="11" width="3" height="3.5" rx=".6"/>',
    shop: '<path d="M4 9l2-5h12l2 5"/><path d="M4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M5.5 11v9h13v-9"/><path d="M10 20v-5h4v5"/>',
    rest: '<path d="M4 15c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5M4 19c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5"/><path d="M9 10c-1-1.5 1-2.5 0-4.5M13 10c-1-1.5 1-2.5 0-4.5M17 10c-1-1.5 1-2.5 0-4.5"/>',
    town: '<path d="M4 20V8h3v2h2V8h3v2h2V8h3v2h2V8h1v12z"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/>',
    card: '<rect x="5" y="3.5" width="11" height="15" rx="1.8" transform="rotate(-8 10.5 11)"/><rect x="8.5" y="5.5" width="11" height="15" rx="1.8"/><path d="M14 10.2l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3z"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    sword: '<path d="M14.5 4H20v5.5L9 20.5 3.5 15z"/><path d="M5 13l6 6M3 21l2.5-2.5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
    swords: '<path d="M4 4l9 9M20 4l-9 9M7 15l-3 3 2 2 3-3M17 15l3 3-2 2-3-3"/><path d="M4 4h3v3M20 4h-3v3"/>'
  };

  function svg(name, cls) {
    return '<svg class="' + (cls || 'rl-ico') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (GL[name] || '') + '</svg>';
  }

  /* ---------- ตำแหน่งช่องรอบขอบตาราง cols×rows (วนตามเข็ม เริ่มมุมซ้ายบน) ----------
   * แดนมนตร์ 8×9 = 30 ช่อง · หมู่เกาะหิ่งห้อย 6×8 = 24 ช่อง */
  function cellPos(i, cols, rows) {
    if (i < cols) return { r: 1, c: i + 1 };
    if (i < cols + rows - 1) return { r: i - cols + 2, c: cols };
    if (i < 2 * cols + rows - 2) return { r: rows, c: cols - (i - (cols + rows - 2)) };
    return { r: rows - (i - (2 * cols + rows - 3)), c: 1 };
  }

  var boardMap = null;
  // สร้างช่องกระดานใหม่เมื่อแผนที่เปลี่ยน (ช่องกลางกระดานคงอยู่)
  function buildBoard(s) {
    var M = R.mapOf(s);
    if (boardMap === M.id && cells.length === s.board.length) return;
    boardMap = M.id;
    cells.forEach(function (c) {
      boardEl.removeChild(c);
    });
    cells = [];
    boardEl.style.setProperty('--cols', String(M.cols));
    boardEl.style.setProperty('--rows', String(M.rows));
    boardEl.setAttribute('data-map', M.id);
    for (var i = 0; i < s.board.length; i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'rl-cell';
      var pos = cellPos(i, M.cols, M.rows);
      b.style.gridRow = String(pos.r);
      b.style.gridColumn = String(pos.c);
      b.addEventListener('click', cellInfo.bind(null, i));
      boardEl.appendChild(b);
      cells.push(b);
    }
  }

  function townName(k) {
    return R.townDef(S.s, k).name;
  }

  /* ---------- ตัวช่วย ---------- */
  function P(i) {
    return S.s.players[i];
  }

  function humans() {
    var n = 0;
    S.s.players.forEach(function (p) {
      if (!p.cpu) n++;
    });
    return n;
  }

  function isHuman(i) {
    return i >= 0 && !P(i).cpu;
  }

  function dot(i) {
    return '<span class="rl-dot ' + SEAT_CLASS[i] + '" aria-hidden="true"></span>';
  }

  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function habit(bias) {
    var mx = Math.max(bias[0], bias[1], bias[2]);
    if (mx < 0.4) return 'เดาใจยาก ออกท่าไม่ซ้ำแบบ';
    return R.BIAS_TEXT[bias.indexOf(mx)];
  }

  function addLog(t) {
    if (!t) return;
    S.log.push(t);
    if (S.log.length > 40) S.log = S.log.slice(-40);
  }

  function needCover() {
    if (!S || busy || view || S.s.phase === 'over') return false;
    var d = R.decider(S.s);
    return humans() >= 2 && isHuman(d) && S.holder !== d;
  }

  /* ---------- บันทึก ---------- */
  function save() {
    FG.store.set(KEY, { s: S.s, mode: S.mode, holder: S.holder, log: S.log });
    var st = FG.store.get(STATS, { played: 0, won: 0 });
    FG.hubNote('realm', {
      note: S.s.phase === 'over' ? (st.played ? 'ชนะ ' + st.won + '/' + st.played + ' เกม' : '') : 'รอบ ' + S.s.round + '/' + S.s.rounds,
      resume: S.s.phase !== 'over'
    });
  }

  function recordResult() {
    var st = FG.store.get(STATS, { played: 0, won: 0 });
    st.played += 1;
    var w = S.s.result.winner;
    if (w >= 0 && !P(w).cpu) st.won += 1;
    FG.store.set(STATS, st);
  }

  /* ---------- เริ่มเกม ---------- */
  function newGame(mode, length, map) {
    clearTimeout(timer);
    queue = [];
    busy = false;
    anim = null;
    view = null;
    plan = [];
    hideResult = false;
    opts.mode = mode;
    opts.length = length;
    opts.map = map;
    FG.store.set(OPTS, opts);
    dieEl.textContent = '';
    var defs = MODES[mode].players.map(function (d) {
      return { name: d.name, cpu: !!d.cpu };
    });
    S = { s: R.newGame({ players: defs, length: length, map: map }), mode: mode, holder: mode === 'duo' ? -1 : 0, log: [] };
    addLog('เริ่มเกม ' + R.MAPS[map].name + ' · ' + LEN_LABEL[length] + ' ' + S.s.rounds + ' รอบ · ' + MODES[mode].label);
    addLog('ตาของ ' + P(0).name);
    save();
    render();
    schedule();
  }

  function setupSheet(canCancel) {
    var mode = opts.mode;
    var length = opts.length;
    var map = opts.map;
    var body = document.createElement('div');
    body.appendChild(FG.label('แผนที่'));
    var mapNote = document.createElement('p');
    mapNote.className = 'rl-note';
    function paintMapNote() {
      mapNote.textContent = R.MAPS[map].blurb;
    }
    body.appendChild(
      FG.choice(
        R.MAP_IDS.map(function (k) {
          return { value: k, label: R.MAPS[k].name };
        }),
        map,
        function (v) {
          map = v;
          paintMapNote();
        }
      )
    );
    paintMapNote();
    body.appendChild(mapNote);
    body.appendChild(FG.label('ผู้เล่น: คุณเล่นกับคอม หรือ 2 คนบนเครื่องเดียว (+ คอม 1 ตัว)'));
    body.appendChild(
      FG.choice(
        Object.keys(MODES).map(function (k) {
          return { value: k, label: MODES[k].short };
        }),
        mode,
        function (v) {
          mode = v;
        }
      )
    );
    body.appendChild(FG.label('ความยาวเกม'));
    body.appendChild(
      FG.choice(
        ['short', 'mid', 'long'].map(function (k) {
          return { value: k, label: LEN_LABEL[k] + ' ' + R.LENGTHS[k] + ' รอบ' };
        }),
        length,
        function (v) {
          length = v;
        }
      )
    );
    var note = document.createElement('p');
    note.className = 'rl-note';
    note.textContent = 'เวลาเล่นโดยประมาณ: สั้น ' + LEN_TIME.short + ' · กลาง ' + LEN_TIME.mid + ' · ยาว ' + LEN_TIME.long + ' · โหมด 2 คน ส่งเครื่องให้กันตอนเปลี่ยนตา';
    body.appendChild(note);
    var actions = [{ label: 'เริ่มเกม', primary: true, onClick: function () { newGame(mode, length, map); } }];
    if (canCancel) actions.unshift({ label: 'ยกเลิก' });
    FG.sheet({ title: 'เกมใหม่', body: body, actions: actions, dismissible: !!canCancel });
  }

  /* ---------- เล่นเหตุการณ์ทีละอัน (มีจังหวะให้ดูทัน) ---------- */
  function run(action) {
    var evs = R.act(S.s, action);
    if (!evs) return false;
    save();
    queue = queue.concat(evs);
    if (!busy) next();
    return true;
  }

  // เหตุการณ์ที่ไม่ต้องรอ (หน่วง 0) ทำต่อกันทันทีในรอบเดียว — กันจอกะพริบ
  function next() {
    clearTimeout(timer);
    for (;;) {
      if (view) {
        render(); // รอผู้เล่นแตะ "ไปต่อ"
        return;
      }
      if (!queue.length) {
        busy = false;
        anim = null;
        render();
        schedule();
        return;
      }
      busy = true;
      var d = handle(queue.shift());
      if (d < 0) continue;
      if (d > 0) {
        render();
        timer = setTimeout(next, d);
        return;
      }
    }
  }

  function handle(e) {
    var who = e.p >= 0 && e.p < S.s.players.length ? e.p : -1;
    var cpuSide = who >= 0 && P(who).cpu;
    switch (e.k) {
      case 'roll':
        addLog(e.t);
        dieEl.textContent = String(e.v);
        dieEl.classList.remove('is-roll');
        void dieEl.offsetWidth;
        dieEl.classList.add('is-roll');
        FG.buzz(10);
        return 380;
      case 'move': {
        // steps < 0 = ถอยหลัง (ไพ่ทรายดูด)
        var size = S.s.board.length;
        var steps = [];
        var dir = e.steps < 0 ? -1 : 1;
        for (var k = 1; k <= Math.abs(e.steps); k++) steps.push({ k: 'step', p: e.p, pos: (((e.from + dir * k) % size) + size) % size });
        anim = { p: e.p, pos: e.from };
        queue = steps.concat(queue);
        return 0;
      }
      case 'step':
        anim = { p: e.p, pos: e.pos };
        return 170;
      case 'warp':
        anim = { p: e.p, pos: e.to };
        FG.buzz(15);
        return 550;
      case 'card':
        addLog(e.t);
        if (isHuman(e.p)) {
          view = { kind: 'card', e: e };
          return -1;
        }
        FG.toast(P(e.p).name + ' เปิดไพ่: ' + e.name, 2200);
        return 1100;
      case 'card-fx':
      case 'ward':
      case 'fest':
      case 'boots':
        addLog(e.t);
        if (e.k === 'fest' || e.k === 'ward') FG.toast(e.t, 2200);
        return cpuSide || e.k !== 'boots' ? 650 : 0;
      case 'turn':
        anim = null;
        addLog(e.t);
        return 250;
      case 'hit':
        if (view && view.kind === 'battle') return 0;
        addLog('  ' + e.t);
        return cpuSide ? 420 : 0;
      case 'battle':
        addLog(e.t);
        return cpuSide ? 600 : 0;
      case 'duel-result':
        addLog(e.t);
        if (isHuman(e.p) || isHuman(e.to)) {
          view = { kind: 'duel', e: e };
          return -1;
        }
        FG.toast(e.t, 2400);
        return 900;
      case 'win':
      case 'lose':
      case 'draw':
      case 'flee':
        addLog(e.t);
        if (!cpuSide && lastBattle) {
          view = { kind: 'battle', e: e, b: lastBattle };
          lastBattle = null;
          return -1;
        }
        FG.toast(e.t, 2000);
        return 700;
      case 'capture':
      case 'level':
      case 'broke':
      case 'nofee':
        addLog(e.t);
        FG.toast(e.t, 2400);
        if (e.k === 'capture' || e.k === 'level') FG.buzz([30, 40, 60]);
        return 900;
      case 'over':
        addLog(e.t);
        recordResult();
        save();
        return 400;
      case 'ask':
        addLog(e.t);
        return cpuSide ? 300 : 0;
      case 'buy':
      case 'invest':
      case 'heal':
      case 'planned':
        addLog(e.t);
        return cpuSide ? 500 : 0;
      default:
        addLog(e.t);
        return cpuSide || e.k === 'toll' || e.k === 'salary' || e.k === 'skip' ? 650 : 400;
    }
  }

  /* ---------- คอม ---------- */
  function schedule() {
    clearTimeout(timer);
    if (!S || busy || view || S.s.phase === 'over') return;
    var d = R.decider(S.s);
    if (d < 0 || !P(d).cpu) return;
    var wait = { roll: 700, decide: 800, battle: 450, duel: 600 }[S.s.phase] || 600;
    timer = setTimeout(function step() {
      if (FG.isSheetOpen() || document.hidden || !coverEl.hidden) {
        timer = setTimeout(step, 500);
        return;
      }
      var a = R.cpuAct(S.s);
      if (!a || !run(a)) {
        // ไม่ควรเกิด — กันเกมค้าง
        run({ type: 'leave' }) || run({ type: 'skip' }) || run({ type: 'roll' });
      }
    }, wait);
  }

  /* ---------- การกระทำของคน ---------- */
  var lastBattle = null;

  function doBattle(action) {
    if (!S || busy || view) return;
    lastBattle = JSON.parse(JSON.stringify(S.s.battle));
    var evs = R.act(S.s, action);
    if (!evs) {
      lastBattle = null;
      if (action.item === 'potion') FG.toast('ใช้ยาไม่ได้ — ไม่มียา หรือพลังชีวิตเต็มอยู่แล้ว', 1800);
      else if (action.item) FG.toast('ใช้ไม่ได้ — ไม่มีของชิ้นนี้', 1600);
      return;
    }
    // อัปเดตภาพหน้าต่างต่อสู้จากผลยกนี้
    evs.forEach(function (e) {
      if (e.k === 'hit') {
        lastBattle.hp = Math.max(0, lastBattle.hp - e.dealt);
        if (e.me !== 'B') lastBattle.n += 1; // ระเบิดไม่นับเป็นยก
        lastBattle.last = { me: e.me, foe: e.foe, dealt: e.dealt, took: e.took };
        if (e.took) FG.buzz(25);
      }
    });
    if (S.s.phase === 'battle') lastBattle = null;
    save();
    queue = queue.concat(evs);
    if (!busy) next();
  }

  function act(action) {
    if (!S || busy || view) return;
    if (!run(action)) FG.toast('ทำแบบนี้ไม่ได้ตอนนี้', 1400);
  }

  /* ---------- วาดจอ ---------- */
  function render() {
    if (!S) return;
    renderPlayers();
    renderBoard();
    renderCenter();
    renderPanel();
    renderOverlay();
  }

  function renderPlayers() {
    var s = S.s;
    var cur = s.phase === 'over' ? -1 : s.turn;
    playersEl.setAttribute('data-n', String(s.players.length));
    playersEl.innerHTML = s.players
      .map(function (p, i) {
        var towns = R.townsOf(s, i).length;
        var hpPct = Math.round((p.hp / p.mhp) * 100);
        return (
          '<button type="button" class="rl-pl ' + SEAT_CLASS[i] + (i === cur ? ' is-turn' : '') + '" data-i="' + i + '">' +
          '<span class="rl-pl__name">' + dot(i) + '<span>' + esc(p.name) + '</span>' + (p.skip ? '<span class="rl-pl__tag">พัก</span>' : '') + '</span>' +
          '<span class="rl-pl__row num">' + svg('coin', 'rl-mini') + FG.fmtNum(p.gold) + '<span class="rl-pl__town">' + svg('town', 'rl-mini') + towns + '</span></span>' +
          '<span class="rl-hp" style="--v:' + hpPct + '%" aria-label="พลังชีวิต ' + p.hp + ' จาก ' + p.mhp + '"></span>' +
          '</button>'
        );
      })
      .join('');
  }

  playersEl.addEventListener('click', function (e) {
    var b = e.target.closest('.rl-pl');
    if (!b || !S) return;
    playerInfo(Number(b.getAttribute('data-i')));
  });

  function renderBoard() {
    var s = S.s;
    buildBoard(s);
    for (var i = 0; i < s.board.length; i++) {
      var sp = s.board[i];
      var el = cells[i];
      var kind = sp.t === 'gold' ? 'chest' : sp.t; // ชนิดช่องเก่า (ถุงเงิน) = หีบสมบัติ
      var cls = 'rl-cell t-' + kind;
      var extra = '';
      var label = R.SPACE_NAME[kind];
      if (sp.t === 'town') {
        var t = s.towns[sp.town];
        label = R.TOWNS[t.i].name;
        if (t.owner >= 0) {
          cls += ' is-owned ' + SEAT_CLASS[t.owner];
          var pips = '';
          for (var l = 0; l < t.level; l++) pips += '<i></i>';
          extra = '<span class="rl-pips">' + pips + '</span>';
          label += ' ของ' + P(t.owner).name + ' ระดับ ' + t.level;
        } else {
          extra = '<span class="rl-tier">' + 'I II III'.split(' ')[R.TOWNS[t.i].tier - 1] + '</span>';
          label += ' (ยังไม่มีเจ้าของ)';
        }
      }
      var toks = '';
      s.players.forEach(function (p, pi) {
        var pos = anim && anim.p === pi ? anim.pos : p.pos;
        if (pos === i) toks += '<span class="rl-tok ' + SEAT_CLASS[pi] + (pi === s.turn && s.phase !== 'over' ? ' is-cur' : '') + '"></span>';
      });
      el.className = cls;
      el.setAttribute('aria-label', 'ช่อง ' + (i + 1) + ': ' + label);
      el.innerHTML = svg(kind) + extra + (toks ? '<span class="rl-toks">' + toks + '</span>' : '');
    }
  }

  function renderCenter() {
    var s = S.s;
    roundEl.textContent = s.phase === 'over' ? 'จบเกม' : 'รอบ ' + s.round + ' / ' + s.rounds + (s.fest > 0 ? ' · เทศกาล ×' + R.FEST_MULT : '');
    roundEl.classList.toggle('is-fest', s.phase !== 'over' && s.fest > 0);
    if (!dieEl.textContent) dieEl.textContent = s.lastRoll ? String(s.lastRoll) : '–';
    logEl.innerHTML = S.log
      .slice(-4)
      .map(function (t) {
        return '<li>' + esc(t.trim()) + '</li>';
      })
      .join('');
  }

  function btn(label, onClick, primary, disabled) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (primary ? ' btn--primary' : '');
    b.innerHTML = label;
    if (disabled) b.disabled = true;
    b.addEventListener('click', onClick);
    return b;
  }

  function renderPanel() {
    var s = S.s;
    actionsEl.innerHTML = '';
    var d = R.decider(s);
    if (s.phase === 'over') {
      msgEl.textContent = s.result.winner < 0 ? 'จบเกม — เสมอกัน' : 'จบเกม — ' + P(s.result.winner).name + ' ชนะ!';
      actionsEl.appendChild(btn('ดูผล', function () {
        hideResult = false;
        render();
      }));
      actionsEl.appendChild(btn('เกมใหม่', function () {
        setupSheet(true);
      }, true));
      return;
    }
    if (busy) {
      msgEl.textContent = P(s.turn).cpu ? P(s.turn).name + ' กำลังเล่น…' : '';
      return;
    }
    if (d < 0 || P(d).cpu) {
      msgEl.textContent = P(d < 0 ? s.turn : d).name + ' กำลังคิด…';
      return;
    }
    var p = P(d);
    if (s.phase === 'roll') {
      msgEl.textContent = 'ตาของ ' + p.name + ' — ' + (p.fast ? 'สวมรองเท้าลมกรดแล้ว ตานี้ทอย 2 ลูก' : 'แตะทอยเต๋า');
      actionsEl.appendChild(
        btn('ยา ×' + p.potion, function () {
          act({ type: 'use', item: 'potion' });
        }, false, p.potion <= 0 || p.hp >= p.mhp)
      );
      if (p.boots > 0 || p.fast) {
        actionsEl.appendChild(
          btn('รองเท้า ×' + p.boots, function () {
            act({ type: 'use', item: 'boots' });
          }, false, p.boots <= 0 || p.fast)
        );
      }
      actionsEl.appendChild(btn(p.fast ? 'ทอย 2 ลูก' : 'ทอยเต๋า', function () {
        act({ type: 'roll' });
      }, true));
      return;
    }
    if (s.phase === 'decide') {
      var k = s.pending.kind;
      if (k === 'duel-offer') {
        msgEl.textContent = 'เจอผู้เล่นอื่น — ท้าประลอง 3 ยก? ชนะได้เงินอีกฝ่าย ' + Math.round(R.DUEL_TAKE * 100) + '% (ไม่เสียพลังชีวิต)';
        s.pending.targets.forEach(function (t) {
          actionsEl.appendChild(btn('ท้า ' + esc(P(t).name), function () {
            act({ type: 'duel', target: t });
          }, true));
        });
        actionsEl.appendChild(btn('ไม่ท้า', function () {
          act({ type: 'skip' });
        }));
        return;
      }
      if (k === 'town') {
        var T = R.townDef(s, s.pending.town);
        var m = R.guardFoe(s, s.pending.town, 1);
        var fee = R.claimFee(s.towns[s.pending.town].i);
        msgEl.innerHTML =
          '<b>' + esc(T.name) + '</b> มี<b>' + esc(m.name) + '</b>เฝ้าอยู่ (พลังชีวิต ' + m.hp + ' · ' + habit(m.bias) + ') · ชนะแล้วจ่ายค่าฟื้นฟู ' + fee + ' เหรียญ ได้เมืองมูลค่า ' + T.base +
          (p.gold < fee ? ' · <span class="rl-warn">เงินยังไม่พอค่าฟื้นฟู</span>' : '');
        actionsEl.appendChild(btn('ผ่านไป', function () {
          act({ type: 'skip' });
        }));
        actionsEl.appendChild(btn(svg('swords', 'rl-btn-ico') + 'สู้ยึดเมือง', function () {
          act({ type: 'fight' });
        }, true));
        return;
      }
      msgEl.textContent = k === 'shop' ? 'แวะร้านพ่อค้าเร่' : 'ขยายเมือง (ต้องสู้ชนะก่อน)';
      return;
    }
    if (s.phase === 'battle') {
      msgEl.textContent = 'กำลังต่อสู้…';
      return;
    }
    if (s.phase === 'duel') msgEl.textContent = 'ประลอง — วางแผน 3 ท่า';
  }

  /* ---------- หน้าต่างเต็มจอ ---------- */
  function showOv(html, kind) {
    ovBox.innerHTML = html;
    ovEl.setAttribute('data-kind', kind);
    ovEl.hidden = false;
  }

  function renderOverlay() {
    var s = S.s;
    // จอบังส่งเครื่อง
    if (needCover()) {
      paintCover();
      ovEl.hidden = true;
      return;
    }
    coverEl.hidden = true;
    if (view && view.kind === 'battle') return battleView(view.b, view.e);
    if (view && view.kind === 'duel') return duelResult(view.e);
    if (view && view.kind === 'card') return cardView(view.e);
    var d = R.decider(s);
    if (s.phase === 'over') {
      if (busy || hideResult) {
        ovEl.hidden = true;
        return;
      }
      return results();
    }
    if (busy || d < 0 || P(d).cpu) {
      ovEl.hidden = true;
      return;
    }
    if (s.phase === 'battle') return battleView(s.battle, null);
    if (s.phase === 'duel') return duelPlan();
    if (s.phase === 'decide' && s.pending.kind === 'shop') return shop();
    if (s.phase === 'decide' && s.pending.kind === 'invest') return invest();
    ovEl.hidden = true;
  }

  function hpBar(cur, max, cls) {
    return '<span class="rl-bar ' + (cls || '') + '"><span style="width:' + Math.round((Math.max(0, cur) / max) * 100) + '%"></span></span>';
  }

  var MOVE_HINT = { A: 'ชนะ โจมตีแรง', H: 'ชนะ ป้องกัน', D: 'ชนะ โจมตี' };

  function battleView(b, endEv) {
    var pi = S.s.turn;
    if (endEv) pi = endEv.p;
    var p = P(pi);
    var last = b.last;
    var lastHtml = '';
    if (last) {
      if (last.me === 'B') lastHtml = esc(p.name) + ' ขว้าง<b>ระเบิดประกายไฟ</b> ทำได้ ' + last.dealt + ' · ' + esc(b.name) + 'ตั้งตัวไม่ทัน';
      else
        lastHtml =
          last.me === 'P'
            ? esc(p.name) + ' ดื่มยา · ' + esc(b.name) + (last.foe === 'D' ? ' ตั้งท่ารอ' : ' ฉวย' + R.MOVE_NAME[last.foe] + ' โดน ' + last.took)
            : esc(p.name) + ' <b>' + R.MOVE_NAME[last.me] + '</b> · ' + esc(b.name) + '<b>' + R.MOVE_NAME[last.foe] + '</b><br>ทำได้ ' + last.dealt + ' · โดน ' + last.took;
    }
    var where = b.town < 0 ? 'ป่ามอนสเตอร์' : b.up ? 'ขยาย' + esc(townName(b.town)) + ' → ระดับ ' + b.up : 'ผู้เฝ้า' + esc(townName(b.town));
    var html =
      '<p class="rl-ov__kicker">' + where + ' · ยกที่ ' + Math.max(1, Math.min(b.n + (endEv ? 0 : 1), R.MAX_EXCHANGES)) + '/' + R.MAX_EXCHANGES + '</p>' +
      '<div class="rl-fight">' +
      '<div class="rl-fighter"><span class="rl-fighter__name">' + svg('monster', 'rl-fighter__ico') + esc(b.name) + '</span>' + hpBar(b.hp, b.mhp, 'is-foe') +
      '<span class="rl-fighter__stat num">' + b.hp + '/' + b.mhp + ' · โจมตี ' + b.atk + ' · ป้องกัน ' + b.def + '</span>' +
      '<span class="rl-habit">นิสัย: ' + habit(b.bias) + '</span></div>' +
      '<div class="rl-fighter"><span class="rl-fighter__name">' + dot(pi) + esc(p.name) + ' Lv ' + p.lv + '</span>' + hpBar(p.hp, p.mhp) +
      '<span class="rl-fighter__stat num">' + p.hp + '/' + p.mhp + ' · โจมตี ' + R.atkOf(p) + ' · ป้องกัน ' + R.defOf(p) + '</span></div>' +
      '</div>' +
      '<p class="rl-last">' + (lastHtml || 'เลือกท่า — อีกฝ่ายเลือกพร้อมกัน') + '</p>';
    if (endEv) {
      html += '<p class="rl-result is-' + endEv.k + '">' + esc(endEv.t) + '</p><div class="rl-ov__actions"><button type="button" class="btn btn--primary" data-go="1">ไปต่อ</button></div>';
      showOv(html, 'battle');
      ovBox.querySelector('[data-go]').addEventListener('click', closeView);
      return;
    }
    html +=
      '<div class="rl-moves">' +
      R.MOVES.map(function (m) {
        return '<button type="button" class="rl-move m-' + m + '" data-m="' + m + '"><b>' + R.MOVE_NAME[m] + '</b><span>' + MOVE_HINT[m] + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="rl-ov__actions rl-items">' +
      '<button type="button" class="btn" data-item="potion"' + (p.potion > 0 && p.hp < p.mhp ? '' : ' disabled') + '>ยา ×' + p.potion + '</button>' +
      '<button type="button" class="btn" data-item="bomb"' + (p.bomb > 0 ? '' : ' disabled') + '>ระเบิด ×' + p.bomb + '</button>' +
      '<button type="button" class="btn" data-item="smoke"' + (p.smoke > 0 ? '' : ' disabled') + '>ลูกควัน ×' + p.smoke + '</button>' +
      '</div>';
    showOv(html, 'battle');
    ovBox.querySelectorAll('[data-m]').forEach(function (el) {
      el.addEventListener('click', function () {
        doBattle({ type: 'move', m: el.getAttribute('data-m') });
      });
    });
    ovBox.querySelectorAll('[data-item]').forEach(function (el) {
      el.addEventListener('click', function () {
        doBattle({ type: 'use', item: el.getAttribute('data-item') });
      });
    });
  }

  function closeView() {
    view = null;
    next();
  }

  function duelPlan() {
    var d = S.s.duel;
    var me = R.decider(S.s);
    var foe = me === d.a ? d.b : d.a;
    var challenged = me === d.b;
    var html =
      '<p class="rl-ov__kicker">ประลอง 3 ยก · ไม่เสียพลังชีวิต · ชนะได้เงินอีกฝ่าย ' + Math.round(R.DUEL_TAKE * 100) + '%</p>' +
      '<h2 class="rl-ov__title">' + dot(me) + esc(P(me).name) + ' วางแผน 3 ท่า</h2>' +
      '<p class="rl-note">' + (challenged ? esc(P(d.a).name) + ' ท้าคุณ! ' : '') + 'คู่ประลอง: ' + esc(P(foe).name) + ' (โจมตี ' + R.atkOf(P(foe)) + ' · ป้องกัน ' + R.defOf(P(foe)) + ') · ใครทำแรงรวมได้มากกว่าชนะ' + (humans() >= 2 && !P(foe).cpu ? ' · อีกคนห้ามดู' : '') + '</p>' +
      '<div class="rl-slots">' +
      [0, 1, 2]
        .map(function (k) {
          var m = plan[k];
          return '<button type="button" class="rl-slot' + (m ? ' m-' + m : '') + '" data-slot="' + k + '">' + '<span>ยก ' + (k + 1) + '</span><b>' + (m ? R.MOVE_NAME[m] : '—') + '</b></button>';
        })
        .join('') +
      '</div>' +
      '<div class="rl-moves">' +
      R.MOVES.map(function (m) {
        return '<button type="button" class="rl-move m-' + m + '" data-m="' + m + '"' + (plan.length >= 3 ? ' disabled' : '') + '><b>' + R.MOVE_NAME[m] + '</b><span>' + MOVE_HINT[m] + '</span></button>';
      }).join('') +
      '</div>' +
      '<div class="rl-ov__actions"><button type="button" class="btn" data-clear="1">ล้าง</button><button type="button" class="btn btn--primary" data-ok="1"' + (plan.length === 3 ? '' : ' disabled') + '>ยืนยันแผน</button></div>';
    showOv(html, 'duel');
    ovBox.querySelectorAll('[data-m]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (plan.length < 3) plan.push(el.getAttribute('data-m'));
        renderOverlay();
      });
    });
    ovBox.querySelectorAll('[data-slot]').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = Number(el.getAttribute('data-slot'));
        if (k < plan.length) plan.splice(k, 1);
        renderOverlay();
      });
    });
    ovBox.querySelector('[data-clear]').addEventListener('click', function () {
      plan = [];
      renderOverlay();
    });
    ovBox.querySelector('[data-ok]').addEventListener('click', function () {
      if (plan.length !== 3) return;
      var moves = plan.slice();
      plan = [];
      act({ type: 'plan', moves: moves });
    });
  }

  function duelResult(e) {
    var rows = e.rounds
      .map(function (r, k) {
        return (
          '<tr><th>ยก ' + (k + 1) + '</th><td>' + R.MOVE_NAME[r.a] + ' <span class="num">' + r.da + '</span></td><td>' + R.MOVE_NAME[r.b] + ' <span class="num">' + r.db + '</span></td></tr>'
        );
      })
      .join('');
    var html =
      '<p class="rl-ov__kicker">ผลประลอง</p>' +
      '<table class="rl-duel"><thead><tr><th></th><th>' + dot(e.p) + esc(P(e.p).name) + '</th><th>' + dot(e.to) + esc(P(e.to).name) + '</th></tr></thead><tbody>' + rows +
      '<tr class="rl-duel__sum"><th>รวม</th><td class="num">' + e.dmg[0] + '</td><td class="num">' + e.dmg[1] + '</td></tr></tbody></table>' +
      '<p class="rl-result' + (e.winner < 0 ? '' : ' is-win') + '">' + esc(e.t) + '</p>' +
      '<div class="rl-ov__actions"><button type="button" class="btn btn--primary" data-go="1">ไปต่อ</button></div>';
    showOv(html, 'duel');
    ovBox.querySelector('[data-go]').addEventListener('click', closeView);
  }

  // ไพ่เหตุการณ์ของคน: แสดงไพ่ให้อ่านก่อน แล้วแตะไปต่อ (ผลเกิดแล้วในเครื่องยนต์ บันทึกอยู่ในบันทึกเหตุการณ์)
  function cardView(e) {
    var html =
      '<p class="rl-ov__kicker">' + dot(e.p) + esc(P(e.p).name) + ' · ศาลาเสี่ยงทาย</p>' +
      '<div class="rl-card ' + (e.good ? 'is-good' : 'is-bad') + '">' +
      '<span class="rl-card__tag">' + (e.good ? 'ไพ่ดี' : 'ไพ่ร้าย') + '</span>' +
      svg('card', 'rl-card__ico') +
      '<h2 class="rl-card__name">' + esc(e.name) + '</h2>' +
      '<p class="rl-card__text">' + esc(e.text) + '</p>' +
      '</div>' +
      '<div class="rl-ov__actions"><button type="button" class="btn btn--primary" data-go="1">ไปต่อ</button></div>';
    showOv(html, 'card');
    ovBox.querySelector('[data-go]').addEventListener('click', closeView);
  }

  function gearText(p) {
    var c = R.charmOf(p);
    return (p.w >= 0 ? R.WEAPONS[p.w].name : 'มือเปล่า') + ' · ' + (p.ar >= 0 ? R.ARMORS[p.ar].name : 'ไม่มีเกราะ') + ' · ' + (c ? c.name : 'ไม่มีเครื่องราง');
  }

  function bagText(p) {
    return R.ITEM_IDS.map(function (id) {
      return R.ITEMS[id].name + ' ' + p[id];
    }).join(' · ');
  }

  var SHOP_GROUPS = [
    { id: 'item', label: 'ของใช้ (ใช้แล้วหมด)' },
    { id: 'gear', label: 'อาวุธ · เกราะ (อัปเกรดทีละขั้น)' },
    { id: 'charm', label: 'เครื่องราง (ใส่ได้ชิ้นเดียว)' }
  ];

  function shop() {
    var p = P(S.s.turn);
    var list = R.shopList(p);
    var html =
      '<h2 class="rl-ov__title">' + svg('shop', 'rl-title-ico') + 'ร้านพ่อค้าเร่</h2>' +
      '<p class="rl-note">' + esc(p.name) + ' มี <b class="num">' + FG.fmtNum(p.gold) + '</b> เหรียญ<br>ตอนนี้ใช้: ' + esc(gearText(p)) + '</p>';
    SHOP_GROUPS.forEach(function (g) {
      var rows = list.filter(function (it) {
        return it.group === g.id;
      });
      if (!rows.length) return;
      html +=
        '<p class="rl-group">' + g.label + '</p><ul class="rl-list">' +
        rows
          .map(function (it) {
            return (
              '<li><span><b>' + esc(it.name) + '</b><small>' + esc(it.note) + '</small></span>' +
              '<button type="button" class="btn" data-buy="' + it.id + '"' + (it.ok ? '' : ' disabled') + '><span class="num">' + it.price + '</span></button></li>'
            );
          })
          .join('') +
        '</ul>';
    });
    html += '<div class="rl-ov__actions"><button type="button" class="btn btn--primary" data-leave="1">ออกจากร้าน</button></div>';
    showOv(html, 'shop');
    ovBox.querySelectorAll('[data-buy]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (run({ type: 'buy', item: el.getAttribute('data-buy') })) FG.buzz(10);
      });
    });
    ovBox.querySelector('[data-leave]').addEventListener('click', function () {
      act({ type: 'leave' });
    });
  }

  function invest() {
    var s = S.s;
    var p = P(s.turn);
    var html =
      '<h2 class="rl-ov__title">' + svg('town', 'rl-title-ico') + 'ขยายเมือง</h2>' +
      '<p class="rl-note">' + (s.pending.bank ? 'ผ่านลานประตูเมือง เลือกขยายได้ 1 เมือง · ' : '') + 'มี <b class="num">' + FG.fmtNum(p.gold) + '</b> เหรียญ · พลังชีวิต ' + p.hp + '/' + p.mhp +
      '<br>ขยายทีละ 1 ระดับ: <b>ต้องสู้ชนะหัวหน้าผู้เฝ้าก่อน</b> แล้วจึงจ่ายค่าลงทุน (แพ้ = เหรียญหล่น + พักฟื้น 1 ตา ไม่เสียค่าลงทุน · หนีได้ด้วยลูกควัน)</p>' +
      '<ul class="rl-list">';
    s.pending.towns.forEach(function (ti) {
      var t = s.towns[ti];
      var cost = R.investCost(t);
      var foe = R.upgradeFoe(s, ti);
      t.level += 1;
      var nt = R.toll(t);
      t.level -= 1;
      html +=
        '<li class="rl-inv"><span><b>' + esc(townName(ti)) + '</b><small>ระดับ ' + t.level + ' → ' + (t.level + 1) + ' · ค่าลงทุน ' + cost + ' · ค่าผ่านทาง ' + R.toll(t) + ' → ' + nt + '</small>' +
        '<small class="rl-foe">' + svg('monster', 'rl-mini') + esc(foe.name) + ': พลังชีวิต ' + foe.hp + ' · โจมตี ' + foe.atk + ' · ป้องกัน ' + foe.def + ' · ' + habit(foe.bias) + '</small></span>' +
        '<span class="rl-inv__btns"><button type="button" class="btn" data-town="' + ti + '"' + (cost <= p.gold ? '' : ' disabled') + '>' + svg('swords', 'rl-btn-ico') + 'สู้เพื่อขยาย</button></span></li>';
    });
    html += '</ul><div class="rl-ov__actions"><button type="button" class="btn btn--primary" data-no="1">ไม่ขยาย</button></div>';
    showOv(html, 'invest');
    ovBox.querySelectorAll('[data-town]').forEach(function (el) {
      el.addEventListener('click', function () {
        act({ type: 'invest', town: Number(el.getAttribute('data-town')), levels: 1 });
      });
    });
    ovBox.querySelector('[data-no]').addEventListener('click', function () {
      act({ type: 'invest', levels: 0 });
    });
  }

  function results() {
    var s = S.s;
    var r = s.result;
    var rows = r.rank
      .map(function (x, k) {
        var p = P(x.p);
        return (
          '<tr' + (k === 0 && r.winner >= 0 ? ' class="is-first"' : '') + '><th>' + (k + 1) + '</th><td>' + dot(x.p) + esc(p.name) + '</td><td class="num">' + FG.fmtNum(x.gold) + '</td><td class="num">' + FG.fmtNum(x.towns) + ' <small>(' + x.count + ')</small></td><td class="num">' + FG.fmtNum(x.gear || 0) + '</td><td class="num"><b>' + FG.fmtNum(x.total) + '</b></td></tr>'
        );
      })
      .join('');
    var facts = s.players
      .map(function (p, i) {
        return dot(i) + esc(p.name) + ': Lv ' + p.lv + ' · ชนะมอนสเตอร์ ' + p.st.wins + ' · แพ้ ' + p.st.losses + ' · ยึดเมือง ' + p.st.captured + ' · ขยายเมือง ' + (p.st.upWin || 0) + '/' + (p.st.upTry || 0) + ' · ได้ค่าผ่านทาง ' + p.st.tollGot;
      })
      .join('<br>');
    var html =
      '<p class="rl-ov__kicker">จบ ' + s.rounds + ' รอบ</p>' +
      '<h2 class="rl-ov__title rl-win">' + (r.winner < 0 ? 'เสมอกัน!' : dot(r.winner) + esc(P(r.winner).name) + ' ชนะ!') + '</h2>' +
      '<table class="rl-rank"><thead><tr><th></th><th>ผู้เล่น</th><th>เงิน</th><th>เมือง</th><th>อุปกรณ์ <small>(ครึ่งราคา)</small></th><th>รวม</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<p class="rl-note">คะแนนรวม = เงิน + มูลค่าเมือง + อุปกรณ์ที่ถืออยู่ (อาวุธ เกราะ เครื่องราง) นับครึ่งราคาซื้อ · ของใช้ไม่นับ</p>' +
      '<p class="rl-note">' + facts + '</p>' +
      '<div class="rl-ov__actions"><button type="button" class="btn" data-see="1">ดูกระดาน</button><button type="button" class="btn btn--primary" data-new="1">เกมใหม่</button></div>';
    showOv(html, 'over');
    ovBox.querySelector('[data-see]').addEventListener('click', function () {
      hideResult = true;
      render();
    });
    ovBox.querySelector('[data-new]').addEventListener('click', function () {
      setupSheet(true);
    });
  }

  /* ---------- จอบัง ---------- */
  function paintCover() {
    var s = S.s;
    var d = R.decider(s);
    coverEl.className = 'rl-cover ' + SEAT_CLASS[d];
    document.getElementById('cover-title').textContent = 'ส่งเครื่องให้' + P(d).name;
    var why = 'ตาของ' + P(d).name;
    if (s.phase === 'duel') why = P(d).name + 'วางแผนประลองลับ ๆ — อีกคนหันหน้าไปก่อน';
    else if (s.phase !== 'roll') why = 'ถึงคิว' + P(d).name + 'ตัดสินใจ';
    document.getElementById('cover-text').textContent = why;
    if (coverEl.hidden) coverAt = Date.now();
    coverEl.hidden = false;
  }

  coverEl.addEventListener('click', function () {
    if (Date.now() - coverAt < 450) return;
    S.holder = R.decider(S.s);
    coverEl.hidden = true;
    save();
    render();
    schedule();
  });

  /* ---------- ข้อมูลช่อง / ผู้เล่น / บันทึก ---------- */
  function cellInfo(i) {
    if (!S || busy) return;
    var s = S.s;
    var sp = s.board[i];
    var here = s.players
      .map(function (p, pi) {
        return p.pos === i ? p.name : null;
      })
      .filter(Boolean);
    var text = '';
    var kind = sp.t === 'gold' ? 'chest' : sp.t;
    var title = R.SPACE_NAME[kind];
    var DESC = {
      start: 'ผ่าน = รับเงินหลวง ' + R.SALARY + ' + 10 ต่อเมืองที่มี (คนทรัพย์น้อยสุดได้เพิ่ม) แล้วขยายเมืองได้ 1 เมือง (ต้องสู้ชนะก่อน) · หยุดพอดี = โบนัสเพิ่ม',
      monster: 'เจอมอนสเตอร์สุ่ม ยิ่งท้ายเกมยิ่งเก่ง · ชนะได้เงิน + ค่าประสบการณ์',
      chest: 'ครึ่งหนึ่งได้เงิน 20–60 (ท้ายเกมได้มากขึ้น) · อีกครึ่งได้ของ: ยา · ลูกควัน · ระเบิด · รองเท้า · ยันต์ · ยาเสริมแรง · ผลโอ๊กเพิ่มพลังชีวิต',
      card: 'เปิดไพ่เหตุการณ์ 1 ใบ (ไพ่ดี 10 · ไพ่ร้าย 6 ในกอง 16 ใบ) · ไพ่ร้ายเสียไม่เกิน 60 · ยันต์กันเคราะห์กันไพ่ร้ายได้',
      shop: 'ซื้อของใช้ อาวุธ เกราะ (4 ขั้น) และเครื่องราง',
      rest: 'พลังชีวิตกลับมาเต็ม'
    };
    if (sp.t === 'town') {
      var t = s.towns[sp.town];
      var T = R.TOWNS[t.i];
      title = T.name;
      if (t.owner < 0) {
        var m = R.guardFoe(s, sp.town, 1);
        text = 'ยังไม่มีเจ้าของ · ผู้เฝ้า: ' + m.name + ' (พลังชีวิต ' + m.hp + ' · ' + habit(m.bias) + ') · ชนะแล้วจ่ายค่าฟื้นฟู ' + R.claimFee(t.i) + ' · มูลค่า ' + T.base;
      } else {
        text = 'ของ ' + P(t.owner).name + ' · ระดับ ' + t.level + '/' + R.MAX_TOWN_LEVEL + ' · มูลค่า ' + R.townValue(t) + ' · ค่าผ่านทาง ' + R.toll(t) + (s.fest > 0 ? ' (ช่วงเทศกาล ×' + R.FEST_MULT + ')' : '');
        if (t.level < R.MAX_TOWN_LEVEL) {
          var up = R.upgradeFoe(s, sp.town);
          text += ' · ขยายต่อ: สู้' + up.name + ' (พลังชีวิต ' + up.hp + ') แล้วจ่าย ' + R.investCost(t);
        }
      }
    } else text = DESC[kind] || '';
    if (here.length) text += ' · อยู่ที่นี่: ' + here.join(', ');
    FG.sheet({ title: title, text: esc(text), actions: [{ label: 'ปิด', primary: true }] });
  }

  function playerInfo(i) {
    var p = P(i);
    var s = S.s;
    var towns = R.townsOf(s, i)
      .map(function (t) {
        return R.TOWNS[t.i].name + ' (ระดับ ' + t.level + ')';
      })
      .join(', ');
    var charm = R.charmOf(p);
    var text =
      'Lv ' + p.lv + ' (ค่าประสบการณ์ ' + p.xp + '/' + R.xpNeed(p.lv) + ') · พลังชีวิต ' + p.hp + '/' + p.mhp + '<br>' +
      'โจมตี ' + R.atkOf(p) + (p.w >= 0 ? ' (' + esc(R.WEAPONS[p.w].name) + ' ขั้น ' + (p.w + 1) + ')' : '') + ' · ป้องกัน ' + R.defOf(p) + (p.ar >= 0 ? ' (' + esc(R.ARMORS[p.ar].name) + ' ขั้น ' + (p.ar + 1) + ')' : '') + '<br>' +
      'เครื่องราง: ' + (charm ? '<b>' + esc(charm.name) + '</b> — ' + esc(charm.note) : 'ยังไม่มี') + '<br>' +
      esc(bagText(p)) + '<br>เงิน ' + FG.fmtNum(p.gold) + '<br>' +
      'เมือง: ' + (towns ? esc(towns) : 'ยังไม่มี') + '<br>อุปกรณ์ (ครึ่งราคา): ' + FG.fmtNum(R.gearValue(p)) + '<br>ทรัพย์รวม (เงิน + มูลค่าเมือง + อุปกรณ์ครึ่งราคา): <b>' + FG.fmtNum(R.total(s, i)) + '</b>';
    FG.sheet({ title: esc(p.name) + (p.cpu ? ' (คอม)' : ''), text: text, actions: [{ label: 'ปิด', primary: true }] });
  }

  function showLog() {
    if (!S) return;
    var ol = document.createElement('ol');
    ol.className = 'rl-fulllog';
    ol.innerHTML = S.log
      .slice()
      .reverse()
      .map(function (t) {
        return '<li>' + esc(t.trim()) + '</li>';
      })
      .join('');
    FG.sheet({ title: 'เหตุการณ์ล่าสุด', body: ol, actions: [{ label: 'ปิด', primary: true }] });
  }

  // แตะกลางกระดาน = ดูเหตุการณ์ย้อนหลัง
  centerEl.addEventListener('click', showLog);

  document.getElementById('restart').addEventListener('click', function () {
    if (S && S.s.phase !== 'over') {
      FG.sheet({
        title: 'เริ่มเกมใหม่?',
        text: 'เกมที่เล่นค้างอยู่ (รอบ ' + S.s.round + '/' + S.s.rounds + ') จะหายไป',
        actions: [{ label: 'เล่นต่อ' }, { label: 'เริ่มใหม่', primary: true, onClick: function () { setTimeout(function () { setupSheet(true); }, 0); } }]
      });
      return;
    }
    setupSheet(true);
  });

  // ⚙️ (v8): แผนที่ / ผู้เล่น / ความยาว ยังเลือกที่หน้า "เกมใหม่" (ปุ่ม ↻) เหมือนเดิม — ที่นี่บอกค่าของเกมนี้ + ขอบล่างจอ
  FG.openSettings = function () {
    FG.settings({
      build: function (body) {
        var now = S
          ? R.mapOf(S.s).name + ' · ' + MODES[S.mode].label + ' · ' + (S.s.phase === 'over' ? 'จบแล้ว ' + S.s.rounds + ' รอบ' : 'รอบ ' + S.s.round + '/' + S.s.rounds)
          : 'ยังไม่ได้เริ่มเกม';
        body.appendChild(FG.group('เกมนี้', null, now));
        body.appendChild(FG.group('', null, 'แผนที่ · ผู้เล่น · ความยาวเกม เลือกได้ตอนเริ่มเกมใหม่ (ปุ่มลูกศรวงกลมบนแถบหัว)'));
      }
    });
  };

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && S && !busy) schedule();
  });

  /* ---------- เปิดหน้า ---------- */
  (function boot() {
    var saved = FG.store.get(KEY, null);
    // เซฟรุ่นเก่า (v1 ยังไม่มีแผนที่) → แปลงเป็นรุ่นปัจจุบันบนแผนที่ฉบับเดิม · เซฟเสียหาย = เริ่มใหม่
    var loaded = saved && saved.s && MODES[saved.mode] ? R.migrate(saved.s) : null;
    if (loaded) {
      S = { s: loaded, mode: saved.mode, holder: saved.holder == null ? -1 : saved.holder, log: Array.isArray(saved.log) ? saved.log : [] };
      if (S.s.phase !== 'over') {
        if (humans() >= 2) S.holder = -1; // เปิดกลับมา = ขึ้นจอบังก่อนเสมอ
        render();
        FG.sheet({
          title: 'มีเกมค้างอยู่',
          text: R.mapOf(S.s).name + ' · ' + MODES[S.mode].label + ' · รอบ ' + S.s.round + '/' + S.s.rounds,
          actions: [
            { label: 'เริ่มใหม่', onClick: function () { setTimeout(function () { setupSheet(true); }, 0); } },
            { label: 'เล่นต่อ', primary: true, onClick: schedule }
          ],
          onDismiss: schedule
        });
        return;
      }
      hideResult = true;
      render();
      setupSheet(true);
      return;
    }
    // ยังไม่เคยเล่น: วาดกระดานเปล่าไว้ข้างหลังหน้าตั้งค่า
    S = { s: R.newGame({ players: MODES[opts.mode].players, length: opts.length, map: opts.map, seed: 1 }), mode: opts.mode, holder: 0, log: [] };
    hideResult = true;
    render();
    S = null;
    setupSheet(false);
  })();
})();
