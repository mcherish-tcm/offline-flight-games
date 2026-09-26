/* ไฟว์ไดซ์ — ลูกเต๋า 5 ลูก ทอยได้ 3 ครั้งต่อตา แตะลูกเพื่อเก็บ แตะแถวในตารางเพื่อลงแต้ม · คนเดียว หรือ 2 คนผลัดกัน · เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var D = window.FiveDice;
  var KEY = 'dice:state';
  var NAMES = ['แดง', 'ฟ้า'];
  var CAT = [
    { name: 'หน้า 1', hint: 'รวมเฉพาะหน้า 1', face: 1 },
    { name: 'หน้า 2', hint: 'รวมเฉพาะหน้า 2', face: 2 },
    { name: 'หน้า 3', hint: 'รวมเฉพาะหน้า 3', face: 3 },
    { name: 'หน้า 4', hint: 'รวมเฉพาะหน้า 4', face: 4 },
    { name: 'หน้า 5', hint: 'รวมเฉพาะหน้า 5', face: 5 },
    { name: 'หน้า 6', hint: 'รวมเฉพาะหน้า 6', face: 6 },
    { name: 'ตอง', hint: '3 ลูกเหมือน · รวมทุกลูก' },
    { name: 'สี่เหมือน', hint: '4 ลูกเหมือน · รวมทุกลูก' },
    { name: 'ฟูลเฮาส์', hint: '3 + 2 เหมือน · 25' },
    { name: 'เรียง 4', hint: 'เช่น 1-2-3-4 · 30' },
    { name: 'เรียง 5', hint: '1-2-3-4-5 หรือ 2–6 · 40' },
    { name: 'ไฟว์ไดซ์', hint: '5 ลูกเหมือน · 50' },
    { name: 'รวมทุกลูก', hint: 'ลงอะไรก็ได้' }
  ];
  var PIPS = {
    1: [[12, 12]],
    2: [[7, 7], [17, 17]],
    3: [[7, 7], [12, 12], [17, 17]],
    4: [[7, 7], [17, 7], [7, 17], [17, 17]],
    5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]],
    6: [[7, 6.5], [17, 6.5], [7, 12], [17, 12], [7, 17.5], [17, 17.5]]
  };

  var diceEl = document.getElementById('dice');
  var rollBtn = document.getElementById('roll');
  var cardEl = document.getElementById('card');
  var statusEl = document.getElementById('status');

  var S; // สถานะจาก engine + { duo }
  var dieEls = [];
  var rolling = false;

  function face(n) {
    var dots = (PIPS[n] || [])
      .map(function (p) {
        return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.3" fill="currentColor"/>';
      })
      .join('');
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + dots + '</svg>';
  }

  for (var i = 0; i < 5; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'dc-die';
    b.addEventListener('click', onDie.bind(null, i));
    diceEl.appendChild(b);
    dieEls.push(b);
  }

  function newGame(isDuo) {
    FG.closeSheet();
    var starter = S && S.duo && isDuo ? 1 - S.starter : 0;
    S = D.newGame(isDuo ? 2 : 1, starter);
    S.duo = !!isDuo;
    FG.store.set('dice:pref', { duo: !!isDuo });
    render();
    save();
  }

  /* ---------- render ---------- */
  function render() {
    var n = S.cards.length;
    var cur = S.cards[S.turn];
    var opts = S.rolls > 0 && !S.over ? D.options(cur, S.dice) : [];
    var byCat = {};
    opts.forEach(function (o) {
      byCat[o.cat] = o.score;
    });
    var best = 0;
    opts.forEach(function (o) {
      if (o.score > best) best = o.score;
    });

    // ลูกเต๋า
    dieEls.forEach(function (el, k) {
      var blank = S.rolls === 0;
      el.innerHTML = face(blank ? 0 : S.dice[k]);
      el.classList.toggle('is-blank', blank);
      el.classList.toggle('is-held', !blank && S.held[k]);
      el.disabled = S.over;
      el.setAttribute('aria-label', blank ? 'ลูกเต๋า ยังไม่ทอย' : 'ลูกเต๋าหน้า ' + S.dice[k] + (S.held[k] ? ' (เก็บไว้)' : ''));
    });

    // ปุ่มทอย
    var left = D.MAX_ROLLS - S.rolls;
    rollBtn.disabled = S.over ? false : !D.canRoll(S) || rolling;
    rollBtn.textContent = S.over ? 'เล่นใหม่' : S.rolls === 0 ? 'ทอย' : left > 0 ? 'ทอยใหม่ (เหลือ ' + left + ' ครั้ง)' : 'ทอยครบแล้ว — เลือกช่องลงแต้ม';

    // สถานะ
    var filled = cur.s.filter(function (v) {
      return v != null;
    }).length;
    if (S.over) statusEl.innerHTML = 'จบเกม';
    else if (S.duo) statusEl.innerHTML = 'ตาของ <span class="dc-pill" data-p="' + S.turn + '">' + NAMES[S.turn] + '</span> · ช่องที่ ' + (filled + 1) + '/13';
    else {
      var bs = FG.store.get('dice:best', 0);
      statusEl.innerHTML = 'ตาที่ <b class="num">' + (filled + 1) + '</b>/13' + (bs ? ' · ดีสุด <b class="num">' + bs + '</b>' : '');
    }
    if (S.rolls > 0 && !S.over && S.rolls < D.MAX_ROLLS) statusEl.innerHTML += ' · แตะลูกเต๋าเพื่อเก็บ';

    // ตาราง
    var html = '';
    var cellsHead = '';
    for (var p = 0; p < n; p++) cellsHead += '<span class="dc-cell' + (S.duo ? '' : ' is-solo') + (p === S.turn && !S.over ? ' is-now' : '') + '" data-p="' + p + '">' + (S.duo ? NAMES[p] : 'แต้ม') + '</span>';
    html += '<div class="dc-row dc-row--head" role="row"><span class="dc-name">ช่อง</span>' + cellsHead + '</div>';
    for (var c = 0; c < D.CATS; c++) {
      if (c === 6) html += sumRow('upper');
      var pick = byCat[c] !== undefined;
      html += '<div class="dc-row' + (pick ? ' is-pick' : '') + '" role="row" data-cat="' + c + '">';
      html += '<span class="dc-name">' + (CAT[c].face ? face(CAT[c].face) : '') + '<span class="dc-label">' + CAT[c].name + (CAT[c].face ? '' : ' <small>' + CAT[c].hint + '</small>') + '</span></span>';
      for (p = 0; p < n; p++) {
        var v = S.cards[p].s[c];
        var inner = '';
        if (v != null) inner = v;
        else if (p === S.turn && pick) inner = '<span class="dc-peek' + (byCat[c] > 0 && byCat[c] === best ? ' is-good' : '') + '">' + byCat[c] + '</span>';
        html += '<span class="dc-cell' + (S.duo ? '' : ' is-solo') + (p === S.turn && !S.over ? ' is-now' : '') + '" data-p="' + p + '">' + inner + '</span>';
      }
      html += '</div>';
    }
    html += sumRow('lower');
    var anyFb = S.cards.some(function (x) {
      return x.fb > 0;
    });
    if (anyFb) html += sumRow('fb');
    html += sumRow('total');
    cardEl.style.setProperty('--players', n);
    cardEl.innerHTML = html;
  }

  function sumRow(kind) {
    var label = { upper: 'รวมบน · ถึง 63 ได้โบนัส +35', lower: 'รวมล่าง', fb: 'ไฟว์ไดซ์ซ้ำ (+100 ต่อครั้ง)', total: 'รวมทั้งหมด' }[kind];
    var cls = kind === 'total' ? 'dc-row dc-row--total' : 'dc-row dc-row--sum';
    var h = '<div class="' + cls + '" role="row"><span class="dc-name">' + label + '</span>';
    for (var p = 0; p < S.cards.length; p++) {
      var t = D.totals(S.cards[p]);
      var v = kind === 'upper' ? (t.bonus ? t.upper + ' +35' : t.upper + '/63') : kind === 'lower' ? t.lower : kind === 'fb' ? (t.fiveBonus ? '+' + t.fiveBonus : '') : t.total;
      h += '<span class="dc-cell' + (S.duo ? '' : ' is-solo') + '" data-p="' + p + '">' + v + '</span>';
    }
    return h + '</div>';
  }

  function save() {
    FG.store.set(KEY, S);
    var started = S.rolls > 0 || S.cards.some(function (c) {
      return c.s.some(function (v) {
        return v != null;
      });
    });
    var bs = FG.store.get('dice:best', 0);
    FG.hubNote('dice', { note: bs ? 'ดีสุด ' + bs + ' แต้ม' : '', resume: started && !S.over });
  }

  /* ---------- actions ---------- */
  function doRoll() {
    if (S.over && !FG.isSheetOpen()) {
      newGame(S.duo);
      return;
    }
    if (rolling || !D.canRoll(S) || FG.isSheetOpen()) return;
    rolling = true;
    var target = D.roll(S);
    var moving = [];
    dieEls.forEach(function (el, k) {
      if (S.rolls === 0 || !S.held[k]) moving.push(k);
    });
    // สลับหน้าเร็ว ๆ ระหว่างกลิ้ง แล้วค่อยหยุดที่หน้าจริง
    var ticks = 0;
    moving.forEach(function (k) {
      dieEls[k].classList.remove('is-blank', 'is-rolling');
      void dieEls[k].offsetWidth;
      dieEls[k].classList.add('is-rolling');
    });
    rollBtn.disabled = true;
    FG.buzz(15);
    var t = setInterval(function () {
      ticks++;
      moving.forEach(function (k) {
        dieEls[k].innerHTML = face(1 + Math.floor(Math.random() * 6));
      });
      if (ticks >= 5) {
        clearInterval(t);
        moving.forEach(function (k) {
          dieEls[k].classList.remove('is-rolling');
        });
        S = Object.assign(target, { duo: S.duo });
        rolling = false;
        render();
        save();
      }
    }, 70);
  }

  function onDie(k) {
    if (rolling || FG.isSheetOpen()) return;
    if (S.rolls === 0) {
      doRoll();
      return;
    }
    if (S.rolls >= D.MAX_ROLLS) {
      FG.toast('ทอยครบ 3 ครั้งแล้ว — แตะแถวในตารางเพื่อลงแต้ม');
      return;
    }
    S = Object.assign(D.toggleHold(S, k), { duo: S.duo });
    FG.buzz(6);
    render();
    save();
  }

  function pickCat(cat) {
    if (rolling || S.over || S.rolls === 0) return;
    var opts = D.options(S.cards[S.turn], S.dice);
    var o = opts.filter(function (x) {
      return x.cat === cat;
    })[0];
    if (!o) return;
    var better = opts.some(function (x) {
      return x.score > 0;
    });
    if (o.score === 0 && better) {
      FG.sheet({
        title: 'ลง 0 แต้มในช่อง "' + CAT[cat].name + '"?',
        text: 'ช่องนี้จะใช้ไม่ได้อีกในเกมนี้',
        actions: [
          { label: 'ไม่ลง' },
          {
            label: 'ลง 0',
            primary: true,
            onClick: function () {
              commit(cat);
            }
          }
        ]
      });
      return;
    }
    commit(cat);
  }

  function commit(cat) {
    var who = S.turn;
    var fbBefore = S.cards[who].fb;
    S = Object.assign(D.score(S, cat), { duo: S.duo });
    FG.buzz(12);
    if (S.cards[who].fb > fbBefore) FG.toast('ไฟว์ไดซ์ซ้ำ! โบนัส +100');
    else if (S.duo && !S.over) FG.toast('ต่อไป: ' + NAMES[S.turn], 1200);
    render();
    var row = cardEl.querySelector('[data-cat="' + cat + '"]');
    if (row) row.classList.add('is-flash');
    save();
    if (S.over) finish();
  }

  function finish() {
    var w = D.winner(S);
    var t = S.cards.map(function (c) {
      return D.totals(c).total;
    });
    if (!S.duo) {
      var best = FG.store.get('dice:best', 0);
      var isBest = t[0] > best;
      if (isBest) FG.store.set('dice:best', t[0]);
      save();
      render();
      setTimeout(function () {
        FG.sheet({
          title: 'ได้ ' + t[0] + ' แต้ม',
          text: isBest ? 'สูงสุดของเรา!' : 'ดีสุด ' + best + ' แต้ม',
          actions: [{ label: 'ดูตาราง' }, { label: 'เล่นใหม่', primary: true, onClick: function () { newGame(false); } }]
        });
      }, 500);
      return;
    }
    var sc = FG.store.get('dice:score', null) || { w: [0, 0], d: 0 };
    if (w === 'draw') sc.d++;
    else sc.w[w]++;
    FG.store.set('dice:score', sc);
    save();
    render();
    setTimeout(function () {
      FG.sheet({
        title: w === 'draw' ? 'เสมอ' : NAMES[w] + ' ชนะ!',
        text: 'แดง ' + t[0] + ' · ฟ้า ' + t[1] + ' แต้ม<br>สกอร์รวม: แดง ' + sc.w[0] + ' · ฟ้า ' + sc.w[1] + ' · เสมอ ' + sc.d,
        actions: [{ label: 'ดูตาราง' }, { label: 'เล่นตาต่อไป', primary: true, onClick: function () { newGame(true); } }]
      });
    }, 500);
  }

  cardEl.addEventListener('click', function (e) {
    var row = e.target.closest('.dc-row.is-pick');
    if (row) pickCat(+row.dataset.cat);
  });
  rollBtn.addEventListener('click', doRoll);

  document.getElementById('new').addEventListener('click', function () {
    var isDuo = S.duo;
    var body = document.createElement('div');
    body.appendChild(FG.label('โหมด'));
    body.appendChild(
      FG.choice(
        [
          { value: false, label: 'คนเดียว' },
          { value: true, label: '2 คนผลัดกัน' }
        ],
        isDuo,
        function (v) {
          isDuo = v;
        }
      )
    );
    var started = S.cards.some(function (c) {
      return c.s.some(function (v) {
        return v != null;
      });
    });
    FG.sheet({
      title: 'เกมใหม่',
      text: started && !S.over ? 'เกมที่เล่นอยู่จะหายไป' : '',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'เริ่ม',
          primary: true,
          onClick: function () {
            newGame(isDuo);
          }
        }
      ]
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'r') {
      e.preventDefault();
      doRoll();
    }
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= 5) onDie(n - 1);
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.cards) && saved.cards.length >= 1 && Array.isArray(saved.dice)) {
    S = saved;
    render();
  } else {
    var pref = FG.store.get('dice:pref', { duo: false });
    newGame(!!pref.duo);
  }
})();
