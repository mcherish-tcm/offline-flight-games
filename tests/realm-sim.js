/*
 * จำลองเกม "ชิงเมืองแดนมนตร์" แบบคอมล้วน เพื่อเช็คสมดุล — รันด้วย:  node tests/realm-sim.js [จำนวนเกม]
 * (ไม่ใช่ไฟล์ *.test.js จึงไม่ถูกรันใน run-all.js · ไม่ได้อยู่ในรายการเก็บออฟไลน์)
 *
 * รายงานต่อความยาว (สั้น/กลาง/ยาว) × จำนวนผู้เล่น (2/3):
 *   ตาเฉลี่ย · อัตราชนะแต่ละที่นั่ง (ได้เปรียบคนเดินก่อนไหม) · % เมืองที่ถูกยึด · % เกมที่มีคนหมดตัว
 *   ช่องว่างคะแนนที่ 1 กับที่ 2 · และแข่ง "นิสัยคอม" ต่างแบบกัน ดูว่ามีแนวไหนชนะขาดไหม
 */
'use strict';

var R = require('../games/realm/engine.js');
var N = Number(process.argv[2]) || 400;

function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

function run(length, seats, styles, games, seed0) {
  var wins = new Array(seats).fill(0);
  var ties = 0;
  var steps = 0;
  var captured = 0;
  var brokeGames = 0;
  var gap = 0;
  var close = 0;
  var totals = 0;
  var levels = 0;
  var towns = 0;
  var byStyle = {};
  for (var g = 0; g < games; g++) {
    // หมุนนิสัยตามที่นั่ง เพื่อแยก "ที่นั่ง" ออกจาก "นิสัย"
    var defs = [];
    for (var i = 0; i < seats; i++) {
      var st = styles[(i + g) % styles.length];
      defs.push({ name: 'P' + i, cpu: true, style: st });
    }
    var s = R.newGame({ players: defs, length: length, seed: seed0 + g * 7919 });
    steps += R.autoplay(s);
    var r = s.result;
    if (r.winner < 0) ties++;
    else {
      wins[r.winner]++;
      var ws = s.players[r.winner].style;
      byStyle[ws] = (byStyle[ws] || 0) + 1;
    }
    var owned = s.towns.filter(function (t) {
      return t.owner >= 0;
    }).length;
    captured += owned / s.towns.length;
    towns += owned;
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
    });
  }
  return {
    wins: wins,
    ties: ties,
    turns: (R.LENGTHS[length] * seats).toFixed(0),
    actions: (steps / games).toFixed(0),
    captured: captured / games,
    towns: towns / games,
    broke: brokeGames / games,
    gap: gap / games,
    close: close / games,
    avgTotal: totals / games / seats,
    avgLv: levels / games / seats,
    byStyle: byStyle,
    games: games
  };
}

console.log('ชิงเมืองแดนมนตร์ — จำลองคอมล้วน ' + N + ' เกมต่อชุด\n');

['short', 'mid', 'long'].forEach(function (len) {
  [2, 3].forEach(function (seats) {
    var r = run(len, seats, ['normal'], N, 1000 + seats * 100000 + len.length);
    console.log(
      len.padEnd(5) +
        ' ' +
        seats +
        ' คน · ' +
        R.LENGTHS[len] +
        ' รอบ (' +
        r.turns +
        ' ตา, ~' +
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
        pct(r.captured) +
        ' (' +
        r.towns.toFixed(1) +
        '/7) · มีคนหมดตัว ' +
        pct(r.broke) +
        ' · ห่างที่1-2 ' +
        pct(r.gap) +
        ' · สูสี(<15%) ' +
        pct(r.close) +
        ' · ทรัพย์เฉลี่ย ' +
        r.avgTotal.toFixed(0) +
        ' · Lv เฉลี่ย ' +
        r.avgLv.toFixed(1)
    );
  });
});

console.log('\nแข่งนิสัยคอม (3 คน สลับที่นั่งวนกัน) — อัตราชนะของแต่ละนิสัย:');
var matchups = [
  ['normal', 'bold', 'meek'],
  ['normal', 'hoard', 'tycoon'],
  ['normal', 'brute', 'bold'],
  ['normal', 'always', 'meek']
];
['short', 'mid', 'long'].forEach(function (len) {
  matchups.forEach(function (styles) {
    var r = run(len, 3, styles, N, 777 + len.length * 13);
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
