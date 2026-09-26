/*
 * ลากเส้นปิดกล่อง — คอม (ใช้ได้ทั้งในเบราว์เซอร์ window.DotsAI และใน node require)
 * กระดาน n×n กล่อง · เส้น = array: เส้นนอน (n+1)*n เส้นก่อน (index แถว*n+หลัก) แล้วตามด้วยเส้นตั้ง n*(n+1) เส้น
 * ค่าในเส้น: -1 ยังไม่ลาก · 0/1 ลากแล้ว (ใครลากไม่สำคัญกับคอม)
 *
 * ง่าย = มีกล่องให้ปิดก็มักจะปิด นอกนั้นสุ่ม (ส่วนใหญ่ไม่ยื่นด้านที่ 3 ให้)
 * ยาก = ปิดกล่องที่ปิดได้ · ไม่ยื่นด้านที่ 3 ตราบใดที่ยังมีเส้นปลอดภัย · พอไม่เหลือเส้นปลอดภัย
 *       ยอมเปิดโซ่ที่สั้นที่สุด · ใช้ท่า "ทิ้ง 2 กล่องท้ายโซ่" เพื่อคุมเกมต่อ · เหลือ ≤14 เส้น = คิดจนจบเกม (เล่นไม่พลาด)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DotsAI = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hCount(n) {
    return (n + 1) * n;
  }

  function boxEdges(n, b) {
    var r = Math.floor(b / n);
    var c = b % n;
    var H = hCount(n);
    return [r * n + c, (r + 1) * n + c, H + r * (n + 1) + c, H + r * (n + 1) + c + 1];
  }

  // กล่องที่อยู่ติดเส้น k (1 หรือ 2 กล่อง)
  function lineBoxes(n, k) {
    var H = hCount(n);
    var out = [];
    if (k < H) {
      var r = Math.floor(k / n);
      var c = k % n;
      if (r > 0) out.push((r - 1) * n + c);
      if (r < n) out.push(r * n + c);
    } else {
      var j = k - H;
      var r2 = Math.floor(j / (n + 1));
      var c2 = j % (n + 1);
      if (c2 > 0) out.push(r2 * n + c2 - 1);
      if (c2 < n) out.push(r2 * n + c2);
    }
    return out;
  }

  function Model(n, lines) {
    this.n = n;
    this.d = lines.map(function (v) {
      return v !== -1;
    });
    this.edges = [];
    this.adj = [];
    for (var b = 0; b < n * n; b++) this.edges.push(boxEdges(n, b));
    for (var k = 0; k < lines.length; k++) this.adj.push(lineBoxes(n, k));
  }

  Model.prototype.sides = function (b) {
    var e = this.edges[b];
    return (this.d[e[0]] ? 1 : 0) + (this.d[e[1]] ? 1 : 0) + (this.d[e[2]] ? 1 : 0) + (this.d[e[3]] ? 1 : 0);
  };

  Model.prototype.free = function () {
    var out = [];
    for (var k = 0; k < this.d.length; k++) if (!this.d[k]) out.push(k);
    return out;
  };

  // ลากเส้น k → ได้กี่กล่อง
  Model.prototype.draw = function (k) {
    this.d[k] = true;
    var got = 0;
    var a = this.adj[k];
    for (var j = 0; j < a.length; j++) if (this.sides(a[j]) === 4) got++;
    return got;
  };

  Model.prototype.undraw = function (k) {
    this.d[k] = false;
  };

  // เส้นที่ปิดกล่องได้ทันที
  Model.prototype.capturing = function () {
    var out = [];
    for (var k = 0; k < this.d.length; k++) {
      if (this.d[k]) continue;
      var a = this.adj[k];
      for (var j = 0; j < a.length; j++) {
        if (this.sides(a[j]) === 3) {
          out.push(k);
          break;
        }
      }
    }
    return out;
  };

  // เส้นปลอดภัย = ไม่ทำให้กล่องไหนมี 3 ด้าน (และไม่ได้ปิดกล่อง)
  Model.prototype.safe = function () {
    var out = [];
    for (var k = 0; k < this.d.length; k++) {
      if (this.d[k]) continue;
      var a = this.adj[k];
      var ok = true;
      for (var j = 0; j < a.length; j++) if (this.sides(a[j]) >= 2) ok = false;
      if (ok) out.push(k);
    }
    return out;
  };

  // อีกฝ่ายกินรวดได้กี่กล่อง ถ้าไล่ปิดทุกกล่องที่ปิดได้ (ไม่แก้กระดานจริง)
  Model.prototype.greedyGain = function () {
    var taken = [];
    var gain = 0;
    for (;;) {
      var cap = this.capturing();
      if (!cap.length) break;
      gain += this.draw(cap[0]);
      taken.push(cap[0]);
    }
    for (var t = 0; t < taken.length; t++) this.undraw(taken[t]);
    return gain;
  };

  /* ---------- คิดจนจบเกม (ใช้เมื่อเหลือเส้นน้อย) ---------- */
  function Timeout() {}

  function exact(m, budgetMs) {
    var deadline = Date.now() + budgetMs;
    var memo = new Map();
    var nodes = 0;
    var free = m.free();

    function key() {
      var s = '';
      for (var i = 0; i < free.length; i++) s += m.d[free[i]] ? '1' : '0';
      return s;
    }

    // คะแนน (กล่องของฝ่ายที่กำลังเดิน − ของอีกฝ่าย) จากนี้ไปจนจบ
    function value() {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
      var k0 = key();
      var hit = memo.get(k0);
      if (hit !== undefined) return hit;
      var best = -Infinity;
      var any = false;
      for (var i = 0; i < free.length; i++) {
        var k = free[i];
        if (m.d[k]) continue;
        any = true;
        var got = m.draw(k);
        var v = got ? got + value() : -value();
        m.undraw(k);
        if (v > best) best = v;
      }
      if (!any) best = 0;
      memo.set(k0, best);
      return best;
    }

    var best = -Infinity;
    var bestK = -1;
    for (var i = 0; i < free.length; i++) {
      var k = free[i];
      var got = m.draw(k);
      var v;
      try {
        v = got ? got + value() : -value();
      } finally {
        m.undraw(k);
      }
      if (v > best) {
        best = v;
        bestK = k;
      }
    }
    return bestK;
  }

  // ท่า "ทิ้ง 2 กล่องท้ายโซ่": กำลังกินโซ่ เหลือ 2 กล่องสุดท้าย และยังมีโซ่ยาวรออยู่
  // → ลากเส้นปลายไกลแทน ให้อีกฝ่ายได้ 2 กล่อง แล้วต้องเปิดโซ่ถัดไปให้เรา
  function doubleDeal(m, cap) {
    for (var i = 0; i < cap.length; i++) {
      var k = cap[i];
      var a = m.adj[k];
      var three = -1;
      for (var j = 0; j < a.length; j++) if (m.sides(a[j]) === 3) three = a[j];
      if (three === -1) continue;
      // กล่องถัดไปผ่านเส้น k ต้องเป็นกล่องสุดท้ายของโซ่ (มี 2 ด้าน และปิดแล้วไม่ต่อไปไหน)
      var other = -1;
      for (var q = 0; q < a.length; q++) if (a[q] !== three) other = a[q];
      if (other === -1 || m.sides(other) !== 2) continue;
      var oe = m.edges[other];
      var far = -1;
      var ends = true;
      for (var t = 0; t < 4; t++) {
        var e = oe[t];
        if (m.d[e] || e === k) continue;
        far = e;
        var nb = m.adj[e];
        for (var z = 0; z < nb.length; z++) if (nb[z] !== other && m.sides(nb[z]) >= 2) ends = false;
      }
      if (far === -1 || !ends) continue;
      // คุ้มไหม: หลังทิ้ง 2 กล่องนี้ ต้องยังมีโซ่ให้อีกฝ่ายเปิดที่ยาวพอ (≥3 กล่อง)
      m.draw(k);
      var gotHere = m.greedyGain(); // กล่องที่เหลือในโซ่นี้ (ควรเป็น 1 = other)
      m.undraw(k);
      if (gotHere !== 1) continue;
      m.draw(far);
      var rest = remainingChainValue(m);
      m.undraw(far);
      if (rest >= 3) return far;
    }
    return -1;
  }

  // โซ่ที่สั้นที่สุดที่อีกฝ่ายจะต้องเปิดให้เรา หลังจากเขากินกล่องที่ปิดได้หมดแล้ว (คร่าว ๆ)
  function remainingChainValue(m) {
    var taken = [];
    for (;;) {
      var cap = m.capturing();
      if (!cap.length) break;
      m.draw(cap[0]);
      taken.push(cap[0]);
    }
    var v = 0;
    if (!m.safe().length) {
      var free = m.free();
      var worst = Infinity;
      for (var i = 0; i < free.length; i++) {
        m.draw(free[i]);
        var g = m.greedyGain();
        m.undraw(free[i]);
        if (g < worst) worst = g;
      }
      v = worst === Infinity ? 0 : worst;
    }
    for (var t = 0; t < taken.length; t++) m.undraw(taken[t]);
    return v;
  }

  // บังคับต้องยื่นกล่อง: เลือกเส้นที่อีกฝ่ายกินได้น้อยที่สุด
  function leastGift(m) {
    var free = m.free();
    var best = Infinity;
    var bestK = free[0];
    for (var i = 0; i < free.length; i++) {
      var got = m.draw(free[i]);
      var g = got ? -got : m.greedyGain();
      m.undraw(free[i]);
      if (g < best) {
        best = g;
        bestK = free[i];
      }
    }
    return bestK;
  }

  function pick(list, rnd) {
    return list[Math.floor(rnd() * list.length)];
  }

  /*
   * ตาเดินของคอม: n (ขนาดกล่อง), lines, level 1|2, rnd, opts { budget }
   * → index เส้นที่ยังไม่ลาก (หรือ -1 ถ้าลากครบแล้ว)
   */
  function choose(n, lines, level, rnd, opts) {
    rnd = rnd || Math.random;
    var m = new Model(n, lines);
    var free = m.free();
    if (!free.length) return -1;
    var cap = m.capturing();
    var safe = m.safe();

    if (level !== 2) {
      if (cap.length && rnd() < 0.85) return pick(cap, rnd);
      if (safe.length && rnd() < 0.7) return pick(safe, rnd);
      return pick(free, rnd);
    }

    if (free.length <= 14) {
      try {
        var k = exact(m, (opts && opts.budget) || 450);
        if (k !== -1) return k;
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
      }
    }
    if (cap.length) {
      if (!safe.length || safe.every(function (s) { return cap.indexOf(s) !== -1; })) {
        var dd = doubleDeal(m, cap);
        if (dd !== -1) return dd;
      }
      return cap[0];
    }
    if (safe.length) return pick(safe, rnd);
    return leastGift(m);
  }

  return { choose: choose, boxEdges: boxEdges, lineBoxes: lineBoxes, hCount: hCount };
});
