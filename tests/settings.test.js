/*
 * เทสปุ่ม ⚙️ ตั้งค่า (v8) — รันด้วย:  node tests/settings.test.js
 * 1) เช็คไฟล์ทุกเกม: มีปุ่มเฟือง (data-settings) บนแถบหัว เรียง ⓘ · (ย้อน) · ⚙️ · ↻ · ไม่มีปุ่มแถบเลื่อนเดิมค้าง
 *    เกมที่มีตัวเลือกของตัวเองตั้ง FG.openSettings · เกม 2 คนเรียก duo.newRound() ตอนเริ่มตาใหม่
 * 2) รัน shared/app.js + shared/duo.js บน DOM ปลอม (ไม่ต้องมีเบราว์เซอร์) แล้วเช็คลำดับ:
 *    บันทึก → (มีเกมค้าง) ถาม "เริ่มใหม่เลย / ใช้ตาหน้า" · ปิดหน้าต่างเฉย ๆ = ไม่บันทึก · ขอบล่างจอใช้ key เดิม
 * 3) สไปเดอร์: เปิดเกมแล้วเล่นต่อ หรือถาม "เล่นกี่ดอก" (Spider.canResume)
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
global.self = global;
require('../shared/games.js');
var GAMES = self.FG_GAMES;
var P = require('../games/spider/engine.js');

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + (e && e.message));
  }
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/* ---------- 1) ไฟล์ของทุกเกม ---------- */
console.log('ปุ่ม ⚙️ ในไฟล์ของทุกเกม');

// ปุ่มบนแถบหัว (ตามลำดับในไฟล์) → ['info','undo','settings','restart', ...]
function headerButtons(html) {
  var m = html.match(/<div class="bar__actions">([\s\S]*?)<\/div>/);
  assert.ok(m, 'ไม่เจอ .bar__actions');
  var out = [];
  var re = /<button\b([^>]*)>/g;
  var b;
  while ((b = re.exec(m[1]))) {
    var attrs = b[1];
    var id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
    var iconName = (attrs.match(/data-icon="([^"]+)"/) || [])[1];
    out.push({ id: id || iconName, icon: iconName, settings: /\bdata-settings\b/.test(attrs) });
  }
  return out;
}

var OWN_SETTINGS = [
  'sudoku', 'minesweeper', 'solitaire', 'spider', 'memory', 'dice', 'atc', 'snake',
  'ox', 'connect4', 'dots', 'makhos', 'makkhum', 'othello', 'gomoku', 'battleship', 'realm'
];
var DUO_ROUND_GAMES = ['ox', 'connect4', 'dots', 'makhos', 'makkhum', 'othello', 'gomoku'];

test('มีครบ 22 เกม', function () {
  assert.strictEqual(GAMES.length, 22);
});

GAMES.forEach(function (g) {
  test(g.id + ': ปุ่มเฟืองบนแถบหัว + ลำดับ ⓘ · (ย้อน) · ⚙️ · ↻', function () {
    var btns = headerButtons(read('games/' + g.id + '/index.html'));
    var gear = btns.filter(function (b) {
      return b.settings;
    });
    assert.strictEqual(gear.length, 1, 'ต้องมีปุ่ม data-settings 1 ปุ่ม');
    assert.strictEqual(gear[0].icon, 'gear', 'ปุ่มตั้งค่าต้องใช้ data-icon="gear"');
    assert.strictEqual(gear[0].id, 'settings', 'ปุ่มตั้งค่าต้องมี id="settings"');
    assert.strictEqual(btns[0].icon, 'info', 'ปุ่มแรกต้องเป็น ⓘ');
    var ids = btns.map(function (b) {
      return b.id;
    });
    var gi = ids.indexOf('settings');
    ['undo', 'pause', 'list'].forEach(function (k) {
      var i = ids.indexOf(k);
      if (i !== -1) assert.ok(i < gi, k + ' ต้องอยู่ก่อน ⚙️');
    });
    ['restart', 'new', 'clear'].forEach(function (k) {
      var i = ids.indexOf(k);
      if (i !== -1) assert.ok(i > gi, k + ' (↻) ต้องอยู่หลัง ⚙️');
    });
    assert.ok(btns.length <= 5, 'ปุ่มบนแถบหัวเกิน 5 ปุ่ม');
    assert.ok(!btns.some(function (b) { return b.icon === 'sliders'; }), 'ยังมีปุ่มแถบเลื่อนเดิม');
  });

  test(g.id + ': game.js ไม่ผูกปุ่มตั้งค่าซ้ำ (ใช้ FG.openSettings)', function () {
    var js = read('games/' + g.id + '/game.js');
    assert.ok(!/getElementById\('settings'\)\.addEventListener/.test(js), 'ยังผูก #settings เอง → หน้าต่างจะเปิดซ้อน 2 อัน');
    if (OWN_SETTINGS.indexOf(g.id) !== -1) assert.ok(/FG\.openSettings\s*=\s*function/.test(js), 'ต้องตั้ง FG.openSettings');
  });
});

