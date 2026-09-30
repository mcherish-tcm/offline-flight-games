/*
 * ปุ่ม "ส่งลิงก์ให้เพื่อน" (หน้าแรก) — ติดตั้งแอปลงหน้าจอแล้วไม่มีแถบที่อยู่ให้คัดลอกลิงก์ จึงมีปุ่มนี้
 * ลิงก์ตายตัว (ไม่ใช้ location.href) เพื่อให้ได้ลิงก์หน้าแรกของเว็บเสมอ ไม่ว่าจะเปิดจากหน้าไหน/แบบแอปหรือเบราว์เซอร์
 *
 * FG_shareLink(nav?) → Promise ที่ไม่มีวัน reject ได้ผลเป็น:
 *   'shared'    — เปิดหน้าต่างแชร์ของเครื่องแล้ว (navigator.share)
 *   'cancelled' — ผู้ใช้ปิดหน้าต่างแชร์เอง (ไม่ต้องทำอะไรต่อ)
 *   'copied'    — ไม่มีหน้าต่างแชร์ → คัดลอกลงคลิปบอร์ดแล้ว (ให้ขึ้น "คัดลอกลิงก์แล้ว")
 *   'box'       — ทำทั้งสองอย่างไม่ได้ → ให้แสดงลิงก์ในช่องที่เลือกคัดลอกเองได้
 * ไม่ใช้เน็ต ไม่ throw แม้ออฟไลน์ · nav ใส่ของปลอมได้ (ใช้ในเทส)
 */
(function (g) {
  'use strict';

  var LINK = 'https://mcherish-tcm.github.io/offline-flight-games/';
  var TITLE = 'เกมบนเครื่องบิน';
  var TEXT = 'เกมเล่นได้โดยไม่ต้องใช้เน็ต — เปิดลิงก์นี้ตอนมีเน็ตครั้งแรก แล้วเล่นบนเครื่องบินได้เลย';

  function shareLink(nav) {
    if (nav === undefined) nav = typeof navigator !== 'undefined' ? navigator : null;

    function copy() {
      try {
        if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
          return Promise.resolve(nav.clipboard.writeText(LINK)).then(
            function () {
              return 'copied';
            },
            function () {
              return 'box';
            }
          );
        }
      } catch (e) {
        /* ตกไปแสดงช่องลิงก์ */
      }
      return Promise.resolve('box');
    }

    try {
      if (nav && typeof nav.share === 'function') {
        return Promise.resolve(nav.share({ title: TITLE, text: TEXT, url: LINK })).then(
          function () {
            return 'shared';
          },
          function (err) {
            return err && err.name === 'AbortError' ? 'cancelled' : copy();
          }
        );
      }
    } catch (e) {
      /* share โยน error ทันที (บางเบราว์เซอร์) → ลองคัดลอกแทน */
    }
    return copy();
  }

  g.FG_SHARE_URL = LINK;
  g.FG_shareLink = shareLink;
})(typeof self !== 'undefined' ? self : this);
