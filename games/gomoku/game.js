/*
 * โกโมกุ — 2 คน หรือเล่นกับคอม · กระดาน 15×15 วางบนจุดตัด · เรียง 5 ขึ้นไป = ชนะ
 * กันแตะพลาดบนจอเล็ก: แตะครั้งแรก = เม็ดจาง + เส้นเล็ง, แตะจุดเดิมอีกครั้ง = วางจริง (ปิดได้ในตั้งค่า)
 * แตะหาจุดตัดที่ใกล้นิ้วที่สุดจากตำแหน่งจริงบนกระดาน (ไม่ต้องแตะโดนเม็ดเป๊ะ ๆ)
 */
(function () {
  'use strict';

  var G = window.Gomoku;
  var N = G.N;
  var KEY = 'gomoku:state';
  var CONFIRM_KEY = 'gomoku:confirm';
  var NS = 'http://www.w3.org/2000/svg';
  var STONE =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><circle cx="12" cy="12" r="6.4" fill="none" stroke="var(--color-paper)" stroke-opacity="0.35" stroke-width="2"/></svg>';
  var COLS = 'ABCDEFGHJKLMNOP';

  var svg = document.getElementById('board');
  var hintEl = document.getElementById('hint');
  var duo = FGDuo.create({
    id: 'gomoku',
    stage: document.getElementById('stage'),
    board: document.getElementById('wrap'),
    chip: function () {
      return STONE;
    },
    ai: true
  });

  // S = { g: สถานะจาก engine { board, turn, over, last, moves }, starter }
  var S;
  var aim = -1; // จุดที่เล็งไว้ (ยังไม่วาง)
  var endedAt = 0;
  var newStone = -1;

  /* ---------- กระดานคงที่ (เส้น + จุดดาว) วาดครั้งเดียว ---------- */
  var grid = document.createElementNS(NS, 'g');
  var d = '';
  for (var k = 0; k < N; k++) {
    var p = k + 0.5;
    d += 'M0.5 ' + p + 'H' + (N - 0.5) + 'M' + p + ' 0.5V' + (N - 0.5);
  }
  grid.innerHTML =
    '<path class="gm-grid" d="' + d + '"/>' +
    [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]]
      .map(function (rc) {
        return '<circle class="gm-starpt" cx="' + (rc[1] + 0.5) + '" cy="' + (rc[0] + 0.5) + '" r="0.12"/>';
      })
      .join('');
  svg.appendChild(grid);
  var layer = document.createElementNS(NS, 'g');
  svg.appendChild(layer);

  function confirmOn() {
    return FG.store.get(CONFIRM_KEY, true) !== false;
  }

  function fresh(starter) {
    return { g: G.newGame(starter), starter: starter };
  }

  function name(i) {
    return COLS[i % N] + (N - Math.floor(i / N));
  }

  /* ---------- input ---------- */
  function pointAt(e) {
    var r = svg.getBoundingClientRect();
    var c = Math.floor(((e.clientX - r.left) / r.width) * N);
    var row = Math.floor(((e.clientY - r.top) / r.height) * N);
    if (c < 0 || c >= N || row < 0 || row >= N) return -1;
    return row * N + c;
  }

  svg.addEventListener('click', function (e) {
    var i = pointAt(e);
    if (i >= 0) onTap(i);
  });

  function onTap(i) {
    if (FG.isSheetOpen()) return;
    if (S.g.over) {
      if (Date.now() - endedAt > 900) nextRound();
      return;
    }
    if (duo.isCPU(S.g.turn)) return; // รอคอมเดิน
    if (S.g.board[i] !== -1) {
      if (aim !== -1) {
        aim = -1;
        render();
      }
      return;
    }
    if (confirmOn() && aim !== i) {
      aim = i;
      FG.buzz(5);
      render();
      return;
    }
    place(i);
  }

  function place(i) {
    var next = G.play(S.g, i);
    if (!next) return;
    S.g = next;
    aim = -1;
    newStone = i;
    FG.buzz(10);
    if (next.over) {
      endedAt = Date.now();
      if (next.over.draw) duo.draw();
      else duo.win(next.over.w);
    }
    render();
    save();
    if (next.over) setTimeout(showResult, 900);
    else cpuTurn();
  }

  function cpuTurn() {
    if (S.g.over || !duo.isCPU(S.g.turn)) return;
    duo.cpuMove(
      function () {
        return G.choose(S.g.board, S.g.turn, duo.level());
      },
      function (i) {
        if (!S.g.over && duo.isCPU(S.g.turn) && i >= 0 && S.g.board[i] === -1) place(i);
      }
    );
  }

  function nextRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(1 - S.starter);
    aim = -1;
    render();
    save();
    cpuTurn();
  }

  function restartRound() {
    FG.closeSheet();
    duo.cancelCPU();
    duo.newRound();
    S = fresh(S.starter);
    aim = -1;
    render();
    save();
    cpuTurn();
  }

  function showResult() {
    if (!S.g.over) return;
    if (S.g.over.draw) duo.showResult({ title: 'เสมอ', text: 'กระดานเต็มแล้ว ไม่มีใครเรียงครบ 5', onNext: nextRound });
    else
      duo.showResult({
        title: duo.name(S.g.over.w) + 'ชนะ!',
        text: 'เรียงติดกัน ' + S.g.over.line.length + ' เม็ด',
        onNext: nextRound,
        faceTo: S.g.over.w
      });
  }

  /* ---------- render ---------- */
  function render() {
    var g = S.g;
    var over = !!g.over;
    var win = {};
    if (over && g.over.line) g.over.line.forEach(function (i) { win[i] = true; });
    var html = '';
    if (aim !== -1 && g.board[aim] === -1 && !over) {
      var ax = (aim % N) + 0.5;
      var ay = Math.floor(aim / N) + 0.5;
      html +=
        '<path class="gm-aim" d="M0.5 ' + ay + 'H' + (N - 0.5) + 'M' + ax + ' 0.5V' + (N - 0.5) + '"/>' +
        '<circle class="gm-ghost" data-p="' + g.turn + '" cx="' + ax + '" cy="' + ay + '" r="0.42"/>';
    }
    for (var i = 0; i < N * N; i++) {
      var v = g.board[i];
      if (v === -1) continue;
      var x = (i % N) + 0.5;
      var y = Math.floor(i / N) + 0.5;
      var cls = 'gm-stone' + (win[i] ? ' is-win' : '') + (i === newStone ? ' is-new' : '');
      html += '<circle class="' + cls + '" data-p="' + v + '" cx="' + x + '" cy="' + y + '" r="0.42"/>';
      if (win[i]) html += '<circle class="gm-win" cx="' + x + '" cy="' + y + '" r="0.2"/>';
      else if (i === g.last && !over) html += '<circle class="gm-last" cx="' + x + '" cy="' + y + '" r="0.11"/>';
    }
    layer.innerHTML = html;
    newStone = -1;
    svg.classList.toggle('is-over', over);

    duo.setResult(over ? (g.over.draw ? 'draw' : g.over.w) : null);
    duo.setTurn(over ? null : g.turn);

    var hint;
    var aiming = false;
    if (over) hint = 'จบเกม — แตะกระดานเพื่อเล่นตาต่อไป';
    else if (duo.isCPU(g.turn)) hint = 'คอมกำลังคิด…';
    else if (aim !== -1) {
      hint = 'เล็ง ' + name(aim) + ' — แตะจุดเดิมอีกครั้งเพื่อวาง';
      aiming = true;
    } else hint = 'ตาของ' + duo.name(g.turn) + (confirmOn() ? ' — แตะเพื่อเล็ง แตะซ้ำเพื่อวาง' : ' — แตะจุดตัดเพื่อวาง');
    hintEl.textContent = hint;
    hintEl.classList.toggle('is-aim', aiming);
  }

  function save() {
    FG.store.set(KEY, S);
    duo.note(!S.g.over && S.g.moves > 0);
  }

  /* ---------- keyboard (ลูกศร + Enter) ---------- */
  svg.addEventListener('keydown', function (e) {
    if (S.g.over || duo.isCPU(S.g.turn)) return;
    var cur = aim === -1 ? 7 * N + 7 : aim;
    var r = Math.floor(cur / N);
    var c = cur % N;
    if (e.key === 'ArrowUp') r = Math.max(0, r - 1);
    else if (e.key === 'ArrowDown') r = Math.min(N - 1, r + 1);
    else if (e.key === 'ArrowLeft') c = Math.max(0, c - 1);
    else if (e.key === 'ArrowRight') c = Math.min(N - 1, c + 1);
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (aim !== -1 && S.g.board[aim] === -1) place(aim);
      return;
    } else return;
    e.preventDefault();
    aim = r * N + c;
    render();
  });

  document.getElementById('restart').addEventListener('click', function () {
    if (S.g.over) {
      nextRound();
      return;
    }
    if (!S.g.moves) return;
    FG.sheet({
      title: 'เริ่มตานี้ใหม่?',
      text: 'กระดานตานี้จะถูกล้าง สกอร์รวมยังอยู่',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: restartRound }]
    });
  });

  // ⚙️ (ปุ่มเฟืองบนแถบหัว — app.js ผูกปุ่มให้แล้ว) · การวางเม็ดมีผลทันทีหลังกดบันทึก
  FG.openSettings = function () {
    var tap2 = confirmOn();
    duo.openSettings({
      onReset: save,
      hasProgress: function () {
        return !S.g.over && S.g.moves > 0;
      },
      onModeChange: function () {
        S = fresh(0);
        aim = -1;
        render();
        save();
        cpuTurn();
      },
      build: function (body) {
        body.appendChild(
          FG.group(
            'การวางเม็ด',
            FG.choice(
              [
                { value: true, label: 'แตะ 2 ครั้ง' },
                { value: false, label: 'แตะครั้งเดียว' }
              ],
              tap2,
              function (v) {
                tap2 = v;
              }
            )
          )
        );
      },
      save: function () {
        if (tap2 === confirmOn()) return;
        FG.store.set(CONFIRM_KEY, tap2);
        aim = -1;
        render();
      }
    });
  };

  /* ---------- boot ---------- */
  var saved = FG.store.get(KEY, null);
  if (saved && saved.g && Array.isArray(saved.g.board) && saved.g.board.length === N * N && typeof saved.g.moves === 'number') {
    S = saved;
  } else {
    S = fresh(0);
  }
  render();
  save();
  cpuTurn();
})();