DUO_ROUND_GAMES.forEach(function (id) {
  test(id + ': เรียก duo.newRound() ทั้งตอนตาต่อไปและเริ่มตานี้ใหม่', function () {
    var js = read('games/' + id + '/game.js');
    var n = (js.match(/duo\.newRound\(\)/g) || []).length;
    assert.ok(n >= 2, 'เจอ duo.newRound() ' + n + ' ที่');
  });
});

test('app.js มีไอคอนเฟือง + FG.settings / FG.gapGroup / FG.confirmNew', function () {
  var js = read('shared/app.js');
  assert.ok(/\bgear:\s*'/.test(js));
  ['settings: settings', 'gapGroup: gapGroup', 'confirmNew: confirmNew', 'openSettings:'].forEach(function (k) {
    assert.ok(js.indexOf(k) !== -1, 'ไม่เจอ ' + k);
  });
});

test('วิธีเล่น (ⓘ) ไม่พูดถึง "แถบเลื่อน" แล้ว', function () {
  GAMES.forEach(function (g) {
    (g.howto || []).forEach(function (t) {
      assert.ok(t.indexOf('แถบเลื่อน') === -1, g.id + ': ' + t);
    });
  });
});

test('sw.js CACHE_VERSION = v9', function () {
  var m = read('sw.js').match(/CACHE_VERSION = '([^']+)'/);
  assert.ok(m);
  assert.strictEqual(m[1], 'v9');
});

/* ---------- 3) สไปเดอร์: เล่นต่อ หรือถามจำนวนดอก ---------- */
console.log('\nสไปเดอร์ — เปิดเกม');

test('ไม่มีเซฟ / เซฟเสีย / จบตาแล้ว → ถาม "เล่นกี่ดอก"', function () {
  assert.strictEqual(P.canResume(null), false);
  assert.strictEqual(P.canResume({}), false);
  assert.strictEqual(P.canResume({ g: { s: { cols: [], suits: 1 } } }), false);
  var s = P.deal(2, 7);
  assert.strictEqual(P.canResume({ g: { s: s, done: true } }), false);
});

test('มีตาค้าง (ยังไม่จบ) → เล่นต่อ', function () {
  [1, 2, 4].forEach(function (n) {
    var s = P.deal(n, 11);
    assert.strictEqual(P.canResume({ g: { s: s, moves: 0, started: false, done: false }, h: [] }), true);
  });
});

test('ค่าจำนวนดอกแปลก ๆ → 1 ดอก', function () {
  assert.strictEqual(P.cleanSuits(2), 2);
  assert.strictEqual(P.cleanSuits(4), 4);
  assert.strictEqual(P.cleanSuits(3), 1);
  assert.strictEqual(P.cleanSuits('4'), 1);
  assert.strictEqual(P.cleanSuits(null), 1);
});

/* ---------- 2) DOM ปลอม → รัน app.js + duo.js จริง ---------- */
console.log('\nFG.settings + duo (DOM ปลอม)');

