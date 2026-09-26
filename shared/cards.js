/*
 * ของใช้ร่วมของเกมไพ่ (ฟรีเซลล์ · สไปเดอร์): รูปดอกไพ่, สร้างการ์ด, วางการ์ด, แตะ/ลากวาง
 * ใส่ในหน้าเกมหลัง app.js: <script src="../../shared/cards.js" defer></script> + <link rel="stylesheet" href="../../shared/cards.css">
 * (โซลิแทร์เดิมมีโค้ดของตัวเอง ไม่ได้ใช้ไฟล์นี้)
 *
 * ไพ่: suit 0 โพดำ · 1 โพแดง · 2 ข้าวหลามตัด · 3 ดอกจิก · rank 1–13
 */
(function () {
  'use strict';

  var RANKS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var SUIT_TH = ['โพดำ', 'โพแดง', 'ข้าวหลามตัด', 'ดอกจิก'];
  var SPRITE =
    '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false">' +
    '<symbol id="suit-0" viewBox="0 0 24 24"><path d="M12 2C9 6.5 4 9.6 4 13.6c0 2.6 2 4.4 4.3 4.4 1.3 0 2.4-.5 3.1-1.4-.3 1.9-1.1 3.4-2.4 4.6h6c-1.3-1.2-2.1-2.7-2.4-4.6.7.9 1.8 1.4 3.1 1.4 2.3 0 4.3-1.8 4.3-4.4C20 9.6 15 6.5 12 2z" fill="currentColor"/></symbol>' +
    '<symbol id="suit-1" viewBox="0 0 24 24"><path d="M12 21s-8.5-5.3-8.5-11.4C3.5 6.5 5.8 4.3 8.6 4.3c1.5 0 2.7.7 3.4 1.8.7-1.1 1.9-1.8 3.4-1.8 2.8 0 5.1 2.2 5.1 5.3C20.5 15.7 12 21 12 21z" fill="currentColor"/></symbol>' +
    '<symbol id="suit-2" viewBox="0 0 24 24"><path d="M12 2l7.2 10L12 22 4.8 12z" fill="currentColor"/></symbol>' +
    '<symbol id="suit-3" viewBox="0 0 24 24"><g fill="currentColor"><circle cx="12" cy="7.2" r="4.3"/><circle cx="6.9" cy="13.4" r="4.3"/><circle cx="17.1" cy="13.4" r="4.3"/><path d="M11 11.5h2c0 4.3.9 7 3 9.5H8c2.1-2.5 3-5.2 3-9.5z"/></g></symbol>' +
    '</svg>';

  var spriteDone = false;
  function sprite() {
    if (spriteDone) return;
    spriteDone = true;
    document.body.insertAdjacentHTML('afterbegin', SPRITE);
  }

  function isRed(suit) {
    return suit === 1 || suit === 2;
  }

  function suitSvg(s, cls) {
    return '<svg class="' + cls + '" aria-hidden="true"><use href="#suit-' + s + '"/></svg>';
  }

  function suitIcon(s) {
    return '<svg aria-hidden="true"><use href="#suit-' + s + '"/></svg>';
  }

  // การ์ด 1 ใบ (ยังไม่วางลงกระดาน)
  function makeCard(id, suit, rank) {
    sprite();
    var el = document.createElement('div');
    el.className = 'card' + (isRed(suit) ? ' is-red' : '');
    el.dataset.id = id;
    el.setAttribute('aria-label', SUIT_TH[suit] + ' ' + RANKS[rank]);
    el.innerHTML =
      '<div class="card__back"></div><div class="card__face"><span class="card__rank">' +
      RANKS[rank] +
      '</span>' +
      suitSvg(suit, 'card__pip') +
      suitSvg(suit, 'card__big') +
      '</div>';
    return el;
  }

  function makeSlot(boardEl, cls, inner) {
    var el = document.createElement('div');
    el.className = 'slot ' + (cls || '');
    el.innerHTML = inner || '';
    boardEl.appendChild(el);
    return el;
  }

  function place(el, x, y, z) {
    el.dataset.x = x;
    el.dataset.y = y;
    el.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    el.style.zIndex = z;
  }

  // ขนาดการ์ดตามความกว้าง (cols แถว, ช่องไฟ g) · ตั้งตัวแปร CSS ให้กระดาน
  function sizeCards(boardEl, cols, maxHFraction) {
    var W = boardEl.clientWidth;
    var H = boardEl.clientHeight;
    var g = Math.max(3, Math.round(W * (cols > 8 ? 0.01 : 0.014)));
    var w = Math.floor((W - (cols + 1) * g) / cols);
    var h = Math.round(w * 1.4);
    var maxH = H * (maxHFraction || 0.3);
    if (h > maxH) {
      h = Math.floor(maxH);
      w = Math.floor(h / 1.4);
    }
    var x0 = Math.round((W - (cols * w + (cols - 1) * g)) / 2);
    var narrow = w < 40;
    boardEl.classList.toggle('is-narrow', narrow);
    boardEl.style.setProperty('--card-w', w + 'px');
    boardEl.style.setProperty('--card-radius', Math.max(3, Math.round(w * 0.1)) + 'px');
    boardEl.style.setProperty('--rank-size', Math.round(w * (narrow ? 0.4 : 0.36)) + 'px');
    boardEl.style.setProperty('--pip-size', Math.round(w * (narrow ? 0.34 : 0.3)) + 'px');
    boardEl.querySelectorAll('.slot, .card').forEach(function (el) {
      el.style.width = w + 'px';
      el.style.height = h + 'px';
    });
    return { W: W, H: H, g: g, w: w, h: h, x0: x0, colX: function (c) { return x0 + c * (w + g); } };
  }

  function shake(el) {
    if (!el) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    FG.buzz(20);
  }

  /*
   * แตะ/ลากวาง บนกระดาน
   * opts.busy() → true = ห้ามแตะตอนนี้
   * opts.pick(cardId|null, slotEl|null) → { ids:[...] } ถ้าหยิบไพ่ได้ (ไพ่ใบนั้น + ใบที่ทับอยู่) · null = หยิบไม่ได้
   * opts.drop(pick, cx, cy) → true ถ้าวางสำเร็จ (cx,cy = จุดกลางใบบนสุดที่ลาก เทียบกับกระดาน)
   * opts.tap(cardId|null, slotEl|null, pick|null) → แตะเฉย ๆ
   * opts.cancel() → วาดใหม่ (ลากแล้ววางไม่ได้)
   * opts.els = array ของ element การ์ด (index = id)
   */
  function input(boardEl, opts) {
    var drag = null;

    boardEl.addEventListener('pointerdown', function (e) {
      if (drag || FG.isSheetOpen() || (opts.busy && opts.busy())) return;
      var cardEl = e.target.closest('.card');
      var slotEl = cardEl ? null : e.target.closest('.slot');
      var id = cardEl ? +cardEl.dataset.id : null;
      drag = { pid: e.pointerId, x: e.clientX, y: e.clientY, moving: false, id: id, slot: slotEl };
      drag.pick = opts.pick(id, slotEl);
      try {
        boardEl.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    boardEl.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pid || !drag.pick) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moving && Math.abs(dx) + Math.abs(dy) < 8) return;
      drag.moving = true;
      drag.pick.ids.forEach(function (cid, n) {
        var el = opts.els[cid];
        el.classList.add('is-dragging');
        el.style.transform = 'translate3d(' + (+el.dataset.x + dx) + 'px,' + (+el.dataset.y + dy) + 'px,0)';
        el.style.zIndex = 2000 + n;
      });
      drag.dx = dx;
      drag.dy = dy;
    });

    function end(e, cancelled) {
      if (!drag || e.pointerId !== drag.pid) return;
      var d = drag;
      drag = null;
      if (d.pick)
        d.pick.ids.forEach(function (cid) {
          opts.els[cid].classList.remove('is-dragging');
        });
      if (cancelled) {
        opts.cancel();
        return;
      }
      if (d.moving) {
        var el = opts.els[d.pick.ids[0]];
        var cx = +el.dataset.x + d.dx + el.offsetWidth / 2;
        var cy = +el.dataset.y + d.dy + el.offsetHeight / 2;
        if (!opts.drop(d.pick, cx, cy)) opts.cancel();
        return;
      }
      opts.tap(d.id, d.slot, d.pick);
    }

    boardEl.addEventListener('pointerup', function (e) {
      end(e, false);
    });
    boardEl.addEventListener('pointercancel', function (e) {
      end(e, true);
    });
    boardEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });
  }

  window.FGCards = {
    RANKS: RANKS,
    SUIT_TH: SUIT_TH,
    isRed: isRed,
    suitIcon: suitIcon,
    sprite: sprite,
    makeCard: makeCard,
    makeSlot: makeSlot,
    place: place,
    sizeCards: sizeCards,
    shake: shake,
    input: input
  };
})();
