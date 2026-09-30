/*
 * เทสปุ่ม "ส่งลิงก์ให้เพื่อน" หน้าแรก — รันด้วย:  node tests/hub-share.test.js
 * เช็คว่า: ปุ่มอยู่ล่างสุดของหน้าแรก · ใช้ลิงก์ตายตัว · ไฟล์อยู่ในรายการเก็บออฟไลน์
 * และลำดับสำรอง share → คัดลอก → ช่องลิงก์ ทำงานถูก ไม่ throw แม้ไม่มีอะไรให้ใช้เลย (ออฟไลน์)
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.self = global;
require('../shared/games.js');
require('../shared/share.js');
var ROOT = path.join(__dirname, '..');
var CANON = 'https://mcherish-tcm.github.io/offline-flight-games/';

var passed = 0;
var failed = 0;
var pending = [];

function test(name, fn) {
  pending.push({ name: name, fn: fn });
}

function run() {
  var i = 0;
  (function next() {
    if (i >= pending.length) {
      console.log('\n' + passed + ' passed, ' + failed + ' failed');
      process.exit(failed ? 1 : 0);
      return;
    }
    var t = pending[i++];
    Promise.resolve()
      .then(t.fn)
      .then(
        function () {
          passed++;
          console.log('  ok  ' + t.name);
        },
        function (e) {
          failed++;
          console.log('  FAIL ' + t.name + '\n       ' + (e && e.message));
        }
      )
      .then(next);
  })();
}

console.log('หน้าแรก — ปุ่มส่งลิงก์ให้เพื่อน');

var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
var hubJs = fs.readFileSync(path.join(ROOT, 'shared/hub.js'), 'utf8');

test('มีปุ่ม #share-btn ข้อความ "ส่งลิงก์ให้เพื่อน" อยู่ล่างสุดของหน้า (หลัง footer) · ไม่ได้ซ่อนไว้', function () {
  var m = html.match(/<button[^>]*id="share-btn"[^>]*>([^<]*)<\/button>/);
  assert.ok(m, 'ไม่มีปุ่ม share-btn');
  assert.ok(m[1].indexOf('ส่งลิงก์ให้เพื่อน') !== -1, 'ข้อความปุ่ม: ' + m[1]);
  assert.ok(m[0].indexOf('hidden') === -1, 'ปุ่มต้องแสดงเสมอ');
  var btnAt = html.indexOf('id="share-btn"');
  assert.ok(btnAt > html.indexOf('</footer>'), 'ปุ่มต้องอยู่ใต้ footer');
  assert.ok(btnAt > html.indexOf('id="game-list"'), 'ปุ่มต้องอยู่ใต้รายการเกม');
  assert.ok(html.indexOf('<button', btnAt + 1) === -1, 'ต้องไม่มีปุ่มอื่นอยู่ใต้ปุ่มนี้');
});

test('ใช้ลิงก์ตายตัวของเว็บ (ไม่ใช้ location.href) · หน้าแรกโหลด shared/share.js ก่อน hub.js', function () {
  assert.strictEqual(self.FG_SHARE_URL, CANON);
  assert.ok(html.indexOf('shared/share.js') !== -1 && html.indexOf('shared/share.js') < html.indexOf('shared/hub.js'));
  var code = function (src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // ตัดคอมเมนต์ออกก่อนเช็ค
  };
  var shareSrc = code(fs.readFileSync(path.join(ROOT, 'shared/share.js'), 'utf8'));
  assert.ok(shareSrc.indexOf(CANON) !== -1, 'ลิงก์ต้องเขียนตายตัวในไฟล์');
  assert.ok(shareSrc.indexOf('location') === -1 && code(hubJs).indexOf('location.href') === -1, 'ห้ามใช้ location.href');
  assert.ok(hubJs.indexOf('share-btn') !== -1, 'hub.js ต้องผูกปุ่ม');
});

test('shared/share.js อยู่ในรายการเก็บออฟไลน์ (FG_ALL_FILES) และมีไฟล์จริง', function () {
  assert.ok(self.FG_ALL_FILES.indexOf('shared/share.js') !== -1);
  assert.ok(fs.existsSync(path.join(ROOT, 'shared/share.js')));
});

test('มี navigator.share = เปิดหน้าต่างแชร์ด้วยลิงก์ตายตัว → "shared"', function () {
  var got = null;
  return self.FG_shareLink({ share: function (d) { got = d; return Promise.resolve(); } }).then(function (r) {
    assert.strictEqual(r, 'shared');
    assert.strictEqual(got.url, CANON);
  });
});

test('ผู้ใช้กดปิดหน้าต่างแชร์ (AbortError) → "cancelled" ไม่คัดลอกซ้ำ', function () {
  var copied = false;
  var nav = {
    share: function () {
      var e = new Error('x');
      e.name = 'AbortError';
      return Promise.reject(e);
    },
    clipboard: { writeText: function () { copied = true; return Promise.resolve(); } }
  };
  return self.FG_shareLink(nav).then(function (r) {
    assert.strictEqual(r, 'cancelled');
    assert.strictEqual(copied, false);
  });
});

test('แชร์พัง (reject/throw) → คัดลอกลงคลิปบอร์ดแทน → "copied"', function () {
  var text = null;
  var clip = { writeText: function (t) { text = t; return Promise.resolve(); } };
  return self.FG_shareLink({ share: function () { return Promise.reject(new Error('NotAllowed')); }, clipboard: clip })
    .then(function (r) {
      assert.strictEqual(r, 'copied');
      assert.strictEqual(text, CANON);
      return self.FG_shareLink({ share: function () { throw new Error('sync'); }, clipboard: clip });
    })
    .then(function (r) {
      assert.strictEqual(r, 'copied');
    });
});

test('ไม่มีแชร์ แต่มีคลิปบอร์ด → "copied" · คลิปบอร์ดปฏิเสธ → "box"', function () {
  return self.FG_shareLink({ clipboard: { writeText: function () { return Promise.resolve(); } } })
    .then(function (r) {
      assert.strictEqual(r, 'copied');
      return self.FG_shareLink({ clipboard: { writeText: function () { return Promise.reject(new Error('denied')); } } });
    })
    .then(function (r) {
      assert.strictEqual(r, 'box');
      return self.FG_shareLink({ clipboard: { writeText: function () { throw new Error('sync'); } } });
    })
    .then(function (r) {
      assert.strictEqual(r, 'box');
    });
});

test('ไม่มีอะไรเลย (เบราว์เซอร์เก่า/ออฟไลน์) → "box" ไม่ throw', function () {
  return Promise.all([self.FG_shareLink({}), self.FG_shareLink(null)]).then(function (rs) {
    assert.deepStrictEqual(rs, ['box', 'box']);
  });
});

run();
