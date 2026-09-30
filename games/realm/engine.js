/*
 * ชิงเมืองแดนมนตร์ — กติกาล้วน + คอม · ใช้ได้ทั้งในเบราว์เซอร์ (window.Realm) และใน node (require)
 *
 * เกมกระดานแนว RPG แฟนตาซี (คิดขึ้นเองทั้งหมด): เดินรอบกระดาน (2 แผนที่: 30 ช่อง / 24 ช่อง) ทอยเต๋า 1–6 เดินหน้า
 * ตีมอนสเตอร์เก็บเงิน/ค่าประสบการณ์ · ปราบผู้เฝ้าเมืองเพื่อยึดเมือง · คนอื่นตกเมืองเรา = เลือก พักค้างคืน (จ่ายค่าผ่านทาง) หรือ ปล้นเมือง (ทอยเต๋าแข่ง · v9)
 * ตกเมืองตัวเอง = ลงทุนขยายเมือง · ศาลาเสี่ยงทาย = เปิดไพ่เหตุการณ์ · ครบจำนวนรอบ = นับ เงิน + มูลค่าเมือง มากสุดชนะ
 *
 * สถานะเกม (s) เป็น object ธรรมดา แปลงเป็น JSON ได้ทั้งก้อน (บันทึกทุกตา) · สุ่มด้วย s.seed ในตัว (เล่นซ้ำได้เหมือนเดิม)
 * แผนที่อยู่ในสถานะ: s.map (รหัสแผนที่) + s.board (ช่องทั้งหมด) + s.towns (เมืองบนแผนที่นี้ · t.i = รหัสเมืองใน TOWNS)
 *   ทุกที่ที่อ้าง "เมืองที่ k" (pending.town, battle.town, action.town) = ลำดับใน s.towns ไม่ใช่ลำดับใน TOWNS
 * ทุกการกระทำผ่าน act(s, action) → คืนรายการเหตุการณ์ (events) ให้หน้าจอเอาไปแสดง
 * ใครต้องตัดสินใจตอนนี้ = decider(s) · คอมเลือกให้ = cpuAct(s)
 * เซฟรุ่นเก่า (s.v = 1 · ยังไม่มีแผนที่ / s.v = 2 · ก่อน v9 / s.v = 3 · ก่อน v10) → migrate(s) แปลงเป็นรุ่นปัจจุบัน
 * v10: โหมดไม่จำกัดรอบ (s.endless · s.rounds = 0) + บอส (s.boss) — ดูหัวข้อ "โหมดไม่จำกัดรอบ + บอส" ในตัวเลขหลัก
 *
 * ช่วง (s.phase):
 *   'roll'   — รอทอยเต๋า (ใช้ยา/รองเท้าก่อนทอยได้)
 *   'decide' — รอเลือก: s.pending.kind = 'duel-offer' | 'town' | 'visit' (เมืองคนอื่น: พัก/ปล้น) | 'invest' | 'shop' | 'boss' (เมืองที่บอสยึด: สู้/ไม่สู้)
 *   'battle' — กำลังสู้มอนสเตอร์/ผู้เฝ้าเมือง (s.battle) เลือกท่าทีละยก
 *   'duel'   — ประลองระหว่างผู้เล่น (s.duel) ต่างคนต่างวางแผน 3 ท่าลับ ๆ
 *   'over'   — จบเกม (s.result)
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Realm = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 4; // รุ่นของสถานะที่บันทึก (1 = ก่อนมีแผนที่/ไพ่/เครื่องราง · 2 = ก่อนมีพัก/ปล้นเมือง + ของช่วยรบ · 3 = ก่อนมีโหมดไม่จำกัดรอบ + บอส)

  /* ---------- ตัวเลขหลัก (ปรับสมดุลตรงนี้ · ผลจำลองอยู่ใน tests/realm-sim.js) ---------- */
  var LENGTHS = { short: 15, mid: 22, long: 30 }; // จำนวนรอบ (ทุกคนเล่นคนละ 1 ตา = 1 รอบ)
  var ENDLESS = 'endless'; // v10: โหมดไม่จำกัดรอบ — จบเมื่อมีคนปราบบอสได้ (s.endless = true · s.rounds = 0)
  var LENGTH_IDS = ['short', 'mid', 'long', ENDLESS]; // ตัวเลือกความยาวตอนเริ่มเกม
  var START_GOLD = 150;
  var SEAT_BONUS = 45; // ที่นั่งหลังได้ทุนเพิ่มที่นั่งละ 45 (ชดเชยเดินทีหลัง · ผลจำลอง 3,000 เกมต่อชุด ทั้ง 2 แผนที่)
  var SALARY = 50; // ผ่านลานประตูเมือง
  var SALARY_PER_TOWN = 10;
  var CATCH_UP = 0.6; // คนที่ทรัพย์รวมน้อยสุดตอนผ่านลานประตูเมือง ได้เงินหลวงเพิ่ม 60% ของเงินหลวงพื้นฐาน
  var BASE = { hp: 30, atk: 8, def: 3 };
  var LEVEL_UP = { hp: 5, atk: 2, def: 1 };
  var MAX_LEVEL = 10;
  var MAX_TOWN_LEVEL = 5;
  var CLAIM_RATE = 0.5; // ค่าฟื้นฟูเมืองหลังชนะผู้เฝ้า = base × 0.5
  var GEAR_RATE = 0.5; // ท้ายเกมนับอาวุธ/เกราะ/เครื่องรางที่ถืออยู่ชิ้นละ 50% ของราคาซื้อเป็นคะแนน (ของใช้ไม่นับ)
  var INVEST_RATE = 0.6; // ขยายเมือง 1 ระดับ = base × 0.6 (มูลค่าเมืองเพิ่มเท่าที่จ่าย)
  var TOLL_RATE = 0.18; // ค่าผ่านทาง = มูลค่า × (0.18 + 0.05 × (ระดับ-1))
  var TOLL_STEP = 0.05;
  var DUEL_TAKE = 0.2; // ชนะประลอง = ได้เงินของผู้แพ้ 20%
  var LOSE_GOLD = 0.15; // แพ้มอนสเตอร์/ผู้เฝ้าเมือง = เสียเงิน 15% (+ พักฟื้น 1 ตา)
  var MAX_EXCHANGES = 10; // สู้ครบ 10 ยกแล้วยังไม่จบ = ต่างฝ่ายต่างถอย
  var MAX_POTION = 3;
  var MAX_SMOKE = 2;
  var MAX_BOMB = 2;
  var MAX_BOOTS = 2;
  var MAX_WARD = 1;
  var MAX_OIL = 2;
  var MAX_BUCKLER = 2;
  var MAX_SCROLL = 2;
  var BOMB_DMG = 14; // ระเบิดประกายไฟ: แรงคงที่ ไม่หักป้องกัน อีกฝ่ายไม่ได้สวน
  var OIL_ATK = 6; // น้ำมันเคลือบดาบ: โจมตี +6 จนจบการต่อสู้/ประลองครั้งนั้น
  /* ตกเมืองคนอื่น (v9): เลือก พักค้างคืน (จ่ายค่าผ่านทาง พลังชีวิตเต็ม) หรือ ปล้นเมือง (ทอยเต๋าแข่งกับเจ้าเมือง)
   * ปล้นสำเร็จ = เจ้าเมืองจ่ายให้ 3 เท่าของค่าผ่านทาง (ไม่เกินเงินที่เจ้าเมืองมี) · ไม่สำเร็จ (เสมอ = เจ้าเมืองชนะ) = จ่ายค่าปรับ 2 เท่า
   * ROB_BONUS[ระดับเมือง] = แต้มที่เจ้าเมืองได้บวกเพิ่มตอนทอยสู้คนปล้น (เมืองระดับสูงคุ้มกันแน่นกว่า) */
  var ROB_WIN = 3;
  var ROB_LOSE = 2;
  // ระดับ 1 = 0 (โอกาสปล้นสำเร็จ 42%) · ระดับ 2–3 = +1 (28%) · ระดับ 4–5 = +2 (17%) — ผลจำลองเทียบหลายแบบอยู่ใน docs/realm-rules.md
  var ROB_BONUS = [0, 0, 1, 1, 2, 2];
  var FEST_MULT = 2; // เทศกาลโคมลอย: ค่าผ่านทาง ×2 ครบหนึ่งรอบ
  var SEAL_RATE = 0.5; // เครื่องรางตราผ่านแดน: จ่ายค่าผ่านทางแค่ครึ่งเดียว
  var PURSE_BONUS = 30; // เครื่องรางเหรียญมังกร: เงินหลวงเพิ่ม
  var TOME_MULT = 1.5; // เครื่องรางตำราปราชญ์: ค่าประสบการณ์ ×1.5

  /* ---------- โหมดไม่จำกัดรอบ + บอส (v10) ----------
   * ไม่มีจำนวนรอบ · มีคนแรกถึง Lv BOSS_LV → ใส่ "การ์ดอัญเชิญบอส" ลงกองไพ่ และไพ่ใบถัดไปที่ใครเปิด = ใบนี้แน่นอน
   * เปิดแล้ว บอสไปยึดเมืองที่มีเจ้าของ (สุ่ม · ไม่มีเมืองไหนมีเจ้าของ = สุ่มจากทุกเมือง) แล้วย้ายเมืองแบบสุ่มทุก 1 รอบ
   * ตกเมืองที่บอสอยู่ (รวมเจ้าเมืองเอง) = เลือกสู้บอสหรือไม่สู้ · เมืองนั้นไม่มีค่าผ่านทาง ปล้นไม่ได้ ขยายไม่ได้ ระหว่างบอสอยู่
   * ปราบบอสได้ = ชนะ จบเกมทันที (คนปราบอันดับ 1 · ที่เหลือเรียงตามทรัพย์รวมเหมือนจบปกติ)
   * บอสฟื้นเต็มทุกครั้งที่สู้ใหม่ · แพ้บอส = โทษแพ้ปกติ (เหรียญหล่น 15% + พักฟื้น 1 ตา)
   * s.boss = { stage: 'wait'|'deck'|'out'|'dead', town, left (ตาที่เหลือก่อนย้ายเมือง), lv6, called, out, tries, slayer } */
  var ENDLESS_REF = 30; // โหมดไม่จำกัด: ความคืบหน้าเกม (แทน รอบ/จำนวนรอบ) = min(รอบ/30, 1) — ใช้กับรางวัล/มอนสเตอร์ที่โตตามเกม
  var BOSS_LV = 6;
  // ค่าพลังบอส (ปรับจากผลจำลองใน tests/realm-sim.js --boss) · bias = โอกาสเลือก [โจมตี, แรง, ป้องกัน]
  var BOSS = { id: 'boss', name: 'ราชันอสูรเงาคราม', hp: 200, atk: 32, def: 12, tier: 6, bias: [0.3, 0.45, 0.25] };
  // move = บอสย้ายเมืองทุกกี่รอบ · need = คอมนิสัยปกติยอมสู้บอสเมื่อโอกาสชนะ (จำลอง) ถึงเท่านี้
  var BOSS_TUNE = { move: 1, need: 0.25 };
  var BOSS_CARD = {
    id: 'summon',
    boss: true,
    good: false,
    name: 'การ์ดอัญเชิญบอส',
    text: BOSS.name + 'ตื่นขึ้นแล้ว! บุกยึดเมืองที่มีเจ้าของ 1 เมือง แล้วย้ายเมืองทุกรอบ · ใครปราบได้ = ชนะทันที'
  };

  /* ---------- ท่าต่อสู้ ----------
   * ตารางวน (เหมือนเป่ายิ้งฉุบ): โจมตีแรง ชนะ ป้องกัน · ป้องกัน ชนะ โจมตี (สวนกลับ) · โจมตี ชนะ โจมตีแรง (ตัดหน้า)
   * TABLE[ท่าเรา][ท่าอีกฝ่าย] = [ตัวคูณแรงที่เราทำ, ตัวคูณแรงที่อีกฝ่ายทำ]
   * ชนะ = ทำ 1.3 เท่า อีกฝ่ายทำไม่ได้ · เสมอ: โจมตี–โจมตี 1 เท่าทั้งคู่ · แรง–แรง 1.5 เท่าทั้งคู่ · ป้องกัน–ป้องกัน ไม่มีใครเจ็บ
   */
  var MOVES = ['A', 'H', 'D'];
  var MOVE_NAME = { A: 'โจมตี', H: 'โจมตีแรง', D: 'ป้องกัน' };
  var WIN_MULT = 1.3;
  var TABLE = {
    A: { A: [1, 1], H: [WIN_MULT, 0], D: [0, WIN_MULT] },
    H: { A: [0, WIN_MULT], H: [1.5, 1.5], D: [WIN_MULT, 0] },
    D: { A: [WIN_MULT, 0], H: [0, WIN_MULT], D: [0, 0] }
  };
  // ท่าที่ชนะท่านั้น
  var BEATS = { A: 'D', H: 'A', D: 'H' };

  /* ---------- มอนสเตอร์ 8 แบบ (ชื่อ/ค่าคิดเอง) · bias = โอกาสเลือก [โจมตี, แรง, ป้องกัน] ---------- */
  var MONSTERS = [
    { id: 'shroom', name: 'เห็ดพิษเดินได้', tier: 1, hp: 16, atk: 8, def: 1, bias: [0.5, 0.2, 0.3] },
    { id: 'bat', name: 'ค้างคาวหินผา', tier: 1, hp: 14, atk: 9, def: 0, bias: [0.25, 0.5, 0.25] },
    { id: 'wolf', name: 'หมาป่าเงา', tier: 2, hp: 24, atk: 11, def: 2, bias: [0.55, 0.25, 0.2] },
    { id: 'bones', name: 'ทหารกระดูก', tier: 2, hp: 26, atk: 10, def: 4, bias: [0.2, 0.25, 0.55] },
    { id: 'bog', name: 'ยักษ์หนองน้ำ', tier: 3, hp: 38, atk: 14, def: 4, bias: [0.25, 0.55, 0.2] },
    { id: 'firebird', name: 'นกไฟหางยาว', tier: 3, hp: 32, atk: 16, def: 3, bias: [0.5, 0.3, 0.2] },
    { id: 'rust', name: 'อัศวินสนิมเขรอะ', tier: 4, hp: 48, atk: 17, def: 7, bias: [0.2, 0.25, 0.55] },
    { id: 'mist', name: 'งูหมอกเจ็ดเกล็ด', tier: 4, hp: 56, atk: 19, def: 5, bias: [0.34, 0.33, 0.33] }
  ];
  var BIAS_TEXT = ['ชอบโจมตี', 'ชอบโจมตีแรง', 'ชอบตั้งป้องกัน'];

  /* ---------- เมือง (ชื่อคิดเอง) · tier 1–3 · guard = มอนสเตอร์ที่เฝ้า + ตัวคูณพลัง ----------
   * 0–6 = แดนมนตร์ (ชุดเดิม) · 7–9 = แดนมนตร์ (เพิ่มใหม่) · 10–16 = หมู่เกาะหิ่งห้อย
   * ห้ามสลับลำดับ 0–6 — เซฟรุ่นเก่าอ้างเมืองด้วยลำดับนี้ */
  var TOWNS = [
    { name: 'หมู่บ้านใบเฟิร์น', tier: 1, base: 100, guard: 'shroom', boost: 1.1 },
    { name: 'บ้านสายหมอก', tier: 1, base: 100, guard: 'bat', boost: 1.1 },
    { name: 'ท่าเรือจันทร์เสี้ยว', tier: 2, base: 150, guard: 'wolf', boost: 1.2 },
    { name: 'ป้อมลมหนาว', tier: 2, base: 150, guard: 'bones', boost: 1.2 },
    { name: 'ตลาดหินเขียว', tier: 2, base: 150, guard: 'bog', boost: 0.9 },
    { name: 'นครทรายทอง', tier: 3, base: 220, guard: 'firebird', boost: 1.15 },
    { name: 'ปราสาทเมฆา', tier: 3, base: 220, guard: 'rust', boost: 1.0 },
    { name: 'หมู่บ้านกังหันลม', tier: 1, base: 100, guard: 'bat', boost: 1.15 },
    { name: 'เหมืองผลึกม่วง', tier: 2, base: 150, guard: 'bones', boost: 1.1 },
    { name: 'หอดูดาวผาสูง', tier: 3, base: 220, guard: 'mist', boost: 0.9 },
    { name: 'หมู่บ้านเปลือกหอย', tier: 1, base: 100, guard: 'shroom', boost: 1.1 },
    { name: 'ท่าน้ำหิ่งห้อย', tier: 1, base: 100, guard: 'bat', boost: 1.1 },
    { name: 'ตลาดน้ำมรกต', tier: 2, base: 150, guard: 'wolf', boost: 1.15 },
    { name: 'ประภาคารลมทะเล', tier: 2, base: 150, guard: 'bones', boost: 1.2 },
    { name: 'หอคอยปะการัง', tier: 2, base: 150, guard: 'bog', boost: 0.9 },
    { name: 'วังมุกราตรี', tier: 3, base: 220, guard: 'firebird', boost: 1.1 },
    { name: 'ป้อมผาวาฬ', tier: 3, base: 220, guard: 'rust', boost: 0.95 }
  ];

  /* ---------- แผนที่ (กระดานวนรอบ · 'townK' = เมืองลำดับ K ของแผนที่นั้น = s.towns[K]) ----------
   * cols × rows = ตารางที่หน้าจอใช้วางช่องรอบขอบ (วนตามเข็ม เริ่มมุมซ้ายบน) · ช่องรวม = 2×(cols+rows) − 4
   * 'chest' = หีบสมบัติ (รวมถุงเงินเดิมไว้ด้วยกัน: ได้เงิน หรือ ของ/พลัง อย่างละครึ่ง) · 'card' = ศาลาเสี่ยงทาย */
  var MAPS = {
    classic: {
      id: 'classic',
      name: 'แดนมนตร์',
      blurb: 'กระดานใหญ่ 30 ช่อง · 10 เมือง',
      cols: 8,
      rows: 9,
      towns: [0, 1, 7, 2, 3, 8, 4, 5, 6, 9],
      layout: [
        'start', 'chest', 'town0', 'monster', 'card', 'town1', 'shop', 'monster',
        'town2', 'chest', 'town3', 'monster', 'town4', 'rest', 'card', 'monster',
        'town5', 'shop', 'town6', 'monster', 'chest', 'town7', 'monster',
        'card', 'town8', 'monster', 'town9', 'shop', 'chest', 'monster'
      ]
    },
    isle: {
      id: 'isle',
      name: 'หมู่เกาะหิ่งห้อย',
      blurb: 'กระดานเล็ก 24 ช่อง · 7 เมือง · วนรอบไว เหมาะไฟลต์สั้น',
      cols: 6,
      rows: 8,
      towns: [10, 11, 12, 13, 14, 15, 16],
      layout: [
        'start', 'chest', 'town0', 'monster', 'card', 'town1',
        'shop', 'monster', 'town2', 'chest', 'town3', 'rest', 'monster',
        'town4', 'chest', 'card', 'monster', 'town5',
        'shop', 'chest', 'monster', 'town6', 'chest', 'monster'
      ]
    },
    // แผนที่ของเซฟรุ่นเก่า (ก่อนมีแผนที่ให้เลือก) — 7 เมืองตำแหน่งเดิมทุกช่อง · ถุงเงินกลายเป็นหีบ · หีบ 2 ช่องกลายเป็นศาลา
    // ไม่มีให้เลือกตอนเริ่มเกมใหม่ มีไว้ให้เซฟเก่าเล่นต่อจนจบได้
    legacy: {
      id: 'legacy',
      legacy: true,
      name: 'แดนมนตร์ (ฉบับเดิม)',
      blurb: 'กระดาน 30 ช่อง · 7 เมือง (เซฟรุ่นเก่า)',
      cols: 8,
      rows: 9,
      towns: [0, 1, 2, 3, 4, 5, 6],
      layout: [
        'start', 'chest', 'monster', 'town0', 'chest', 'monster', 'shop', 'town1', 'monster', 'chest',
        'town2', 'card', 'monster', 'rest', 'town3', 'monster', 'chest', 'town4', 'chest', 'shop',
        'monster', 'town5', 'chest', 'monster', 'card', 'town6', 'monster', 'chest', 'shop', 'chest'
      ]
    }
  };
  var MAP_IDS = ['classic', 'isle']; // แผนที่ที่เลือกได้ตอนเริ่มเกม
  // ค่าเดิมเพื่อความเข้ากันได้ (= แผนที่ดั้งเดิม) · ในเกมให้ใช้ s.board.length
  var LAYOUT = MAPS.classic.layout;
  var SIZE = LAYOUT.length;
  var SPACE_NAME = {
    start: 'ลานประตูเมือง',
    gold: 'หีบสมบัติ', // ชนิดช่องเก่า (ถุงเงิน) = ทำงานเหมือนหีบสมบัติ
    monster: 'ป่ามอนสเตอร์',
    chest: 'หีบสมบัติ',
    card: 'ศาลาเสี่ยงทาย',
    shop: 'ร้านพ่อค้าเร่',
    rest: 'บ่อน้ำพุร้อน',
    town: 'เมือง'
  };

  /* ---------- ร้านค้า ---------- */
  var WEAPONS = [
    { name: 'ดาบเหล็กกล้า', atk: 3, price: 70 },
    { name: 'ดาบเงินจันทร์', atk: 6, price: 170 },
    { name: 'ขวานศิลาอัคคี', atk: 9, price: 290 },
    { name: 'ดาบดาวตกสีคราม', atk: 13, price: 440 },
    // v9: 2 ขั้นบนสุด (แพงมาก ส่วนใหญ่ซื้อได้ช่วงท้ายเกมยาว · เผื่อสู้ของใหญ่ในรุ่นหน้า)
    { name: 'หอกสายฟ้าพิโรธ', atk: 18, price: 640 },
    { name: 'ดาบตะวันนิรันดร์', atk: 24, price: 900 }
  ];
  var ARMORS = [
    { name: 'เสื้อหนังแรด', def: 2, price: 60 },
    { name: 'เกราะเกล็ดเงิน', def: 4, price: 150 },
    { name: 'เกราะกระดองเต่ายักษ์', def: 6, price: 260 },
    { name: 'ชุดเกราะขนนกฟ้า', def: 9, price: 400 },
    { name: 'เกราะเกล็ดมังกรแดง', def: 12, price: 580 },
    { name: 'เกราะแสงจันทร์ศักดิ์สิทธิ์', def: 16, price: 820 }
  ];
  // เครื่องราง: ใส่ได้ครั้งละ 1 ชิ้น · ซื้อชิ้นใหม่ = เปลี่ยนแทนชิ้นเดิม (ไม่คืนเงิน)
  var CHARMS = [
    { id: 'purse', name: 'เหรียญมังกรนำโชค', price: 80, note: 'ผ่านลานประตูเมือง ได้เงินหลวงเพิ่ม ' + PURSE_BONUS },
    { id: 'feather', name: 'ขนนกกระเรียนเงิน', price: 60, note: 'แพ้การต่อสู้ ไม่ต้องนอนพักฟื้น (ฟื้นพลังชีวิตเต็มทันที) และเหรียญหล่นแค่ครึ่งเดียว' },
    { id: 'tome', name: 'ตำราปราชญ์ใบลาน', price: 60, note: 'ค่าประสบการณ์ ×1.5' },
    { id: 'seal', name: 'ตราผ่านแดนหยก', price: 70, note: 'จ่ายค่าผ่านทางแค่ครึ่งเดียว' }
  ];
  var ITEMS = {
    potion: { name: 'ยาฟื้นพลัง', price: 30, max: MAX_POTION, note: 'ฟื้นพลังชีวิตครึ่งหลอด' },
    smoke: { name: 'ลูกควันหนีภัย', price: 25, max: MAX_SMOKE, note: 'หนีออกจากการต่อสู้' },
    bomb: { name: 'ระเบิดประกายไฟ', price: 35, max: MAX_BOMB, note: 'ระหว่างสู้: แรง ' + BOMB_DMG + ' ทันที อีกฝ่ายไม่ได้สวน' },
    boots: { name: 'รองเท้าลมกรด', price: 30, max: MAX_BOOTS, note: 'ก่อนทอย: ตานี้ทอยเต๋า 2 ลูก' },
    ward: { name: 'ยันต์กันเคราะห์', price: 30, max: MAX_WARD, note: 'กันไพ่ร้าย 1 ครั้ง หรือกันเหรียญหล่นตอนแพ้' },
    // v9 ของช่วยรบ: ใช้ระหว่างสู้ได้ฟรี ไม่เสียยก อีกฝ่ายไม่ได้สวน · ใช้ได้ชนิดละครั้งต่อการต่อสู้
    oil: { name: 'น้ำมันเคลือบดาบ', short: 'น้ำมันดาบ', price: 35, max: MAX_OIL, fight: true, note: 'ระหว่างสู้/ประลอง: โจมตี +' + OIL_ATK + ' จนจบการต่อสู้นั้น' },
    buckler: { name: 'โล่ไม้ไผ่สาน', short: 'โล่ไม้', price: 30, max: MAX_BUCKLER, fight: true, note: 'ระหว่างสู้/ประลอง: กันการโดนตีได้ 1 ครั้ง (ไม่เจ็บเลย)' },
    scroll: { name: 'ม้วนคัมภีร์อ่านใจ', short: 'คัมภีร์', price: 30, max: MAX_SCROLL, fight: true, note: 'สู้มอนสเตอร์/ผู้เฝ้า: รู้ท่าที่อีกฝ่ายจะออกยกถัดไป' }
  };
  var ITEM_IDS = ['potion', 'smoke', 'bomb', 'boots', 'ward', 'oil', 'buckler', 'scroll'];
  var FIGHT_ITEMS = ['oil', 'buckler', 'scroll'];

  /* ---------- ไพ่เหตุการณ์ (ศาลาเสี่ยงทาย) 16 ใบ: ดี 10 · ร้าย 6 · คิดขึ้นเองทั้งหมด ----------
   * ไพ่ร้ายทุกใบมีเพดาน (เสียไม่เกิน 60 ต่อคน) · ยันต์กันเคราะห์กันไพ่ร้ายได้ */
  var CARDS = [
    { id: 'wind', good: true, name: 'ลมส่งท้ายเรือ', text: 'ลมดีพัดหนุนหลัง เดินหน้าต่ออีก 3 ช่อง' },
    { id: 'gate', good: true, name: 'แผนที่ทางลัด', text: 'ลัดถึงลานประตูเมืองทันที รับเงินหลวงตามปกติ' },
    { id: 'treasure', good: true, name: 'ถุงทองของเทพไม้', text: 'รับเงิน 30–80 เหรียญ (ท้ายเกมได้มากขึ้น)' },
    { id: 'festival', good: true, name: 'เทศกาลโคมลอย', text: 'ทั้งแดนฉลองกัน ค่าผ่านทางทุกเมือง ×2 ครบหนึ่งรอบ' },
    { id: 'gift', good: true, name: 'ตราตั้งจากเจ้าแคว้น', text: 'รับเงินบำรุงเมือง เมืองละ 20 (อย่างน้อย 30 · ไม่เกิน 80)' },
    { id: 'rain', good: true, name: 'ฝนทองโปรยปราย', text: 'ทุกคนได้เงินคนละ 25 เหรียญ' },
    { id: 'holy', good: true, name: 'น้ำมนต์ธารแก้ว', text: 'พลังชีวิตเต็ม และได้ยาฟื้นพลัง 1 ขวด' },
    { id: 'master', good: true, name: 'ครูดาบพเนจร', text: 'ได้ค่าประสบการณ์ 15' },
    { id: 'tribute', good: true, name: 'บรรณาการจากพ่อค้า', text: 'ผู้เล่นคนอื่นจ่ายให้คุณคนละ 10% ของเงิน (ไม่เกินคนละ 30)' },
    { id: 'bridge', good: true, name: 'สะพานสายรุ้ง', text: 'ข้ามไปเมืองว่างที่ใกล้ที่สุดข้างหน้า (ไม่มีเมืองว่าง = รับ 30 เหรียญ)' },
    { id: 'storm', good: false, name: 'พายุฝุ่นแดง', text: 'ทุกคนเสียเงิน 10% (ไม่เกินคนละ 40)' },
    { id: 'bandit', good: false, name: 'โจรป่าดักปล้น', text: 'เสียเงิน 15% (ไม่เกิน 60)' },
    { id: 'sand', good: false, name: 'ทรายดูด', text: 'ถอยหลัง 3 ช่อง (ไม่เกิดผลของช่องนั้น)' },
    { id: 'repair', good: false, name: 'ค่าซ่อมกำแพงเมือง', text: 'จ่ายเมืองละ 15 (ไม่เกิน 60) · ไม่มีเมือง = จ่าย 10' },
    { id: 'soaked', good: false, name: 'ฝนกระหน่ำ ข้าวของเปียก', text: 'ของใช้เสียไป 1 ชิ้น (ไม่มีของ = เสีย 15 เหรียญ)' },
    { id: 'ambush', good: false, name: 'มอนสเตอร์ซุ่มโจมตี', text: 'ต้องสู้กับมอนสเตอร์สุ่มทันที' }
  ];
  var CARD_CAP = { storm: 40, bandit: 60, repair: 60 };

  /* ---------- สุ่ม (mulberry32 เก็บค่าไว้ใน s.seed) ---------- */
  function rnd(s) {
    s.seed = (s.seed + 0x6d2b79f5) >>> 0;
    var t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function rint(s, lo, hi) {
    return lo + Math.floor(rnd(s) * (hi - lo + 1));
  }

  function pickWeighted(s, w) {
    var sum = 0;
    for (var i = 0; i < w.length; i++) sum += w[i];
    var x = rnd(s) * sum;
    for (var j = 0; j < w.length; j++) {
      x -= w[j];
      if (x < 0) return j;
    }
    return w.length - 1;
  }

  function monsterById(id) {
    for (var i = 0; i < MONSTERS.length; i++) if (MONSTERS[i].id === id) return MONSTERS[i];
    return MONSTERS[0];
  }

  /* ---------- แผนที่ ---------- */
  function mapOf(s) {
    return MAPS[s && s.map] || MAPS.classic;
  }

  function buildBoard(M) {
    return M.layout.map(function (k) {
      return k.indexOf('town') === 0 ? { t: 'town', town: Number(k.slice(4)) } : { t: k === 'gold' ? 'chest' : k };
    });
  }

  // ข้อมูลคงที่ของเมืองลำดับ k บนแผนที่ของเกมนี้
  function townDef(s, k) {
    return TOWNS[s.towns[k].i];
  }

  // ความคืบหน้าของเกม 0..1 (ใช้ขยายรางวัล/มอนสเตอร์ช่วงท้ายเกม) · โหมดไม่จำกัดรอบ = min(รอบ/30, 1) ไม่หารด้วย 0
  function progress(s) {
    if (s.endless || !(s.rounds > 0)) return Math.min(1, s.round / ENDLESS_REF);
    return s.round / s.rounds;
  }

  /* ---------- ผู้เล่น ---------- */
  function makePlayer(def, i) {
    return {
      name: def.name || 'ผู้เล่น ' + (i + 1),
      cpu: !!def.cpu,
      style: def.style || 'normal',
      pos: 0,
      gold: START_GOLD,
      hp: BASE.hp,
      mhp: BASE.hp,
      atk: BASE.atk,
      def: BASE.def,
      lv: 1,
      xp: 0,
      w: -1,
      ar: -1,
      ch: -1,
      potion: 1,
      smoke: 0,
      bomb: 0,
      boots: 0,
      ward: 0,
      oil: 0,
      buckler: 0,
      scroll: 0,
      fast: false,
      laps: 0,
      bank: false,
      skip: 0,
      st: newStats()
    };
  }

  /* สถิติต่อคน · tollPaid/tollGot = ค่าผ่านทางจากการพักค้างคืน
   * ปล้นเมือง (ฝั่งคนปล้น): robTry ครั้งที่ลอง · robWin สำเร็จ · robGot เงินที่ได้ · robLost ค่าปรับที่เสีย
   * ปล้นเมือง (ฝั่งเจ้าเมือง): defGot ค่าปรับที่ได้จากคนปล้นไม่สำเร็จ · defLost เงินที่โดนปล้นไป */
  var ROB_STATS = ['robTry', 'robWin', 'robGot', 'robLost', 'defGot', 'defLost'];
  function newStats() {
    var st = { wins: 0, losses: 0, broke: 0, tollPaid: 0, tollGot: 0, duelsWon: 0, captured: 0, cards: 0 };
    ROB_STATS.forEach(function (k) {
      st[k] = 0;
    });
    return st;
  }

  function atkOf(p) {
    return p.atk + (p.w >= 0 ? WEAPONS[p.w].atk : 0);
  }

  function defOf(p) {
    return p.def + (p.ar >= 0 ? ARMORS[p.ar].def : 0);
  }

  function charmOf(p) {
    return p.ch >= 0 && p.ch < CHARMS.length ? CHARMS[p.ch] : null;
  }

  function hasCharm(p, id) {
    var c = charmOf(p);
    return !!c && c.id === id;
  }

  function xpNeed(lv) {
    return lv * 10;
  }

  /* ---------- เมือง ---------- */
  function townValue(t) {
    var T = TOWNS[t.i];
    return T.base + Math.round(T.base * INVEST_RATE) * (t.level - 1);
  }

  function investCost(t) {
    return Math.round(TOWNS[t.i].base * INVEST_RATE);
  }

  // ค่าฟื้นฟูเมือง: ชนะผู้เฝ้าแล้วต้องจ่ายเท่านี้จึงได้เมือง (ti = รหัสเมืองใน TOWNS = s.towns[k].i)
  function claimFee(ti) {
    return Math.round(TOWNS[ti].base * CLAIM_RATE);
  }

  // ค่าผ่านทางพื้นฐานของเมือง (ไม่รวมเทศกาล/เครื่องราง)
  function toll(t) {
    return Math.round(townValue(t) * (TOLL_RATE + TOLL_STEP * (t.level - 1)));
  }

  // ค่าผ่านทางที่ผู้เล่น pi ต้องจ่ายจริงตอนนี้ (เทศกาล ×2 · ตราผ่านแดน ×0.75)
  function tollFor(s, t, pi) {
    var f = toll(t);
    if (s.fest > 0) f *= FEST_MULT;
    if (pi >= 0 && hasCharm(s.players[pi], 'seal')) f *= SEAL_RATE;
    return Math.round(f);
  }

  function townsOf(s, pi) {
    return s.towns.filter(function (t) {
      return t.owner === pi;
    });
  }

  function assets(s, pi) {
    var v = 0;
    townsOf(s, pi).forEach(function (t) {
      v += townValue(t);
    });
    return v;
  }

  // มูลค่าอุปกรณ์ที่ถืออยู่ = 50% ของราคาซื้อ (เฉพาะชิ้นที่ใส่อยู่ตอนนี้: อาวุธ + เกราะ + เครื่องราง · ของใช้ไม่นับ)
  // ขั้นเก่าที่ถูกแทนด้วยขั้นใหม่ไม่นับ · ไม่ต้องเก็บค่าเพิ่มในเซฟ (คำนวณจาก p.w / p.ar / p.ch)
  function gearValue(p) {
    var v = 0;
    if (p.w >= 0 && WEAPONS[p.w]) v += WEAPONS[p.w].price;
    if (p.ar >= 0 && ARMORS[p.ar]) v += ARMORS[p.ar].price;
    if (p.ch >= 0 && CHARMS[p.ch]) v += CHARMS[p.ch].price;
    return Math.round(v * GEAR_RATE);
  }

  // ทรัพย์รวม (คะแนนท้ายเกม + เช็คคนรั้งท้ายรับเงินหลวงเพิ่ม) = เงิน + มูลค่าเมือง + อุปกรณ์ครึ่งราคา
  function total(s, pi) {
    return s.players[pi].gold + assets(s, pi) + gearValue(s.players[pi]);
  }

  // ทรัพย์รวมน้อยสุด (ต้องน้อยกว่าทุกคนจริง ๆ ไม่นับเสมอ)
  function isLast(s, pi) {
    var mine = total(s, pi);
    for (var i = 0; i < s.players.length; i++) if (i !== pi && total(s, i) <= mine) return false;
    return s.players.length > 1;
  }

  /* ---------- สร้างเกม ----------
   * opts = { players: [{ name, cpu, style }], length: 'short'|'mid'|'long' หรือ rounds: ตัวเลข, map: 'classic'|'isle', seed }
   */
  function newGame(opts) {
    opts = opts || {};
    var defs = opts.players && opts.players.length ? opts.players : [{ name: 'คุณ' }, { name: 'คอม', cpu: true }];
    var endless = opts.length === ENDLESS;
    var rounds = endless ? 0 : opts.rounds || LENGTHS[opts.length] || LENGTHS.mid;
    var M = MAPS[opts.map] || MAPS.classic;
    var s = {
      v: VERSION,
      seed: (opts.seed == null ? Math.floor(Math.random() * 4294967296) : opts.seed) >>> 0,
      map: M.id,
      rounds: rounds, // 0 = ไม่จำกัดรอบ (s.endless)
      endless: endless,
      boss: endless ? { stage: 'wait', town: -1, left: 0, lv6: 0, called: 0, out: 0, tries: 0, slayer: -1 } : null,
      length: opts.length || null,
      round: 1,
      turn: 0,
      phase: 'roll',
      pending: null,
      battle: null,
      duel: null,
      result: null,
      lastRoll: 0,
      fest: 0, // จำนวนตาที่เหลือของเทศกาล (ค่าผ่านทาง ×2)
      deck: [], // กองไพ่ที่เหลือ (ลำดับใน CARDS) · หมดแล้วสับใหม่ด้วย seed
      players: defs.map(makePlayer),
      board: buildBoard(M),
      towns: M.towns.map(function (ti) {
        return { i: ti, owner: -1, level: 1 };
      })
    };
    // ผู้เล่นคนหลัง ๆ ได้ทุนตั้งต้นเพิ่มนิดหน่อย ชดเชยที่ได้เดินทีหลัง (ดูผลจำลอง)
    s.players.forEach(function (p, i) {
      p.gold += i * SEAT_BONUS;
    });
    return s;
  }

  /* ---------- แปลงเซฟรุ่นเก่า ----------
   * รุ่น 1: ยังไม่มีแผนที่ (กระดาน 30 ช่อง 7 เมือง มีช่องถุงเงิน) · ยังไม่มีไพ่/เครื่องราง/ของใช้ใหม่
   * → ใช้แผนที่ 'legacy' (เมืองตำแหน่งเดิม เจ้าของ/ระดับเมืองอยู่ครบ) · ถุงเงิน → หีบสมบัติ · หีบ 2 ช่อง → ศาลาเสี่ยงทาย
   * คืนสถานะที่ใช้ได้ (แก้ในตัว) หรือ null ถ้าเสียหาย/ไม่รู้จัก */
  function migrate(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.players) || !Array.isArray(s.board) || !Array.isArray(s.towns)) return null;
    if (s.v === VERSION) return MAPS[s.map] && (!s.endless || (s.boss && typeof s.boss === 'object')) ? s : null;
    if (s.v !== 1 && s.v !== 2 && s.v !== 3) return null;
    if (s.v === 1) {
      var M = MAPS.legacy;
      if (s.board.length !== M.layout.length || s.towns.length !== M.towns.length) return null;
      s.map = M.id;
      s.board = buildBoard(M); // เมือง/ช่องอื่นตำแหน่งเดิมทุกช่อง
      s.fest = 0;
      s.deck = [];
      s.players.forEach(function (p) {
        if (p.ch == null) p.ch = -1;
        ['bomb', 'boots', 'ward'].forEach(function (k) {
          if (p[k] == null) p[k] = 0;
        });
        p.fast = false;
        if (p.st && p.st.cards == null) p.st.cards = 0;
      });
      s.v = 2;
    }
    // รุ่น 2 → 3: ของช่วยรบ 3 ชนิด + สถิติปล้นเมือง (อาวุธ/เกราะขั้นเดิมอยู่ลำดับเดิม ขั้นใหม่ต่อท้าย)
    if (!MAPS[s.map]) return null;
    if (s.v <= 2) {
      s.players.forEach(function (p) {
        FIGHT_ITEMS.forEach(function (k) {
          if (p[k] == null) p[k] = 0;
        });
        if (!p.st) p.st = newStats();
        ROB_STATS.forEach(function (k) {
          if (p.st[k] == null) p.st[k] = 0;
        });
      });
      if (s.duel && !s.duel.items) s.duel.items = [[], []];
      s.v = 3;
    }
    // รุ่น 3 → 4 (v10): ยังไม่มีโหมดไม่จำกัดรอบ → เซฟเก่าทุกอันเป็นเกมจำนวนรอบคงที่ เล่นต่อจนจบแบบเดิม
    if (!(s.rounds > 0)) return null;
    s.endless = false;
    s.boss = null;
    s.v = VERSION;
    return s;
  }

  function decider(s) {
    if (s.phase === 'over') return -1;
    if (s.phase === 'duel') return s.duel.plans[0] ? s.duel.b : s.duel.a;
    return s.turn;
  }

  /* ---------- เหตุการณ์ ---------- */
  function ev(list, kind, text, extra) {
    var e = { k: kind, t: text };
    if (extra) for (var key in extra) e[key] = extra[key];
    list.push(e);
    return e;
  }

  // ค่าประสบการณ์จริงที่ได้ (รวมผลเครื่องรางตำรา)
  function xpFor(p, xp) {
    return hasCharm(p, 'tome') ? Math.round(xp * TOME_MULT) : xp;
  }

  function gainXp(s, pi, xp, out) {
    var p = s.players[pi];
    if (p.lv >= MAX_LEVEL) return;
    p.xp += xpFor(p, xp);
    while (p.lv < MAX_LEVEL && p.xp >= xpNeed(p.lv)) {
      p.xp -= xpNeed(p.lv);
      p.lv += 1;
      p.mhp += LEVEL_UP.hp;
      p.hp = Math.min(p.mhp, p.hp + LEVEL_UP.hp);
      p.atk += LEVEL_UP.atk;
      p.def += LEVEL_UP.def;
      ev(out, 'level', p.name + ' เลเวลอัปเป็น Lv ' + p.lv + '! (พลังชีวิต +' + LEVEL_UP.hp + ' · โจมตี +' + LEVEL_UP.atk + ' · ป้องกัน +' + LEVEL_UP.def + ')', { p: pi });
    }
    if (p.lv >= MAX_LEVEL) p.xp = 0;
    if (p.lv >= BOSS_LV) callBoss(s, pi, out);
  }

  /* ---------- บอส (โหมดไม่จำกัดรอบ · v10) ---------- */
  // มีคนแรกถึง Lv 6 → ใส่การ์ดอัญเชิญบอสลงกองไพ่ (ไพ่ใบถัดไปที่ใครเปิด = ใบนี้แน่นอน)
  function callBoss(s, pi, out) {
    var B = s.boss;
    if (!s.endless || !B || B.stage !== 'wait') return;
    B.stage = 'deck';
    B.lv6 = s.round;
    ev(out, 'boss-card', s.players[pi].name + ' ถึง Lv ' + BOSS_LV + ' เป็นคนแรก — "' + BOSS_CARD.name + '" ถูกใส่ลงกองไพ่แล้ว! ใครเปิดไพ่ที่ศาลาเสี่ยงทายใบถัดไป = อัญเชิญ' + BOSS.name, { p: pi });
  }

  function bossHere(s, k) {
    return !!(s.boss && s.boss.stage === 'out' && s.boss.town === k);
  }

  // เมืองที่บอสไปอยู่ได้: เมืองที่มีเจ้าของ (ไม่มีเลย = ทุกเมือง) ยกเว้นเมือง except
  function bossSpots(s, except) {
    var own = [];
    var all = [];
    s.towns.forEach(function (t, k) {
      if (k === except) return;
      all.push(k);
      if (t.owner >= 0) own.push(k);
    });
    if (own.length) return own;
    // มีเมืองที่มีเจ้าของแค่เมืองที่บอสยืนอยู่ = อยู่ที่เดิม
    if (except >= 0 && s.towns[except] && s.towns[except].owner >= 0) return [];
    return all;
  }

  function summonBoss(s, pi, out) {
    var B = s.boss;
    var list = bossSpots(s, -1);
    var k = list[rint(s, 0, list.length - 1)];
    B.stage = 'out';
    B.town = k;
    // ย้ายเมืองเมื่อครบ 1 รอบ · ครั้งแรก +1 ตา (นับตาของคนเปิดไพ่ที่กำลังจบ) = ทุกคนรวมคนเปิดไพ่ได้เล่น 1 ตาก่อนบอสย้าย
    B.left = Math.max(1, Math.round(s.players.length * BOSS_TUNE.move)) + 1;
    B.called = s.round;
    B.out = s.round;
    var t = s.towns[k];
    ev(
      out,
      'boss',
      BOSS.name + 'ปรากฏตัว บุกยึด' + TOWNS[t.i].name + (t.owner >= 0 ? ' (เมืองของ ' + s.players[t.owner].name + ')' : '') + '! ใครหยุดที่เมืองนี้ได้ท้าสู้ · ปราบได้ = ชนะทันที',
      { p: pi, town: k, owner: t.owner }
    );
  }

  // จบแต่ละตา: บอสนับถอยหลัง ครบ 1 รอบ = ย้ายไปเมืองอื่นแบบสุ่ม (เมืองที่มีเจ้าของ)
  function bossTick(s, out) {
    var B = s.boss;
    if (!B || B.stage !== 'out') return;
    B.left -= 1;
    if (B.left > 0) return;
    B.left = Math.max(1, Math.round(s.players.length * BOSS_TUNE.move));
    var list = bossSpots(s, B.town);
    if (!list.length) return;
    var from = B.town;
    B.town = list[rint(s, 0, list.length - 1)];
    var t = s.towns[B.town];
    ev(out, 'boss-move', BOSS.name + 'ย้ายจาก' + TOWNS[s.towns[from].i].name + 'ไปยึด' + TOWNS[t.i].name + (t.owner >= 0 ? ' (เมืองของ ' + s.players[t.owner].name + ')' : ''), {
      p: -1,
      town: B.town,
      from: from
    });
  }

  function bossFoe() {
    return { m: BOSS.id, name: BOSS.name, hp: BOSS.hp, atk: BOSS.atk, def: BOSS.def, tier: BOSS.tier, bias: BOSS.bias.slice(), level: 0, boss: true };
  }

  function pay(s, from, to, amount, out) {
    var p = s.players[from];
    var paid = Math.min(p.gold, amount);
    p.gold -= paid;
    if (to >= 0) s.players[to].gold += paid;
    if (paid < amount) {
      p.st.broke += 1;
      ev(out, 'broke', p.name + ' เงินไม่พอจ่าย — หมดตัว!', { p: from });
    }
    return paid;
  }

  /* ---------- เริ่ม/จบตา ---------- */
  // เมืองของผู้เล่นที่ลงทุนได้ตอนนี้ (คืนลำดับใน s.towns)
  function investable(s, pi) {
    var p = s.players[pi];
    var list = [];
    s.towns.forEach(function (t, k) {
      // เมืองที่บอสยึดอยู่ขยายไม่ได้ (v10)
      if (t.owner === pi && t.level < MAX_TOWN_LEVEL && investCost(t) <= p.gold && !bossHere(s, k)) list.push(k);
    });
    return list;
  }

  // v10: ทำไมผ่านลานประตูเมืองแล้วขยายเมืองไม่ได้ (มีเมืองแต่ขยายไม่ได้สักเมือง) — แค่ข้อความ ไม่เปลี่ยนกติกา
  function noInvestReason(s, pi) {
    var p = s.players[pi];
    var mine = [];
    s.towns.forEach(function (t, k) {
      if (t.owner === pi) mine.push(k);
    });
    if (!mine.length) return '';
    var open = mine.filter(function (k) {
      return s.towns[k].level < MAX_TOWN_LEVEL;
    });
    if (!open.length) return 'เมืองของตัวเองเต็มระดับ ' + MAX_TOWN_LEVEL + ' ครบทุกเมืองแล้ว';
    var free = open.filter(function (k) {
      return !bossHere(s, k);
    });
    if (!free.length) return 'เมืองที่ยังขยายได้ถูก' + BOSS.name + 'ยึดอยู่';
    var cheap = Infinity;
    free.forEach(function (k) {
      cheap = Math.min(cheap, investCost(s.towns[k]));
    });
    return 'ขยายเมืองถูกสุดต้องมี ' + cheap + ' เหรียญ (ตอนนี้มี ' + p.gold + ')';
  }

  function endTurn(s, out) {
    s.pending = null;
    s.battle = null;
    s.duel = null;
    // ผ่านลานประตูเมืองในตานี้ → ได้เลือกลงทุนเมืองไหนก็ได้ของตัวเอง 1 เมือง ก่อนจบตา
    var cur = s.players[s.turn];
    cur.fast = false;
    if (cur.bank) {
      cur.bank = false;
      var list = investable(s, s.turn);
      if (list.length) {
        s.phase = 'decide';
        s.pending = { kind: 'invest', towns: list, bank: true };
        ev(out, 'ask', cur.name + ' ผ่านลานประตูเมือง — ลงทุนขยายเมืองของตัวเองได้ 1 เมือง', { p: s.turn });
        return;
      }
      var why = noInvestReason(s, s.turn);
      if (why) ev(out, 'noinvest', cur.name + ' ผ่านลานประตูเมือง แต่ยังขยายเมืองไม่ได้ — ' + why, { p: s.turn });
    }
    // ไปคนถัดไป · คนที่แพ้การต่อสู้ในตาก่อน = นอนพักฟื้น ข้าม 1 ตา (แล้วฟื้นเต็ม)
    for (var guard = 0; guard <= s.players.length; guard++) {
      s.turn += 1;
      if (s.turn >= s.players.length) {
        s.turn = 0;
        s.round += 1;
      }
      if (s.fest > 0) {
        s.fest -= 1;
        if (s.fest === 0) ev(out, 'fest', 'เทศกาลโคมลอยจบแล้ว — ค่าผ่านทางกลับเป็นปกติ', { p: -1 });
      }
      bossTick(s, out);
      // โหมดไม่จำกัดรอบ: ไม่จบตามจำนวนรอบ (จบเมื่อมีคนปราบบอสเท่านั้น)
      if (!s.endless && s.round > s.rounds) {
        finish(s, out);
        return;
      }
      var nx = s.players[s.turn];
      if (nx.skip > 0) {
        nx.skip -= 1;
        nx.hp = nx.mhp;
        ev(out, 'skip', nx.name + ' นอนพักฟื้น ข้าม 1 ตา (พลังชีวิตกลับมาเต็ม)', { p: s.turn });
        continue;
      }
      break;
    }
    s.phase = 'roll';
    ev(out, 'turn', 'ตาของ ' + s.players[s.turn].name, { p: s.turn });
  }

  function standings(s) {
    return s.players
      .map(function (p, i) {
        return { p: i, gold: p.gold, towns: assets(s, i), gear: gearValue(p), total: total(s, i), count: townsOf(s, i).length };
      })
      .sort(function (a, b) {
        return b.total - a.total || b.count - a.count || a.p - b.p;
      });
  }

  // slayer = ผู้เล่นที่ปราบบอส (โหมดไม่จำกัดรอบ) → อันดับ 1 เสมอ ที่เหลือเรียงตามทรัพย์รวมเหมือนจบปกติ
  function finish(s, out, slayer) {
    s.phase = 'over';
    if (!s.endless) s.round = s.rounds;
    s.fest = 0;
    var rank = standings(s);
    if (slayer >= 0) {
      var at = 0;
      for (var i = 0; i < rank.length; i++) if (rank[i].p === slayer) at = i;
      var first = rank.splice(at, 1)[0];
      first.slayer = true;
      rank.unshift(first);
      s.result = { rank: rank, winner: slayer, slayer: slayer };
      ev(out, 'over', 'จบเกม — ' + s.players[slayer].name + ' ปราบ' + BOSS.name + 'ได้ ชนะ!', { p: slayer, slayer: slayer });
      return;
    }
    var tie = rank.length > 1 && rank[0].total === rank[1].total && rank[0].count === rank[1].count;
    s.result = { rank: rank, winner: tie ? -1 : rank[0].p };
    ev(out, 'over', tie ? 'จบเกม — เสมอกัน!' : 'จบเกม — ' + s.players[rank[0].p].name + ' ชนะ!', { p: s.result.winner });
  }

  /* ---------- ทอย + เดิน ---------- */
  function paySalary(s, pi, out) {
    var p = s.players[pi];
    p.laps += 1;
    var sal = SALARY + SALARY_PER_TOWN * townsOf(s, pi).length;
    if (isLast(s, pi)) sal += Math.round(SALARY * CATCH_UP);
    if (hasCharm(p, 'purse')) sal += PURSE_BONUS;
    p.gold += sal;
    p.bank = true;
    ev(out, 'salary', p.name + ' ผ่านลานประตูเมือง รับเงินหลวง ' + sal + ' เหรียญ', { p: pi, v: sal });
  }

  // เดินหน้า n ช่อง (ผ่านลานประตูเมือง = รับเงินหลวง) · warp = ย้ายทันทีไม่ต้องเดินทีละช่องบนจอ
  function advance(s, pi, n, out, warp) {
    var p = s.players[pi];
    var size = s.board.length;
    var from = p.pos;
    for (var k = 0; k < n; k++) {
      p.pos = (p.pos + 1) % size;
      if (p.pos === 0) paySalary(s, pi, out);
    }
    ev(out, warp ? 'warp' : 'move', '', { p: pi, from: from, to: p.pos, steps: n });
  }

  // ถอยหลัง n ช่อง (ไม่ได้เงินหลวงเมื่อถอยข้ามลานประตูเมือง)
  function retreat(s, pi, n, out) {
    var p = s.players[pi];
    var size = s.board.length;
    var from = p.pos;
    p.pos = (((p.pos - n) % size) + size) % size;
    ev(out, 'move', '', { p: pi, from: from, to: p.pos, steps: -n });
  }

  function roll(s, out, forced) {
    var pi = s.turn;
    var p = s.players[pi];
    var fast = !!p.fast;
    p.fast = false;
    var d;
    var dice;
    if (forced >= (fast ? 2 : 1) && forced <= (fast ? 12 : 6)) {
      d = forced;
      dice = [d];
    } else if (fast) {
      dice = [rint(s, 1, 6), rint(s, 1, 6)];
      d = dice[0] + dice[1];
    } else {
      d = rint(s, 1, 6);
      dice = [d];
    }
    s.lastRoll = d;
    ev(out, 'roll', p.name + ' ทอยได้ ' + (dice.length === 2 ? dice[0] + ' + ' + dice[1] + ' = ' + d : d), { p: pi, v: d, dice: dice, from: p.pos });
    advance(s, pi, d, out);
    land(s, out);
  }

  function othersHere(s, pi) {
    var list = [];
    s.players.forEach(function (q, i) {
      if (i !== pi && q.pos === s.players[pi].pos) list.push(i);
    });
    return list;
  }

  function land(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var sp = s.board[p.pos];
    var here = sp.t === 'start' ? [] : othersHere(s, pi);
    if (here.length) {
      s.phase = 'decide';
      s.pending = { kind: 'duel-offer', targets: here };
      ev(out, 'ask', p.name + ' เจอ ' + here.map(function (i) { return s.players[i].name; }).join(' กับ ') + ' — จะท้าประลองไหม', { p: pi });
      return;
    }
    resolveSpace(s, out);
  }

  function resolveSpace(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var sp = s.board[p.pos];
    var frac = progress(s);
    switch (sp.t) {
      case 'start': {
        // หยุดพอดีที่ลาน = โบนัสเงินครึ่งหนึ่งของเงินหลวง + (v10) พลังชีวิตเต็ม · เดินผ่านเฉย ๆ ไม่ได้ฟื้นพลัง
        var bonus = Math.round(SALARY / 2);
        p.gold += bonus;
        p.hp = p.mhp;
        ev(out, 'gold', p.name + ' หยุดที่ลานประตูเมือง รับโบนัสอีก ' + bonus + ' เหรียญ และพลังชีวิตเต็ม', { p: pi, v: bonus });
        endTurn(s, out);
        return;
      }
      case 'rest': {
        p.hp = p.mhp;
        ev(out, 'heal', p.name + ' แช่บ่อน้ำพุร้อน พลังชีวิตเต็ม', { p: pi });
        endTurn(s, out);
        return;
      }
      case 'gold': // ชนิดช่องเก่า — ทำงานเหมือนหีบสมบัติ
      case 'chest':
        openChest(s, out, frac);
        endTurn(s, out);
        return;
      case 'card':
        drawCard(s, out);
        return;
      case 'monster':
        startBattle(s, out, wildFoe(randomMonster(s)), -1);
        return;
      case 'shop':
        s.phase = 'decide';
        s.pending = { kind: 'shop' };
        ev(out, 'ask', p.name + ' แวะร้านพ่อค้าเร่', { p: pi });
        return;
      case 'town': {
        var k = sp.town;
        var t = s.towns[k];
        var T = TOWNS[t.i];
        if (bossHere(s, k)) {
          // v10: บอสยึดเมืองนี้อยู่ = ไม่มีค่าผ่านทาง/ปล้น/ขยาย/ยึด — เลือกสู้บอส หรือไม่สู้ (รวมเจ้าเมืองเอง)
          s.phase = 'decide';
          s.pending = { kind: 'boss', town: k };
          ev(out, 'ask', BOSS.name + 'ยึด' + T.name + 'อยู่ — ' + p.name + ' จะท้าสู้ไหม (ปราบได้ = ชนะทันที)', { p: pi, town: k });
        } else if (t.owner === -1) {
          s.phase = 'decide';
          s.pending = { kind: 'town', town: k };
          ev(out, 'ask', T.name + ' ถูก' + monsterById(T.guard).name + 'ยึดอยู่ — จะสู้เพื่อยึดเมืองไหม', { p: pi });
        } else if (t.owner === pi) {
          if (t.level < MAX_TOWN_LEVEL && investCost(t) <= p.gold) {
            s.phase = 'decide';
            s.pending = { kind: 'invest', towns: [k], bank: false };
            ev(out, 'ask', p.name + ' กลับถึง' + T.name + ' เมืองของตัวเอง — ลงทุนขยายเมืองได้', { p: pi });
          } else {
            // v10: บอกเหตุผลที่ขยายไม่ได้ (เต็มระดับ / เงินไม่พอ) — แค่ข้อความ กติกาเดิม
            var homeWhy =
              t.level >= MAX_TOWN_LEVEL
                ? 'เมืองนี้เต็มระดับ ' + MAX_TOWN_LEVEL + ' แล้ว'
                : 'อยากขยายเป็นระดับ ' + (t.level + 1) + ' ต้องมี ' + investCost(t) + ' เหรียญ (ตอนนี้มี ' + p.gold + ')';
            ev(out, 'home', p.name + ' แวะพักที่' + T.name + ' เมืองของตัวเอง — ' + homeWhy, { p: pi, town: k, full: t.level >= MAX_TOWN_LEVEL });
            endTurn(s, out);
          }
        } else {
          // v9: ไม่มีการจ่ายบังคับ และไม่มีทางผ่านฟรี — ต้องเลือก พักค้างคืน หรือ ปล้นเมือง
          s.phase = 'decide';
          s.pending = { kind: 'visit', town: k };
          ev(out, 'ask', p.name + ' แวะ' + T.name + ' เมืองของ ' + s.players[t.owner].name + ' — เลือก พักค้างคืน หรือ ปล้นเมือง', { p: pi, to: t.owner, town: k });
        }
        return;
      }
    }
    endTurn(s, out);
  }

  /* ---------- แวะเมืองคนอื่น: พักค้างคืน / ปล้นเมือง ---------- */
  function robBonus(t) {
    var b = ROB_BONUS[Math.max(0, Math.min(ROB_BONUS.length - 1, t.level))];
    return b || 0;
  }

  // โอกาสปล้นสำเร็จ = ทอยของคนปล้น > ทอยเจ้าเมือง + แต้มบวก (เต๋า 1–6 ทั้งคู่ · เสมอ = เจ้าเมืองชนะ)
  function robChance(t) {
    var b = robBonus(t);
    var n = 0;
    for (var x = 1; x <= 6; x++) for (var y = 1; y <= 6; y++) if (x > y + b) n++;
    return n / 36;
  }

  // ตัวเลขที่หน้าจอ/คอมใช้ตัดสินใจ: ค่าพัก (= ค่าผ่านทางตอนนี้ รวมเทศกาล/ตราผ่านแดน) · ปล้นได้ · ปล้นเสีย
  function visitInfo(s, k, pi) {
    var t = s.towns[k];
    var fee = tollFor(s, t, pi);
    return {
      town: k,
      owner: t.owner,
      fee: fee,
      win: fee * ROB_WIN,
      lose: fee * ROB_LOSE,
      bonus: robBonus(t),
      chance: robChance(t)
    };
  }

  function restAt(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var k = s.pending.town;
    var t = s.towns[k];
    var T = TOWNS[t.i];
    var fee = tollFor(s, t, pi);
    var paid = pay(s, pi, t.owner, fee, out); // เงินไม่พอ = จ่ายเท่าที่มี (นับหมดตัว) แต่ยังได้พัก
    p.st.tollPaid += paid;
    s.players[t.owner].st.tollGot += paid;
    p.hp = p.mhp;
    ev(out, 'toll', p.name + ' พักค้างคืนที่' + T.name + ' จ่ายค่าผ่านทาง ' + paid + ' เหรียญ ให้ ' + s.players[t.owner].name + (s.fest > 0 ? ' (เทศกาล ×2)' : '') + ' · พลังชีวิตเต็ม', {
      p: pi,
      to: t.owner,
      v: paid,
      town: k
    });
    endTurn(s, out);
  }

  function robTown(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var k = s.pending.town;
    var t = s.towns[k];
    var T = TOWNS[t.i];
    var oi = t.owner;
    var o = s.players[oi];
    var fee = tollFor(s, t, pi);
    var bonus = robBonus(t);
    var a = rint(s, 1, 6); // คนปล้นทอย
    var b = rint(s, 1, 6); // เจ้าเมืองทอย (อัตโนมัติ แม้เป็นคน)
    var ok = a > b + bonus;
    var v;
    p.st.robTry += 1;
    var dice = ' (ทอย ' + a + ' ต่อ ' + b + (bonus ? ' +' + bonus : '') + ')';
    if (ok) {
      // เจ้าเมืองจ่าย 3 เท่า ไม่เกินเงินที่มี (เจ้าเมืองไม่นับว่าหมดตัว)
      v = Math.min(o.gold, fee * ROB_WIN);
      o.gold -= v;
      p.gold += v;
      p.st.robWin += 1;
      p.st.robGot += v;
      o.st.defLost += v;
      ev(out, 'rob', p.name + ' ปล้น' + T.name + 'สำเร็จ' + dice + ' — ได้ ' + v + ' เหรียญจาก ' + o.name + (v < fee * ROB_WIN ? ' (เจ้าเมืองมีแค่นี้)' : ''), {
        p: pi,
        to: oi,
        town: k,
        a: a,
        b: b,
        bonus: bonus,
        ok: true,
        v: v,
        fee: fee
      });
    } else {
      // ไม่สำเร็จ = จ่ายค่าปรับ 2 เท่าให้เจ้าเมือง (เงินไม่พอ = จ่ายเท่าที่มี นับหมดตัว)
      var later = []; // ข้อความ "หมดตัว" ให้ขึ้นหลังผลปล้น
      v = pay(s, pi, oi, fee * ROB_LOSE, later);
      p.st.robLost += v;
      o.st.defGot += v;
      ev(out, 'rob', p.name + ' ปล้น' + T.name + 'ไม่สำเร็จ' + dice + ' — เสียค่าปรับ ' + v + ' เหรียญ ให้ ' + o.name, {
        p: pi,
        to: oi,
        town: k,
        a: a,
        b: b,
        bonus: bonus,
        ok: false,
        v: v,
        fee: fee
      });
      later.forEach(function (e) {
        out.push(e);
      });
    }
    endTurn(s, out);
  }

  /* หีบสมบัติ (รวมถุงเงินเดิม): ครึ่งหนึ่งได้เงิน 20–60 (ท้ายเกมได้มากขึ้น) · อีกครึ่งได้ของใช้/พลังถาวรเล็กน้อย
   * ของเต็มกระเป๋าแล้ว = ได้เงินปลอบใจ 15–30 แทน (ไม่มีทางได้ของเกินเพดาน) */
  // v9: เพิ่มของช่วยรบ 3 ชนิด (ต่อท้าย) · ลดยา/ลูกควัน/ระเบิด/รองเท้า/ยันต์/พลังถาวรลงนิดหน่อย · เงินยังครึ่งหนึ่งเท่าเดิม
  var CHEST_W = [50, 12, 5, 6, 5, 4, 5, 5, 3, 3, 2]; // [เงิน, ยา, ลูกควัน, ระเบิด, รองเท้า, ยันต์, ยาเสริมแรง, ผลโอ๊ก, น้ำมันดาบ, โล่ไม้, คัมภีร์]
  var CHEST_GIVE = ['', 'potion', 'smoke', 'bomb', 'boots', 'ward', '', '', 'oil', 'buckler', 'scroll'];
  function openChest(s, out, frac) {
    var pi = s.turn;
    var p = s.players[pi];
    var r = pickWeighted(s, CHEST_W);
    var give = CHEST_GIVE[r];
    if (r === 0) {
      var g = rint(s, 20, 40) + Math.round((frac || 0) * 20);
      p.gold += g;
      ev(out, 'chest', p.name + ' เปิดหีบได้ ' + g + ' เหรียญ', { p: pi, v: g, got: 'gold' });
    } else if (give) {
      if ((p[give] || 0) < ITEMS[give].max) {
        p[give] = p[give] || 0;
        p[give] += 1;
        ev(out, 'chest', p.name + ' เปิดหีบได้' + ITEMS[give].name + ' 1 ชิ้น', { p: pi, got: give });
      } else {
        var c = rint(s, 15, 30);
        p.gold += c;
        ev(out, 'chest', p.name + ' เปิดหีบเจอ' + ITEMS[give].name + ' แต่กระเป๋าเต็ม — ขายได้ ' + c + ' เหรียญ', { p: pi, v: c, got: 'gold' });
      }
    } else if (r === 6) {
      p.atk += 1;
      ev(out, 'chest', p.name + ' เปิดหีบได้ยาเสริมแรง — โจมตี +1 ถาวร', { p: pi, got: 'atk' });
    } else {
      p.mhp += 3;
      p.hp += 3;
      ev(out, 'chest', p.name + ' เปิดหีบได้ผลโอ๊กวิเศษ — พลังชีวิตสูงสุด +3', { p: pi, got: 'mhp' });
    }
  }

  /* ---------- ไพ่เหตุการณ์ ---------- */
  function newDeck(s) {
    var d = [];
    for (var i = 0; i < CARDS.length; i++) d.push(i);
    for (var j = d.length - 1; j > 0; j--) {
      var k = rint(s, 0, j);
      var x = d[j];
      d[j] = d[k];
      d[k] = x;
    }
    return d;
  }

  function cardById(id) {
    for (var i = 0; i < CARDS.length; i++) if (CARDS[i].id === id) return CARDS[i];
    return null;
  }

  // ยันต์กันเคราะห์: มีอยู่ = ใช้อัตโนมัติ กันผลร้ายครั้งนี้
  function shielded(s, qi, out, what) {
    var q = s.players[qi];
    if (q.ward > 0) {
      q.ward -= 1;
      ev(out, 'ward', q.name + ' ใช้' + ITEMS.ward.name + ' — ไม่โดน' + what, { p: qi });
      return true;
    }
    return false;
  }

  function loseGold(s, qi, amount, out, why) {
    var q = s.players[qi];
    var lost = Math.max(0, Math.min(q.gold, amount));
    q.gold -= lost;
    ev(out, 'card-fx', q.name + ' ' + why + ' เสีย ' + lost + ' เหรียญ', { p: qi, v: -lost });
    return lost;
  }

  function gainGold(s, qi, amount, out, why) {
    s.players[qi].gold += amount;
    ev(out, 'card-fx', s.players[qi].name + ' ' + why + ' ได้ ' + amount + ' เหรียญ', { p: qi, v: amount });
  }

  function drawCard(s, out) {
    var pi = s.turn;
    var p = s.players[pi];
    var c;
    if (s.boss && s.boss.stage === 'deck') c = BOSS_CARD; // v10: การ์ดอัญเชิญบอสอยู่ในกอง = ใบนี้แน่นอน (กองเดิมไม่ถูกแตะ)
    else {
      if (!Array.isArray(s.deck) || !s.deck.length) s.deck = newDeck(s);
      c = CARDS[s.deck.pop()] || CARDS[0];
    }
    p.st.cards = (p.st.cards || 0) + 1;
    ev(out, 'card', p.name + ' เปิดไพ่ที่ศาลาเสี่ยงทาย: ' + c.name + ' — ' + c.text, { p: pi, card: c.id, good: c.good, boss: !!c.boss, name: c.name, text: c.text });
    if (!applyCard(s, pi, c, out)) endTurn(s, out);
  }

  // คืน true = ไพ่พาไปทำอย่างอื่นต่อแล้ว (เดิน/สู้/ตัดสินใจ) · false = จบตาได้เลย
  function applyCard(s, pi, c, out) {
    var p = s.players[pi];
    var size = s.board.length;
    var n = s.players.length;
    var i;
    switch (c.id) {
      case 'summon':
        summonBoss(s, pi, out);
        return false;
      case 'wind':
        advance(s, pi, 3, out);
        land(s, out);
        return true;
      case 'gate':
        advance(s, pi, size - p.pos, out, true);
        return false; // จบตา → ได้เลือกลงทุนเมืองเหมือนผ่านลานประตูเมือง
      case 'treasure':
        gainGold(s, pi, rint(s, 30, 50) + Math.round(progress(s) * 30), out, 'ขุดเจอถุงทอง');
        return false;
      case 'festival':
        s.fest = n + 1; // นับรวมตาที่เหลือของรอบถัดไปให้ครบทุกคน (รวมคนจั่วเอง)
        ev(out, 'fest', 'เทศกาลโคมลอยเริ่มแล้ว — ค่าผ่านทางทุกเมือง ×' + FEST_MULT + ' ครบหนึ่งรอบ', { p: pi });
        return false;
      case 'gift': {
        // ขยายเมืองต้องสู้ชนะเสมอ → ไพ่นี้ให้เป็นเงินตามจำนวนเมืองแทนการขยายฟรี
        var own = townsOf(s, pi).length;
        gainGold(s, pi, Math.min(Math.max(30, own * 20), 80), out, own ? 'ได้เงินบำรุงเมือง' : 'ยังไม่มีเมือง รับเงินตั้งตัว');
        return false;
      }
      case 'rain':
        for (i = 0; i < n; i++) s.players[i].gold += 25;
        ev(out, 'card-fx', 'ทุกคนได้เงินคนละ 25 เหรียญ', { p: pi, v: 25 });
        return false;
      case 'holy':
        p.hp = p.mhp;
        if (p.potion < MAX_POTION) p.potion += 1;
        ev(out, 'heal', p.name + ' ดื่มน้ำมนต์ พลังชีวิตเต็ม' + (p.potion <= MAX_POTION ? ' · ยา ' + p.potion + ' ขวด' : ''), { p: pi });
        return false;
      case 'master':
        ev(out, 'card-fx', p.name + ' ได้ค่าประสบการณ์ +' + xpFor(p, 15), { p: pi });
        gainXp(s, pi, 15, out);
        return false;
      case 'tribute': {
        var sum = 0;
        for (i = 0; i < n; i++) {
          if (i === pi) continue;
          var q = s.players[i];
          var take = Math.min(Math.floor(q.gold * 0.1), 30);
          q.gold -= take;
          sum += take;
        }
        p.gold += sum;
        ev(out, 'card-fx', p.name + ' ได้บรรณาการรวม ' + sum + ' เหรียญ', { p: pi, v: sum });
        return false;
      }
      case 'bridge': {
        for (var d = 1; d < size; d++) {
          var sp = s.board[(p.pos + d) % size];
          if (sp.t === 'town' && s.towns[sp.town].owner === -1) {
            advance(s, pi, d, out, true);
            land(s, out);
            return true;
          }
        }
        gainGold(s, pi, 30, out, 'ไม่มีเมืองว่างเหลือแล้ว');
        return false;
      }
      case 'storm':
        for (i = 0; i < n; i++) {
          if (shielded(s, i, out, 'พายุ')) continue;
          loseGold(s, i, Math.min(Math.floor(s.players[i].gold * 0.1), CARD_CAP.storm), out, 'โดนพายุ');
        }
        return false;
      case 'bandit':
        if (!shielded(s, pi, out, 'โจรปล้น')) loseGold(s, pi, Math.min(Math.floor(p.gold * 0.15), CARD_CAP.bandit), out, 'โดนโจรปล้น');
        return false;
      case 'sand':
        if (!shielded(s, pi, out, 'ทรายดูด')) {
          retreat(s, pi, 3, out);
          ev(out, 'card-fx', p.name + ' ติดทรายดูด ถอยหลัง 3 ช่อง', { p: pi });
        }
        return false;
      case 'repair': {
        if (shielded(s, pi, out, 'ค่าซ่อม')) return false;
        var cnt = townsOf(s, pi).length;
        loseGold(s, pi, cnt ? Math.min(cnt * 15, CARD_CAP.repair) : 10, out, 'จ่ายค่าซ่อม');
        return false;
      }
      case 'soaked': {
        if (shielded(s, pi, out, 'ฝนกระหน่ำ')) return false;
        var lostItem = null;
        ['bomb', 'potion', 'boots', 'smoke'].forEach(function (k) {
          if (!lostItem && p[k] > 0) lostItem = k;
        });
        if (lostItem) {
          p[lostItem] -= 1;
          ev(out, 'card-fx', p.name + ' ' + ITEMS[lostItem].name + 'เปียกใช้ไม่ได้ 1 ชิ้น', { p: pi });
        } else loseGold(s, pi, 15, out, 'ของเปียก');
        return false;
      }
      case 'ambush':
        if (shielded(s, pi, out, 'ซุ่มโจมตี')) return false;
        startBattle(s, out, wildFoe(randomMonster(s)), -1);
        return true;
    }
    return false;
  }

  function randomMonster(s) {
    var frac = progress(s);
    var top = Math.max(1, Math.min(4, 1 + Math.floor(frac * 3.4)));
    var lo = Math.max(1, top - 1);
    var tier = rint(s, lo, top);
    var pool = MONSTERS.filter(function (m) {
      return m.tier === tier;
    });
    return pool[rint(s, 0, pool.length - 1)];
  }

  /* ---------- ศัตรู ----------
   * มอนสเตอร์ป่า = ค่าตามตาราง
   * ผู้เฝ้าเมือง (level 1 = ตอนยึดเมือง) และ "หัวหน้าผู้เฝ้า" ตอนขยายเมืองเป็นระดับ level (2–5):
   *   g = boost ของเมือง × (1 + UP_GROW × (level − 1))
   *   พลังชีวิต = hp × g · โจมตี = atk × √g · ป้องกัน = def + (level − 1) · ขั้นรางวัล = tier + ⌈level/2⌉ (ยึดเมือง = tier + 1) */
  var UP_GROW = 0.25;
  var UP_NEED = 0.5; // คอมนิสัยปกติ: ลองขยายเมืองเมื่อโอกาสชนะ (edge) ถึงเกณฑ์นี้

  function wildFoe(m) {
    return { m: m.id, name: m.name, hp: m.hp, atk: m.atk, def: m.def, tier: m.tier, bias: m.bias.slice(), level: 0 };
  }

  function guardFoe(s, k, level) {
    var T = townDef(s, k);
    var m = monsterById(T.guard);
    var lv = Math.max(1, level || 1);
    var g = T.boost * (1 + UP_GROW * (lv - 1));
    return {
      m: m.id,
      name: lv > 1 ? 'หัวหน้า' + m.name : m.name,
      hp: Math.round(m.hp * g),
      atk: Math.round(m.atk * Math.sqrt(g)),
      def: m.def + (lv - 1),
      tier: m.tier + (lv > 1 ? Math.ceil(lv / 2) : 1),
      bias: m.bias.slice(),
      level: lv
    };
  }

  // ศัตรูที่ต้องชนะก่อนขยายเมืองลำดับ k ขึ้นอีก 1 ระดับ
  function upgradeFoe(s, k) {
    return guardFoe(s, k, s.towns[k].level + 1);
  }

  /* ---------- ต่อสู้ (townIdx = ลำดับเมืองใน s.towns · -1 = มอนสเตอร์ป่า · up = ระดับเป้าหมายตอนขยายเมือง) ---------- */
  function startBattle(s, out, foe, townIdx, up) {
    s.phase = 'battle';
    s.battle = {
      m: foe.m,
      town: townIdx,
      up: up || 0,
      name: foe.name,
      hp: foe.hp,
      mhp: foe.hp,
      atk: foe.atk,
      def: foe.def,
      tier: foe.tier,
      bias: foe.bias.slice(),
      n: 0,
      last: null,
      oil: 0, // โจมตีที่เพิ่มจากน้ำมันเคลือบดาบ (ของเรา)
      block: 0, // 1 = โล่ไม้พร้อมกันการโดนตีครั้งถัดไป
      peek: null // ท่าที่อีกฝ่ายจะออกยกถัดไป (ม้วนคัมภีร์อ่านใจ)
    };
    if (foe.boss) s.battle.boss = true; // v10: สู้บอส (ชนะ = จบเกม · town = เมืองที่บอสยึดอยู่)
    var T = townIdx >= 0 ? townDef(s, townIdx) : null;
    var head = foe.boss ? 'ท้าสู้บอสที่' + T.name + ': ' : !T ? 'เจอ ' : up ? 'ขยาย' + T.name + 'เป็นระดับ ' + up + ' ต้องชนะ ' : 'ผู้เฝ้า' + T.name + ': ';
    ev(out, 'battle', head + foe.name + '!', { p: s.turn, town: townIdx, up: up || 0, boss: !!foe.boss });
  }

  function damage(s, atk, def, mult) {
    if (!mult) return 0;
    var base = atk * mult - def * 0.5;
    var v = 0.85 + rnd(s) * 0.3;
    return Math.max(1, Math.round(base * v));
  }

  // ท่าของศัตรูยกนี้: อ่านใจไว้แล้ว = ท่านั้น (ใช้แล้วหมด) · ไม่งั้นสุ่มตามนิสัย
  function foeMove(s, b) {
    if (b.peek && MOVES.indexOf(b.peek) !== -1) {
      var m = b.peek;
      b.peek = null;
      return m;
    }
    return MOVES[pickWeighted(s, b.bias)];
  }

  // โล่ไม้: ถ้าพร้อมอยู่และยกนี้จะโดนตี = กันไว้ ไม่เจ็บ (ใช้แล้วหมด) · คืนแรงที่โดนจริง
  function blockHit(b, took) {
    if (took > 0 && b.block) {
      b.block = 0;
      return 0;
    }
    return took;
  }

  function exchange(s, out, mine) {
    var b = s.battle;
    var p = s.players[s.turn];
    var theirs = foeMove(s, b);
    var mult = TABLE[mine][theirs];
    var dealt = damage(s, atkOf(p) + (b.oil || 0), b.def, mult[0]);
    var raw = damage(s, b.atk, defOf(p), mult[1]);
    var took = blockHit(b, raw);
    b.hp = Math.max(0, b.hp - dealt);
    p.hp = Math.max(0, p.hp - took);
    b.n += 1;
    b.last = { me: mine, foe: theirs, dealt: dealt, took: took, blocked: raw > took ? raw : 0 };
    ev(out, 'hit', p.name + ' ' + MOVE_NAME[mine] + ' · ' + b.name + ' ' + MOVE_NAME[theirs] + ' — ทำได้ ' + dealt + ' · โดน ' + took + (raw > took ? ' (โล่ไม้กันไว้ ' + raw + ')' : ''), {
      p: s.turn,
      me: mine,
      foe: theirs,
      dealt: dealt,
      took: took,
      blocked: raw > took ? raw : 0
    });
    afterExchange(s, out);
  }

  // ของช่วยรบระหว่างสู้ (ไม่เสียยก อีกฝ่ายไม่ได้สวน) · คืน true = ใช้ได้
  function useFightItem(s, pi, id, out) {
    var b = s.battle;
    var p = s.players[pi];
    if (!b || FIGHT_ITEMS.indexOf(id) === -1 || !(p[id] > 0)) return false;
    if (id === 'oil') {
      if (b.oil) return false; // ใช้ได้ครั้งเดียวต่อการต่อสู้
      b.oil = OIL_ATK;
      p.oil -= 1;
      ev(out, 'fight-item', p.name + ' ทา' + ITEMS.oil.name + ' — โจมตี +' + OIL_ATK + ' จนจบการต่อสู้นี้', { p: pi, item: id });
      return true;
    }
    if (id === 'buckler') {
      if (b.block) return false; // ยกโล่ค้างไว้แล้ว
      b.block = 1;
      p.buckler -= 1;
      ev(out, 'fight-item', p.name + ' ยก' + ITEMS.buckler.name + ' — กันการโดนตีครั้งถัดไป', { p: pi, item: id });
      return true;
    }
    // คัมภีร์อ่านใจ: สุ่มท่าของอีกฝ่ายยกถัดไปไว้ก่อนเลย แล้วบอกให้รู้
    if (b.peek) return false;
    b.peek = MOVES[pickWeighted(s, b.bias)];
    p.scroll -= 1;
    ev(out, 'fight-item', p.name + ' เปิด' + ITEMS.scroll.name + ' — ' + b.name + ' จะ' + MOVE_NAME[b.peek] + 'ยกถัดไป', { p: pi, item: id, peek: b.peek });
    return true;
  }

  function afterExchange(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    if (b.hp <= 0) {
      winBattle(s, out);
      return;
    }
    if (p.hp <= 0) {
      loseBattle(s, out);
      return;
    }
    if (b.n >= MAX_EXCHANGES) {
      ev(out, 'draw', b.boss ? b.name + 'ถอยกลับเข้าเมืองไปตั้งหลัก — ไม่มีใครชนะ (สู้ใหม่ บอสพลังชีวิตเต็ม)' : b.name + ' ถอยหนีไป — ไม่มีใครชนะ', { p: pi, boss: !!b.boss });
      endTurn(s, out);
    }
  }

  function winBattle(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    if (b.boss) {
      // v10: ปราบบอสได้ = ชนะ จบเกมทันที
      p.st.bossWin = (p.st.bossWin || 0) + 1;
      s.boss.stage = 'dead';
      s.boss.slayer = pi;
      ev(out, 'win', p.name + ' ปราบ' + b.name + 'ได้!', { p: pi, v: 0, boss: true });
      s.pending = null;
      s.battle = null;
      s.duel = null;
      finish(s, out, pi);
      return;
    }
    p.st.wins += 1;
    var gold = b.tier * 12 + rint(s, 0, 10);
    var xp = b.tier * 6;
    p.gold += gold;
    ev(out, 'win', p.name + ' ชนะ' + b.name + '! ได้ ' + gold + ' เหรียญ · ค่าประสบการณ์ +' + xpFor(p, xp), { p: pi, v: gold });
    gainXp(s, pi, xp, out);
    if (b.town >= 0 && b.up) {
      // ชนะหัวหน้าผู้เฝ้า → จ่ายค่าลงทุนแล้วเมืองขึ้น 1 ระดับ
      var ut = s.towns[b.town];
      var cost = investCost(ut);
      if (ut.owner === pi && ut.level === b.up - 1 && p.gold >= cost) {
        p.gold -= cost;
        ut.level += 1;
        p.st.upWin = (p.st.upWin || 0) + 1;
        ev(out, 'invest', p.name + ' ลงทุน ' + cost + ' เหรียญ ขยาย' + TOWNS[ut.i].name + 'เป็นระดับ ' + ut.level + ' (ค่าผ่านทาง ' + toll(ut) + ')', { p: pi, town: b.town });
      } else {
        ev(out, 'nofee', p.name + ' เงินไม่พอค่าลงทุน (' + cost + ') — ยังขยาย' + TOWNS[ut.i].name + 'ไม่ได้', { p: pi, town: b.town });
      }
    } else if (b.town >= 0) {
      var t = s.towns[b.town];
      var fee = claimFee(t.i);
      if (p.gold >= fee) {
        p.gold -= fee;
        t.owner = pi;
        t.level = 1;
        p.st.captured += 1;
        ev(out, 'capture', p.name + ' จ่ายค่าฟื้นฟู ' + fee + ' เหรียญ ยึด' + TOWNS[t.i].name + 'ได้! (มูลค่า ' + townValue(t) + ')', { p: pi, town: b.town });
      } else {
        ev(out, 'nofee', p.name + ' เงินไม่พอค่าฟื้นฟูเมือง (' + fee + ') — เมืองยังว่างอยู่ ผู้เฝ้าตัวใหม่เข้ามาแทน', { p: pi, town: b.town });
      }
    }
    endTurn(s, out);
  }

  function loseBattle(s, out) {
    var b = s.battle;
    var pi = s.turn;
    var p = s.players[pi];
    p.st.losses += 1;
    var feather = hasCharm(p, 'feather');
    var lost = Math.floor(p.gold * LOSE_GOLD * (feather ? 0.5 : 1));
    if (lost > 0 && shielded(s, pi, out, 'เหรียญหล่น')) lost = 0;
    p.gold -= lost;
    if (feather) p.hp = p.mhp;
    else {
      p.hp = 1;
      p.skip = 1;
    }
    ev(out, 'lose', p.name + ' แพ้' + b.name + ' — ' + (lost ? 'ทำเหรียญหล่น ' + lost : 'ไม่เสียเหรียญ') + (feather ? ' · ขนนกกระเรียนช่วยไว้ ไม่ต้องพักฟื้น' : ' · ต้องนอนพักฟื้น 1 ตา'), { p: pi, v: lost, boss: !!b.boss });
    endTurn(s, out);
  }

  function usePotion(s, pi, out) {
    var p = s.players[pi];
    if (p.potion <= 0 || p.hp >= p.mhp) return false;
    p.potion -= 1;
    var heal = Math.ceil(p.mhp / 2);
    p.hp = Math.min(p.mhp, p.hp + heal);
    ev(out, 'heal', p.name + ' ดื่ม' + ITEMS.potion.name + ' พลังชีวิต +' + heal, { p: pi });
    return true;
  }

  /* ---------- ประลองระหว่างผู้เล่น (ไม่เสียพลังชีวิตจริง · แค่วัดฝีมือ 3 ยก) ---------- */
  function startDuel(s, out, target) {
    s.phase = 'duel';
    s.pending = null;
    // items[0|1] = ของช่วยรบที่แต่ละฝ่ายเลือกใช้ตอนวางแผน ('oil' | 'buckler') — หักจากกระเป๋าตอนเปิดผล
    s.duel = { a: s.turn, b: target, plans: [null, null], items: [[], []] };
    ev(out, 'duel', s.players[s.turn].name + ' ท้าประลอง ' + s.players[target].name + '!', { p: s.turn, to: target });
  }

  function validPlan(m) {
    return (
      Array.isArray(m) &&
      m.length === 3 &&
      m.every(function (x) {
        return MOVES.indexOf(x) !== -1;
      })
    );
  }

  function resolveDuel(s, out) {
    var d = s.duel;
    var A = s.players[d.a];
    var B = s.players[d.b];
    var dmg = [0, 0];
    var rounds = [];
    // ของช่วยรบในการประลอง: น้ำมันดาบ = โจมตี +OIL_ATK ทั้ง 3 ยก · โล่ไม้ = ยกแรกที่จะโดนตี ไม่เจ็บ
    var its = d.items || [[], []];
    var used = [[], []];
    var boost = [0, 0];
    var shield = [0, 0];
    [A, B].forEach(function (P, side) {
      (its[side] || []).forEach(function (id) {
        if (!(P[id] > 0) || used[side].indexOf(id) !== -1) return;
        P[id] -= 1;
        used[side].push(id);
        if (id === 'oil') boost[side] = OIL_ATK;
        if (id === 'buckler') shield[side] = 1;
      });
    });
    for (var k = 0; k < 3; k++) {
      var ma = d.plans[0][k];
      var mb = d.plans[1][k];
      var mult = TABLE[ma][mb];
      var x = damage(s, atkOf(A) + boost[0], defOf(B), mult[0]);
      var y = damage(s, atkOf(B) + boost[1], defOf(A), mult[1]);
      var ra = '';
      var rb = '';
      if (x > 0 && shield[1]) {
        shield[1] = 0;
        rb = x; // B ยกโล่กันไว้
        x = 0;
      }
      if (y > 0 && shield[0]) {
        shield[0] = 0;
        ra = y;
        y = 0;
      }
      dmg[0] += x;
      dmg[1] += y;
      rounds.push({ a: ma, b: mb, da: x, db: y, ba: ra || 0, bb: rb || 0 });
    }
    var win = dmg[0] > dmg[1] ? d.a : dmg[1] > dmg[0] ? d.b : -1;
    var take = 0;
    if (win >= 0) {
      var lose = win === d.a ? d.b : d.a;
      take = Math.floor(s.players[lose].gold * DUEL_TAKE);
      s.players[lose].gold -= take;
      s.players[win].gold += take;
      s.players[win].st.duelsWon += 1;
    }
    d.result = { rounds: rounds, dmg: dmg, winner: win, take: take, used: used };
    var usedText = [A, B]
      .map(function (P, side) {
        return used[side].length
          ? ' · ' + P.name + ' ใช้' + used[side]
              .map(function (id) {
                return ITEMS[id].name;
              })
              .join('+')
          : '';
      })
      .join('');
    ev(
      out,
      'duel-result',
      (win < 0
        ? 'ประลองเสมอ ' + dmg[0] + ' ต่อ ' + dmg[1] + ' — ไม่มีใครเสียเงิน'
        : s.players[win].name + ' ชนะประลอง (' + dmg[0] + ' ต่อ ' + dmg[1] + ') ได้เงิน ' + take + ' เหรียญ') + usedText,
      { p: d.a, to: d.b, winner: win, take: take, rounds: rounds, dmg: dmg, used: used }
    );
    // ประลองจบ → ผลของช่องที่ยืนอยู่ยังเกิดตามปกติ
    s.duel = null;
    resolveSpace(s, out);
  }

  /* ---------- ร้านค้า ----------
   * id: ของใช้ = 'potion'|'smoke'|'bomb'|'boots'|'ward' · อาวุธขั้นถัดไป = 'w' · เกราะขั้นถัดไป = 'ar' · เครื่องราง = 'ch0'..'ch3'
   * group: 'item' | 'gear' | 'charm' (หน้าจอใช้แบ่งหัวข้อ) */
  function shopList(p) {
    var list = [];
    ITEM_IDS.forEach(function (id) {
      var I = ITEMS[id];
      var have = p[id] || 0;
      list.push({ id: id, group: I.fight ? 'fight' : 'item', name: I.name, price: I.price, note: I.note + ' · มี ' + have + '/' + I.max, ok: have < I.max });
    });
    var nw = p.w + 1;
    if (nw < WEAPONS.length) list.push({ id: 'w', group: 'gear', name: WEAPONS[nw].name, price: WEAPONS[nw].price, note: 'อาวุธขั้น ' + (nw + 1) + ' · โจมตี +' + WEAPONS[nw].atk, ok: true });
    var na = p.ar + 1;
    if (na < ARMORS.length) list.push({ id: 'ar', group: 'gear', name: ARMORS[na].name, price: ARMORS[na].price, note: 'เกราะขั้น ' + (na + 1) + ' · ป้องกัน +' + ARMORS[na].def, ok: true });
    CHARMS.forEach(function (c, i) {
      if (i === p.ch) return;
      list.push({ id: 'ch' + i, group: 'charm', name: c.name, price: c.price, note: c.note + (p.ch >= 0 ? ' · แทนชิ้นเดิม' : ''), ok: true });
    });
    list.forEach(function (it) {
      it.ok = it.ok && p.gold >= it.price;
    });
    return list;
  }

  function buy(s, out, id) {
    var pi = s.turn;
    var p = s.players[pi];
    var it = shopList(p).filter(function (x) {
      return x.id === id;
    })[0];
    if (!it || !it.ok) return false;
    p.gold -= it.price;
    if (ITEMS[id]) p[id] = (p[id] || 0) + 1;
    else if (id === 'w') p.w += 1;
    else if (id === 'ar') p.ar += 1;
    else if (id.indexOf('ch') === 0) p.ch = Number(id.slice(2));
    ev(out, 'buy', p.name + ' ซื้อ' + it.name + ' (' + it.price + ' เหรียญ)', { p: pi });
    return true;
  }

  /* ---------- การกระทำ ----------
   * { type: 'roll' }                          ช่วง roll
   * { type: 'use', item: 'potion' }           ช่วง roll / battle
   * { type: 'use', item: 'boots' }            ช่วง roll (ตานี้ทอย 2 ลูก)
   * { type: 'use', item: 'smoke'|'bomb' }     ช่วง battle
   * { type: 'duel', target } | { type: 'skip' }  duel-offer
   * { type: 'fight' } | { type: 'skip' }         town (ยังไม่มีเจ้าของ)
   * { type: 'fight' } | { type: 'skip' }         boss (v10 เมืองที่บอสยึดอยู่ · ไม่สู้ก็ได้)
   * { type: 'invest', town, levels }             invest (0 = ไม่ลงทุน · ≥1 = สู้หัวหน้าผู้เฝ้าเพื่อขยาย 1 ระดับ · town = ลำดับใน s.towns)
   * { type: 'rest' } | { type: 'rob' }           visit (เมืองคนอื่น · ไม่มี skip)
   * { type: 'buy', item } | { type: 'leave' }    shop
   * { type: 'move', m: 'A'|'H'|'D' }             battle
   * { type: 'use', item: 'oil'|'buckler'|'scroll' } battle (ของช่วยรบ ไม่เสียยก)
   * { type: 'plan', moves: [3 ท่า], items: ['oil','buckler'] }  duel (ของ decider · items ไม่ใส่ก็ได้)
   * คืน events (array) · ทำไม่ได้ = คืน null
   */
  function act(s, a) {
    var out = [];
    if (!a || s.phase === 'over') return null;
    var pi = s.turn;
    var p = s.players[pi];
    switch (s.phase) {
      case 'roll':
        if (a.type === 'roll') {
          roll(s, out, a.forced);
          return out;
        }
        if (a.type === 'use' && a.item === 'potion') return usePotion(s, pi, out) ? out : null;
        if (a.type === 'use' && a.item === 'boots') {
          if (p.boots <= 0 || p.fast) return null;
          p.boots -= 1;
          p.fast = true;
          ev(out, 'boots', p.name + ' สวม' + ITEMS.boots.name + ' — ตานี้ทอยเต๋า 2 ลูก', { p: pi });
          return out;
        }
        return null;
      case 'decide': {
        var k = s.pending.kind;
        if (k === 'duel-offer') {
          if (a.type === 'duel' && s.pending.targets.indexOf(a.target) !== -1) startDuel(s, out, a.target);
          else if (a.type === 'skip') {
            s.pending = null;
            resolveSpace(s, out);
          } else return null;
          return out;
        }
        if (k === 'town') {
          if (a.type === 'fight') startBattle(s, out, guardFoe(s, s.pending.town, 1), s.pending.town);
          else if (a.type === 'skip') {
            ev(out, 'pass', p.name + ' ผ่านเมืองไปก่อน', { p: pi });
            endTurn(s, out);
          } else return null;
          return out;
        }
        if (k === 'boss') {
          // v10: ท้าสู้บอส (ไม่สู้ก็ได้ — ไม่มีอะไรเกิดขึ้น จบตา)
          if (a.type === 'fight') {
            s.boss.tries += 1;
            p.st.bossTry = (p.st.bossTry || 0) + 1;
            startBattle(s, out, bossFoe(), s.pending.town);
          } else if (a.type === 'skip') {
            ev(out, 'pass', p.name + ' ไม่สู้บอส ผ่านไปก่อน', { p: pi });
            endTurn(s, out);
          } else return null;
          return out;
        }
        if (k === 'invest') {
          if (a.type !== 'invest') return null;
          var n = Math.max(0, a.levels | 0);
          if (n === 0) {
            endTurn(s, out);
            return out;
          }
          // ขยายได้ครั้งละ 1 ระดับ และต้องสู้ชนะหัวหน้าผู้เฝ้าก่อน (จ่ายค่าลงทุนหลังชนะ · แพ้/หนี = ไม่เสียค่าลงทุน)
          if (s.pending.towns.indexOf(a.town) === -1) return null;
          var t = s.towns[a.town];
          if (t.owner !== pi || t.level >= MAX_TOWN_LEVEL || investCost(t) > p.gold) return null;
          p.st.upTry = (p.st.upTry || 0) + 1;
          startBattle(s, out, upgradeFoe(s, a.town), a.town, t.level + 1);
          return out;
        }
        if (k === 'visit') {
          // ต้องเลือกอย่างใดอย่างหนึ่ง — ไม่มี 'skip' (ไม่มีทางผ่านฟรี)
          if (a.type === 'rest') restAt(s, out);
          else if (a.type === 'rob') robTown(s, out);
          else return null;
          return out;
        }
        if (k === 'shop') {
          if (a.type === 'buy') return buy(s, out, a.item) ? out : null;
          if (a.type === 'leave') {
            endTurn(s, out);
            return out;
          }
          return null;
        }
        return null;
      }
      case 'battle': {
        var b = s.battle;
        if (a.type === 'move' && MOVES.indexOf(a.m) !== -1) {
          exchange(s, out, a.m);
          return out;
        }
        if (a.type === 'use' && a.item === 'potion') {
          if (!usePotion(s, pi, out)) return null;
          // ดื่มยา = เสียจังหวะ อีกฝ่ายได้โจมตีฟรี (ท่าตามนิสัย/ที่อ่านใจไว้ ถ้าป้องกัน = ไม่ทำอะไร · โล่ไม้กันได้)
          var mv = foeMove(s, b);
          var raw = mv === 'D' ? 0 : damage(s, b.atk, defOf(p), mv === 'H' ? 1.5 : 1);
          var took = blockHit(b, raw);
          p.hp = Math.max(0, p.hp - took);
          b.n += 1;
          b.last = { me: 'P', foe: mv, dealt: 0, took: took, blocked: raw > took ? raw : 0 };
          ev(out, 'hit', p.name + ' ดื่มยา · ' + b.name + (mv === 'D' ? ' ตั้งท่ารอ' : ' ฉวย' + MOVE_NAME[mv] + ' — โดน ' + took + (raw > took ? ' (โล่ไม้กันไว้)' : '')), {
            p: pi,
            me: 'P',
            foe: mv,
            dealt: 0,
            took: took,
            blocked: raw > took ? raw : 0
          });
          afterExchange(s, out);
          return out;
        }
        if (a.type === 'use' && FIGHT_ITEMS.indexOf(a.item) !== -1) return useFightItem(s, pi, a.item, out) ? out : null;
        if (a.type === 'use' && a.item === 'bomb') {
          if (p.bomb <= 0) return null;
          p.bomb -= 1;
          b.hp = Math.max(0, b.hp - BOMB_DMG);
          b.last = { me: 'B', foe: null, dealt: BOMB_DMG, took: 0 };
          ev(out, 'hit', p.name + ' ขว้าง' + ITEMS.bomb.name + ' ใส่' + b.name + ' — ทำได้ ' + BOMB_DMG, { p: pi, me: 'B', foe: null, dealt: BOMB_DMG, took: 0 });
          afterExchange(s, out);
          return out;
        }
        if (a.type === 'use' && a.item === 'smoke') {
          if (p.smoke <= 0) return null;
          p.smoke -= 1;
          ev(out, 'flee', p.name + ' ปาลูกควัน หนีออกมาได้', { p: pi, boss: !!b.boss });
          endTurn(s, out);
          return out;
        }
        return null;
      }
      case 'duel': {
        if (a.type !== 'plan' || !validPlan(a.moves)) return null;
        var d = s.duel;
        var side = d.plans[0] ? 1 : 0;
        // ของช่วยรบที่ใช้ในการประลองได้: น้ำมันดาบ / โล่ไม้ (คัมภีร์อ่านใจใช้ไม่ได้ — แผนของคนเป็นความลับ)
        var want = Array.isArray(a.items) ? a.items : [];
        var planner = s.players[side ? d.b : d.a];
        for (var wi = 0; wi < want.length; wi++) {
          if ((want[wi] !== 'oil' && want[wi] !== 'buckler') || !(planner[want[wi]] > 0) || want.indexOf(want[wi]) !== wi) return null;
        }
        if (!d.items) d.items = [[], []];
        d.items[side] = want.slice();
        d.plans[side] = a.moves.slice();
        if (d.plans[1]) resolveDuel(s, out);
        else ev(out, 'planned', s.players[d.a].name + ' วางแผนเสร็จแล้ว', { p: d.a });
        return out;
      }
    }
    return null;
  }

  /* ---------- คอม ---------- */
  // ประมาณโอกาสชนะแบบหยาบ: เทียบจำนวนยกที่ต้องใช้ล้มอีกฝ่าย (นับระเบิดในกระเป๋าด้วย)
  function edge(p, foe) {
    var mine = Math.max(1, atkOf(p) + (p.oil > 0 ? OIL_ATK * 0.8 : 0) - foe.def * 0.5);
    var theirs = Math.max(1, foe.atk - defOf(p) * 0.5);
    var myLife = p.hp + p.potion * Math.ceil(p.mhp / 2) * 0.6 + (p.buckler > 0 ? theirs * 1.1 : 0);
    var foeHp = Math.max(1, foe.hp - (p.bomb || 0) * BOMB_DMG * 0.8);
    return myLife / theirs / (foeHp / mine);
  }

  /* คอมเลือก พักค้างคืน / ปล้นเมือง ด้วยค่าคาดหวัง (เงิน):
   *   ปล้น = โอกาส × ที่ได้ (ไม่เกินเงินเจ้าเมือง) − (1 − โอกาส) × ค่าปรับ (ไม่เกินเงินตัวเอง) − โทษถ้าปล้นพลาดแล้วหมดตัวทั้งที่พักได้
   *   พัก  = − ค่าพัก + มูลค่าพลังชีวิตที่ได้คืน (มีค่ามากถ้าเลือดน้อยและยังเหลือหลายรอบ · รอบท้าย ๆ แทบไม่มีค่า)
   * นิสัย: meek กลัวเสี่ยง (ต้องได้เปรียบชัด) · bold/always/brute ชอบเสี่ยง · hoard คิดเงินล้วน */
  var HP_GOLD = 1.6; // พลังชีวิต 1 หน่วย ≈ 1.6 เหรียญ (ยาฟื้นพลัง 30 เหรียญ ฟื้นราว 15–30)
  function cpuVisit(s, di) {
    var p = s.players[di];
    var info = visitInfo(s, s.pending.town, di);
    var o = s.players[info.owner];
    var style = p.style;
    var pw = info.chance;
    var gain = Math.min(o.gold, info.win);
    var loss = Math.min(p.gold, info.lose);
    // ค่าปรับเกินเงินที่มี แต่ค่าพักยังจ่ายไหว = ปล้นพลาดแล้วหมดตัวทั้งที่ไม่จำเป็น → พักไว้ก่อน (ยกเว้นนิสัยชอบเสี่ยง)
    // ค่าพักก็จ่ายไม่ไหวอยู่แล้ว = ยังไงก็หมดตัว ปล้นดีกว่า (มีโอกาสรอด)
    var bold = style === 'bold' || style === 'always' || style === 'brute';
    // กันเงินไว้: ปล้นพลาดแล้วต้องยังเหลือพอจ่ายค่าผ่านทางครั้งหน้าอีกสักครั้ง (นิสัยชอบเสี่ยงกันน้อยกว่า)
    var cushion = bold ? 0 : Math.max(info.fee, 30);
    if (info.lose + cushion > p.gold && info.fee <= p.gold) return { type: 'rest' };
    var robEV = pw * gain - (1 - pw) * loss;
    var left = s.endless ? 1 : Math.max(0, 1 - progress(s)); // โหมดไม่จำกัด: พลังชีวิตมีค่าตลอด
    var missing = p.mhp - p.hp;
    var hpVal = style === 'hoard' ? 0 : missing * HP_GOLD * Math.min(1, left * 2.5) * (p.hp < p.mhp * 0.5 ? 1.3 : 1);
    var restEV = -Math.min(p.gold, info.fee) + hpVal;
    var margin = 0;
    if (style === 'meek') margin = info.fee * 0.8 + 10; // ต้องคุ้มกว่าพักชัด ๆ ถึงยอมเสี่ยง
    else if (style === 'bold' || style === 'always' || style === 'brute') margin = -info.fee * 0.4;
    return robEV > restEV + margin ? { type: 'rob' } : { type: 'rest' };
  }

  // คอมใช้ของช่วยรบระหว่างสู้ (คืน null = ไม่ใช้)
  function cpuFightItem(p, b, style) {
    var tough = b.town >= 0 || b.hp >= 30;
    // โล่ไม้: โดนตีแรงครั้งเดียวอาจล้ม
    if (p.buckler > 0 && !b.block && p.hp <= b.atk * 1.7 && b.hp > BOMB_DMG) return 'buckler';
    // น้ำมันดาบ: ศัตรูอึด ทาตั้งแต่ต้น
    if (p.oil > 0 && !b.oil && (tough || style === 'brute') && b.hp > b.mhp * 0.5) return 'oil';
    // คัมภีร์: ศัตรูแกร่ง (ผู้เฝ้า/หัวหน้า) หรือเลือดเราน้อย และศัตรูไม่ได้เดาใจยาก... ใช้ได้ทุกแบบ
    if (p.scroll > 0 && !b.peek && style !== 'brute' && (b.town >= 0 || p.hp <= p.mhp * 0.5) && b.hp > BOMB_DMG) return 'scroll';
    return null;
  }

  function reserve(s, pi) {
    // เงินกันไว้จ่ายค่าผ่านทางแพงสุดที่อาจเจอ
    var worst = 0;
    s.towns.forEach(function (t) {
      if (t.owner >= 0 && t.owner !== pi) worst = Math.max(worst, tollFor(s, t, pi));
    });
    return Math.max(40, Math.round(worst * 1.1));
  }

  function counterOf(bias) {
    var best = 0;
    for (var i = 1; i < 3; i++) if (bias[i] > bias[best]) best = i;
    return BEATS[MOVES[best]];
  }

  // ค่าผ่านทางรวมของเมืองคนอื่นในช่วงระยะ lo..hi ช่องข้างหน้า
  function dangerAhead(s, pi, lo, hi) {
    var p = s.players[pi];
    var size = s.board.length;
    var sum = 0;
    for (var d = lo; d <= hi; d++) {
      var sp = s.board[(p.pos + d) % size];
      if (sp.t === 'town') {
        var t = s.towns[sp.town];
        if (t.owner >= 0 && t.owner !== pi) sum += tollFor(s, t, pi);
      }
    }
    return sum;
  }

  // คอมเลือกเครื่องรางตามสถานการณ์ (นิสัย 'c-<id>' = บังคับเลือกชิ้นนั้น ใช้ในผลจำลอง)
  function pickCharm(s, pi) {
    var p = s.players[pi];
    var style = p.style;
    if (style.indexOf('c-') === 0) {
      for (var i = 0; i < CHARMS.length; i++) if ('c-' + CHARMS[i].id === style) return i;
    }
    var frac = progress(s);
    var others = 0;
    s.towns.forEach(function (t) {
      if (t.owner >= 0 && t.owner !== pi) others++;
    });
    if (style === 'bold' || style === 'always' || style === 'brute') return 1;
    if (frac < 0.25 && p.lv <= 2) return 2;
    if (others >= 3) return 3;
    return 0;
  }

  function cpuAct(s) {
    var di = decider(s);
    if (di < 0) return null;
    var p = s.players[di];
    var style = p.style;
    switch (s.phase) {
      case 'roll':
        if (p.hp < p.mhp * 0.45 && p.potion > 0) return { type: 'use', item: 'potion' };
        // รองเท้า: ข้างหน้าใกล้ ๆ มีเมืองคนอื่นค่าผ่านทางแพง แต่ไกลออกไปปลอดภัยกว่า → ทอย 2 ลูกข้ามไป
        if (p.boots > 0 && !p.fast) {
          var near = dangerAhead(s, di, 1, 6) / 6;
          var far = dangerAhead(s, di, 2, 12) / 11;
          if (near > 12 && near > far * 1.3) return { type: 'use', item: 'boots' };
        }
        return { type: 'roll' };
      case 'decide': {
        var k = s.pending.kind;
        if (k === 'duel-offer') {
          if (style === 'meek') return { type: 'skip' };
          var best = -1;
          s.pending.targets.forEach(function (t) {
            var q = s.players[t];
            var mine = atkOf(p) + defOf(p);
            var theirs = atkOf(q) + defOf(q);
            if (q.gold >= 60 && mine >= theirs - 1 && (best < 0 || q.gold > s.players[best].gold)) best = t;
          });
          return best >= 0 ? { type: 'duel', target: best } : { type: 'skip' };
        }
        if (k === 'town') {
          var foe = guardFoe(s, s.pending.town, 1);
          var need = style === 'always' ? 0 : style === 'bold' ? 0.2 : style === 'meek' ? 0.9 : 0.35;
          if (p.gold < claimFee(s.towns[s.pending.town].i)) return { type: 'skip' };
          return edge(p, foe) >= need ? { type: 'fight' } : { type: 'skip' };
        }
        if (k === 'invest') {
          if (style === 'hoard') return { type: 'invest', levels: 0 };
          // ขยายเมือง = ต้องสู้หัวหน้าผู้เฝ้า: เลือกเมืองที่ค่าผ่านทางเพิ่มมากสุดต่อเงินที่ลง
          // จากเมืองที่ (1) มีเงินพอหลังกันเงินสำรอง (2) โอกาสชนะพอสมควร
          var needUp = style === 'always' ? 0.2 : style === 'bold' || style === 'tycoon' ? 0.3 : style === 'meek' ? 0.9 : UP_NEED;
          var spare = style === 'tycoon' ? p.gold - 20 : p.gold - reserve(s, di) - (style === 'bold' ? 0 : 30);
          var bestT = -1;
          var bestGain = 0;
          s.pending.towns.forEach(function (ti) {
            var tt = s.towns[ti];
            if (tt.level >= MAX_TOWN_LEVEL || investCost(tt) > spare) return;
            if (edge(p, upgradeFoe(s, ti)) < needUp) return;
            var now = toll(tt);
            tt.level += 1;
            var gain = (toll(tt) - now) / investCost(tt);
            tt.level -= 1;
            if (gain > bestGain) {
              bestGain = gain;
              bestT = ti;
            }
          });
          if (bestT < 0) return { type: 'invest', levels: 0 };
          return { type: 'invest', town: bestT, levels: 1 };
        }
        if (k === 'visit') return cpuVisit(s, di);
        if (k === 'shop') return cpuShop(s, di);
        if (k === 'boss') return cpuBoss(s, di);
        return null;
      }
      case 'battle': {
        var b = s.battle;
        if (p.bomb > 0 && (b.hp <= BOMB_DMG || b.boss)) return { type: 'use', item: 'bomb' }; // บอส: ระเบิดทุกลูก (แรงฟรี ไม่โดนสวน)
        if (p.hp <= p.mhp * 0.3) {
          if (p.potion > 0) return { type: 'use', item: 'potion' };
          if (p.bomb > 0 && b.hp <= BOMB_DMG * 2) return { type: 'use', item: 'bomb' };
          if (p.smoke > 0 && b.hp > b.mhp * 0.4) return { type: 'use', item: 'smoke' };
        }
        var fi = cpuFightItem(p, b, style);
        if (fi) return { type: 'use', item: fi };
        if (b.peek) return { type: 'move', m: BEATS[b.peek] }; // รู้ท่าแล้ว = ออกท่าที่ชนะ
        if (style === 'brute') return { type: 'move', m: 'H' };
        if (rnd(s) < 0.6) return { type: 'move', m: counterOf(b.bias) };
        return { type: 'move', m: MOVES[rint(s, 0, 2)] };
      }
      case 'duel': {
        var plan = [];
        for (var j = 0; j < 3; j++) plan.push(style === 'brute' ? 'H' : MOVES[rint(s, 0, 2)]);
        // ของช่วยรบ: ใช้เมื่อเดิมพันคุ้ม (อีกฝ่าย/ตัวเองมีเงินมาก)
        var dd = s.duel;
        var foeP = s.players[di === dd.a ? dd.b : dd.a];
        var stake = Math.max(foeP.gold, p.gold) * DUEL_TAKE;
        var its = [];
        if (p.oil > 0 && stake >= 40) its.push('oil');
        if (p.buckler > 0 && stake >= 60) its.push('buckler');
        return its.length ? { type: 'plan', moves: plan, items: its } : { type: 'plan', moves: plan };
      }
    }
    return null;
  }

  /* คอมประเมินโอกาสชนะบอส: จำลองการต่อสู้จริงด้วยตรรกะคอมตัวเดียวกันบนสำเนาสถานะ BOSS_SIMS ครั้ง
   * (seed ของสำเนาคิดจาก seed เกม — ไม่แตะ s.seed ของเกมจริง ผลจึงยังเล่นซ้ำได้เหมือนเดิม) · ใช้พลังชีวิต/ของในกระเป๋าตอนนี้ */
  var BOSS_SIMS = 24;
  function bossOdds(s, pi) {
    if (!s.pending || s.pending.kind !== 'boss' || s.turn !== pi) return 0;
    var base = JSON.stringify(s);
    var wins = 0;
    for (var i = 0; i < BOSS_SIMS; i++) {
      var c = JSON.parse(base);
      c.seed = (s.seed ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0;
      act(c, { type: 'fight' });
      for (var g = 0; g < 80 && c.phase === 'battle'; g++) act(c, cpuAct(c));
      if (c.phase === 'over' && c.result && c.result.slayer === pi) wins++;
    }
    return wins / BOSS_SIMS;
  }

  // คอมเลือกสู้บอส: ชนะ = ชนะทั้งเกม · แพ้ = โทษแพ้ปกติ → ยอมเสี่ยงเมื่อโอกาสถึงเกณฑ์ตามนิสัย
  // BOSS_TUNE.need = เกณฑ์โอกาสชนะที่คอมนิสัยปกติยอมสู้บอส (อยู่ใน BOSS_TUNE ให้ผลจำลองลองค่าอื่นได้)
  function cpuBoss(s, di) {
    var style = s.players[di].style;
    var need = style === 'always' ? 0.05 : style === 'bold' || style === 'brute' ? 0.15 : style === 'meek' ? 0.4 : BOSS_TUNE.need;
    return bossOdds(s, di) >= need ? { type: 'fight' } : { type: 'skip' };
  }

  // ร้านค้าของคอม: ยา → อาวุธ/เกราะ (ถูกกว่าก่อน · ไม่ซื้อตอนท้ายเกม) → เครื่องราง → ของใช้อื่น
  // นิสัยในผลจำลอง: 'hoard' ไม่ซื้ออุปกรณ์ · 'geared' ทุ่มซื้ออุปกรณ์ทุกครั้งที่มีเงิน · 'nogear' ซื้อแค่ของใช้
  function cpuShop(s, di) {
    var p = s.players[di];
    var style = p.style;
    var list = shopList(p);
    var keep = reserve(s, di);
    var frac = progress(s);
    function get(id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id && list[i].ok) return list[i];
      return null;
    }
    function buyIf(id, cushion) {
      var it = get(id);
      return it && p.gold - it.price >= cushion ? { type: 'buy', item: id } : null;
    }
    var a = p.potion < 2 ? buyIf('potion', keep * 0.5) : null;
    if (a) return a;
    // v10 โหมดไม่จำกัดรอบ: บอสใกล้มา/ออกแล้ว (มีคนถึง Lv 5 ขึ้นไป) = ล่าบอส → เตรียมของช่วยรบ + ระเบิดก่อน แล้วทุ่มอุปกรณ์มากขึ้น
    var hunt = !!s.endless && (s.boss && s.boss.stage !== 'wait' ? true : p.lv >= BOSS_LV - 1);
    if (hunt && style !== 'hoard') {
      var kit = ['oil', 'scroll', 'buckler', 'bomb'];
      for (var ki = 0; ki < kit.length; ki++) if (!(p[kit[ki]] > 0) && (a = buyIf(kit[ki], keep * 0.5))) return a;
    }
    if (style === 'hoard') return { type: 'leave' };
    // นิสัยในผลจำลอง 'c-<id>': ซื้อเครื่องรางชิ้นนั้นก่อนอย่างอื่น (วัดว่าเครื่องรางชิ้นไหนแรงเกินไหม)
    if (style.indexOf('c-') === 0 && p.ch < 0 && (a = buyIf('ch' + pickCharm(s, di), keep * 0.5))) return a;
    if (style !== 'nogear') {
      var geared = style === 'geared';
      // โหมดไม่จำกัดรอบ: ไม่มี "ท้ายเกม" ให้หยุดซื้ออุปกรณ์ (ต้องแกร่งพอสู้บอส)
      if (geared || frac < 0.55 || s.endless) {
        var gear = [get('w'), get('ar')].filter(Boolean).sort(function (x, y) {
          return x.price - y.price;
        });
        for (var g = 0; g < gear.length; g++) {
          if (p.gold - gear[g].price >= (geared || hunt ? keep * 0.5 : keep + 40)) return { type: 'buy', item: gear[g].id };
        }
      }
      if (p.ch < 0 && (geared || frac < 0.6 || s.endless)) {
        a = buyIf('ch' + pickCharm(s, di), keep + 30);
        if (a) return a;
      }
    }
    if (p.bomb < 1 && (a = buyIf('bomb', keep + 20))) return a;
    // ของช่วยรบ (v9): แต่ละนิสัยชอบคนละชิ้น · ช่วงท้ายเกมไม่ซื้อ (สู้น้อยลงแล้ว · โหมดไม่จำกัดรอบซื้อตลอด)
    if (frac < 0.8 || s.endless) {
      var fav = style === 'brute' || style === 'bold' ? 'oil' : style === 'meek' ? 'buckler' : 'scroll';
      if (!(p[fav] > 0) && (a = buyIf(fav, keep + 30))) return a;
      if (p.buckler < 1 && (a = buyIf('buckler', keep + 70))) return a;
    }
    if (p.ward < 1 && (a = buyIf('ward', keep + 40))) return a;
    if (p.boots < 1 && (a = buyIf('boots', keep + 60))) return a;
    return { type: 'leave' };
  }

  /* ---------- เล่นทั้งเกมด้วยคอม (ใช้ในเทส/จำลอง) ---------- */
  function autoplay(s, maxSteps) {
    var steps = 0;
    var limit = maxSteps || 20000;
    while (s.phase !== 'over' && steps < limit) {
      var a = cpuAct(s);
      var r = act(s, a);
      if (!r) throw new Error('คอมเลือกการกระทำที่ใช้ไม่ได้: ' + JSON.stringify(a) + ' ช่วง ' + s.phase);
      steps++;
    }
    return steps;
  }

  return {
    VERSION: VERSION,
    LENGTHS: LENGTHS,
    LENGTH_IDS: LENGTH_IDS,
    ENDLESS: ENDLESS,
    ENDLESS_REF: ENDLESS_REF,
    BOSS: BOSS,
    BOSS_LV: BOSS_LV,
    BOSS_CARD: BOSS_CARD,
    BOSS_TUNE: BOSS_TUNE,
    progress: progress,
    bossHere: bossHere,
    bossFoe: bossFoe,
    bossOdds: bossOdds,
    SIZE: SIZE,
    MAPS: MAPS,
    MAP_IDS: MAP_IDS,
    MOVES: MOVES,
    MOVE_NAME: MOVE_NAME,
    TABLE: TABLE,
    BEATS: BEATS,
    MONSTERS: MONSTERS,
    BIAS_TEXT: BIAS_TEXT,
    TOWNS: TOWNS,
    LAYOUT: LAYOUT,
    SPACE_NAME: SPACE_NAME,
    WEAPONS: WEAPONS,
    ARMORS: ARMORS,
    CHARMS: CHARMS,
    ITEMS: ITEMS,
    ITEM_IDS: ITEM_IDS,
    FIGHT_ITEMS: FIGHT_ITEMS,
    OIL_ATK: OIL_ATK,
    ROB_WIN: ROB_WIN,
    ROB_LOSE: ROB_LOSE,
    ROB_BONUS: ROB_BONUS,
    robBonus: robBonus,
    robChance: robChance,
    visitInfo: visitInfo,
    CARDS: CARDS,
    CARD_CAP: CARD_CAP,
    CHEST_W: CHEST_W,
    MAX_TOWN_LEVEL: MAX_TOWN_LEVEL,
    MAX_EXCHANGES: MAX_EXCHANGES,
    START_GOLD: START_GOLD,
    SALARY: SALARY,
    DUEL_TAKE: DUEL_TAKE,
    LOSE_GOLD: LOSE_GOLD,
    BOMB_DMG: BOMB_DMG,
    FEST_MULT: FEST_MULT,
    newGame: newGame,
    migrate: migrate,
    mapOf: mapOf,
    townDef: townDef,
    decider: decider,
    act: act,
    cpuAct: cpuAct,
    autoplay: autoplay,
    atkOf: atkOf,
    defOf: defOf,
    charmOf: charmOf,
    hasCharm: hasCharm,
    xpNeed: xpNeed,
    townValue: townValue,
    investCost: investCost,
    claimFee: claimFee,
    toll: toll,
    tollFor: tollFor,
    townsOf: townsOf,
    assets: assets,
    gearValue: gearValue,
    isLast: isLast,
    GEAR_RATE: GEAR_RATE,
    total: total,
    standings: standings,
    shopList: shopList,
    monsterById: monsterById,
    cardById: cardById,
    counterOf: counterOf,
    edge: edge,
    guardFoe: guardFoe,
    upgradeFoe: upgradeFoe,
    UP_GROW: UP_GROW
  };
});
