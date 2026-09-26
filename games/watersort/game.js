/* เทน้ำเรียงสี — ด่านสร้างเองแบบกำหนดผล (ทุกด่านผ่านตัวแก้แล้วว่าแก้ได้), แตะหลอดต้นทาง → หลอดปลายทาง, ย้อน, เริ่มด่านใหม่, ใบ้, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var W = window.WaterSort;
  var KEY = 'ws:state';

  var rackEl = document.getElementById('rack');
  var levelEl = document.getElementById('level');
  var movesEl = document.getElementById('moves');
  var undoBtn = document.getElementById('undo');
  var hintBtn = document.getElementById('hint');

  // S = { n, tubes, moves, history: [tubes...], max: ด่านสูงสุดที่ปลดแล้ว, done }
  var S;
  var picked = -1;
  var tubeEls = [];
  var freshUnits = null; // { tube, count } หน่วยที่เพิ่งเทลง → แอนิเมชัน

  function load(n) {
    var L = W.level(n);
    var max = S ? Math.max(S.max, n) : n;
    S = { n: n, tubes: L.tubes, moves: 0, history: [], max: max, done: false };
    picked = -1;
    build();
    render();
    save();
  }

  function build() {
    rackEl.innerHTML = '';
    tubeEls = [];
    var count = S.tubes.length;
    var cols = count <= 6 ? count : Math.ceil(count / 2);
    rackEl.style.setProperty('--cols', cols);
    rackEl.classList.toggle('is-one-row', count <= 6);
    S.tubes.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'ws-tube';
      b.addEventListener('click', onTap.bind(null, i));
      rackEl.appendChild(b);
      tubeEls.push(b);
    });
  }

  function render() {
    S.tubes.forEach(function (t, i) {
      var el = tubeEls[i];
      var html = '';
      t.forEach(function (c, k) {
        var isNew = freshUnits && freshUnits.tube === i && k >= t.length - freshUnits.count;
        html += '<span class="ws-unit' + (isNew ? ' is-new' : '') + '" data-c="' + c + '"></span>';
      });
      el.innerHTML = html;
      el.classList.toggle('is-picked', i === picked);
      el.classList.remove('is-hint');
      var done = t.length === W.CAP && t.every(function (c) {
        return c === t[0];
      });
      el.classList.toggle('is-done', done);
      el.setAttribute('aria-label', 'หลอด ' + (i + 1) + (t.length ? ' มี ' + t.length + ' ชั้น' : ' ว่าง') + (done ? ' ครบแล้ว' : '') + (i === picked ? ' (เลือกอยู่)' : ''));
    });
    freshUnits = null;
    levelEl.textContent = S.n;
    movesEl.textContent = S.moves;
    undoBtn.disabled = !S.history.length || S.done;
    hintBtn.disabled = S.done;
  }

  function save() {
    FG.store.set(KEY, { n: S.n, tubes: S.tubes, moves: S.moves, history: S.history.slice(-120), max: S.max, done: S.done });
    FG.hubNote('watersort', { note: 'ถึงด่าน ' + S.max, resume: S.moves > 0 && !S.done });
  }

  function shake(el) {
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    FG.buzz(20);
  }

  function onTap(i) {
    if (FG.isSheetOpen() || S.done) return;
    if (picked === -1) {
      if (!S.tubes[i].length) return;
      picked = i;
      render();
      return;
    }
    if (picked === i) {
      picked = -1;
      render();
      return;
    }
    if (!W.canPour(S.tubes, picked, i)) {
      // แตะหลอดอื่นที่เทไม่ได้ = เปลี่ยนไปเลือกหลอดนั้นแทน (ถ้ามีน้ำ)
      shake(tubeEls[i]); // สีไม่ตรง / หลอดเต็ม — คงการเลือกเดิมไว้
      return;
    }
    var r = W.pour(S.tubes, picked, i);
    S.history.push(S.tubes);
    S.tubes = r.tubes;
    S.moves++;
    freshUnits = { tube: i, count: r.amount };
    picked = -1;
    FG.buzz(8);
    if (W.isSolved(S.tubes)) {
      S.done = true;
      S.max = Math.max(S.max, S.n + 1);
      render();
      save();
      setTimeout(function () {
        FG.sheet({
          title: 'ผ่านด่าน ' + S.n + '!',
          text: 'เท ' + S.moves + ' ครั้ง',
          dismissible: false,
          actions: [
            {
              label: 'ด่านถัดไป',
              primary: true,
              onClick: function () {
                load(S.n + 1);
              }
            }
          ]
        });
      }, 450);
      return;
    }
    render();
    save();
    if (!anyMove()) FG.toast('ไม่มีทางเทต่อแล้ว — กดย้อน หรือเริ่มด่านนี้ใหม่', 2600);
  }

  function anyMove() {
    for (var a = 0; a < S.tubes.length; a++) for (var b = 0; b < S.tubes.length; b++) if (W.canPour(S.tubes, a, b)) return true;
    return false;
  }

  function undo() {
    if (!S.history.length || S.done) return;
    S.tubes = S.history.pop();
    S.moves++;
    picked = -1;
    render();
    save();
  }

  function restart() {
    FG.closeSheet();
    load(S.n);
  }

  hintBtn.addEventListener('click', function () {
    if (S.done || FG.isSheetOpen()) return;
    var m = W.hint(S.tubes);
    if (!m) {
      FG.toast('จากตรงนี้หาทางไปต่อไม่เจอ — ลองย้อน หรือเริ่มด่านนี้ใหม่', 2600);
      return;
    }
    picked = m[0];
    render();
    tubeEls[m[1]].classList.add('is-hint');
    FG.toast('เทหลอดที่ยกขึ้น ไปหลอดที่มีขอบสีเขียว');
  });

  undoBtn.addEventListener('click', undo);

  document.getElementById('new').addEventListener('click', function () {
    var body = document.createElement('div');
    body.appendChild(FG.label('ไปด่านที่ (1–' + S.max + ')'));
    var input = document.createElement('input');
    input.className = 'field';
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '1';
    input.max = String(S.max);
    input.placeholder = 'เว้นว่าง = ด่าน ' + S.n;
    input.setAttribute('aria-label', 'เลขด่าน');
    body.appendChild(input);
    FG.sheet({
      title: 'เริ่มใหม่ / เลือกด่าน',
      body: body,
      actions: [
        { label: 'ยกเลิก' },
        {
          label: 'เริ่ม',
          primary: true,
          onClick: function () {
            var v = parseInt(input.value, 10);
            if (v >= 1 && v <= S.max) load(v);
            else restart();
          }
        }
      ]
    });
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'z' || e.key === 'u') undo();
  });

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.tubes) && saved.n >= 1) {
    S = { n: saved.n, tubes: saved.tubes, moves: saved.moves || 0, history: saved.history || [], max: saved.max || saved.n, done: !!saved.done };
    if (S.done) {
      load(S.n + 1);
    } else {
      build();
      render();
    }
  } else {
    S = null;
    load(1);
  }
})();
