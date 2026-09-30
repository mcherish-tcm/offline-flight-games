/*
 * จำลองเกม "ชิงเมืองแดนมนตร์" แบบคอมล้วน เพื่อเช็คสมดุล — รันด้วย:
 *   node tests/realm-sim.js [จำนวนเกม=400] [แผนที่=all|classic|isle] [--no-styles]
 *   ตัวอย่าง: node tests/realm-sim.js 3000 all --no-styles   (เช็คที่นั่ง 3,000 เกมต่อชุด ทั้ง 2 แผนที่)
 * (ไม่ใช่ไฟล์ *.test.js จึงไม่ถูกรันใน run-all.js · ไม่ได้อยู่ในรายการเก็บออฟไลน์)
 *
 * รายงานต่อ แผนที่ × ความยาว (สั้น/กลาง/ยาว) × จำนวนผู้เล่น (2/3):
 *   อัตราชนะแต่ละที่นั่ง (ได้เปรียบคนเดินก่อนไหม) · เมืองที่ถูกยึดเฉลี่ย · % เกมที่มีคนหมดตัว
 *   ช่องว่างคะแนนที่ 1 กับที่ 2 · อุปกรณ์เฉลี่ย (+ คะแนนที่ได้จากอุปกรณ์ครึ่งราคา) · แล้วแข่ง "นิสัยคอม" ต่างแบบกัน ดูว่ามีแนวไหนชนะขาดไหม
 *   (รวมแนว ทุ่มซื้ออุปกรณ์ / ไม่ซื้ออุปกรณ์ และบังคับเครื่องรางแต่ละชิ้น)
 */
'use strict';

var R = require('../games/realm/engine.js');
var args = process.argv.slice(2);
var N = Number(args[0]) || 400;
var MAPARG = args[1] && args[1].indexOf('--') !== 0 ? args[1] : 'all';
var STYLES = args.indexOf('--no-styles') === -1;
var MAPS = MAPARG === 'all' ? R.MAP_IDS : [MAPARG];

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

function run(map, length, seats, styles, games, seed0) {
  var wins = new Array(seats).fill(0);
  var ties = 0;
  var steps = 0;
  var brokeGames = 0;
  var gap = 0;
  var close = 0;
  var totals = 0;
  var levels = 0;
  var towns = 0;
  var gear = 0;
  var gearScore = 0;
  var charms = 0;
  var byStyle = {};
  var nTowns = 0;
  var lvlSum = 0;
  var lvlN = 0;
  var upTry = 0;
  var upWin = 0;
  for (var g = 0; g < games; g++) {
    // หมุนนิสัยตามที่นั่ง เพื่อแยก "ที่นั่ง" ออกจาก "นิสัย"
    var defs = [];
    for (var i = 0; i < seats; i++) {
      var st = styles[(i + g) % styles.length];
      defs.push({ name: 'P' + i, cpu: true, style: st });
    }
    var s = R.newGame({ players: defs, length: length, map: map, seed: seed0 + g * 7919 });
    nTowns = s.towns.length;
    steps += R.autoplay(s);
    var r = s.result;
    if (r.winner < 0) ties++;
    else {
      wins[r.winner]++;
      var ws = s.players[r.winner].style;
      byStyle[ws] = (byStyle[ws] || 0) + 1;
    }
    s.towns.forEach(function (t) {
      if (t.owner < 0) return;
      towns++;
      lvlSum += t.level;
      lvlN++;
    });
    if (
      s.players.some(function (p) {
        return p.st.broke > 0;
      })
    )
      brokeGames++;
    var gg = (r.rank[0].total - r.rank[1].total) / Math.max(1, r.rank[0].total);
    gap += gg;
    if (gg < 0.15) close++;
    r.rank.forEach(function (x) {
      totals += x.total;
    });
    s.players.forEach(function (p) {
      levels += p.lv;
      gear += p.w + 1 + p.ar + 1;
      gearScore += R.gearValue(p);
      if (p.ch >= 0) charms++;
      upTry += p.st.upTry || 0;
      upWin += p.st.upWin || 0;
    });
  }
  return {
    wins: wins,
    ties: ties,
    actions: (steps / games).toFixed(0),
    towns: towns / games,
    nTowns: nTowns,
    broke: brokeGames / games,
    gap: gap / games,
    close: close / games,
    avgTotal: totals / games / seats,
    avgLv: levels / games / seats,
    gear: gear / games / seats,
    gearScore: gearScore / games / seats,
    charms: charms / games / seats,
    townLv: lvlN ? lvlSum / lvlN : 0,
    upTry: upTry / games,
    upWin: upWin / games,
    byStyle: byStyle,
    games: games
  };
}

