# Image prompts (ทางเลือก — ไม่จำเป็นต้องทำ)

ตอนนี้ **ไม่มีภาพไหนเป็นตัวแทนชั่วคราว** ทุกภาพในแอปวาดด้วยโค้ดแล้วใช้งานได้ครบ:
ไอคอนแอป (หน้าต่างเครื่องบิน + 4 ช่อง) · ไอคอนเล็กของแต่ละเกมในหน้าแรก · ลายหลังไพ่ (ลายทางแนวทแยง) · หน้าไพ่ (ดอกวาดด้วย SVG)

ถ้าอยากได้ภาพที่สวยขึ้น ให้เอา prompt ด้านล่างไปทำใน ChatGPT แล้วส่งไฟล์กลับมา เดี๋ยวจะตัดแล้วใส่ให้

**สไตล์ที่ต้องใช้ให้เหมือนกันทุกภาพ:** flat vector illustration, calm "night flight cabin" mood, deep navy background `#0F1622`, warm off-white `#EEE9DF`, reading-light amber accent `#E8B25A`, soft sage green `#8CC9A0` used sparingly, rounded geometric shapes, no gradients or only very subtle ones, no text, no letters, no logos, no photorealism.

---

## 1. App icon (ไอคอนแอป)

- **ขนาด:** 1:1 · 1024 × 1024 px (เดี๋ยวย่อเป็น 512 / 192 เอง)
- **พื้นหลัง:** navy สีเดียวเต็มภาพ `#0F1622` (ห้ามโปร่งใส ห้ามมีขอบมน — Android ตัดขอบเอง)
- **Prompt:**
  > A flat vector app icon on a solid deep navy (#0F1622) square background, no rounded corners. Centered: a single airplane cabin window (tall rounded oval with a thick warm off-white #EEE9DF frame). Inside the window, instead of sky, a tiny 2×2 grid of rounded game tiles, three off-white and one glowing reading-light amber (#E8B25A). Keep all artwork inside the central 60% of the canvas (safe zone for maskable icons). Minimal, bold, readable at 48 px. No text, no letters, no shadows beyond one subtle soft shadow.

## 2. Header art หน้าแรก (ภาพแถบบน — ยังไม่มีช่องวาง ถ้าได้ภาพมาจะเพิ่มให้)

- **ขนาด:** 3:1 · 1500 × 500 px
- **พื้นหลัง:** navy สีเดียว `#0F1622` (ให้กลืนกับพื้นแอป)
- **Prompt:**
  > Wide flat vector banner, 3:1, solid deep navy background (#0F1622). A calm night-flight scene seen through a row of three airplane cabin windows, a crescent moon and a few stars outside, a small warm amber (#E8B25A) reading light glowing from the top. Off-white (#EEE9DF) window frames, a hint of sage green (#8CC9A0). Keep the left 40% mostly empty and dark so Thai title text can sit on top. Quiet, cozy, minimal. No text, no people, no logos.

## 3. ลายหลังไพ่ (โซลิแทร์)

- **ขนาด:** 5:7 · 500 × 700 px (ภาพเดียว)
- **พื้นหลัง:** ขอบนอกสีขาวนวล `#F3EFE7` กว้างเท่ากันรอบด้าน ~6% (ให้ตัดง่าย)
- **Prompt:**
  > A single playing-card back design, exact 5:7 portrait ratio, flat vector. Even off-white (#F3EFE7) border of about 6% on all sides. Inside: a deep indigo-blue (#3B5B8C) field with a small repeating geometric pattern of tiny airplanes and stars in a slightly lighter blue (#4E6FA3), perfectly symmetric top-to-bottom so it looks the same when rotated 180°. A small amber (#E8B25A) circle emblem in the exact center. Clean, crisp edges, no texture, no text, no shadow, no card corners drawn outside the rectangle.

## 4. ภาพปกเกมเล็ก ๆ (ทางเลือก — แทนไอคอนเส้นในหน้าแรก)

- **ขนาด:** ชีตเดียว 5 ภาพเรียงแนวนอน · 5:1 · 2500 × 500 px (แต่ละช่อง 500 × 500 px จัดตารางเท่ากันเป๊ะ ห่างกันเท่ากัน)
- **พื้นหลัง:** navy สีเดียว `#0F1622` ทั้งชีต (ตัดเป็นสี่เหลี่ยมง่าย)
- **Prompt:**
  > A horizontal sprite sheet, exact 5:1 ratio, 5 equal square cells in a single row with identical spacing and a solid deep navy (#0F1622) background everywhere. Each cell contains one centered flat vector game emblem in the same style, same stroke weight, same scale, with generous padding: (1) four rounded number tiles in a 2×2 grid, one amber; (2) a 3×3 sudoku grid with one highlighted cell; (3) a round mine with short spikes and a small amber flag beside it; (4) two overlapping playing cards with a small amber heart; (5) a friendly minimalist snake made of rounded squares chasing an amber dot. Palette only: off-white #EEE9DF, amber #E8B25A, sage green #8CC9A0 on navy. No text, no numbers, no letters, no borders between cells.
