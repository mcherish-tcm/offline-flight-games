/* หมากขุม — 2 คนเครื่องเดียว หรือเล่นกับคอม · หยอดทีละเม็ดให้เห็น (แตะรางเพื่อข้ามแอนิเมชัน) · สลับกันเริ่มทุกตา · เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var M = window.MakKhum;
  var KEY = 'makkhum:state';
  var SEED =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12.5" rx="8.5" ry="7.5" fill="currentColor"/><ellipse cx="9.5" cy="9.5" rx="2.6" ry="1.8" fill="var(--color-paper)" fill-opacity="0.35"/></svg>';

  var boardEl = document.getElementById('board');
  var duo = FGDuo.create({
    id: 'makkhum',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return SEED;
    },
    ai: true
  });

  // S = { g: { pits, turn, over }, starter, moved }
  var S;
  var pitEls = [];
  var anim = null; // { steps, k, view, timer, done }
  var endedAt = 0;

  /* ---------- DOM: 16 ช่องตามตำแหน่งบนจอ ---------- */
  for (var i = 0; i < 16; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mk-pit';
    if (i === 7 || i === 15) {
      b.classList.add('mk-store');
      b.dataset.p = i === 7 ? '0' : '1';
      b.innerHTML = '<span class="mk-label">หัวเมือง<br>' + (i === 7 ? 'แดง' : 'ฟ้า') + '</span><span class="mk-n num"></span><span class="mk-seeds"></span>';
    } else {
      var top = i >= 8;
      b.dataset.row = top ? 'top' : 'bottom';
      // แถวล่าง: หลุม 6 อยู่ซ้าย → 0 อยู่ขวา · แถวบน: 8 อยู่ซ้าย → 14 อยู่ขวา
      b.style.gridRow = top ? '1' : '2';
      b.style.gridColumn = String(top ? i - 8 + 2 : 6 - i + 2);
      b.innerHTML = '<span class="mk-n num"></span><span class="mk-seeds"></span>';
    }
    b.addEventListener('click', onTap.bind(null, i));
    boardEl.appendChild(b);
    pitEls.push(b);
  }

  function fresh(starter) {
    return { g: M.initial(starter), starter: starter, moved: false };
  }

  /* ---------- render ---------- */
  function seedsHtml(n) {
    var k = Math.min(n, 15);
    var s = '';
    for (var j = 0; j < k; j++) s += '<i></i>';
    return s;
  }

  function paintPits(view, activeIdx, hand) {
    var g = S.g;
    var can = anim || g.over || duo.isCPU(g.turn) ? [] : M.legalMoves(g);
    boardEl.dataset.turn = g.turn;
    boardEl.classList.toggle('is-flipped', duo.isFlipped());
    for (var i = 0; i < 16; i++) {
      var el = pitEls[i];
      var n = view[i];
      var nEl = el.querySelector('.mk-n');
      if (nEl.textContent !== String(n)) {
        nEl.textContent = n;
        el.querySelector('.mk-seeds').innerHTML = seedsHtml(n);
      }
      el.classList.toggle('is-can', can.indexOf(i) !== -1);
      el.classList.toggle('is-active', i === activeIdx);
      var h = el.querySelector('.mk-hand');
      if (i === activeIdx && hand > 0) {
        if (!h) {
          h = document.createElement('span');
          h.className = 'mk-hand num';
          el.appendChild(h);
        }
        h.textContent = hand;
      } else if (h) h.remove();
      var owner = M.ownerOf(i);
      var who = i === 7 ? 'หัวเมืองแดง' : i === 15 ? 'หัวเมืองฟ้า' : 'หลุม' + (owner === 0 ? 'แดง' : 'ฟ้า') + ' ที่ ' + ((owner === 0 ? i : i - 8) + 1);
      el.setAttribute('aria-label', who + ' ' + n + ' เม็ด');
    }
    duo.setLive(0, view[7]);
    duo.setLive(1, view[15]);
  }

  function render() {
    paintPits(S.g.pits, -1, 0);
    var g = S.g;
    var w = M.winner(g);
    duo.setResult(w === null ? null : w);
    duo.setTurn(g.over || anim ? (anim ? anim.turn : null) : g.turn);
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.g.over && S.moved);
  }

  /* ---------- move + animation ---------- */
  function onTap(i) {
    if (FG.isSheetOpen()) return;
    if (anim) {
      finishAnim(); // แตะระหว่างหยอด = ข้ามไปผลลัพธ์
      return;
    }
    var g = S.g;
    if (g.over) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (duo.isCPU(g.turn)) return;
    if (M.ownerOf(i) !== g.turn) {
      if (M.ownerOf(i) === 1 - g.turn) FG.toast('ตานี้เป็นของ' + duo.name(g.turn) + ' — แตะหลุมฝั่งตัวเอง');
      return;
    }
    if (!g.pits[i]) {
      FG.toast('หลุมนี้ว่าง เลือกหลุมที่มีหมาก');
      return;
    }
    play(i);
  }

  function play(i) {
    var before = S.g.pits.slice();
    var turn = S.g.turn;
    var r = M.move(S.g, i);
    S.g = r.state;
    S.moved = true;
    save(); // บันทึกผลทันที (ปิดแอปกลางแอนิเมชัน กลับมาเห็นผลแล้ว)
    FG.buzz(8);
    var drops = r.steps.filter(function (s) {
      return s.t === 'drop';
    }).length;
    anim = {
      steps: r.steps,
      k: 0,
      view: before,
      hand: 0,
      at: -1,
      turn: turn,
      result: r.result,
      delay: Math.max(28, Math.min(120, Math.round(3600 / Math.max(1, drops))))
    };
    duo.setTurn(turn);
    stepAnim();
  }

  function stepAnim() {
    if (!anim) return;
    var a = anim;
    if (a.k >= a.steps.length) {
      finishAnim();
      return;
    }
    var s = a.steps[a.k++];
    var wait = a.delay;
    if (s.t === 'pick') {
      a.hand += a.view[s.i];
      a.view[s.i] = 0;
      a.at = s.i;
      wait = a.delay * 2.5;
    } else if (s.t === 'drop') {
      a.view[s.i]++;
      a.hand--;
      a.at = s.i;
    } else {
      a.view[s.to] += a.view[s.from];
      a.view[s.from] = 0;
      a.at = s.to;
      pitEls[s.to].classList.remove('is-gain');
      void pitEls[s.to].offsetWidth;
      pitEls[s.to].classList.add('is-gain');
      if (s.t === 'capture') {
        FG.toast('กินแทน! +' + s.n);
        FG.buzz(30);
      }
      wait = 520;
    }
    paintPits(a.view, a.at, a.hand);
    a.timer = setTimeout(stepAnim, wait);
  }

  function finishAnim() {
    if (!anim) return;
    var a = anim;
    clearTimeout(a.timer);
    anim = null;
    render();
    if (S.g.over) {
      endRound();
      return;
    }
    if (a.result === 'store') FG.toast(duo.name(a.turn) + ' ตกหัวเมืองพอดี — ได้เดินต่อ', 1600);
    else if (a.result === 'dead') FG.toast('หมากตาย — เปลี่ยนตา', 1200);
    cpuTurn();
  }

  function endRound() {
    var w = M.winner(S.g);
    if (w === 'draw') duo.draw();
    else duo.win(w);
    render();
    save();
    endedAt = Date.now();
    setTimeout(function () {
      var a = S.g.pits[7];
      var b = S.g.pits[15];
      var text = 'หัวเมืองแดง ' + a + ' เม็ด · ฟ้า ' + b + ' เม็ด';
      if (w === 'draw') duo.showResult({ title: 'เสมอ', text: text, onNext: nextRound });
      else duo.showResult({ title: duo.name(w) + ' ชนะ!', text: text, onNext: nextRound, faceTo: w });
    }, 650);
  }

  function cpuTurn() {
    if (S.g.over || anim || !duo.isCPU(S.g.turn)) return;
    duo.cpuMove(
      function () {
        return M.choose(S.g, duo.level(), Math.random, 450);
      },
      function (i) {
        if (!anim && !S.g.over && duo.isCPU(S.g.turn) && i >= 0 && S.g.pits[i] > 0 && M.ownerOf(i) === S.g.turn) play(i);
      }
    );
  }

  function stopAnim() {
    if (anim) {
      clearTimeout(anim.timer);
      anim = null;
    }
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    stopAnim();
    S = fresh(1 - S.starter);
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    stopAnim();
    S = fresh(S.starter);
    render();
    save();
    cpuTurn();
  }

  document.getElementById('restart').addEventListener('click', function () {
    if (S.g.over) {
      nextRound();
      return;
    }
    if (!S.moved) return;
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'รางตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  document.getElementById('settings').addEventListener('click', function () {
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !S.g.over && S.moved;
      },
      onModeChange: function () {
        stopAnim();
        S = fresh(0);
        render();
        save();
        cpuTurn();
      }
    });
  });

  // ปุ่มตั้งค่าเปลี่ยน "กลับหัว" → วาดใหม่
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.sheet'))
      setTimeout(function () {
        if (!anim) render();
      }, 0);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.g && Array.isArray(saved.g.pits) && saved.g.pits.length === 16) {
    S = saved;
  } else {
    S = fresh(0);
  }
  render();
  save();
  cpuTurn();
})();
