/*
 * ของใช้ร่วมของเกม 2 คน (เครื่องเดียว): ป้ายผู้เล่นบน/ล่าง, บอกว่าตาใคร, สกอร์สะสมข้ามตา, หน้าตั้งค่า
 * ผู้เล่น 0 = แดง (ฝั่งล่างจอ) · ผู้เล่น 1 = ฟ้า (ฝั่งบนจอ)
 * ใส่ในหน้าเกมหลัง app.js: <script src="../../shared/duo.js" defer></script>
 *
 * var duo = FGDuo.create({ id, stage, board, chip(p), action?: { label, onClick(p) }, ai?: true })
 *
 * ai: true = เกมนี้มีโหมด "เล่นกับคอม" (เลือกในหน้าตั้งค่า)
 *   - คน = แดง (ล่าง) · คอม = ฟ้า (บน) · ความยาก 1 = ง่าย, 2 = ยาก
 *   - สกอร์แยกกัน: เล่น 2 คน / กับคอมง่าย / กับคอมยาก
 *   - duo.isCPU(p) → ตานี้คอมเดินไหม · duo.cpuMove(compute, apply) → รอให้ดูเป็นธรรมชาติ แล้วให้คอมเดิน
 */
(function () {
  'use strict';

  var NAMES = ['แดง', 'ฟ้า'];
  var AI_NAMES = ['คุณ', 'คอม'];
  var LEVELS = { 1: 'ง่าย', 2: 'ยาก' };
  var FLIP_KEY = 'duo:flip';
  var THINK_MIN = 520; // ms · คอมรออย่างน้อยเท่านี้ก่อนเดิน (ให้ดูเหมือนคิด)
  var THINK_LEAD = 160; // ms · หน่วงก่อนเริ่มคำนวณ ให้ป้าย "กำลังคิด…" ขึ้นก่อน

  function create(opts) {
    var modeKey = opts.id + ':mode';
    var mode = { ai: false, level: 1 };
    if (opts.ai) {
      var m = FG.store.get(modeKey, null);
      if (m && typeof m === 'object') mode = { ai: !!m.ai, level: m.level === 2 ? 2 : 1 };
    }
    var score;
    var flip = !!FG.store.get(FLIP_KEY, false);
    var turn = null;
    var result = null;
    var cpuToken = 0;

    function scoreKey() {
      return mode.ai ? opts.id + ':score:ai' + mode.level : opts.id + ':score';
    }

    function loadScore() {
      score = FG.store.get(scoreKey(), null);
      if (!score || !Array.isArray(score.w)) score = { w: [0, 0], d: 0 };
    }
    loadScore();

    function name(p) {
      return (mode.ai ? AI_NAMES : NAMES)[p];
    }

    function isCPU(p) {
      return mode.ai && p === 1;
    }

    function panel(p) {
      var el = document.createElement('section');
      el.className = 'duo-side';
      el.setAttribute('data-p', String(p));
      el.innerHTML =
        '<span class="duo-chip" aria-hidden="true">' +
        opts.chip(p) +
        '</span>' +
        '<span class="duo-who"><span class="duo-name"></span><span class="duo-sub"></span></span>' +
        '<span class="duo-live num" hidden></span>' +
        (opts.action ? '<button type="button" class="btn duo-act">' + opts.action.label + '</button>' : '') +
        '<span class="duo-turn" aria-live="polite"></span>';
      if (opts.action) {
        el.querySelector('.duo-act').addEventListener('click', function () {
          if (turn === p && result === null && !FG.isSheetOpen() && !isCPU(p)) opts.action.onClick(p);
        });
      }
      return el;
    }

    var sides = [panel(0), panel(1)];
    opts.stage.insertBefore(sides[1], opts.board);
    opts.stage.insertBefore(sides[0], opts.board.nextSibling);

    function paint() {
      sides[1].classList.toggle('is-flipped', flip && !mode.ai);
      for (var p = 0; p < 2; p++) {
        var el = sides[p];
        var pill = el.querySelector('.duo-turn');
        var isTurn = result === null && turn === p;
        el.classList.toggle('is-turn', isTurn);
        el.classList.toggle('is-win', result === p);
        el.classList.toggle('is-cpu', isCPU(p));
        el.setAttribute('aria-label', mode.ai ? (p === 1 ? 'คอม' : 'คุณ') : 'ผู้เล่น' + NAMES[p]);
        el.querySelector('.duo-name').textContent = name(p);
        el.querySelector('.duo-sub').textContent =
          (isCPU(p) ? LEVELS[mode.level] + ' · ' : '') + 'ชนะ ' + score.w[p] + ' ตา';
        var text = '';
        if (result === p) text = 'ชนะ!';
        else if (result === 'draw') text = 'เสมอ';
        else if (isTurn) text = isCPU(p) ? 'กำลังคิด…' : 'ตาคุณ';
        pill.textContent = text;
        pill.hidden = !text;
        var act = el.querySelector('.duo-act');
        if (act) act.hidden = !isTurn || isCPU(p);
      }
    }

    function saveScore() {
      FG.store.set(scoreKey(), score);
    }

    function summary() {
      return name(0) + ' ' + score.w[0] + ' · ' + name(1) + ' ' + score.w[1] + ' · เสมอ ' + score.d;
    }

    function cancelCPU() {
      cpuToken++;
    }

    var api = {
      NAMES: NAMES,
      name: name,
      sides: sides,
      isAI: function () {
        return mode.ai;
      },
      level: function () {
        return mode.level;
      },
      isCPU: isCPU,
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
        var note = played ? (mode.ai ? 'กับคอม' + LEVELS[mode.level] + ': ' : '') + summary() : '';
        FG.hubNote(opts.id, { note: note, resume: !!resume });
      },
      isFlipped: function () {
        return flip && !mode.ai;
      },
      // หมุนหน้าต่างให้คนฝั่งบนอ่านได้ (เมื่อเปิดโหมดกลับหัว)
      faceSheet: function (dlg, p) {
        if (dlg && flip && !mode.ai && p === 1) dlg.classList.add('sheet--flip');
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

      /*
       * ให้คอมเดิน: compute() คืนตาเดิน (คำนวณแบบจำกัดเวลาเอง) · apply(move) เดินจริง
       * ถ้ามีหน้าต่างเปิดอยู่ จะรอจนปิดก่อน · เรียก cancelCPU() เมื่อเริ่มตาใหม่/เปลี่ยนโหมด
       * o.min = เวลารอขั้นต่ำ (ms) แทนค่าปกติ เช่น ตอนคอมกินกล่องต่อเนื่อง
       */
      cpuMove: function (compute, apply, o) {
        var my = ++cpuToken;
        var started = Date.now();
        var minWait = o && o.min != null ? o.min : THINK_MIN;
        function go() {
          if (my !== cpuToken) return;
          if (FG.isSheetOpen() || document.hidden) {
            setTimeout(go, 300);
            return;
          }
          var move = compute();
          var wait = Math.max(0, minWait - (Date.now() - started));
          setTimeout(function land() {
            if (my !== cpuToken) return;
            if (FG.isSheetOpen() || document.hidden) {
              // มีคนเปิดหน้าต่างระหว่างรอ → รอจนปิดแล้วค่อยเดิน
              setTimeout(land, 300);
              return;
            }
            apply(move);
          }, wait);
        }
        setTimeout(go, THINK_LEAD);
      },
      cancelCPU: cancelCPU,

      /*
       * o.build(frag) เพิ่มตัวเลือกของเกม · o.onReset() หลังล้างสกอร์
       * o.hasProgress() → ตานี้เดินไปแล้วหรือยัง (ใช้ถามก่อนเปลี่ยนโหมด)
       * o.onModeChange() → เปลี่ยนโหมด/ความยากแล้ว (เกมเริ่มตาใหม่)
       */
      openSettings: function (o) {
        o = o || {};
        var pending = { ai: mode.ai, level: mode.level };
        var frag = document.createDocumentFragment();

        var levelGroup = null;
        var flipGroup = document.createElement('div');
        flipGroup.className = 'duo-group';

        function sync() {
          if (levelGroup) levelGroup.hidden = !pending.ai;
          flipGroup.hidden = pending.ai;
        }

        if (opts.ai) {
          var modeGroup = document.createElement('div');
          modeGroup.className = 'duo-group';
          modeGroup.appendChild(FG.label('โหมด'));
          modeGroup.appendChild(
            FG.choice(
              [
                { value: false, label: 'เล่น 2 คน' },
                { value: true, label: 'เล่นกับคอม' }
              ],
              pending.ai,
              function (v) {
                pending.ai = v;
                sync();
              }
            )
          );
          frag.appendChild(modeGroup);

          levelGroup = document.createElement('div');
          levelGroup.className = 'duo-group';
          levelGroup.appendChild(FG.label('ความยากของคอม'));
          levelGroup.appendChild(
            FG.choice(
              [
                { value: 1, label: 'ง่าย' },
                { value: 2, label: 'ยาก' }
              ],
              pending.level,
              function (v) {
                pending.level = v;
              }
            )
          );
          var aiHint = document.createElement('p');
          aiHint.className = 'duo-hint';
          aiHint.textContent = 'คุณเป็นฝั่งแดง (ล่าง) · สลับกันเริ่มทุกตา · สกอร์กับคอมนับแยกจากเล่น 2 คน';
          levelGroup.appendChild(aiHint);
          frag.appendChild(levelGroup);
        }

        flipGroup.appendChild(FG.label('ป้ายชื่อคนฝั่งบน'));
        flipGroup.appendChild(
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
        flipGroup.appendChild(hint);
        frag.appendChild(flipGroup);
        sync();

        if (o.build) o.build(frag);
        var sc = document.createElement('p');
        sc.className = 'duo-hint';
        sc.textContent = 'สกอร์รวม' + (mode.ai ? ' (กับคอม' + LEVELS[mode.level] + ')' : '') + ': ' + summary();
        frag.appendChild(sc);

        var resetting = false;

        function applyMode() {
          cancelCPU();
          mode = { ai: pending.ai, level: pending.level };
          FG.store.set(modeKey, mode);
          loadScore();
          paint();
          if (o.onModeChange) o.onModeChange();
          FG.toast(mode.ai ? 'เล่นกับคอม (' + LEVELS[mode.level] + ')' : 'เล่น 2 คน');
        }

        function finish() {
          if (resetting) return;
          if (pending.ai === mode.ai && (!pending.ai || pending.level === mode.level)) return;
          if (o.hasProgress && o.hasProgress()) {
            // ถามก่อน เพราะตาที่เล่นค้างจะถูกล้าง (เปิดหน้าต่างใหม่หลังหน้าต่างเดิมปิดแล้ว)
            setTimeout(function () {
              FG.sheet({
                title: 'เปลี่ยนโหมดแล้วเริ่มตาใหม่?',
                text: 'กระดานตานี้จะถูกล้าง สกอร์ที่เก็บไว้ยังอยู่',
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
          onDismiss: finish,
          actions: [
            {
              label: 'ล้างสกอร์',
              onClick: function () {
                resetting = true;
                score = { w: [0, 0], d: 0 };
                saveScore();
                paint();
                if (o.onReset) o.onReset();
                FG.toast('ล้างสกอร์แล้ว');
              }
            },
            { label: 'เสร็จ', primary: true, onClick: finish }
          ]
        });
      }
    };

    paint();
    return api;
  }

  window.FGDuo = { create: create, NAMES: NAMES };
})();
