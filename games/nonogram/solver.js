/*
 * ภาพปริศนาเติมช่อง (nonogram) — ตัวคำนวณตัวเลขใบ้ + ตัวแก้แบบทีละแถว
 * ใช้ได้ทั้งในเบราว์เซอร์ window.NonoSolver และใน node require
 * ช่องในกระดาน: 1 ถม · 0 ว่าง · -1 ยังไม่รู้
 * solve() ใช้แค่ "สิ่งที่บังคับ" ในแต่ละแถว/คอลัมน์ (ไม่เดา ไม่ลองผิดลองถูก)
 * — ถ้าแก้ได้ครบ แปลว่าผู้เล่นไล่ตรรกะทีละแถวจนจบได้โดยไม่ต้องเดา และคำตอบมีแบบเดียว
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NonoSolver = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ตัวเลขใบ้ของแถวเดียว (array ของ 1/0 หรือ string '#'/'.') → [3, 1] · แถวว่าง → []
  function lineClue(line) {
    var out = [];
    var run = 0;
    for (var i = 0; i < line.length; i++) {
      var v = line[i];
      if (v === 1 || v === '#') run++;
      else {
        if (run) out.push(run);
        run = 0;
      }
    }
    if (run) out.push(run);
    return out;
  }

  // rows = ['#.#..', ...] → { rows: [[1,1],...], cols: [[...],...] }
  function clues(rows) {
    var h = rows.length;
    var w = h ? rows[0].length : 0;
    var r = [];
    var c = [];
    var i, j;
    for (i = 0; i < h; i++) r.push(lineClue(rows[i]));
    for (j = 0; j < w; j++) {
      var col = [];
      for (i = 0; i < h; i++) col.push(rows[i].charAt(j));
      c.push(lineClue(col));
    }
    return { rows: r, cols: c };
  }

  /*
   * แก้แถวเดียวแบบแม่นยำ (DP บนตำแหน่งวางบล็อก)
   * line = array ของ 1/0/-1 · clue = [3, 1]
   * คืน array ใหม่ที่เติมช่องที่ "ต้องเป็นแบบนั้นในทุกวิธีวางที่ถูกต้อง" · หรือ null ถ้าวางไม่ได้เลย (ขัดแย้ง)
   */
  function solveLine(line, clue) {
    var n = line.length;
    var k = clue.length;
    var i, j, L, e;

    function canEmpty(x) {
      return line[x] !== 1;
    }
    // ช่องถมต่อเนื่องได้ไหม [s, s+len)
    // เตรียมตัวนับ "ช่องที่ห้ามถม (0) สะสม" เพื่อเช็คเร็ว
    var zeroPre = [0];
    for (i = 0; i < n; i++) zeroPre.push(zeroPre[i] + (line[i] === 0 ? 1 : 0));
    function canFillRun(s, len) {
      return s + len <= n && zeroPre[s + len] - zeroPre[s] === 0;
    }
    // บล็อก j วางที่ s ได้ไหม (รวมช่องว่างคั่นหลังบล็อกถ้าไม่ชนขอบ) → ตำแหน่งถัดไป หรือ -1
    function placeEnd(s, len) {
      if (!canFillRun(s, len)) return -1;
      e = s + len;
      if (e === n) return n;
      return canEmpty(e) ? e + 1 : -1;
    }

    // F[i][j]: ช่อง [0,i) รองรับบล็อก 0..j-1 ได้ครบ และช่อง i เริ่มบล็อกใหม่ได้ (ช่องก่อนหน้าว่างหรือ i=0)
    // B[i][j]: ช่อง [i,n) รองรับบล็อก j..k-1 ได้ครบ โดยเริ่มจากสถานะว่าง
    var F = [];
    var B = [];
    for (i = 0; i <= n; i++) {
      F.push(new Array(k + 1).fill(false));
      B.push(new Array(k + 1).fill(false));
    }
    F[0][0] = true;
    for (i = 0; i < n; i++) {
      for (j = 0; j <= k; j++) {
        if (!F[i][j]) continue;
        if (canEmpty(i)) F[i + 1][j] = true;
        if (j < k) {
          var nx = placeEnd(i, clue[j]);
          if (nx >= 0) F[nx][j + 1] = true;
        }
      }
    }
    if (!F[n][k]) return null;

    B[n][k] = true;
    for (i = n - 1; i >= 0; i--) {
      for (j = k; j >= 0; j--) {
        var ok = canEmpty(i) && B[i + 1][j];
        if (!ok && j < k) {
          var nb = placeEnd(i, clue[j]);
          if (nb >= 0 && B[nb][j + 1]) ok = true;
        }
        B[i][j] = ok;
      }
    }

    var emptyOk = new Array(n).fill(false);
    var fillDiff = new Array(n + 1).fill(0);
    for (i = 0; i < n; i++) {
      for (j = 0; j <= k; j++) {
        if (!F[i][j]) continue;
        if (canEmpty(i) && B[i + 1][j]) emptyOk[i] = true;
        if (j < k) {
          L = clue[j];
          var p = placeEnd(i, L);
          if (p >= 0 && B[p][j + 1]) {
            fillDiff[i]++;
            fillDiff[i + L]--;
            if (i + L < n) emptyOk[i + L] = true; // ช่องคั่นหลังบล็อก
          }
        }
      }
    }

    var out = line.slice();
    var acc = 0;
    for (i = 0; i < n; i++) {
      acc += fillDiff[i];
      var fillOk = acc > 0;
      if (!fillOk && !emptyOk[i]) return null;
      if (fillOk && !emptyOk[i]) out[i] = 1;
      else if (!fillOk && emptyOk[i]) out[i] = 0;
    }
    return out;
  }

  /*
   * แก้ทั้งกระดานด้วยตรรกะทีละแถว/คอลัมน์ วนจนไม่มีอะไรเปลี่ยน
   * → { solved, grid (array ของแถว ค่า 1/0/-1), contradiction }
   */
  function solve(rowClues, colClues) {
    var h = rowClues.length;
    var w = colClues.length;
    var grid = [];
    var i, j;
    for (i = 0; i < h; i++) grid.push(new Array(w).fill(-1));

    // คิวแถว/คอลัมน์ที่ต้องคิดใหม่ (0..h-1 = แถว · h..h+w-1 = คอลัมน์)
    var dirty = new Array(h + w).fill(true);
    var queue = [];
    for (i = 0; i < h + w; i++) queue.push(i);
    var contradiction = false;

    while (queue.length && !contradiction) {
      var id = queue.shift();
      dirty[id] = false;
      var line, res, x;
      if (id < h) {
        res = solveLine(grid[id], rowClues[id]);
        if (!res) {
          contradiction = true;
          break;
        }
        for (x = 0; x < w; x++) {
          if (grid[id][x] === -1 && res[x] !== -1) {
            grid[id][x] = res[x];
            if (!dirty[h + x]) {
              dirty[h + x] = true;
              queue.push(h + x);
            }
          }
        }
      } else {
        var c = id - h;
        line = [];
        for (x = 0; x < h; x++) line.push(grid[x][c]);
        res = solveLine(line, colClues[c]);
        if (!res) {
          contradiction = true;
          break;
        }
        for (x = 0; x < h; x++) {
          if (grid[x][c] === -1 && res[x] !== -1) {
            grid[x][c] = res[x];
            if (!dirty[x]) {
              dirty[x] = true;
              queue.push(x);
            }
          }
        }
      }
    }

    var solved = !contradiction;
    for (i = 0; i < h && solved; i++) {
      for (j = 0; j < w; j++) {
        if (grid[i][j] === -1) {
          solved = false;
          break;
        }
      }
    }
    return { solved: solved, grid: grid, contradiction: contradiction };
  }

  function sameClue(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // กระดาน 1/0 ครบทุกช่อง ตรงตัวเลขใบ้ทุกแถวทุกคอลัมน์ไหม (ใช้ตัดสินว่าชนะ)
  function check(rowClues, colClues, grid) {
    var h = rowClues.length;
    var w = colClues.length;
    if (!grid || grid.length !== h) return false;
    var i, j;
    for (i = 0; i < h; i++) {
      if (!grid[i] || grid[i].length !== w) return false;
      for (j = 0; j < w; j++) if (grid[i][j] !== 0 && grid[i][j] !== 1) return false;
      if (!sameClue(lineClue(grid[i]), rowClues[i])) return false;
    }
    for (j = 0; j < w; j++) {
      var col = [];
      for (i = 0; i < h; i++) col.push(grid[i][j]);
      if (!sameClue(lineClue(col), colClues[j])) return false;
    }
    return true;
  }

  // แปลงภาพ ['#.#', ...] → กระดาน 1/0
  function toGrid(rows) {
    return rows.map(function (r) {
      var a = [];
      for (var i = 0; i < r.length; i++) a.push(r.charAt(i) === '#' ? 1 : 0);
      return a;
    });
  }

  return {
    lineClue: lineClue,
    clues: clues,
    solveLine: solveLine,
    solve: solve,
    check: check,
    toGrid: toGrid
  };
});