console.log('ชิงเมืองแดนมนตร์ — จำลองคอมล้วน ' + N + ' เกมต่อชุด · แผนที่ ' + MAPS.join(', ') + '\n');

MAPS.forEach(function (map, mi) {
  console.log('== ' + R.MAPS[map].name + ' (' + map + ') ==');
  ['short', 'mid', 'long'].forEach(function (len) {
    [2, 3].forEach(function (seats) {
      var r = run(map, len, seats, ['normal'], N, 1000 + seats * 100000 + len.length + mi * 50000000);
      console.log(
        len.padEnd(5) +
          ' ' +
          seats +
          ' คน · ' +
          R.LENGTHS[len] +
          ' รอบ (~' +
          r.actions +
          ' การกระทำ) · ชนะตามที่นั่ง ' +
          r.wins
            .map(function (w) {
              return pct(w / r.games);
            })
            .join(' / ') +
          ' · เสมอ ' +
          r.ties +
          ' · ยึดเมือง ' +
          r.towns.toFixed(1) +
          '/' +
          r.nTowns +
          ' · มีคนหมดตัว ' +
          pct(r.broke) +
          ' · ห่างที่1-2 ' +
          pct(r.gap) +
          ' · สูสี(<15%) ' +
          pct(r.close) +
          ' · ทรัพย์เฉลี่ย ' +
          r.avgTotal.toFixed(0) +
          ' · Lv ' +
          r.avgLv.toFixed(1) +
          ' · อุปกรณ์ ' +
          r.gear.toFixed(1) +
          ' ขั้น (นับเป็นคะแนน ' +
          r.gearScore.toFixed(0) +
          ') · มีเครื่องราง ' +
          pct(r.charms) +
          ' · ระดับเมืองเฉลี่ย ' +
          r.townLv.toFixed(2) +
          ' · ขยายเมือง ' +
          r.upWin.toFixed(1) +
          '/' +
          r.upTry.toFixed(1) +
          ' ครั้ง/เกม (สำเร็จ/ลอง)'
      );
    });
  });
  console.log('');
});

if (STYLES) {
  var matchups = [
    ['normal', 'bold', 'meek'],
    ['normal', 'hoard', 'tycoon'],
    ['normal', 'brute', 'bold'],
    ['normal', 'always', 'meek'],
    ['normal', 'geared', 'nogear'],
    ['c-purse', 'c-feather', 'c-tome'],
    ['c-seal', 'c-purse', 'c-feather'],
    ['c-tome', 'c-seal', 'normal']
  ];
  MAPS.forEach(function (map) {
    console.log('แข่งนิสัยคอม · ' + R.MAPS[map].name + ' (3 คน สลับที่นั่งวนกัน) — อัตราชนะของแต่ละนิสัย:');
    ['short', 'mid', 'long'].forEach(function (len) {
      matchups.forEach(function (styles) {
        var r = run(map, len, 3, styles, N, 777 + len.length * 13);
        console.log(
          '  ' +
            len.padEnd(5) +
            ' ' +
            styles
              .map(function (st) {
                return st + ' ' + pct((r.byStyle[st] || 0) / r.games);
              })
              .join(' · ')
        );
      });
    });
    console.log('');
  });
}
