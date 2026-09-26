/*
 * รายการเกม + รายการไฟล์ที่ต้องเก็บไว้เล่นออฟไลน์
 * ไฟล์นี้ถูกใช้ 2 ที่: หน้าแรก (index.html) และ service worker (sw.js ผ่าน importScripts)
 *
 * เพิ่มเกมใหม่ = 1) สร้างโฟลเดอร์ games/<id>/ (index.html + style.css + game.js)
 *               2) เพิ่ม 1 แถวใน GAMES ด้านล่าง (ไฟล์ของเกมจะถูกใส่ในรายการเก็บออฟไลน์ให้อัตโนมัติ)
 *               3) เพิ่มเลข CACHE_VERSION ใน sw.js
 */
(function (g) {
  var SHARED_FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'shared/tokens.css',
    'shared/base.css',
    'shared/app.js',
    'shared/games.js',
    'shared/hub.css',
    'shared/hub.js',
    'shared/duo.css',
    'shared/duo.js',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/icon-maskable-512.png'
  ];

  // players: 1 = เล่นคนเดียว · 2 = เล่น 2 คน (ขึ้นในหัวข้อ "เล่น 2 คน" ที่หน้าแรกเอง)
  // files: ไฟล์เพิ่มเติมของเกม (ค่าเริ่มต้น index.html + style.css + game.js)
  var GAMES = [
    { id: '2048', title: '2048', blurb: 'เลื่อนรวมเลขที่เหมือนกัน ไปให้ถึง 2048', players: 1 },
    { id: 'sudoku', title: 'ซูโดกุ', blurb: 'เติมเลข 1–9 ไม่ให้ซ้ำ มี 3 ระดับ', players: 1 },
    { id: 'minesweeper', title: 'หาระเบิด', blurb: 'เปิดช่องให้หมดโดยไม่โดนระเบิด', players: 1 },
    { id: 'solitaire', title: 'โซลิแทร์', blurb: 'เรียงไพ่ขึ้นกองตามดอก จาก A ถึง K', players: 1 },
    { id: 'snake', title: 'งู', blurb: 'กินอาหารให้งูยาวที่สุด อย่าชนกำแพง', players: 1 },
    { id: 'ox', title: 'โอเอ็กซ์', blurb: 'เรียง X หรือ O ให้ครบ 3 ช่องก่อน', players: 2 },
    { id: 'connect4', title: 'หยอดเหรียญเรียง 4', blurb: 'หยอดเหรียญให้เรียงครบ 4 ก่อนอีกฝ่าย', players: 2 },
    { id: 'dots', title: 'ลากเส้นปิดกล่อง', blurb: 'ผลัดกันลากเส้น ปิดกล่องได้มากสุดชนะ', players: 2 },
    {
      id: 'makhos',
      title: 'หมากฮอสไทย',
      blurb: 'กติกาไทย บังคับกิน ฮอสลงติดตัวที่กิน',
      players: 2,
      files: ['index.html', 'style.css', 'engine.js', 'game.js']
    }
  ];

  var DEFAULT_GAME_FILES = ['index.html', 'style.css', 'game.js'];

  var all = SHARED_FILES.slice();
  GAMES.forEach(function (game) {
    game.path = 'games/' + game.id + '/';
    var files = game.files || DEFAULT_GAME_FILES;
    all.push(game.path);
    files.forEach(function (f) {
      all.push(game.path + f);
    });
  });

  g.FG_GAMES = GAMES;
  g.FG_ALL_FILES = all;
})(self);