function El(tag) {
  this.tagName = String(tag).toUpperCase();
  this.children = [];
  this.parentNode = null;
  this.attrs = {};
  this.listeners = {};
  this.style = { setProperty: function () {}, cssText: '' };
  this._text = '';
  this._html = '';
  this.hidden = false;
  this.className = '';
  this.open = false;
  this.disabled = false;
}
El.prototype = {
  get classList() {
    var el = this;
    function list() {
      return el.className.split(/\s+/).filter(Boolean);
    }
    return {
      add: function (c) {
        if (list().indexOf(c) === -1) el.className = list().concat(c).join(' ');
      },
      remove: function (c) {
        el.className = list()
          .filter(function (x) {
            return x !== c;
          })
          .join(' ');
      },
      toggle: function (c, on) {
        if (on === undefined) on = list().indexOf(c) === -1;
        if (on) this.add(c);
        else this.remove(c);
      },
      contains: function (c) {
        return list().indexOf(c) !== -1;
      }
    };
  },
  get textContent() {
    return (
      this._text +
      this.children
        .map(function (c) {
          return c.textContent;
        })
        .join('')
    );
  },
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  },
  get innerHTML() {
    return this._html;
  },
  set innerHTML(v) {
    this.children = [];
    this._text = '';
    this._html = String(v);
    // แปลง HTML แบบง่าย ๆ (แท็ก + class/attr + ข้อความ) ให้ querySelector หาเจอ
    var stack = [this];
    var re = /<\/?([a-z0-9]+)([^>]*)>|([^<]+)/gi;
    var m;
    while ((m = re.exec(this._html))) {
      var top = stack[stack.length - 1];
      if (m[3]) {
        var t = new El('#text');
        t._text = m[3];
        t.matches = function () {
          return false;
        };
        top.appendChild(t);
      } else if (m[0][1] === '/') {
        if (stack.length > 1) stack.pop();
      } else {
        var el = new El(m[1]);
        var ar = /([\w-]+)="([^"]*)"/g;
        var a;
        while ((a = ar.exec(m[2]))) {
          if (a[1] === 'class') el.className = a[2];
          else el.attrs[a[1]] = a[2];
        }
        top.appendChild(el);
        if (!/^(br|img|input|path|circle|rect)$/i.test(m[1]) && !/\/$/.test(m[2])) stack.push(el);
      }
    }
  },
  get nextSibling() {
    if (!this.parentNode) return null;
    var sib = this.parentNode.children;
    return sib[sib.indexOf(this) + 1] || null;
  },
  appendChild: function (c) {
    if (c.isFragment) {
      var kids = c.children.slice();
      c.children = [];
      kids.forEach(this.appendChild, this);
      return c;
    }
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.children.push(c);
    return c;
  },
  insertBefore: function (c, ref) {
    if (!ref) return this.appendChild(c);
    if (c.parentNode) c.parentNode.removeChild(c);
    c.parentNode = this;
    this.children.splice(this.children.indexOf(ref), 0, c);
    return c;
  },
  removeChild: function (c) {
    var i = this.children.indexOf(c);
    if (i !== -1) this.children.splice(i, 1);
    c.parentNode = null;
    return c;
  },
  setAttribute: function (k, v) {
    this.attrs[k] = String(v);
  },
  getAttribute: function (k) {
    return k in this.attrs ? this.attrs[k] : null;
  },
  removeAttribute: function (k) {
    delete this.attrs[k];
  },
  addEventListener: function (type, fn) {
    (this.listeners[type] = this.listeners[type] || []).push(fn);
  },
  dispatch: function (type, ev) {
    ev = ev || {};
    ev.type = type;
    if (!ev.target) ev.target = this;
    ev.preventDefault = function () {
      ev.defaultPrevented = true;
    };
    (this.listeners[type] || []).slice().forEach(function (fn) {
      fn(ev);
    });
    return ev;
  },
  click: function () {
    this.dispatch('click', { clientX: 0, clientY: 0 });
  },
  focus: function () {},
  insertAdjacentHTML: function () {},
  showModal: function () {
    this.open = true;
  },
  close: function () {
    this.open = false;
    this.dispatch('close');
  },
  getBoundingClientRect: function () {
    return { left: 0, right: 100, top: 0, bottom: 100 };
  },
  matches: function (sel) {
    var m = sel.match(/^([a-z]+)?((?:[.#][\w-]+)*)((?:\[[^\]]+\])*)$/i);
    if (!m) throw new Error('selector ไม่รองรับ: ' + sel);
    if (m[1] && m[1].toUpperCase() !== this.tagName) return false;
    var el = this;
    var ok = (m[2].match(/[.#][\w-]+/g) || []).every(function (p) {
      return p[0] === '.' ? el.classList.contains(p.slice(1)) : el.attrs.id === p.slice(1);
    });
    return (
      ok &&
      (m[3].match(/\[[^\]]+\]/g) || []).every(function (a) {
        var mm = a.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);
        return mm[2] == null ? mm[1] in el.attrs : el.attrs[mm[1]] === mm[2];
      })
    );
  },
  querySelectorAll: function (sel) {
    var out = [];
    (function walk(n) {
      n.children.forEach(function (c) {
        if (c.matches(sel)) out.push(c);
        walk(c);
      });
    })(this);
    return out;
  },
  querySelector: function (sel) {
    return this.querySelectorAll(sel)[0] || null;
  }
};

function fakeBrowser() {
  var store = {};
  var html = new El('html');
  var body = new El('body');
  html.appendChild(body);
  var doc = new El('#document');
  doc.appendChild(html);
  doc.documentElement = html;
  doc.body = body;
  doc.hidden = false;
  doc.currentScript = null;
  doc.createElement = function (t) {
    return new El(t);
  };
  doc.createDocumentFragment = function () {
    var f = new El('#fragment');
    f.isFragment = true;
    return f;
  };
  global.document = doc;
  global.window = global;
  global.localStorage = {
    getItem: function (k) {
      return k in store ? store[k] : null;
    },
    setItem: function (k, v) {
      store[k] = String(v);
    },
    removeItem: function (k) {
      delete store[k];
    }
  };
  Object.defineProperty(global, 'navigator', { value: { userAgent: 'node-test' }, configurable: true, writable: true });
  global.matchMedia = function () {
    return { matches: false };
  };
  global.getComputedStyle = function () {
    return { paddingBottom: '0px', backgroundColor: '', getPropertyValue: function () { return ''; } };
  };
  global.requestAnimationFrame = function () {
    return 0;
  };
  global.CustomEvent = function (type) {
    this.type = type;
  };
  global.screen = { height: 800 };
  global.innerHeight = 800;
  global.addEventListener = function () {};
  return store;
}

var store = fakeBrowser();
require('../shared/app.js');
require('../shared/duo.js');

// ปุ่มในหน้าต่างที่เปิดอยู่ตอนนี้
function openDialog() {
  var d = document.body.querySelectorAll('dialog').filter(function (x) {
    return x.open;
  });
  return d[d.length - 1] || null;
}
function buttons(dlg) {
  return dlg.querySelector('.sheet__actions').querySelectorAll('button');
}
function press(label) {
  var dlg = openDialog();
  assert.ok(dlg, 'ไม่มีหน้าต่างเปิดอยู่ (จะกด "' + label + '")');
  var b = buttons(dlg).filter(function (x) {
    return x.textContent === label;
  })[0];
  assert.ok(b, 'ไม่เจอปุ่ม "' + label + '" · มีแต่ ' + buttons(dlg).map(function (x) { return x.textContent; }).join('/'));
  b.click();
}
function dialogTitle() {
  var dlg = openDialog();
  var m = dlg && dlg.innerHTML.match(/sheet__title">([^<]*)</);
  return m ? m[1] : null;
}

// เกมจำลอง: ค่าที่ตั้งไว้ 1 ค่า (ต้องเริ่มใหม่จึงมีผล)
function fakeGame(opts) {
  var g = { saved: opts.saved, pending: opts.saved, playing: !!opts.playing, restarts: 0, laters: 0 };
  g.open = function () {
    g.pending = g.saved;
    FG.settings({
      build: function (body) {
        body.appendChild(
          FG.group(
            'ค่า',
            FG.choice([{ value: 1, label: 'หนึ่ง' }, { value: 2, label: 'สอง' }], g.pending, function (v) {
              g.pending = v;
            })
          )
        );
      },
      needsNew: function () {
        return g.pending !== g.saved;
      },
      save: function () {
        g.saved = g.pending;
      },
      inProgress: function () {
        return g.playing;
      },
      restart: function () {
        g.restarts++;
        g.playing = false;
      },
      later: function () {
        g.laters++;
      }
    });
  };
  g.pick = function (label) {
    var seg = openDialog().querySelector('.seg');
    seg.querySelectorAll('button').filter(function (b) {
      return b.textContent === label;
    })[0].click();
  };
  return g;
}

test('หน้าต่างตั้งค่ามี "ขอบล่างจอ" ต่อท้ายเสมอ (แม้เกมไม่มีตัวเลือก) + ปุ่ม "เสร็จ"', function () {
  FG.openSettings();
  var dlg = openDialog();
  assert.ok(dlg.querySelector('.set-group--gap'), 'ไม่มีขอบล่างจอ');
  assert.deepStrictEqual(buttons(dlg).map(function (b) { return b.textContent; }), ['เสร็จ']);
  press('เสร็จ');
  assert.strictEqual(openDialog(), null);
});

test('ขอบล่างจอในหน้าต่าง ⚙️ ใช้ key เดิม (ffg:bottomgap) และมีผลทันที', function () {
  FG.openSettings();
  var gap = openDialog().querySelector('.set-group--gap');
  gap.querySelectorAll('button').filter(function (b) {
    return b.textContent === 'มาก';
  })[0].click();
  assert.strictEqual(store['ffg:bottomgap'], '72');
  assert.strictEqual(FG.getGap(), 72);
  FG.closeSheet();
  FG.setGap('auto');
});

test('ไม่ได้เปลี่ยนอะไร → กดบันทึกแล้วไม่ถาม ไม่เริ่มใหม่', function () {
  var g = fakeGame({ saved: 1, playing: true });
  g.open();
  press('บันทึก');
  assert.strictEqual(openDialog(), null);
  assert.strictEqual(g.restarts, 0);
});

test('เปลี่ยนค่า + ไม่มีเกมค้าง → บันทึกแล้วเริ่มใหม่เลย ไม่ถาม', function () {
  var g = fakeGame({ saved: 1, playing: false });
  g.open();
  g.pick('สอง');
  press('บันทึก');
  assert.strictEqual(g.saved, 2);
  assert.strictEqual(g.restarts, 1);
  assert.strictEqual(openDialog(), null);
});

test('เปลี่ยนค่า + มีเกมค้าง → ถาม "เริ่มเกมใหม่เลยไหม" · เริ่มใหม่เลย = เริ่มใหม่', function () {
  var g = fakeGame({ saved: 1, playing: true });
  g.open();
  g.pick('สอง');
  press('บันทึก');
  assert.strictEqual(g.saved, 2, 'ต้องบันทึกก่อนถาม');
  assert.strictEqual(dialogTitle(), 'เริ่มเกมใหม่เลยไหม');
  assert.deepStrictEqual(buttons(openDialog()).map(function (b) { return b.textContent; }), ['ใช้ตาหน้า', 'เริ่มใหม่เลย']);
  press('เริ่มใหม่เลย');
  assert.strictEqual(g.restarts, 1);
  assert.strictEqual(g.laters, 0);
});

test('เปลี่ยนค่า + มีเกมค้าง → ใช้ตาหน้า = บันทึกไว้ ไม่เริ่มใหม่', function () {
  var g = fakeGame({ saved: 1, playing: true });
  g.open();
  g.pick('สอง');
  press('บันทึก');
  press('ใช้ตาหน้า');
  assert.strictEqual(g.saved, 2);
  assert.strictEqual(g.restarts, 0);
  assert.strictEqual(g.laters, 1);
});

test('ปิดหน้าต่างตั้งค่าโดยไม่กดบันทึก = ไม่เปลี่ยน', function () {
  var g = fakeGame({ saved: 1, playing: true });
  g.open();
  g.pick('สอง');
  FG.closeSheet();
  assert.strictEqual(g.saved, 1);
  assert.strictEqual(g.restarts, 0);
});

test('FG.confirmNew: ไม่ค้าง = เริ่มเลย · ค้าง = ถามก่อน', function () {
  var n = 0;
  FG.confirmNew({ inProgress: function () { return false; }, restart: function () { n++; } });
  assert.strictEqual(n, 1);
  FG.confirmNew({ inProgress: function () { return true; }, restart: function () { n++; } });
  assert.strictEqual(n, 1);
  press('เริ่มใหม่');
  assert.strictEqual(n, 2);
});

function makeDuo(id) {
  var stage = new El('main');
  var board = new El('div');
  stage.appendChild(board);
  return FGDuo.create({ id: id, stage: stage, board: board, chip: function () { return ''; }, ai: true });
}

test('duo: เปลี่ยนเป็นเล่นกับคอมกลางตา → ใช้ตาหน้า → เปลี่ยนตอน duo.newRound()', function () {
  var duo = makeDuo('t1');
  var restarted = 0;
  duo.openSettings({
    hasProgress: function () {
      return true;
    },
    onModeChange: function () {
      restarted++;
    }
  });
  openDialog().querySelector('.seg').querySelectorAll('button')[1].click(); // เล่นกับคอม
  press('บันทึก');
  press('ใช้ตาหน้า');
  assert.strictEqual(duo.isAI(), false, 'ตานี้ยังต้องเป็น 2 คน');
  assert.strictEqual(restarted, 0);
  assert.ok(store['ffg:t1:mode:next'], 'ต้องเก็บโหมดตาหน้าไว้');
  assert.strictEqual(duo.newRound(), true);
  assert.strictEqual(duo.isAI(), true);
  assert.strictEqual(store['ffg:t1:mode:next'], undefined, 'ใช้แล้วต้องลบทิ้ง');
  assert.strictEqual(duo.newRound(), false);
});

test('duo: โหมดตาหน้ายังอยู่หลังปิดแอปแล้วเปิดใหม่', function () {
  var duo = makeDuo('t2');
  duo.openSettings({ hasProgress: function () { return true; } });
  openDialog().querySelector('.seg').querySelectorAll('button')[1].click();
  press('บันทึก');
  press('ใช้ตาหน้า');
  var again = makeDuo('t2'); // เปิดหน้าใหม่
  assert.strictEqual(again.isAI(), false);
  assert.strictEqual(again.newRound(), true);
  assert.strictEqual(again.isAI(), true);
});

test('duo: ไม่มีตาค้าง → เปลี่ยนโหมดแล้วเริ่มตาใหม่ทันที', function () {
  var duo = makeDuo('t3');
  var restarted = 0;
  duo.openSettings({
    hasProgress: function () {
      return false;
    },
    onModeChange: function () {
      restarted++;
    }
  });
  openDialog().querySelector('.seg').querySelectorAll('button')[1].click();
  press('บันทึก');
  assert.strictEqual(duo.isAI(), true);
  assert.strictEqual(restarted, 1);
  assert.strictEqual(openDialog(), null);
});

test('duo: ตัวเลือกของเกม (needsNew/save) ถามเริ่มใหม่ได้แม้โหมดไม่เปลี่ยน', function () {
  var duo = makeDuo('t4');
  var size = 4;
  var pend = 5;
  var restarted = 0;
  duo.openSettings({
    hasProgress: function () {
      return true;
    },
    needsNew: function () {
      return pend !== size;
    },
    save: function () {
      size = pend;
    },
    onModeChange: function () {
      restarted++;
    }
  });
  press('บันทึก');
  assert.strictEqual(size, 5);
  assert.strictEqual(dialogTitle(), 'เริ่มเกมใหม่เลยไหม');
  press('เริ่มใหม่เลย');
  assert.strictEqual(restarted, 1);
  assert.strictEqual(duo.isAI(), false);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
