/*
 * รันเทสทุกไฟล์ใน tests/ ทีเดียว:  node tests/run-all.js
 * (node รับได้ทีละไฟล์ — "node tests/*.test.js" จะรันแค่ไฟล์แรก จึงมีไฟล์นี้ไว้)
 */
'use strict';

var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var dir = __dirname;
var files = fs
  .readdirSync(dir)
  .filter(function (f) {
    return /\.test\.js$/.test(f);
  })
  .sort();

var bad = 0;
files.forEach(function (f) {
  console.log('\n=== ' + f + ' ===');
  var r = spawnSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  if (r.status !== 0) bad++;
});

console.log('\n' + (files.length - bad) + '/' + files.length + ' test files passed');
process.exit(bad ? 1 : 0);
