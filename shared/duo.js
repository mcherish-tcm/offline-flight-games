/*
 * ของใช้ร่วมของเกม 2 คน (เครื่องเดียว): ป้ายผู้เล่นบน/ล่าง, บอกว่าตาใคร, สกอร์สะสมข้ามตา, หน้าตั้งค่า
 * ผู้เล่น 0 = แดง (ฝั่งล่างจอ) · ผู้เล่น 1 = ฟ้า (ฝั่งบนจอ)
 * ใส่ในหน้าเกมหลัง app.js: <script src="../../shared/duo.js" defer></script>
 *
 * var duo = FGDuo.create({ id, stage, board, chip(p), action?: { label, onClick(p) } })
 */
(function () {
  'use strict';

  var NAMES = ['แดง', 'ฟ้า'];
  var FLIP_KEY = 'duo:flip';

  function create(opts) {
    var scoreKey = opts.id + ':score';
    var score = FG.store.get(scoreKey, null);
    if (!score || !Array.isArray(score.w)) score = { w: [0, 0], d: 0 };
    var flip = !!FG.store.get(FLIP_KEY, false);
    var turn = null;
    var result = null;

    function panel(p) {
      var el = document.createElement('section');
      el.className = 'duo-side';
      el.setAttribute('data-p', String(p));
      el.setAttribute('aria-label', 'ผู้เล่น' + NAMES[p]);
      el.innerHTML =
        '<span class="duo-chip" aria-hidden="true">' +
        opts.chip(p) +
        '</span>' +
        '<span class="duo-who"><span class="duo-name">' +
        NAMES[p] +
        '</span><span class="duo-sub"></span></span>' +
        '<span class="duo-live num" hidden></span>' +
        (opts.action ? '<button type="button" class="btn duo-act">' + opts.action.label + '</button>' : '') +
        '<span class="duo-turn" aria-live="polite"></span>';
      if (opts.action) {
        el.querySelector('.duo-act').addEventListener('click', function () {
          if (turn === p && result === null && !FG.isSheetOpen()) opts.action.onClick(p);
        });
      }
      return el;
    }

    var sides = [panel(0), panel(1)];
    opts.stage.insertBefore(sides[1], opts.board);
    opts.stage.insertBefore(sides[0], opts.board.nextSibling);

    function paint() {
      sides[1].classList.toggle('is-flipped', flip);
      for (var p = 0; p < 2; p++) {
        var el = sides[p];
        var pill = el.querySelector('.duo-turn');
        var isTurn = result === null && turn === p;
        el.classList.toggle('is-turn', isTurn);
        el.classList.toggle('is-win', result === p);
        el.querySelector('.duo-sub').textContent = 'ชนะ ' + score.w[p] + ' ตา';
        var text = '';
        if (result === p) text = 'ชนะ!';
        else if (result === 'draw') text = 'เสมอ';
        else if (isTurn) text = 'ตาคุณ';
        pill.textContent = text;
        pill.hidden = !text;
        var act = el.querySelector('.duo-act');
        if (act) act.hidden = !isTurn;
      }
    }

    function saveScore() {
      FG.store.set(scoreKey, score);
    }

    function summary() {
      return 'แดง ' + score.w[0] + ' · ฟ้า ' + score.w[1] + ' · เสมอ ' + score.d;
    }

    var api = {
      NAMES: NAMES,
      name: function (p) {
        return NAMES[p];
      },
      sides: sides,
      setTurn: function (p) {
        turn = p;
        paint();
      },
      // r = 0 / 1 (ผู้ชนะ) · 'draw' · null (กำลังเล่น)
      setResult: function (r) {
        result = r;
        paint();
      },
      setLive: function (p, text) {
        var live = sides[p].querySelector('.duo-live');
        live.hidden = text == null || text === '';
        live.textContent = text == null ? '' : text;
      },
      win: function (p) {
        score.w[p] += 1;
        saveScore();
        result = p;
        paint();
      },
      draw: function () {
        score.d += 1;
        saveScore();
        result = 'draw';
        paint();
      },
      summary: summary,
      note: function (resume) {
        var played = score.w[0] + score.w[1] + score.d;
        FG.hubNote(opts.id, { note: played ? summary() : '', resume: !!resume });
      },
      isFlipped: function () {
        return flip;
      },
      // หมุนหน้าต่างให้คนฝั่งบนอ่านได้ (เมื่อเปิดโหมดกลับหัว)
      faceSheet: function (dlg, p) {
        if (dlg && flip && p === 1) dlg.classList.add('sheet--flip');
        return dlg;
      },
      showResult: function (o) {
        var dlg = FG.sheet({
          title: o.title,
          text: (o.text ? o.text + '<br>' : '') + 'สกอร์รวม: ' + summary(),
          actions: [{ label: 'ดูกระดาน' }, { label: 'เล่นตาต่อไป', primary: true, onClick: o.onNext }]
        });
        return api.faceSheet(dlg, o.faceTo);
      },
      openSettings: function (o) {
        o = o || {};
        var frag = document.createDocumentFragment();
        frag.appendChild(FG.label('ป้ายชื่อคนฝั่งบน'));
        frag.appendChild(
          FG.choice(
            [
              { value: false, label: 'ตั้งตรง' },
              { value: true, label: 'กลับหัว' }
            ],
            flip,
            function (v) {
              flip = v;
              FG.store.set(FLIP_KEY, v);
              paint();
            }
          )
        );
        var hint = document.createElement('p');
        hint.className = 'duo-hint';
        hint.textContent = 'เลือก "กลับหัว" เมื่อนั่งหันหน้าเข้าหากัน วางมือถือไว้ตรงกลาง';
        frag.appendChild(hint);
        if (o.build) o.build(frag);
        var sc = document.createElement('p');
        sc.className = 'duo-hint';
        sc.textContent = 'สกอร์รวม: ' + summary();
        frag.appendChild(sc);
        FG.sheet({
          title: 'ตั้งค่า',
          body: frag,
          actions: [
            {
              label: 'ล้างสกอร์',
              onClick: function () {
                score = { w: [0, 0], d: 0 };
                saveScore();
                paint();
                if (o.onReset) o.onReset();
                FG.toast('ล้างสกอร์แล้ว');
              }
            },
            { label: 'เสร็จ', primary: true }
          ]
        });
      }
    };

    paint();
    return api;
  }

  window.FGDuo = { create: create, NAMES: NAMES };
})();
