/* หมากฮอสไทย — หน้าจอ (2 คน หรือเล่นกับคอม ai.js): แตะหมาก → เห็นช่องที่ไปได้, บังคับกิน (ปิดได้ในตั้งค่า), กินต่อทีละช่อง, ขอเสมอ, ตำแหน่งซ้ำ 3 ครั้ง = เสมอ */
(function () {
  'use strict';

  var M = window.Makhos;
  var KEY = 'makhos:state';
  var FORCE_KEY = 'makhos:force';
  var CROWN =
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5z"/></svg>';
  var CHIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6" fill="none" stroke="var(--color-paper)" stroke-opacity="0.35" stroke-width="2"/></svg>';

  var boardEl = document.getElementById('board');
  var hintEl = document.getElementById('hint');
  var duo = FGDuo.create({
    id: 'makhos',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return CHIP;
    },
    action: { label: 'ขอเสมอ', onClick: offerDraw },
    ai: true
  });

  // S = { g: สถานะจาก engine { board, turn, rep, over, last }, starter, agreed: bool }
  var S;
  var sel = null; // { from, step, cands:[moves], at }
  var legal = [];
  var sqEls = [];
  var endedAt = 0;
  var arrivedAt = -1;

  function force() {
    return FG.store.get(FORCE_KEY, true) !== false;
  }

  function opts() {
    return { forceCapture: force() };
  }

  for (var i = 0; i < 64; i++) {
    var dark = M.isDark(i);
    var el = document.createElement(dark ? 'button' : 'div');
    el.className = 'mk-sq' + (dark ? ' is-dark' : '');
    if (dark) {
      el.type = 'button';
      el.setAttribute('role', 'gridcell');
      el.addEventListener('click', onTap.bind(null, i));
    }
    boardEl.appendChild(el);
    sqEls.push(el);
  }

  function fresh(starter) {
    return { g: M.newGame(starter), starter: starter, agreed: false };
  }

  function isOver() {
    return !!(S.g.over || S.agreed);
  }

  function moveCount() {
    // มีการเดินไปแล้วหรือยัง (ไว้ตัดสินว่า "เล่นค้าง" + ต้องถามก่อนเริ่มใหม่)
    return S.g.last ? 1 : 0;
  }

  function hasForcedCapture() {
    return force() && legal.length > 0 && legal[0].captures.length > 0;
  }

  /* ---------- input ---------- */
  function onTap(i) {
    if (FG.isSheetOpen()) return;
    if (isOver()) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    var turn = S.g.turn;
    if (duo.isCPU(turn)) return; // รอคอมเดิน

    if (sel) {
      var hopCands = sel.cands.filter(function (m) {
        return m.path[sel.step] === i;
      });
      if (hopCands.length) {
        if (hopCands.length === 1) {
          execute(hopCands[0]);
        } else {
          sel = { from: sel.from, step: sel.step + 1, cands: hopCands, at: i };
          render();
        }
        return;
      }
      if (sel.step > 0 && i === sel.from) {
        sel = null;
        render();
        return;
      }
    }

    if (M.owner(S.g.board[i]) === turn) {
      var mine = legal.filter(function (m) {
        return m.from === i;
      });
      if (!mine.length) {
        sel = null;
        render();
        if (hasForcedCapture()) FG.toast('ต้องกินก่อน — เลือกตัวที่มีวงสีเหลือง');
        else FG.toast('ตัวนี้เดินไม่ได้ตอนนี้');
        return;
      }
      sel = sel && sel.from === i && sel.step === 0 ? null : { from: i, step: 0, cands: mine, at: i };
      render();
      return;
    }

    if (sel) {
      sel = null;
      render();
    }
  }

  function execute(move) {
    var mover = S.g.turn;
    S.g = M.play(S.g, move, opts());
    sel = null;
    arrivedAt = move.path[move.path.length - 1];
    FG.buzz(move.captures.length ? 25 : 10);
    if (move.promote) FG.toast(duo.name(mover) + 'ได้ฮอส!', 1400);
    if (S.g.over) {
      endedAt = Date.now();
      if (S.g.over.draw) duo.draw();
      else duo.win(S.g.over.w);
    }
    render();
    save();
    if (S.g.over) setTimeout(showResult, 700);
    else cpuTurn();
  }

  // ถึงตาคอม → คิดจากตาเดินที่ถูกกติกาเท่านั้น (บังคับกิน/ไม่บังคับ ตามตั้งค่าตอนนั้น)
  function cpuTurn() {
    if (isOver() || !duo.isCPU(S.g.turn)) return;
    duo.cpuMove(
      function () {
        return MakhosAI.choose(S.g.board, S.g.turn, duo.level(), null, { forceCapture: force() });
      },
      function (mv) {
        if (!mv || isOver() || !duo.isCPU(S.g.turn)) return;
        var ok = M.legalMoves(S.g.board, S.g.turn, opts()).filter(function (m) {
          return M.sameMove(m, mv);
        })[0];
        if (ok) execute(ok);
        else cpuTurn(); // กติกาเปลี่ยนระหว่างคิด → คิดใหม่
      }
    );
  }

  function agreeDraw() {
    S.agreed = true;
    endedAt = Date.now();
    sel = null;
    duo.cancelCPU();
    duo.draw();
    render();
    save();
    setTimeout(showResult, 300);
  }

  function offerDraw(p) {
    if (duo.isAI()) {
      // เล่นกับคอม: คอมตัดสินเอง — ยอมเมื่อไม่ได้เปรียบชัดเจน
      if (MakhosAI.acceptsDraw(S.g.board, 1)) {
        FG.toast('คอมตกลงเสมอ');
        agreeDraw();
      } else {
        FG.toast('คอมไม่ตกลง — เล่นต่อ', 2000);
      }
      return;
    }
    var dlg = FG.sheet({
      title: duo.name(p) + 'ขอเสมอ',
      text: duo.name(1 - p) + ' ตกลงให้ตานี้เสมอไหม?',
      actions: [
        { label: 'ไม่ตกลง', onClick: function () { FG.toast('เล่นต่อ — ตาของ' + duo.name(p)); } },
        {
          label: 'ตกลง เสมอ',
          primary: true,
          onClick: agreeDraw
        }
      ]
    });
    duo.faceSheet(dlg, 1 - p);
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(1 - S.starter);
    sel = null;
    arrivedAt = -1;
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(S.starter);
    sel = null;
    arrivedAt = -1;
    render();
    save();
    cpuTurn();
  }

  function showResult() {
    if (!isOver()) return;
    if (S.agreed) {
      duo.showResult({ title: 'เสมอ', text: 'ตกลงเสมอกัน', onNext: nextRound });
    } else if (S.g.over.draw) {
      duo.showResult({ title: 'เสมอ', text: 'ตำแหน่งเดิมวนซ้ำครบ 3 ครั้ง', onNext: nextRound });
    } else {
      var w = S.g.over.w;
      var why = M.count(S.g.board, 1 - w) === 0 ? 'กินหมากอีกฝ่ายหมดกระดาน' : duo.name(1 - w) + 'ไม่มีตาเดินแล้ว';
      duo.showResult({ title: duo.name(w) + 'ชนะ!', text: why, onNext: nextRound, faceTo: w });
    }
  }

  /* ---------- render ---------- */
  function render() {
    var over = isOver();
    var b = S.g.board;
    legal = over ? [] : M.legalMoves(b, S.g.turn, opts());
    var forced = hasForcedCapture();
    var capturers = {};
    if (forced && !sel) legal.forEach(function (m) { capturers[m.from] = true; });

    var targets = {};
    var taken = {};
    var at = -1;
    if (sel) {
      sel.cands.forEach(function (m) {
        var t = m.path[sel.step];
        if (t != null) targets[t] = m.captures.length > 0;
      });
      if (sel.step > 0) {
        at = sel.at;
        sel.cands[0].captures.slice(0, sel.step).forEach(function (c) { taken[c] = true; });
      }
    }

    var last = S.g.last;
    var lastSq = {};
    var lastCap = {};
    if (last && !sel) {
      lastSq[last.from] = true;
      lastSq[last.to] = true;
      last.captures.forEach(function (c) { lastCap[c] = true; });
    }

    for (var i = 0; i < 64; i++) {
      if (!M.isDark(i)) continue;
      var el = sqEls[i];
      var v = b[i];
      var showV = v;
      var ghost = false;
      if (sel && sel.step > 0) {
        if (i === sel.from) ghost = true;
        if (i === at) showV = b[sel.from];
      }
      var html = '';
      if (showV) {
        var p = M.owner(showV);
        var cls = 'mk-piece';
        if (ghost) cls += ' is-ghost';
        if (taken[i]) cls += ' is-taken';
        if (i === arrivedAt && !sel) cls += ' is-arrived';
        html = '<span class="' + cls + '" data-p="' + p + '">' + (M.isKing(showV) ? CROWN : '') + '</span>';
      }
      if (el._html !== html) {
        el.innerHTML = html;
        el._html = html;
      }
      el.classList.toggle('can-capture', !!capturers[i]);
      el.classList.toggle('is-sel', !!sel && i === (sel.step > 0 ? at : sel.from));
      el.classList.toggle('is-target', i in targets);
      el.classList.toggle('is-capture-hop', !!targets[i]);
      el.classList.toggle('is-last', !!lastSq[i]);
      el.classList.toggle('is-lastcap', !!lastCap[i]);
      el.setAttribute('aria-label', label(i, v, i in targets));
    }
    arrivedAt = -1;

    duo.setLive(0, String(M.count(b, 0)));
    duo.setLive(1, String(M.count(b, 1)));
    if (over) duo.setResult(S.agreed || S.g.over.draw ? 'draw' : S.g.over.w);
    else duo.setResult(null);
    duo.setTurn(over ? null : S.g.turn);

    var hint = '';
    if (!over) {
      if (sel && sel.step > 0) hint = 'กินต่อได้อีก — แตะวงสีเหลืองช่องถัดไป';
      else if (sel) hint = 'แตะจุดสีเหลืองเพื่อเดิน · แตะหมากตัวเดิมเพื่อยกเลิก';
      else if (forced) hint = 'มีทางกิน ต้องกิน — ตัวที่กินได้มีวงสีเหลือง';
      else if (duo.isCPU(S.g.turn)) hint = 'คอมกำลังคิด…';
      else hint = 'ตาของ' + duo.name(S.g.turn) + ' — แตะหมากที่จะเดิน';
    } else {
      hint = 'แตะกระดานเพื่อเล่นตาต่อไป';
    }
    hintEl.textContent = hint;
  }

  function label(i, v, isTarget) {
    var r = (i >> 3) + 1;
    var c = (i & 7) + 1;
    var what = v ? (v <= 2 ? 'แดง' : 'ฟ้า') + (M.isKing(v) ? ' ฮอส' : ' เบี้ย') : 'ว่าง';
    return 'แถว ' + r + ' ช่อง ' + c + ' ' + what + (isTarget ? ' เดินมาที่นี่ได้' : '');
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!isOver() && moveCount() > 0);
  }

  /* ---------- วิธีเล่น (ปุ่ม ⓘ): ข้อสั้นจาก games.js + กติกาบ้านเรา + กติกาเต็ม (กดเปิดอ่าน) ---------- */
  function rulesList() {
    var ul = document.createElement('ul');
    ul.className = 'mk-rules';
    ul.innerHTML = [
      'เล่นเฉพาะ<b>ช่องสีเข้ม</b> ฝ่ายละ 8 ตัว แดงอยู่ล่าง ฟ้าอยู่บน สลับกันเริ่มทุกตา',
      '<b>เบี้ย</b>เดินทแยงไปข้างหน้าทีละ 1 ช่อง ถอยหลังไม่ได้ กินก็กินไปข้างหน้าเท่านั้น',
      'กิน = กระโดดข้ามหมากอีกฝ่ายที่อยู่ติดกัน ไปลงช่องว่างถัดไป',
      force()
        ? '<b>บังคับกิน</b> — ถ้ามีทางกิน ต้องกิน เดินธรรมดาไม่ได้ (ตัวที่กินได้มีวงสีเหลือง)'
        : '<b>ไม่บังคับกิน</b> (ตั้งไว้ในตั้งค่า) — มีทางกินก็เลือกเดินธรรมดาได้',
      'กินแล้วยังกินต่อได้ <b>ต้องกินต่อจนสุด</b> · มีหลายทางให้กิน <b>เลือกได้ตามใจ</b> ไม่ต้องเลือกทางที่ได้มากสุด',
      'เบี้ยถึงแถวสุดท้ายฝั่งตรงข้าม = กลายเป็น<b>ฮอส</b> (มีมงกุฎ) และจบตานั้นทันที',
      '<b>ฮอส</b>เดินทแยงได้ไกลกี่ช่องก็ได้ ทั้งหน้าและหลัง แต่เวลากิน <b>ต้องลงช่องที่ติดหลังตัวที่ถูกกินทันที</b> แล้วกินต่อจากตรงนั้นได้',
      '<b>ชนะ</b> เมื่ออีกฝ่ายไม่เหลือหมาก หรือไม่มีตาเดิน',
      '<b>เสมอ</b> เมื่อกด "ขอเสมอ" แล้วอีกฝ่ายตกลง หรือตำแหน่งเดิมวนซ้ำครบ 3 ครั้ง'
    ]
      .map(function (t) {
        return '<li>' + t + '</li>';
      })
      .join('');
    return ul;
  }

  FG.howtoExtra = function (box) {
    var house = document.createElement('div');
    house.className = 'howto';
    house.appendChild(FG.label('กติกาบ้านเรา (เปลี่ยนได้ในตั้งค่า)'));
    var ul = document.createElement('ul');
    ul.className = 'howto__list';
    ul.innerHTML = [
      force()
        ? 'ตอนนี้ตั้งเป็น <b>บังคับกิน</b> — มีทางกินต้องกิน (ตัวที่กินได้มีวงสีเหลือง)'
        : 'ตอนนี้ตั้งเป็น <b>ไม่บังคับกิน</b> — มีทางกินก็เลือกเดินธรรมดาได้',
      'ฮอสกินแล้วต้องลง<b>ช่องที่ติดหลังตัวที่ถูกกิน</b>ทันที',
      '<b>เสมอ</b>: กดปุ่ม "ขอเสมอ" แล้วอีกฝ่ายตกลง (เล่นกับคอม = คอมตัดสินเอง) หรือตำแหน่งเดิมวนซ้ำครบ 3 ครั้ง'
    ]
      .map(function (t) {
        return '<li>' + t + '</li>';
      })
      .join('');
    house.appendChild(ul);
    box.appendChild(house);
    var more = document.createElement('details');
    more.className = 'howto__more';
    more.innerHTML = '<summary>อ่านกติกาเต็ม</summary>';
    more.appendChild(rulesList());
    box.appendChild(more);
  };

  document.getElementById('restart').addEventListener('click', function () {
    if (isOver()) {
      nextRound();
      return;
    }
    if (!moveCount()) return;
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'กระดานตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  // ⚙️ (ปุ่มเฟืองบนแถบหัว — app.js ผูกปุ่มให้แล้ว) · การกินมีผลทันทีหลังกดบันทึก (เหมือนเดิม)
  FG.openSettings = function () {
    var mustEat = force();
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !isOver() && moveCount() > 0;
      },
      onModeChange: function () {
        S = fresh(0);
        sel = null;
        arrivedAt = -1;
        render();
        save();
        cpuTurn();
      },
      build: function (body) {
        body.appendChild(
          FG.group(
            'การกิน',
            FG.choice(
              [
                { value: true, label: 'บังคับกิน' },
                { value: false, label: 'ไม่บังคับกิน' }
              ],
              mustEat,
              function (v) {
                mustEat = v;
              }
            )
          )
        );
      },
      save: function () {
        if (mustEat === force()) return;
        FG.store.set(FORCE_KEY, mustEat);
        sel = null;
        render();
        FG.toast(mustEat ? 'บังคับกิน: มีทางกินต้องกิน' : 'ไม่บังคับกิน: เลือกเดินธรรมดาได้');
      }
    });
  };

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.g && Array.isArray(saved.g.board) && saved.g.board.length === 64 && saved.g.rep) {
    S = saved;
  } else {
    S = fresh(0);
  }
  render();
  save();
  cpuTurn();
})();
