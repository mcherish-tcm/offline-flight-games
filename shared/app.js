/*
 * ของใช้ร่วมทุกหน้า: บันทึกข้อมูล, ธีม, ลงทะเบียน service worker, แถบอัปเดต, toast, หน้าต่างถาม, ปัดนิ้ว, ไอคอน
 * ใส่ในหน้าด้วย <script src=".../shared/app.js" data-root="../../" defer></script>
 * data-root = ทางกลับไปโฟลเดอร์หลักของเว็บ (หน้าแรก = "./", หน้าเกม = "../../")
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var ROOT = (script && script.getAttribute('data-root')) || './';
  var PREFIX = 'ffg:';

  /* ---------- storage (localStorage อาจใช้ไม่ได้ในบางโหมด → ห่อ try/catch ทุกครั้ง) ---------- */
  var store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* เต็ม/ถูกบล็อก — เล่นต่อได้ แค่ไม่ได้บันทึก */
      }
    },
    del: function (key) {
      try {
        localStorage.removeItem(PREFIX + key);
      } catch (e) {}
    }
  };

  /* ---------- icons (stroke = currentColor) ---------- */
  var ICONS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    restart: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
    pause: '<path d="M9 5v14M15 5v14"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    flag: '<path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/>',
    pencil: '<path d="M4 20l4.5-1L19 8.5 15.5 5 5 15.5 4 20z"/><path d="M13.5 7l3.5 3.5"/>',
    erase: '<path d="M21 6H9l-6 6 6 6h12z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    up: '<path d="M5 15l7-7 7 7"/>',
    down: '<path d="M5 9l7 7 7-7"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    wand: '<path d="M4 20L15 9"/><path d="M17 3v4M15 5h4M20 10v3M18.5 11.5h3"/>',
    download: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.01" stroke-width="2.6"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2"/>',
    cross: '<path d="M6 6l12 12M18 6L6 18"/>',
    // เฟือง = ตั้งค่า (v8) — วาดเอง 8 ฟัน
    gear: '<path d="M19.2 12.7L21.6 13.9L20.1 17.5L17.5 16.6L16.6 17.5L17.5 20.1L13.9 21.6L12.7 19.2L11.3 19.2L10.1 21.6L6.5 20.1L7.4 17.5L6.5 16.6L3.9 17.5L2.4 13.9L4.8 12.7L4.8 11.3L2.4 10.1L3.9 6.5L6.5 7.4L7.4 6.5L6.5 3.9L10.1 2.4L11.3 4.8L12.7 4.8L13.9 2.4L17.5 3.9L16.6 6.5L17.5 7.4L20.1 6.5L21.6 10.1L19.2 11.3z"/><circle cx="12" cy="12" r="3"/>',
    square: '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"/>'
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      (ICONS[name] || '') +
      '</svg>'
    );
  }

  function fillIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(function (el) {
      if (el.querySelector('svg')) return;
      el.insertAdjacentHTML('afterbegin', icon(el.getAttribute('data-icon')));
    });
  }

  /* ---------- theme ---------- */
  function applyTheme(theme) {
    var root = document.documentElement;
    if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      requestAnimationFrame(function () {
        meta.setAttribute('content', getComputedStyle(document.body).backgroundColor);
      });
    }
  }

  function getTheme() {
    return store.get('theme', 'dark');
  }

  function setTheme(theme) {
    store.set('theme', theme);
    applyTheme(theme);
  }

  /* ---------- toast ---------- */
  var toastEl = null;
  var toastTimer = 0;
  function toast(text, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    clearTimeout(toastTimer);
    // force reflow so repeated toasts re-animate
    void toastEl.offsetWidth;
    toastEl.classList.add('is-on');
    toastTimer = setTimeout(function () {
      toastEl.classList.remove('is-on');
    }, ms || 1800);
  }

  /* ---------- sheet (หน้าต่างถาม/สรุปผล) ---------- */
  var openSheet = null;
  function sheet(opts) {
    closeSheet();
    var dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    var html = '';
    if (opts.title) html += '<h2 class="sheet__title">' + opts.title + '</h2>';
    if (opts.text) html += '<p class="sheet__text">' + opts.text + '</p>';
    dlg.innerHTML = html;
    if (opts.body) {
      var body = document.createElement('div');
      body.className = 'sheet__body';
      body.appendChild(opts.body);
      dlg.appendChild(body);
    }
    var actions = document.createElement('div');
    actions.className = 'sheet__actions';
    (opts.actions || [{ label: 'ตกลง', primary: true }]).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn' + (a.primary ? ' btn--primary' : '');
      b.textContent = a.label;
      b.addEventListener('click', function () {
        if (a.keepOpen !== true) closeSheet();
        if (a.onClick) a.onClick();
      });
      actions.appendChild(b);
    });
    dlg.appendChild(actions);
    dlg.addEventListener('cancel', function (e) {
      if (opts.dismissible === false) {
        e.preventDefault();
        return;
      }
      if (opts.onDismiss) opts.onDismiss();
    });
    dlg.addEventListener('close', function () {
      if (dlg.parentNode) dlg.parentNode.removeChild(dlg);
      if (openSheet === dlg) openSheet = null;
    });
    if (opts.dismissible !== false) {
      dlg.addEventListener('click', function (e) {
        if (e.target === dlg) {
          var r = dlg.getBoundingClientRect();
          var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) {
            closeSheet();
            if (opts.onDismiss) opts.onDismiss();
          }
        }
      });
    }
    document.body.appendChild(dlg);
    openSheet = dlg;
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
    var primary = actions.querySelector('.btn--primary');
    if (primary) primary.focus({ preventScroll: true });
    return dlg;
  }

  function closeSheet() {
    if (openSheet) {
      var d = openSheet;
      openSheet = null;
      if (d.open && typeof d.close === 'function') d.close();
      if (d.parentNode) d.parentNode.removeChild(d);
    }
  }

  /* segmented choice builder for sheets: FG.choice([{value,label}], current, onChange) */
  function choice(options, current, onChange) {
    var wrap = document.createElement('div');
    wrap.className = 'seg';
    wrap.setAttribute('role', 'radiogroup');
    options.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(o.value === current));
      b.textContent = o.label;
      b.addEventListener('click', function () {
        wrap.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-checked', 'false');
        });
        b.setAttribute('aria-checked', 'true');
        onChange(o.value);
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function label(text) {
    var d = document.createElement('div');
    d.className = 'sheet__label';
    d.textContent = text;
    return d;
  }

  // กลุ่มตัวเลือกในหน้าต่างตั้งค่า: หัวข้อ + ตัวเลือก + คำอธิบายสั้น (ไม่บังคับ)
  function group(title, node, hintText) {
    var d = document.createElement('div');
    d.className = 'set-group';
    if (title) d.appendChild(label(title));
    if (node) d.appendChild(node);
    if (hintText) {
      var p = document.createElement('p');
      p.className = 'set-hint';
      p.textContent = hintText;
      d.appendChild(p);
    }
    return d;
  }

  /* ---------- swipe ---------- */
  function swipe(el, cb, opts) {
    var threshold = (opts && opts.threshold) || 24;
    var sx = 0;
    var sy = 0;
    var id = null;
    var fired = false;
    el.addEventListener('pointerdown', function (e) {
      if (id !== null) return;
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      fired = false;
    });
    function track(e, end) {
      if (e.pointerId !== id) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      var ax = Math.abs(dx);
      var ay = Math.abs(dy);
      if (!fired && Math.max(ax, ay) >= threshold) {
        fired = true;
        cb(ax > ay ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        // continuous swipes (Snake): re-anchor so a second turn in the same gesture works
        if (opts && opts.continuous) {
          sx = e.clientX;
          sy = e.clientY;
          fired = false;
        }
      }
      if (end) id = null;
    }
    el.addEventListener('pointermove', function (e) {
      track(e, false);
    });
    el.addEventListener('pointerup', function (e) {
      track(e, true);
    });
    el.addEventListener('pointercancel', function (e) {
      if (e.pointerId === id) id = null;
    });
  }

  /* ---------- misc ---------- */
  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    var mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString('th-TH');
  }

  // บันทึกข้อความสั้น ๆ ให้หน้าแรกเอาไปแสดง (สถิติ / มีเกมค้าง)
  function hubNote(id, data) {
    var cur = store.get('hub:' + id, {});
    for (var k in data) cur[k] = data[k];
    store.set('hub:' + id, cur);
  }

  function onVisibility(cb) {
    document.addEventListener('visibilitychange', function () {
      cb(document.hidden);
    });
  }

  function buzz(ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms || 12);
    } catch (e) {}
  }

  /* ---------- วิธีเล่น (ปุ่ม ⓘ บนแถบหัวของทุกเกม) ----------
   * ในหน้าเกม: <button type="button" class="icon-btn" data-howto="<id เกม>" data-icon="info" aria-label="วิธีเล่น"></button>
   * ข้อความอยู่ที่ howto ของเกมนั้นใน shared/games.js (หน้าเกมต้องโหลด games.js ด้วย)
   * เกมเพิ่มเนื้อหาท้ายหน้าต่างได้: FG.howtoExtra = function (container) { ... }
   */
  function howto(id) {
    var list = typeof self !== 'undefined' && self.FG_GAMES ? self.FG_GAMES : [];
    var game = null;
    for (var k = 0; k < list.length; k++) if (list[k].id === id) game = list[k];
    var body = document.createElement('div');
    body.className = 'howto';
    var ul = document.createElement('ul');
    ul.className = 'howto__list';
    ul.innerHTML = ((game && game.howto) || ['ยังไม่มีคำอธิบายของเกมนี้'])
      .map(function (t) {
        return '<li>' + t + '</li>';
      })
      .join('');
    body.appendChild(ul);
    if (typeof window.FG.howtoExtra === 'function') window.FG.howtoExtra(body);
    return sheet({
      // ชื่อไทยต่อกันได้เลย ("วิธีเล่นซูโดกุ") · ชื่อที่ขึ้นต้นด้วยเลข/อังกฤษ เว้นวรรค ("วิธีเล่น 2048")
      title: 'วิธีเล่น' + (game ? (/^[฀-๿]/.test(game.title) ? '' : ' ') + game.title : ''),
      body: body,
      actions: [{ label: 'เข้าใจแล้ว', primary: true }]
    });
  }

  function wireHowto(root) {
    (root || document).querySelectorAll('[data-howto]').forEach(function (el) {
      el.addEventListener('click', function () {
        howto(el.getAttribute('data-howto'));
      });
    });
  }

  /* ---------- service worker + update prompt ---------- */
  var userAskedReload = false;
  var updateBar = null;

  function showUpdate(worker) {
    if (updateBar) return;
    updateBar = document.createElement('button');
    updateBar.type = 'button';
    updateBar.className = 'update-bar';
    updateBar.innerHTML = icon('restart') + '<span>มีเวอร์ชันใหม่ — แตะเพื่อรีโหลด</span>';
    updateBar.addEventListener('click', function () {
      userAskedReload = true;
      updateBar.disabled = true;
      worker.postMessage({ type: 'skipWaiting' });
      // เผื่อ controllerchange ไม่มา
      setTimeout(function () {
        location.reload();
      }, 2500);
    });
    document.body.appendChild(updateBar);
  }

  var swReady = null;
  function registerSW() {
    if (!('serviceWorker' in navigator)) {
      swReady = Promise.resolve(null);
      return;
    }
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (userAskedReload) location.reload();
    });
    swReady = navigator.serviceWorker
      .register(ROOT + 'sw.js')
      .then(function (reg) {
        if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) showUpdate(nw);
            if (nw.state === 'activated') document.dispatchEvent(new CustomEvent('fg:sw-activated'));
          });
        });
        // เช็คอัปเดตเมื่อกลับมาเปิดแอป (ถ้ามีเน็ต)
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden && navigator.onLine) reg.update().catch(function () {});
        });
        return reg;
      })
      .catch(function () {
        return null;
      });
  }

  // ถาม SW ว่าเก็บไฟล์ครบหรือยัง → {version,total,have,missing} หรือ null
  function offlineStatus() {
    if (!('serviceWorker' in navigator) || !swReady) return Promise.resolve({ error: true });
    return swReady.then(function (registered) {
      if (!registered) return { error: true };
      var timeout = new Promise(function (resolve) {
        setTimeout(function () {
          resolve(null);
        }, 5000);
      });
      return Promise.race([navigator.serviceWorker.ready, timeout]).then(function (reg) {
        return reg ? askWorker(reg) : null;
      });
    });
  }

  function askWorker(reg) {
    var worker = reg.active;
    if (!worker) return null;
    return new Promise(function (resolve) {
      var ch = new MessageChannel();
      var t = setTimeout(function () {
        resolve(null);
      }, 4000);
      ch.port1.onmessage = function (e) {
        clearTimeout(t);
        resolve(e.data);
      };
      worker.postMessage({ type: 'status' }, [ch.port2]);
    });
  }

  /* ---------- ขอบล่างจอ (กันแถบปุ่ม/แถบท่าทางของ Android บังปุ่มล่างสุด) ----------
   * Chrome Android (135+) วาดหน้าเว็บลอดใต้แถบท่าทางด้านล่าง และบอกความสูงแถบผ่าน env(safe-area-inset-bottom)
   * แต่ตอนเปิดเป็นแอปที่ติดตั้งแล้ว (standalone) บางเครื่องได้ค่า 0 ทั้งที่หน้ายังลอดใต้แถบ → ปุ่มล่างสุดโดนบัง
   * ทางแก้: CSS ใช้ --fg-safe-bottom = ค่าที่มากกว่าระหว่าง env(...) กับ --fg-pad-bottom (ตั้งจากตรงนี้)
   * ค่าที่ผู้ใช้เลือก (หน้าแรก → "ขอบล่างจอ"): 'auto' (ค่าเริ่มต้น) · 0 · 24 · 48 · 72 (px)
   */
  var GAP_KEY = 'bottomgap';
  var GAP_AUTO_PX = 48;

  function envBottom() {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-bottom:env(safe-area-inset-bottom,0px)';
      document.body.appendChild(d);
      var v = parseFloat(getComputedStyle(d).paddingBottom) || 0;
      d.parentNode.removeChild(d);
      return v;
    } catch (e) {
      return 0;
    }
  }

  function isStandalone() {
    try {
      return (
        ['standalone', 'fullscreen', 'minimal-ui'].some(function (m) {
          return window.matchMedia('(display-mode: ' + m + ')').matches;
        }) || navigator.standalone === true
      );
    } catch (e) {
      return false;
    }
  }

  // เดาเองเมื่อผู้ใช้ไม่ได้เลือก: เฉพาะแอปที่ติดตั้งบน Android ที่ Chrome ไม่บอกความสูงแถบ (env = 0)
  // และหน้าจอสูงเกือบเท่าจอจริง (ถูกหักแค่แถบสถานะด้านบน = หน้าลอดใต้แถบล่าง) → เว้น 48px
  function autoGap() {
    if (!/Android/i.test(navigator.userAgent || '') || !isStandalone()) return 0;
    if (envBottom() > 0) return 0;
    var gap = (window.screen && screen.height ? screen.height : 0) - window.innerHeight;
    return gap >= 72 ? 0 : GAP_AUTO_PX;
  }

  function getGap() {
    var v = store.get(GAP_KEY, 'auto');
    return v === 'auto' || [0, 24, 48, 72].indexOf(v) === -1 ? 'auto' : v;
  }

  function applyGap() {
    var v = getGap();
    var px = v === 'auto' ? autoGap() : v;
    document.documentElement.style.setProperty('--fg-pad-bottom', px + 'px');
    return px;
  }

  function setGap(v) {
    store.set(GAP_KEY, v);
    return applyGap();
  }

  // ชุดตัวเลือก "ขอบล่างจอ" — ใช้ทั้งหน้าแรกและหน้าต่าง ⚙️ ของทุกเกม (ค่าเดียวกัน key เดียวกัน)
  // แตะแล้วมีผลทันที ไม่ต้องรอกดบันทึก
  var GAP_CHOICES = [
    { value: 'auto', label: 'อัตโนมัติ' },
    { value: 0, label: 'ไม่เว้น' },
    { value: 24, label: 'น้อย' },
    { value: 48, label: 'กลาง' },
    { value: 72, label: 'มาก' }
  ];

  function gapGroup(title) {
    var note = document.createElement('p');
    note.className = 'set-hint';
    function paint(px) {
      note.textContent =
        'ปุ่มแถวล่างสุดโดนแถบของมือถือบัง → เลือก กลาง หรือ มาก · ตอนนี้เว้น ' +
        Math.round(Math.max(px, envBottom())) +
        ' px' +
        (isStandalone() ? ' (เปิดแบบแอป)' : ' (เปิดในเบราว์เซอร์)');
    }
    var d = group(
      title == null ? 'ขอบล่างจอ (ใช้กับทุกเกม)' : title,
      choice(GAP_CHOICES, getGap(), function (v) {
        paint(setGap(v));
      })
    );
    d.classList.add('set-group--gap');
    d.appendChild(note);
    paint(applyGap());
    return d;
  }

  /* ---------- ⚙️ ตั้งค่าของเกม (ปุ่มรูปเฟืองบนแถบหัวของทุกเกม · v8) ----------
   * ในหน้าเกม: <button type="button" class="icon-btn" id="settings" data-settings data-icon="gear" aria-label="ตั้งค่า"></button>
   * ปุ่มเรียก FG.openSettings() — ค่าเริ่มต้น = หน้าต่างที่มีแค่ "ขอบล่างจอ"
   * เกมที่มีตัวเลือกของตัวเอง ให้แทนที่: FG.openSettings = function () { FG.settings({ ... }); };
   *
   * FG.settings(o):
   *   o.build(body)   ใส่ตัวเลือกของเกม (FG.group + FG.choice) · จำค่าที่แตะไว้ในตัวแปรของเกมก่อน ยังไม่บันทึก
   *   o.needsNew()    true = ค่าที่เลือกเปลี่ยนไป และต้องเริ่มเกมใหม่จึงมีผล (เรียกก่อน save)
   *   o.save()        บันทึกค่าที่เลือก (ตอนกด "บันทึก") · ค่าที่มีผลทันทีได้ ให้ใช้เลยในนี้
   *   o.inProgress()  true = มีเกมเล่นค้าง → ถาม "เริ่มเกมใหม่เลยไหม" (เริ่มใหม่เลย / ใช้ตาหน้า)
   *   o.restart()     เริ่มเกมใหม่ด้วยค่าที่บันทึกแล้ว
   *   o.later()       (ไม่บังคับ) เรียกเมื่อเลือก "ใช้ตาหน้า"
   *   o.actions       ปุ่มเพิ่ม วางก่อนปุ่มบันทึก (เช่น ล้างสกอร์)
   * ปิดหน้าต่างโดยไม่กดบันทึก = ไม่เปลี่ยนค่าของเกม (ขอบล่างจอมีผลทันทีที่แตะอยู่แล้ว)
   */
  function settings(o) {
    o = o || {};
    var body = document.createElement('div');
    body.className = 'settings';
    if (o.build) o.build(body);
    body.appendChild(gapGroup());
    var acts = (o.actions || []).slice();
    acts.push({
      label: o.save ? 'บันทึก' : 'เสร็จ',
      primary: true,
      onClick: function () {
        var need = !!(o.needsNew && o.needsNew());
        if (o.save) o.save();
        if (!need) return;
        if (o.inProgress && o.inProgress()) askNewNow(o);
        else if (o.restart) o.restart();
      }
    });
    return sheet({ title: o.title || 'ตั้งค่า', text: o.text, body: body, actions: acts });
  }

  // บันทึกแล้ว แต่มีเกมค้าง → ถามว่าจะเริ่มใหม่เลย หรือใช้ตั้งแต่เกม/ตาหน้า (ปิดหน้าต่าง = ใช้ตาหน้า)
  function askNewNow(o) {
    var done = false;
    function later() {
      if (done) return;
      done = true;
      toast('บันทึกแล้ว · มีผลตั้งแต่ตาหน้า', 2200);
      if (o.later) o.later();
    }
    sheet({
      title: 'เริ่มเกมใหม่เลยไหม',
      text: o.askText || 'ค่าที่เปลี่ยนจะมีผลเมื่อเริ่มเกมใหม่ · ถ้าเริ่มตอนนี้ เกมที่เล่นค้างอยู่จะหายไป',
      actions: [
        { label: 'ใช้ตาหน้า', onClick: later },
        {
          label: 'เริ่มใหม่เลย',
          primary: true,
          onClick: function () {
            done = true;
            if (o.restart) o.restart();
          }
        }
      ],
      onDismiss: later
    });
  }

  // ปุ่ม ↻ เริ่มเกมใหม่: เล่นค้างอยู่ → ถามก่อน · ไม่ค้าง → เริ่มเลย
  // o = { inProgress(), restart(), title?, text?, go? }
  function confirmNew(o) {
    if (!o.inProgress || !o.inProgress()) {
      o.restart();
      return;
    }
    sheet({
      title: o.title || 'เริ่มเกมใหม่?',
      text: o.text || 'เกมที่เล่นอยู่จะหายไป',
      actions: [{ label: 'ยกเลิก' }, { label: o.go || 'เริ่มใหม่', primary: true, onClick: o.restart }]
    });
  }

  function wireSettings(root) {
    (root || document).querySelectorAll('[data-settings]').forEach(function (el) {
      el.addEventListener('click', function () {
        if (openSheet) return;
        window.FG.openSettings();
      });
    });
  }

  /* ---------- boot ---------- */
  applyGap();
  var gapTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(gapTimer);
    gapTimer = setTimeout(applyGap, 150);
  });
  applyTheme(getTheme());
  fillIcons(document);
  wireHowto(document);
  wireSettings(document);
  document.addEventListener('gesturestart', function (e) {
    e.preventDefault();
  });
  registerSW();

  window.FG = {
    ROOT: ROOT,
    store: store,
    icon: icon,
    fillIcons: fillIcons,
    getTheme: getTheme,
    setTheme: setTheme,
    toast: toast,
    sheet: sheet,
    closeSheet: closeSheet,
    choice: choice,
    label: label,
    group: group,
    gapGroup: gapGroup,
    settings: settings,
    confirmNew: confirmNew,
    // ปุ่ม ⚙️ เรียกตัวนี้ — เกมที่มีตัวเลือกของตัวเองแทนที่ได้
    openSettings: function () {
      return settings();
    },
    swipe: swipe,
    fmtTime: fmtTime,
    fmtNum: fmtNum,
    hubNote: hubNote,
    onVisibility: onVisibility,
    buzz: buzz,
    offlineStatus: offlineStatus,
    howto: howto,
    howtoExtra: null,
    getGap: getGap,
    setGap: setGap,
    envBottom: envBottom,
    isStandalone: isStandalone,
    isSheetOpen: function () {
      return !!openSheet;
    }
  };
})();
