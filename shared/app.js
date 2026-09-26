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
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.01" stroke-width="2.6"/>'
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

  /* ---------- boot ---------- */
  applyTheme(getTheme());
  fillIcons(document);
  wireHowto(document);
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
    swipe: swipe,
    fmtTime: fmtTime,
    fmtNum: fmtNum,
    hubNote: hubNote,
    onVisibility: onVisibility,
    buzz: buzz,
    offlineStatus: offlineStatus,
    howto: howto,
    howtoExtra: null,
    isSheetOpen: function () {
      return !!openSheet;
    }
  };
})();
