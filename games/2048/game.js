/* 2048 — ปัด/ลูกศร, ย้อน 1 ตา, สถิติ, เล่นต่อจากที่ค้าง */
(function () {
  'use strict';

  var N = 4;
  var KEY = '2048:state';
  var BEST = '2048:best';
  var VEC = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };

  var board = document.getElementById('board');
  var cellsEl = board.querySelector('.board__cells');
  var scoreEl = document.getElementById('score');
  var bestEl = document.getElementById('best');
  var undoBtn = document.getElementById('undo');

  var grid, tiles, score, best, won, keepPlaying, over, prev;
  var nextId = 1;
  var els = new Map();

  for (var i = 0; i < N * N; i++) cellsEl.appendChild(document.createElement('span'));

  function blank() {
    var g = [];
    for (var r = 0; r < N; r++) g.push([null, null, null, null]);
    return g;
  }

  function values() {
    return grid.map(function (row) {
      return row.map(function (t) {
        return t ? t.v : 0;
      });
    });
  }

  function fromValues(cells) {
    grid = blank();
    tiles = [];
    for (var r = 0; r < N; r++)
      for (var c = 0; c < N; c++)
        if (cells[r][c]) {
          var t = { id: nextId++, v: cells[r][c], r: r, c: c };
          grid[r][c] = t;
          tiles.push(t);
        }
  }

  function empties() {
    var out = [];
    for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (!grid[r][c]) out.push([r, c]);
    return out;
  }

  function addRandom() {
    var e = empties();
    if (!e.length) return;
    var p = e[Math.floor(Math.random() * e.length)];
    var t = { id: nextId++, v: Math.random() < 0.9 ? 2 : 4, r: p[0], c: p[1], isNew: true };
    grid[p[0]][p[1]] = t;
    tiles.push(t);
  }

  function canMove() {
    if (empties().length) return true;
    for (var r = 0; r < N; r++)
      for (var c = 0; c < N; c++) {
        var v = grid[r][c].v;
        if (c + 1 < N && grid[r][c + 1].v === v) return true;
        if (r + 1 < N && grid[r + 1][c].v === v) return true;
      }
    return false;
  }

  function newGame() {
    FG.closeSheet();
    grid = blank();
    tiles = [];
    score = 0;
    won = false;
    keepPlaying = false;
    over = false;
    prev = null;
    clearBoard();
    addRandom();
    addRandom();
    render([]);
    save();
  }

  function move(dir) {
    if (over || (won && !keepPlaying) || FG.isSheetOpen()) return;
    var v = VEC[dir];
    var snapshot = { cells: values(), score: score };
    tiles.forEach(function (t) {
      t.isNew = false;
      t.merged = false;
    });
    var rows = [0, 1, 2, 3];
    var cols = [0, 1, 2, 3];
    if (v[0] === 1) rows.reverse();
    if (v[1] === 1) cols.reverse();

    var dying = [];
    var moved = false;
    var gained = 0;
    var reached2048 = false;

    rows.forEach(function (r) {
      cols.forEach(function (c) {
        var t = grid[r][c];
        if (!t) return;
        var nr = r;
        var nc = c;
        var mergedInto = null;
        for (;;) {
          var tr = nr + v[0];
          var tc = nc + v[1];
          if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
          var o = grid[tr][tc];
          if (!o) {
            nr = tr;
            nc = tc;
            continue;
          }
          if (o.v === t.v && !o.merged) mergedInto = o;
          break;
        }
        if (mergedInto) {
          var o2 = mergedInto;
          grid[r][c] = null;
          var nt = { id: nextId++, v: t.v * 2, r: o2.r, c: o2.c, merged: true };
          grid[o2.r][o2.c] = nt;
          t.r = o2.r;
          t.c = o2.c;
          t.dead = true;
          o2.dead = true;
          dying.push(t, o2);
          tiles.push(nt);
          gained += nt.v;
          if (nt.v === 2048) reached2048 = true;
          moved = true;
        } else if (nr !== r || nc !== c) {
          grid[r][c] = null;
          grid[nr][nc] = t;
          t.r = nr;
          t.c = nc;
          moved = true;
        }
      });
    });

    if (!moved) return;
    tiles = tiles.filter(function (t) {
      return !t.dead;
    });
    prev = snapshot;
    score += gained;
    addRandom();
    render(dying);
    if (reached2048 && !won) {
      won = true;
      setTimeout(showWin, 320);
    }
    if (!canMove()) {
      over = true;
      setTimeout(showOver, 420);
    }
    save();
  }

  function undo() {
    if (!prev || FG.isSheetOpen()) return;
    fromValues(prev.cells);
    score = prev.score;
    prev = null;
    over = false;
    clearBoard();
    render([]);
    save();
  }

  /* ---------- render ---------- */
  function clearBoard() {
    els.forEach(function (el) {
      el.remove();
    });
    els.clear();
  }

  function paint(el, t) {
    var digits = String(t.v).length;
    el.className =
      'tile ' +
      (t.v > 2048 ? 'vsuper' : 'v' + t.v) +
      (digits >= 3 ? ' d' + Math.min(digits, 5) : '') +
      (t.isNew ? ' is-new' : '') +
      (t.merged ? ' is-merged' : '');
    el.style.setProperty('--r', t.r);
    el.style.setProperty('--c', t.c);
    el.firstChild.textContent = t.v;
  }

  function render(dying) {
    var live = new Set();
    tiles.concat(dying).forEach(function (t) {
      live.add(t.id);
      var el = els.get(t.id);
      if (!el) {
        el = document.createElement('div');
        el.appendChild(document.createElement('div')).className = 'tile__in';
        paint(el, t);
        board.appendChild(el);
        els.set(t.id, el);
      } else {
        paint(el, t);
      }
    });
    els.forEach(function (el, id) {
      if (!live.has(id)) {
        el.remove();
        els.delete(id);
      }
    });
    if (dying.length) {
      setTimeout(function () {
        dying.forEach(function (t) {
          var el = els.get(t.id);
          if (el) {
            el.remove();
            els.delete(t.id);
          }
        });
      }, 130);
    }
    if (score > best) {
      best = score;
      FG.store.set(BEST, best);
    }
    scoreEl.textContent = FG.fmtNum(score);
    bestEl.textContent = FG.fmtNum(best);
    undoBtn.disabled = !prev;
  }

  function save() {
    FG.store.set(KEY, { cells: values(), score: score, won: won, keepPlaying: keepPlaying, over: over, prev: prev });
    FG.hubNote('2048', { note: best ? 'สถิติ ' + FG.fmtNum(best) : '', resume: score > 0 && !over });
  }

  /* ---------- sheets ---------- */
  function showWin() {
    FG.sheet({
      title: 'ถึง 2048 แล้ว!',
      text: 'เก่งมาก ได้ ' + FG.fmtNum(score) + ' แต้ม จะเล่นต่อให้ได้เลขใหญ่กว่านี้ไหม',
      dismissible: false,
      actions: [
        { label: 'เริ่มใหม่', onClick: newGame },
        {
          label: 'เล่นต่อ',
          primary: true,
          onClick: function () {
            keepPlaying = true;
            save();
          }
        }
      ]
    });
  }

  function showOver() {
    var actions = [{ label: 'เริ่มใหม่', primary: true, onClick: newGame }];
    if (prev) actions.unshift({ label: 'ย้อน 1 ตา', onClick: undo });
    FG.sheet({
      title: 'ไม่มีช่องให้เลื่อนแล้ว',
      text: 'ได้ ' + FG.fmtNum(score) + ' แต้ม' + (score > 0 && score >= best ? ' — สถิติใหม่!' : ''),
      dismissible: false,
      actions: actions
    });
  }

  function confirmRestart() {
    if (score === 0 || over) {
      newGame();
      return;
    }
    FG.sheet({
      title: 'เริ่มเกมใหม่?',
      text: 'เกมที่เล่นอยู่ (' + FG.fmtNum(score) + ' แต้ม) จะหายไป',
      actions: [{ label: 'ยกเลิก' }, { label: 'เริ่มใหม่', primary: true, onClick: newGame }]
    });
  }

  /* ---------- input ---------- */
  FG.swipe(document.getElementById('stage'), move);
  document.addEventListener('keydown', function (e) {
    var map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    var dir = map[e.key];
    if (dir) {
      e.preventDefault();
      move(dir);
    } else if ((e.key === 'z' || e.key === 'u') && !e.metaKey) {
      undo();
    }
  });
  undoBtn.addEventListener('click', undo);
  document.getElementById('restart').addEventListener('click', confirmRestart);

  /* ---------- boot ---------- */
  best = FG.store.get(BEST, 0) || 0;
  var saved = FG.store.get(KEY, null);
  if (saved && Array.isArray(saved.cells) && saved.cells.length === N) {
    fromValues(saved.cells);
    score = saved.score || 0;
    won = !!saved.won;
    keepPlaying = !!saved.keepPlaying;
    over = !!saved.over;
    prev = saved.prev || null;
    if (!tiles.length) newGame();
    else {
      render([]);
      if (over) setTimeout(showOver, 200);
      else if (won && !keepPlaying) setTimeout(showWin, 200);
    }
  } else {
    newGame();
  }
})();
