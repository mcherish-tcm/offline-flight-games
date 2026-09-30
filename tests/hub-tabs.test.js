/*
 * เทสแท็บหน้าแรก (เล่นคนเดียว / เล่น 2 คน) — รันด้วย:  node tests/hub-tabs.test.js
 * เช็คว่า: ทุกเกมอยู่อย่างน้อย 1 แท็บ · แต่ละแท็บเรียงตามชื่อไทย (localeCompare 'th') · ทุกเกมมีไฟล์ครบจริง
 */
'use strict';

var assert = require('assert');
var fs = require('fs');
var path = require('path');

global.self = global;
require('../shared/games.js');
var GAMES = self.FG_GAMES;
var TABS = self.FG_TABS;
var gamesFor = self.FG_GAMES_FOR;
var ROOT = path.join(__dirname, '..');

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

console.log('หน้าแรก — แท็บเกม');

test('มีแท็บ solo + duo', function () {
  assert.deepStrictEqual(
    TABS.map(function (t) {
      return t.id;
    }),
    ['solo', 'duo']
  );
});

test('ทุกเกมมี modes ที่ถูกต้อง และอยู่อย่างน้อย 1 แท็บ', function () {
  GAMES.forEach(function (g) {
    assert.ok(Array.isArray(g.modes) && g.modes.length, g.id + ' ไม่มี modes');
    g.modes.forEach(function (m) {
      assert.ok(m === 'solo' || m === 'duo', g.id + ' mode แปลก: ' + m);
    });
    var inTabs = TABS.filter(function (t) {
      return gamesFor(t.id).indexOf(g) !== -1;
    });
    assert.ok(inTabs.length >= 1, g.id + ' ไม่อยู่ในแท็บไหนเลย');
  });
});

test('แต่ละแท็บเรียงตามชื่อไทย (localeCompare th) และไม่มีเกมซ้ำ', function () {
  TABS.forEach(function (t) {
    var list = gamesFor(t.id);
    assert.ok(list.length > 0, 'แท็บ ' + t.id + ' ว่าง');
    for (var i = 1; i < list.length; i++) {
      assert.ok(list[i - 1].title.localeCompare(list[i].title, 'th') <= 0, t.id + ': ' + list[i - 1].title + ' ควรอยู่หลัง ' + list[i].title);
    }
    var ids = list.map(function (g) {
      return g.id;
    });
    assert.strictEqual(new Set(ids).size, ids.length, 'มีเกมซ้ำในแท็บ ' + t.id);
  });
});

test('เกมที่เล่นได้ทั้งสองแบบขึ้นทั้งสองแท็บ · จำนวนรวมตรงกับรายชื่อ', function () {
  var solo = gamesFor('solo');
  var duo = gamesFor('duo');
  GAMES.forEach(function (g) {
    assert.strictEqual(solo.indexOf(g) !== -1, g.modes.indexOf('solo') !== -1, g.id);
    assert.strictEqual(duo.indexOf(g) !== -1, g.modes.indexOf('duo') !== -1, g.id);
  });
  var union = new Set(solo.concat(duo));
  assert.strictEqual(union.size, GAMES.length);
});

test('ทุกไฟล์ในรายการเก็บออฟไลน์มีอยู่จริง', function () {
  self.FG_ALL_FILES.forEach(function (f) {
    if (f === './' || f.slice(-1) === '/') return;
    assert.ok(fs.existsSync(path.join(ROOT, f)), 'ไม่มีไฟล์ ' + f);
  });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
