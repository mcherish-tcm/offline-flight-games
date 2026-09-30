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
 *
 * v8: ตั้งค่าอยู่หลังปุ่มเฟือง ⚙️ (duo.openSettings ใช้ FG.settings) · เปลี่ยนโหมดกลางตาแล้วเลือก "ใช้ตาหน้า"
 *     → เกมต้องเรียก duo.newRound() ทุกครั้งก่อนสร้างกระดานตาใหม่ (โหมดใหม่จะเริ่มใช้ตรงนั้น)
 */
(function () {
  'use strict';

  var NAMES = ['แดง', 'ฟ้า'];
  var AI_NAMES = ['คุณ', 'คอม'];
  var LEVELS = { 1: 'ง่าย', 2: 'ยาก' };
  var FLIP_KEY = 'duo:flip';
  var THINK_MIN = 520; // ms · คอมรออย่างน้อยเท่านี้ก่อนเดิน (ให้ดูเหมือนคิด)
  var THINK_LEAD = 160; // ms · หน่วงก่อนเริ่มคำนวณ ให้ป้าย "กำลังคิด…" ขึ้นก่อน

  function cleanMode(m) {
    return m && typeof m === 'object' ? { ai: !!m.ai, level: m.level === 2 ? 2 : 1 } : null;
  }

  function sameMode(a, b) {
    return a.ai === b.ai && (!a.ai || a.level === b.level);
  }

  function create(opts) {
    var modeKey = opts.id + ':mode';
    // v8: เปลี่ยนโหมดกลางตาแล้วเลือก "ใช้ตาหน้า" → เก็บไว้ที่นี่ เกมเรียก duo.newRound() ตอนเริ่มตาใหม่แล้วค่อยใช้
    var nextKey = opts.id + ':mode:next';
    var mode = { ai: false, level: 1 };
    var next = null;
    if (opts.ai) {
      mode = cleanMode(FG.store.get(modeKey, null)) || mode;
      next = cleanMode(FG.store.get(nextKey, null));
      if (next && sameMode(next, mode)) next = null;
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
       * เริ่มตาใหม่: ถ้ามีโหมดที่ตั้งไว้ "ใช้ตาหน้า" → เปลี่ยนตอนนี้ (เกมเรียกก่อนสร้างกระดานตาใหม่ทุกครั้ง)
       * คืน true ถ้าเปลี่ยนโหมด
       */
      newRound: function () {
        if (!next) return false;
        applyMode(next);
        return true;
      },

      // ชุด "ป้ายชื่อคนฝั่งบน ตั้งตรง/กลับหัว" (มีผลทันที) — ใช้ในหน้าต่างตั้งค่า
      flipGroup: flipGroup,

      // ปุ่ม "ล้างสกอร์" สำหรับหน้าต่างตั้งค่า
      resetAction: function (onReset) {
        return {
          label: 'ล้างสกอร์',
          onClick: function () {
            score = { w: [0, 0], d: 0 };
            saveScore();
            paint();
            if (onReset) onReset();
            FG.toast('ล้างสกอร์แล้ว');
          }
        };
      },

      /*
       * ⚙️ ตั้งค่า (ใช้ FG.settings — ขอบล่างจอต่อท้ายให้เอง)
       * o.build(body) เพิ่มตัวเลือกของเกม · o.needsNew() ตัวเลือกของเกมต้องเริ่มตาใหม่ไหม · o.save() บันทึกตัวเลือกของเกม
       * o.hasProgress() → ตานี้เดินไปแล้วหรือยัง (ถาม "เริ่มใหม่เลย / ใช้ตาหน้า")
       * o.onModeChange() → เริ่มตาใหม่ทันที (หลังเปลี่ยนโหมดแล้ว ถ้ามี) · o.onReset() หลังล้างสกอร์
       */
      openSettings: function (o) {
        o = o || {};
        var target = next || mode;
        var pending = { ai: target.ai, level: target.level };
        var levelGroup = null;
        var flipEl = null;

        function sync() {
          if (levelGroup) levelGroup.hidden = !pending.ai;
          if (flipEl) flipEl.hidden = pending.ai;
        }

        FG.settings({
          build: function (body) {
            if (opts.ai) {
              body.appendChild(
                FG.group(
                  'โหมด',
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
                )
              );
              levelGroup = FG.group(
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
                'คุณเป็นฝั่งแดง (ล่าง) · สลับกันเริ่มทุกตา · สกอร์กับคอมนับแยกจากเล่น 2 คน'
              );
              body.appendChild(levelGroup);
            }
            flipEl = flipGroup();
            body.appendChild(flipEl);
            sync();
            if (o.build) o.build(body);
            var sc = 'สกอร์รวม' + (mode.ai ? ' (กับคอม' + LEVELS[mode.level] + ')' : '') + ': ' + summary();
            if (next) sc += ' · ตาหน้าจะเป็น: ' + modeLabel(next);
            body.appendChild(FG.group('', null, sc));
          },
          needsNew: function () {
            return !sameMode(pending, target) || !!(o.needsNew && o.needsNew());
          },
          save: function () {
            if (o.save) o.save();
          },
          inProgress: function () {
            return !!(o.hasProgress && o.hasProgress());
          },
          restart: function () {
            if (!sameMode(pending, mode)) applyMode({ ai: pending.ai, level: pending.level });
            else setNext(null);
            if (o.onModeChange) o.onModeChange();
          },
          later: function () {
            setNext(sameMode(pending, mode) ? null : { ai: pending.ai, level: pending.level });
          },
          actions: [api.resetAction(o.onReset)]
        });
      }
    };

    function modeLabel(m) {
      return m.ai ? 'เล่นกับคอม (' + LEVELS[m.level] + ')' : 'เล่น 2 คน';
    }

    function setNext(m) {
      next = m;
      if (m) FG.store.set(nextKey, m);
      else FG.store.del(nextKey);
    }

    function applyMode(m) {
      cancelCPU();
      mode = { ai: m.ai, level: m.level };
      FG.store.set(modeKey, mode);
      setNext(null);
      loadScore();
      paint();
      FG.toast(modeLabel(mode));
    }

    function flipGroup() {
      return FG.group(
        'ป้ายชื่อคนฝั่งบน',
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
            document.dispatchEvent(new CustomEvent('fg:duo-flip'));
          }
        ),
        'เลือก "กลับหัว" เมื่อนั่งหันหน้าเข้าหากัน วางมือถือไว้ตรงกลาง'
      );
    }

    paint();
    return api;
  }

  window.FGDuo = { create: create, NAMES: NAMES };
})();
