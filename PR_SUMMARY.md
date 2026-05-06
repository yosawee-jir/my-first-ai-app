
# PR Summary Log

---

## [2026-05-06] Fix: Excel Serial Date ยังคงปรากฏใน Bulk Update — แปลงตั้งแต่ mapRow

### สิ่งที่ทำ
- ย้ายการแปลง Excel Serial → ISO string จาก `parseDateMMDDYYYY` มาทำใน `mapRow` โดยตรง
- `mapped[dateField]` จะเป็น ISO string (`"2025-09-24"`) แทนที่จะเป็น number (`45925.00005`) เสมอ
- ตัดปัญหาที่ number serial อาจหลุดเข้าไปใน `payload` หรือ `FormData` โดยไม่ถูกแปลง

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetTable.jsx` — `mapRow`: เพิ่ม branch `typeof cell === 'number' && DATE_FIELDS.has(key)` ให้เรียก `excelSerialToISO(cell)` ทันที แทนที่จะเก็บ number ไว้

### พฤติกรรมที่เปลี่ยนไปของระบบ
- **ก่อนแก้ไข**: `mapped.purchase_date` = `45925.00005` (number) → ส่งผ่านไปยัง `payload` → หากมี edge case ใดทำให้ parsing block ไม่ทำงาน serial number จะถูกส่งไปยัง backend ตรงๆ → Error log แสดง `45925.00005` ในคอลัมน์วันที่
- **หลังแก้ไข**: `mapped.purchase_date` = `"2025-09-24"` (ISO string) ทันทีใน `mapRow` → `parseDateMMDDYYYY("2025-09-24")` ผ่าน ISO regex → คืนค่าเดิม → ไม่มี number หลุดเข้า payload เลย

### ความเสี่ยง / หมายเหตุ
- หาก `excelSerialToISO` ล้มเหลว (serial ผิดปกติ) จะ fallback เป็น `String(cell)` เช่น `"45925.00005"` ซึ่ง numeric-string regex จะยังพยายามแปลงอีกครั้ง
- Build: ✅ 481 modules, no errors

---

## [2026-05-06] Fix: Bulk Update ไม่พบ Asset Code เนื่องจาก State เก่า

### สิ่งที่ทำ
- แก้ไข `handleImportUpdate` ให้เรียก `getEquipment()` โดยตรงแทนการใช้ `assets` state เพื่อ build `assetByCode` lookup

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetTable.jsx` — `handleImportUpdate`

### พฤติกรรมที่เปลี่ยนไปของระบบ
- **ก่อนแก้ไข**: หากผู้ใช้คลิก "Bulk Update" ทันทีหลังจาก "Import New" ยังไม่ทันที่ `load()` (async) จะ refresh `assets` state สำเร็จ — `assetByCode` จะว่างเปล่าหรือไม่มี asset ที่เพิ่งสร้าง ทำให้ทุก row ล้มเหลวด้วย `"Asset Code not found"`
- **หลังแก้ไข**: `handleImportUpdate` ดึงข้อมูล asset ล่าสุดจาก API โดยตรง (`await getEquipment()`) ก่อนสร้าง lookup map ทุกครั้ง ทำให้ได้ข้อมูลที่ตรงกับ DB เสมอ แม้ state จะยังไม่ refresh

### ความเสี่ยง / หมายเหตุ
- เพิ่ม 1 API call (GET /api/equipment) ต่อการ Bulk Update 1 ครั้ง — ผลกระทบต่อ performance น้อยมาก
- Build: ✅ 481 modules, no errors

---

## [2026-05-04] Fix: รองรับ Excel Serial Date ใน CSV Import

### สิ่งที่ทำ
- เพิ่ม `DATE_FIELDS` set เพื่อระบุฟิลด์ที่เป็นวันที่ (`purchase_date`, `warranty_expiry_date`)
- เพิ่ม `fmtDateVal(v)` helper สำหรับแสดงค่าวันที่ใน Error Log อย่างอ่านง่าย (`number → integer string`)
- แทนที่ `excelSerialToMMDDYYYY` ด้วย `excelSerialToISO` ที่ return format `yyyy-mm-dd` โดยตรง
- อัปเดต `parseDateMMDDYYYY` ให้ตรวจ `typeof val === 'number'` ก่อนเป็นอันดับแรก เพื่อแปลง Excel serial number ได้ถูกต้องก่อนที่จะแปลงเป็น string
- อัปเดต `mapRow` ให้เก็บค่า numeric type ไว้สำหรับฟิลด์ใน `DATE_FIELDS` แทนที่จะแปลงเป็น string ก่อน
- อัปเดต error message ใน `handleImportNew` และ `handleImportUpdate` ให้ใช้ `fmtDateVal()` แสดงเลข serial เป็น integer เช่น `Invalid Date Format: '45925' in Purchase Date`

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetTable.jsx`

### พฤติกรรมที่เปลี่ยนไปของระบบ
- Excel ไฟล์ที่มี date cell ถูก format เป็น Date column (ไม่ใช่ Text) จะถูกอ่านเป็น numeric serial เช่น `45925.0000462963` และแปลงเป็นวันที่ถูกต้องโดยอัตโนมัติ
- ไม่ต้อง format column เป็น Text ใน Excel ก่อน import อีกต่อไป
- Error Log แสดงเลข serial เป็น integer ที่อ่านง่าย เช่น `Invalid Date Format: '45925' in Purchase Date (Expected mm/dd/yyyy)`
- `parseDateMMDDYYYY` รองรับ 4 รูปแบบ: numeric type, numeric string, `mm/dd/yyyy`, ISO `yyyy-mm-dd`, และ month-name string

### ความเสี่ยง / หมายเหตุ
- `Math.floor()` ตัด decimal ออก (ส่วนของเวลา) จึงใช้เฉพาะวันที่เท่านั้น — เป็น behavior ที่ต้องการ
- Build: ✅ 481 modules, no errors

---

## เพิ่มความแข็งแกร่งของระบบ CSV Import — ปิด Auto-Conversion, Force String, Whitespace Trim และ Month-Name Date Parser

### สิ่งที่ทำ
แก้ปัญหาสำคัญที่ทำให้การ import ล้มเหลวจากการที่ parser แปลงค่าโดยอัตโนมัติ และเพิ่ม robustness ให้กับการ parse วันที่และการ lookup Asset Code

#### 1. ปิด Auto Date Conversion
- เปลี่ยน `XLSX.read` จาก `cellDates: true` → `cellDates: false`
- ผลลัพธ์: date-formatted cells ใน Excel ไม่ถูกแปลงเป็น JS Date object อีกต่อไป → ได้รับเป็น Excel serial number (ตัวเลข) แทน ซึ่ง parser จัดการได้อย่างถูกต้อง

#### 2. Force String — ทุก cell เป็น string ก่อน
- `mapRow()` ถูก refactor:
  - `raw[h]` = `String(cell)` ไม่ trim — เก็บค่า **ต้นฉบับ** เพื่อแสดงใน error log CSV
  - `mapped[key]` = `String(cell).trim()` — ค่าที่ผ่าน trim แล้วสำหรับ validation และ processing
  - ลบ `DATE_FIELDS` special case ออกทั้งหมด (ทุก field เป็น string เหมือนกัน)

#### 3. Whitespace Sanitization ครบถ้วน
- ทุก cell ถูก `trim()` ก่อน validation — ขจัด space นำหน้า/ท้ายและ hidden characters
- Cell ที่กลายเป็นว่างหลัง trim → ถูกถือเป็น "ไม่มีค่า" (Partial Update: ไม่เขียนทับข้อมูลเดิม)
- Asset Code lookup: map ใน DB ใช้ `.trim().toLowerCase()`, lookup key ใช้ `.toLowerCase()` บนค่าที่ trim แล้ว → case-insensitive และ whitespace-insensitive

#### 4. Month-Name Date Parser
- `parseDateMMDDYYYY()` ได้รับ refactor ครบ:
  - ลบ `instanceof Date` branch (ไม่มี Date object แล้ว)
  - เพิ่ม: ISO format `yyyy-mm-dd` — pass through ตรง
  - เพิ่ม: Month-name pattern เช่น `"Thu Sep 25 2025 00:00:00 GMT+0700 (Indochina Time)"` → extract `Sep 25 2025` → `2025-09-25` โดยใช้ regex `\b([A-Za-z]{3,9})\s+(\d{1,2})[,\s]+(\d{4})`
  - คง: Excel serial number และ m/d/yyyy / mm/dd/yyyy

#### 5. Error Messages ที่ชัดเจนขึ้น
- Date error: `Invalid Date Format: '9/32/2025' in Purchase Date (Expected mm/dd/yyyy)`
- Not found: `Asset Code "IT-001" not found (Check for hidden spaces or wrong code)`
- Error log CSV แสดงค่าต้นฉบับ (untrimmed) จาก `raw` object ทุก column

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetTable.jsx`
  - `parseDateMMDDYYYY()` — ใหม่ทั้งหมด
  - `parseCSVFile()` — `cellDates: false`
  - `mapRow()` — raw=untrimmed, mapped=trimmed, ลบ DATE_FIELDS
  - `handleImportUpdate` payload builder — simplify เป็น `if (v !== '') payload[k] = v`
  - Date error messages — ทั้ง handleImportNew และ handleImportUpdate

### พฤติกรรมที่เปลี่ยนไปของระบบ
- ไม่มี "Thu Sep 25 2025..." เกิดขึ้นอีก — ทุก date cell ถูกอ่านเป็น string/number
- ช่องว่างนำหน้า/ท้ายใน Asset Code และฟิลด์อื่น ไม่ทำให้ lookup ล้มเหลวอีก
- Error log CSV แสดงค่าดิบจากไฟล์ต้นฉบับ (ไม่ผ่าน transform) เพื่อให้แก้ไขและ re-upload ได้ทันที

### ความเสี่ยง / หมายเหตุ
- Month-name regex: ถ้า cell มีข้อความเหมือนชื่อเดือน (เช่น "March" เป็นชื่อสถานที่) อาจ parse ผิด — risk ต่ำมากในบริบท asset management
- Build: ✅ 481 modules, no errors

---

## ปรับปรุง Error Log ให้แสดงเหตุผลที่ชัดเจนและรวบรวมหลาย error ต่อแถว

### สิ่งที่ทำ
ปรับปรุงระบบ CSV Import ให้เก็บ error ทุกรายการต่อแถวแทนที่จะหยุดที่ error แรก และเพิ่มข้อความแจ้งเตือนที่ระบุชื่อฟิลด์และค่าที่มีปัญหาอย่างชัดเจน

#### การเปลี่ยนแปลงหลัก

1. **Multi-error Collection** — แทนที่จะหยุดที่ error แรก ระบบจะตรวจสอบทุก validation rule ก่อน จากนั้นรวม error ทั้งหมดเป็นข้อความเดียวคั่นด้วย `; `

2. **ข้อความแสดงผลที่ชัดเจน**:
   - Mandatory: `Required field "Purchase Date" is missing`
   - Enum: `Stock Status must be 'Available' or 'Checked Out' (got: 'xyz')`
   - Enum: `Condition must be one of: Ready, Broken, Under Repair, Retired (got: 'abc')`
   - Date: `Invalid Purchase Date '13/40/2024' — expected mm/dd/yyyy format`
   - Date: `Invalid Warranty Expiry Date '...' — expected mm/dd/yyyy format`
   - Duplicate: `Duplicate Asset Code: IT-001`
   - Not found: `Asset Code "IT-999" not found in system`
   - Assignment: `Staff Name is required when Stock Status is Checked Out`

3. **Enum Validation บน Frontend** — ตรวจสอบ Stock Status และ Condition ก่อนส่ง backend (ลด round trip)

4. **Backend Errors array** — รองรับ `err.response.data.errors[]` (array) join ด้วย `; ` แทนใช้เฉพาะ `.error`

5. **Preserve Original Row** — `downloadErrorLogCSV` เก็บ column ทั้งหมดจากไฟล์ต้นฉบับ (ไม่มีการเปลี่ยนแปลง แต่ยืนยันว่าทำงานถูกต้อง)

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetTable.jsx`
  - `handleImportNew`: refactor loop ให้ใช้ `rowErrors[]` array + apply parsed dates หลัง validation pass
  - `handleImportUpdate`: refactor loop เช่นเดียวกัน + ตรวจสอบ effectiveStock/effectiveUser สำหรับ Checked Out

### พฤติกรรมที่เปลี่ยนไปของระบบ
- Error Log CSV แสดงเหตุผลครบทุกปัญหาในแถวเดียว แทนที่จะแสดงเพียงปัญหาแรก
- UI popup แสดง error message ที่อ่านเข้าใจได้ เช่น `IT-001: Required field "Serial Number" is missing; Duplicate Asset Code: IT-001`
- ผู้ใช้สามารถ download error log, แก้ไขข้อมูลในไฟล์ต้นฉบับ แล้ว re-upload ได้ทันที

### ความเสี่ยง / หมายเหตุ
- ไม่กระทบ logic การ import ที่สำเร็จ — row ที่ผ่านทุก validation จะส่งไปยัง backend ตามปกติ
- Build: ✅ 481 modules, no errors

---

## ระบบ CSV Import แบบคู่: Import New Assets + Bulk Update Assets พร้อม User Assignment และ Multi-disk Storage

### สิ่งที่ทำ
ยกระดับระบบ CSV Import จากปุ่มเดียวเป็นสองโหมดแยกกัน พร้อมรองรับการ assign ผู้ใช้งานและการ parse ข้อมูล Storage จาก comma-separated string

#### 1. Dual Import System
- เพิ่มปุ่ม **⬆ Import New** สำหรับสร้าง asset ใหม่ และ **⬆ Bulk Update** สำหรับอัปเดต asset ที่มีอยู่แล้วโดยใช้ Asset Code เป็น key
- เพิ่มปุ่มดาวน์โหลด template แยกกัน: **⬇ New Template** และ **⬇ Update Template**
- Bulk Update mode: หากไม่พบ Asset Code ในระบบ → บันทึกเป็น error row
- Partial Update: ส่งเฉพาะ field ที่มีค่าใน CSV ไปยัง backend (PATCH endpoint) — field ที่ว่างไม่เขียนทับค่าเดิม

#### 2. User Assignment & Ownership Tracking
- template รองรับ columns: **Staff Name**, **Staff ID**, **Department**
- หากมี Staff Name หรือ Staff ID → Stock Status จะถูก set เป็น "Checked Out" อัตโนมัติ (ทั้งสองโหมด)
- backend PATCH endpoint สร้าง/ปิด checkout record และบันทึก history ทุกครั้งที่มีการ assign ผู้ใช้ใหม่
- Staff ID (employee code string) ถูกบันทึกลงใน `checkouts.employee_id` ทั้ง POST และ PATCH

#### 3. Multi-disk Storage (Comma-separated)
- เพิ่ม helper `parseStorageCSV()`: แปลง `"512GB SSD, 1TB HDD"` → JSON `[{size:"512GB",type:"SSD"},{size:"1TB",type:"HDD"}]`
- เพิ่ม helper `parseRAMCSV()`: แปลง `"16GB, 8GB"` → JSON `["16GB","8GB"]`
- รองรับทั้งรูปแบบ "ขนาด ชนิด" (`512GB SSD`) และ "ชนิด ขนาด" (`SSD 512GB`)

#### 4. Data Integrity
- Mandatory fields สำหรับ New mode: Asset Code, Serial Number, Asset Name, Type, Purchase Date (5 fields — ตัด Stock Status ออก เพราะ auto-derive จาก Staff)
- Update mode: ต้องการเฉพาะ Asset Code สำหรับ lookup
- Validation, date parsing, duplicate check และ error log ครบถ้วนทั้งสองโหมด

### ไฟล์ที่มีการแก้ไข
- `backend/routes/equipment.js`
  - POST: เพิ่ม `f.assigned_employee_id` ใน checkout INSERT
  - เพิ่ม `PATCH /:id` endpoint สำหรับ partial update (merge กับค่าเดิม, ตรวจสอบ enum, สร้าง/ปิด checkout, บันทึก history)
- `frontend/src/services/api.js` — เพิ่ม `updateEquipmentPartial` (PATCH)
- `frontend/src/components/AssetTable.jsx`
  - เพิ่ม `staff name`, `staff id`, `department`, `ram`, `asset type` ใน CSV_HEADER_MAP
  - แยก mandatory fields เป็น `MANDATORY_NEW_FIELDS` (5 fields)
  - เพิ่ม helpers: `parseStorageCSV`, `parseRAMCSV`, `parseCSVFile`, `mapRow`, `applyStorageAndRAM`
  - แทนที่ `downloadCSVTemplate` ด้วย `downloadNewTemplate` + `downloadUpdateTemplate`
  - แทนที่ `handleImportFile` ด้วย `handleImportNew` + `handleImportUpdate`
  - UI: 4 ปุ่ม import/template + file inputs แยกกัน + modal แสดงผลตาม mode
- `frontend/src/App.css` — เพิ่ม `.btn-export.update` style (สีส้ม)

### พฤติกรรมที่เปลี่ยนไปของระบบ
- ผู้ใช้สามารถเลือกโหมด Import ได้ชัดเจน: สร้างใหม่ หรืออัปเดต bulk
- การอัปเดตแบบ partial: field ว่างใน CSV ไม่เขียนทับข้อมูลเดิมในฐานข้อมูล
- การกำหนด Staff ผ่าน CSV สร้าง checkout record ใน ownership history อัตโนมัติ
- Storage หลาย disk สามารถนำเข้าได้ด้วย comma-separated string เดียว

### ความเสี่ยง / หมายเหตุ
- PATCH endpoint ไม่มี `requireAll` validation — ใช้ inline validation เฉพาะ enum + Checked Out rule เพื่อรองรับ partial update ได้อย่างถูกต้อง
- `parseStorageCSV` ใช้ regex ตรวจจับขนาด (GB/TB/MB/KB) — รูปแบบที่ไม่ตรง pattern จะถูก fallback เป็น `{size: original, type: "Other"}`
- Build: ✅ 481 modules, no errors

---

## แก้ไข Lifecycle Tab แสดงผลว่างเปล่า (Invalid Date จาก SQLite timestamp)

### สิ่งที่ทำ
แก้ไขปัญหา Lifecycle tab ใน Asset Detail Modal แสดงผลว่างเปล่าทั้งหน้า เนื่องจาก SQLite จัดเก็บ timestamp ในรูปแบบ `'2026-05-04 13:53:31'` (คั่นด้วย space ไม่ใช่ `T`) ซึ่งทำให้ browser บางตัว (เช่น Safari) parse เป็น `Invalid Date` และเมื่อเรียก `.toLocaleDateString()` บน Invalid Date จะ throw `RangeError: Invalid time value` ทำให้ React crash ทั้ง tab

### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetDetailModal.jsx`
  - เพิ่ม helper function `formatDate(val)` ที่แทนที่ space ด้วย `T` ก่อน parse และตรวจสอบ `isNaN` ก่อน format
  - แทนที่ทุก `new Date(x).toLocaleDateString()` ใน Lifecycle tab ด้วย `formatDate(x)`:
    - `asset.purchase_date`
    - `asset.warranty_expiry_date`
    - `asset.created_at`
    - `asset.updated_at`

### พฤติกรรมที่เปลี่ยนไปของระบบ
- Lifecycle tab แสดงผลวันที่ถูกต้องแทนที่จะ crash และแสดงหน้าว่าง
- ป้องกัน RangeError ในทุก browser ที่ parse ISO date แบบ strict
- หากวันที่ไม่ถูกต้องหรือเป็น null จะแสดง `Row` นั้น skip โดยอัตโนมัติ (Row component คืน null เมื่อ value เป็น null)

### ความเสี่ยง / หมายเหตุ
- ไม่มีความเสี่ยง: เป็น defensive fix ที่ไม่กระทบ logic อื่น
- Build: ✅ 481 modules, no errors

---

### ✅ งาน: แก้ไข CSV Import — รองรับวันที่ไม่มี leading zero และ JS Date object จาก XLSX
**วันที่:** 2026-05-04

#### สิ่งที่ทำ
- อัปเดต `parseDateMMDDYYYY()` ให้รองรับ input 4 รูปแบบ:
  1. **JS Date object** (XLSX คืนค่านี้เมื่อใช้ `cellDates: true`) → แปลงตรงจาก UTC
  2. **Excel serial number** (integer หรือ decimal เช่น `45925`, `45925.0000462963`) → ผ่าน `excelSerialToMMDDYYYY()`
  3. **String ไม่มี leading zero** เช่น `9/25/2025`, `1/5/2024` → regex `\d{1,2}` + padStart
  4. **String มี leading zero** เช่น `09/25/2025` → เหมือนเดิม
- เปลี่ยน `XLSX.read` options จาก `raw: false, cellText: true` → `cellDates: true` เพื่อให้ date cells คืน Date object สม่ำเสมอ
- เพิ่ม `raw: true` ใน `sheet_to_json` เพื่อป้องกัน XLSX auto-format ค่าก่อน parser ทำงาน
- เพิ่ม `DATE_FIELDS` set ใน field mapping — date fields ส่ง raw value (Date/number) เข้า parser โดยตรง ไม่ stringify ก่อน
- อัปเดต error message ให้บอกว่ารับทั้ง `m/d/yyyy` และ `mm/dd/yyyy`

#### ไฟล์ที่มีการแก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `frontend/src/components/AssetTable.jsx` | `parseDateMMDDYYYY()`, XLSX options, field mapping, error messages |

#### พฤติกรรมที่เปลี่ยนไป
- `9/25/2025` (ไม่มี leading zero) → ✅ รับได้ → `2025-09-25`
- `1/5/2024` (เดือนและวันไม่มี 0 นำ) → ✅ รับได้ → `2024-01-05`
- `09/25/2025` → ✅ รับได้เหมือนเดิม
- Excel Date object จาก XLSX → ✅ รับได้
- Unit tests: ✅ 10/10 ผ่านทุก case

---

### ✅ งาน: แก้ไข CSV Import — รองรับ Excel Serial Date Number
**วันที่:** 2026-05-04

#### สิ่งที่ทำ
- เพิ่ม helper function `excelSerialToMMDDYYYY()` ใน `AssetTable.jsx`
  - แปลง Excel serial date (เช่น `45925` หรือ `45925.0000462963`) กลับเป็น `mm/dd/yyyy`
  - ใช้สูตร UTC: `(Math.floor(serial) - 25569) * 86400 * 1000` (คำนึงถึง leap-year bug ของ Excel)
- อัปเดต `parseDateMMDDYYYY()` ให้ตรวจสอบ input ก่อน:
  1. ถ้าเป็นตัวเลข (integer หรือ decimal) → แปลงผ่าน `excelSerialToMMDDYYYY()` ก่อน แล้วจึง parse
  2. ถ้าเป็น string → ใช้ logic เดิม (validate format `mm/dd/yyyy`)

#### ไฟล์ที่มีการแก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `frontend/src/components/AssetTable.jsx` | เพิ่ม `excelSerialToMMDDYYYY()`, อัปเดต `parseDateMMDDYYYY()` |

#### พฤติกรรมที่เปลี่ยนไปของระบบ
- CSV import รองรับวันที่ 3 รูปแบบโดยอัตโนมัติ:
  - **Excel serial integer**: `45925` → `2025-09-25`
  - **Excel serial decimal**: `45925.0000462963` → `2025-09-25`
  - **String format**: `09/25/2025` → `2025-09-25` (เหมือนเดิม)
- ผู้ใช้ไม่ต้อง format column วันที่ใน Excel ก่อน export — ระบบจัดการให้อัตโนมัติ

#### ความเสี่ยง / หมายเหตุ
- Excel serial ≤ 60 (ก่อนวันที่ 1 มี.ค. 1900) มีผลจาก leap-year bug ของ Excel แต่ไม่มีผลใช้งานจริง
- Build ผ่าน 481 modules | ทดสอบกับ backend จริง: ✅ import 3 rows ทุก format ถูกต้อง

---

### ✅ งาน: Data Integrity — Mandatory Fields, CSV Import พร้อม Error Log, และ Data Sanitization
**วันที่:** 2026-05-04

#### สิ่งที่ทำ

**1. Mandatory Fields — UI + Backend**
- กำหนดให้ฟิลด์ต่อไปนี้บังคับกรอก (ใส่ `*` สีแดง): Asset Code, Serial Number, Asset Name, Type, Stock Status, Purchase Date
- อัปเดต frontend validation ใน `AssetForm.jsx` ให้ตรวจสอบทุก mandatory field ก่อน submit (ไม่ขึ้นอยู่กับ browser native validation)
- อัปเดต backend `validateEquipmentFields()` ใน `equipment.js` ให้ใช้ `requireAll: true` บน POST และ PUT — ส่ง error 400 หากมี mandatory field ว่าง
- Conditional validation: ถ้า Stock Status = "Checked Out" ต้องระบุ Staff Name เสมอ (ทั้ง frontend และ backend)
- เพิ่มการตรวจ serial_number ซ้ำในระดับ application (POST: ห้ามซ้ำทั้งหมด, PUT: ห้ามซ้ำกับ record อื่น)

**2. Robust CSV Import**
- เพิ่มปุ่ม "⬆ Import CSV" และ "⬇ Template" ใน export bar ของ AssetTable
- Download Template: ดาวน์โหลด CSV template พร้อม header ที่ระบุว่าฟิลด์ใด mandatory (`*`) และ format วันที่ `mm/dd/yyyy`
- Import Logic:
  - Parse header จาก CSV (รองรับ header case-insensitive และมี `*` suffix)
  - Trim whitespace ทุก field
  - ตรวจสอบ mandatory fields ครบก่อน
  - Parse + validate วันที่ format `mm/dd/yyyy` (Purchase Date และ Warranty Expiry Date)
  - ตรวจ Duplicate Asset Code และ Duplicate Serial Number ทั้งกับ DB ปัจจุบัน และภายใน batch เดียวกัน
  - ตรวจ conditional: Checked Out ต้องมี Assigned User Name
  - Import ทีละแถว → เก็บ error rows พร้อม reason
- Import Results Modal: แสดงสถิติ (Imported / Skipped / Total)
- Download Error Log: ถ้ามี row ที่ skip — ดาวน์โหลด CSV โดยมีคอลัมน์ "Error Reason" อยู่หัวแถว + ข้อมูลต้นฉบับทั้งหมด

**3. Data Sanitization**
- `trimFields()` ใน backend ขยายให้ครอบคลุม `purchase_date` และ `warranty_expiry_date` ด้วย
- Frontend AssetForm trim ทุก string field ก่อน submit (ผ่าน `trimmed` object ใน `onSubmit`)
- CSV import trim ทุก cell value ก่อน validate และบันทึก

**4. Dropdown Sorting**
- ทุก dropdown ที่ได้รับข้อมูลจาก import ผ่าน backend API ซึ่งใช้ `sortDropdownOptions()` เหมือนเดิม (ไม่มีการเปลี่ยนแปลงเพิ่มเติม)

#### ไฟล์ที่มีการแก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `backend/routes/equipment.js` | `MANDATORY_LABELS` map, `validateEquipmentFields({ requireAll })`, serial uniqueness check ใน POST+PUT, ขยาย `trimFields()` |
| `frontend/src/components/AssetForm.jsx` | เพิ่ม `required` prop บน 6 fields, trim-on-submit, frontend mandatory validation |
| `frontend/src/components/AssetTable.jsx` | Import state, `handleImportFile()`, `downloadCSVTemplate()`, `downloadErrorLogCSV()`, Import Result Modal, ปุ่ม Import + Template |
| `frontend/src/App.css` | Styles สำหรับ import buttons, import stats modal, error list |

#### พฤติกรรมที่เปลี่ยนไปของระบบ
- ฟอร์ม Add/Edit Asset จะแสดง `*` แดงและไม่ยอม submit หากขาดฟิลด์บังคับ
- Backend API (POST/PUT) reject ทันทีหาก mandatory field ว่าง (HTTP 400)
- Backend reject ทันทีหาก serial_number ซ้ำ (HTTP 409)
- หน้า Asset Inventory มีปุ่ม Download Template (CSV) และ Import CSV ใหม่
- หลัง Import เสร็จ: modal แสดงจำนวนสำเร็จ/skipped พร้อมปุ่ม Download Error Log (ถ้ามี error)
- Error Log CSV มีคอลัมน์ "Error Reason" นำหน้าทุก row ที่ถูก skip

#### ความเสี่ยง / หมายเหตุ
- Serial Number uniqueness บังคับที่ application layer (ไม่มี UNIQUE constraint ใน DB schema) — หากมีข้อมูลเก่าที่ serial ซ้ำอยู่แล้ว การ import ใหม่จะ skip แต่ข้อมูลเก่าจะไม่ถูกกระทบ
- วันที่ใน CSV ต้องเป็น format `mm/dd/yyyy` เท่านั้น — format อื่นจะถูก skip พร้อม error message ชัดเจน
- Build ผ่าน 481 modules ไม่มี error

---

### ✅ งาน: Reusable Dropdown Sort Utility — A-Z พร้อม "Other" ท้ายรายการ
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
- สร้าง utility function `sortDropdownOptions()` ใน `frontend/src/utils/sortOptions.js`
- ฟังก์ชันนี้เรียงรายการ dropdown ตามตัวอักษร A-Z และบังคับให้รายการชื่อ "Other" (ไม่คำนึงถึงตัวพิมพ์เล็ก-ใหญ่) ไปอยู่ท้ายสุดเสมอ
- Refactor `AssetForm.jsx` ให้ใช้ฟังก์ชันดังกล่าวสำหรับ dropdown ของ Brand, Asset Type และ Purpose
- Refactor `AssetTable.jsx` ให้ใช้ฟังก์ชันดังกล่าวสำหรับ filter dropdown ของ Brand และ Asset Type

#### ไฟล์ที่มีการแก้ไข
| ไฟล์ | การเปลี่ยนแปลง |
|------|---------------|
| `frontend/src/utils/sortOptions.js` | **สร้างใหม่** — utility function `sortDropdownOptions(options)` |
| `frontend/src/components/AssetForm.jsx` | เพิ่ม import + ใช้ `sortDropdownOptions` กับ `brandOpts`, `typeOpts`, `purposeOpts` |
| `frontend/src/components/AssetTable.jsx` | เพิ่ม import + ใช้ `sortDropdownOptions` กับ `brands` และ `typeOpts` |

#### พฤติกรรมที่เปลี่ยนไปของระบบ
- Dropdown ทุกรายการสำหรับ Brand, Asset Type และ Purpose จะแสดงรายการเรียงตามตัวอักษร A-Z โดยอัตโนมัติ
- หากมีรายการชื่อ "Other" อยู่ใน dropdown จะถูกแสดงที่ท้ายรายการเสมอ ไม่ว่าตัวอักษรจะเป็นพิมพ์เล็กหรือพิมพ์ใหญ่
- Filter dropdown ในหน้า Asset Table ก็ได้รับการปรับปรุงให้เรียงลำดับเดียวกัน

#### ความเสี่ยง / หมายเหตุ
- ฟังก์ชันรับ `string[]` เท่านั้น — หาก dropdown ใช้ object (`{ value, label }`) ต้องแปลงก่อน (ปัจจุบัน AssetForm แปลงเป็น string array อยู่แล้วก่อนส่งเข้า `sortDropdownOptions`)
- Build ผ่าน 481 modules ไม่มี error

---

### ✅ งาน: Department/Purpose fields, purpose master data, Staff label rename, receipt fix
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
**Backend**
- เพิ่มคอลัมน์ `assigned_department` และ `assigned_purpose` ใน `equipment` table (migration)
- เพิ่ม master data category `purpose` พร้อม seed: New Staff Onboarding, Replacement/Upgrade, Temporary Loan, Off-site Working, Repair Backup
- เพิ่ม `purpose` ใน `VALID_CATEGORIES` ของ masterData route
- อัปเดต equipment `COLS`, `trimFields`, `INSERT`, `UPDATE` ให้รองรับ 2 คอลัมน์ใหม่
- PUT equipment: เมื่อ stock_status = 'Checked Out' → บันทึก dept/purpose ลง equipment AND ส่งต่อไป checkouts row; เมื่อ Available → clear ทั้งหมด
- POST equipment: เมื่อสร้าง asset ที่ Checked Out → สร้าง checkout record พร้อม dept/purpose
- POST checkouts: sync `assigned_department` และ `assigned_purpose` กลับไปที่ equipment ด้วย
- PATCH return (ทั้ง 2 path): clear `assigned_department`, `assigned_purpose` เมื่อคืนอุปกรณ์
- GET checkouts COALESCE: `employee_id` ดึงจาก `u.employee_id` เมื่อ orphan; `department`/`purpose` ดึงจาก `e.assigned_*` เมื่อไม่มี checkout row

**Frontend**
- `AssetForm`: เพิ่ม `assigned_department` (text, auto-fill จาก user) และ `assigned_purpose` (dropdown จาก master data) — แสดงเฉพาะเมื่อ stock_status = 'Checked Out'
- `AssetForm`: `onUserSelect` auto-fill `assigned_department` จาก user.department
- เปลี่ยน label "Employee Name" → "Staff Name", "Employee ID" → "Staff ID" ใน: CheckoutList table, CheckoutList receipt, CheckoutModal form, CheckoutModal receipt

#### ไฟล์ที่มีการแก้ไข
- `backend/database.js` — migration + purpose seed
- `backend/routes/masterData.js` — VALID_CATEGORIES
- `backend/routes/equipment.js` — COLS, trimFields, INSERT, UPDATE, PUT sync, POST sync
- `backend/routes/checkouts.js` — GET COALESCE, POST sync, PATCH clear
- `frontend/src/components/AssetForm.jsx`
- `frontend/src/components/CheckoutList.jsx`
- `frontend/src/components/CheckoutModal.jsx`

#### พฤติกรรมที่เปลี่ยนไปของระบบ
| รายการ | ก่อน | หลัง |
|---|---|---|
| Department ใน Active Checkouts | ว่าง | แสดงค่าจากทั้ง checkouts และ equipment |
| Purpose ใน Active Checkouts | ว่าง | แสดงค่าจากทั้ง checkouts และ equipment |
| Purpose field ใน AssetForm | ไม่มี | Dropdown จาก master data (เฉพาะเมื่อ Checked Out) |
| Department field ใน AssetForm | Read-only | Editable, auto-fill จาก user (เฉพาะเมื่อ Checked Out) |
| Employee Name/ID label | "Employee Name/ID" | "Staff Name/ID" ทุกที่ |
| PDF receipt borrower data | อาจว่าง | แสดงครบถ้วน รวม dept และ purpose |

#### ความเสี่ยง / หมายเหตุ
- `assigned_department` และ `assigned_purpose` บน equipment table ถูก clear อัตโนมัติเมื่อคืนอุปกรณ์
- Purpose options สามารถจัดการได้ที่ Admin Settings > Dropdown Options > Purpose

---

### ✅ แก้ไขบัก: Add Asset ไม่แสดง User Assignment และไม่แสดง Department ของ owner
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
- นำ condition `{isCheckedOut && (...)}` ออกจาก User Assignment section ใน `AssetForm.jsx` — ทำให้แสดงเสมอ ทั้งตอน Add และ Edit
- เปลี่ยนให้ * (required) แสดงเฉพาะเมื่อ `stock_status = 'Checked Out'`, และเปลี่ยนสีกรอบเฉพาะในกรณีนั้น
- เพิ่ม read-only field "Department" และ "Position" ที่ auto-fill จาก user directory เมื่อเลือก user จาก dropdown
- เพิ่ม CSS class `.form-input-static` สำหรับ read-only display field

#### ไฟล์ที่มีการแก้ไข
- `frontend/src/components/AssetForm.jsx`
- `frontend/src/App.css`

#### พฤติกรรมที่เปลี่ยนไปของระบบ
| รายการ | ก่อน | หลัง |
|---|---|---|
| User Assignment ใน Add Asset | ไม่แสดง (ซ่อนอยู่) | แสดงเสมอ |
| Department ของ owner | ไม่มีฟิลด์ | แสดงอัตโนมัติเมื่อเลือก user จาก directory |
| Position ของ owner | ไม่มีฟิลด์ | แสดงอัตโนมัติเมื่อเลือก user จาก directory |

#### ความเสี่ยง / หมายเหตุ
- Department และ Position เป็น read-only (ดึงจาก users table) ไม่ได้บันทึกลงใน equipment table
- การ validation ยังคงเดิม: assigned_user_name required เฉพาะเมื่อ stock_status = 'Checked Out'

---

### ✅ แก้ไขบัก: Active Checkouts ไม่แสดงครุภัณฑ์ที่ถูก Checked Out ผ่าน Edit form
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
- แก้ไข `GET /api/checkouts` ให้ดึงข้อมูลจาก `equipment.stock_status = 'Checked Out'` แทนที่จะขึ้นอยู่กับตาราง `checkouts` เพียงอย่างเดียว — ทำให้หน้า Assets และหน้า Active Checkouts ใช้แหล่งข้อมูลเดียวกัน
- อัปเดต `PUT /api/equipment/:id` ให้ sync ตาราง `checkouts` ทุกครั้งที่ `stock_status` เปลี่ยน — สร้าง checkout record อัตโนมัติเมื่อตั้งเป็น "Checked Out", ปิด record อัตโนมัติเมื่อเปลี่ยนกลับ
- อัปเดต `PATCH /api/checkouts/:id/return` ให้รองรับ `id=0` (กรณี orphan record) โดยรับ `equipment_id` ใน body
- อัปเดต `returnAsset()` ใน `api.js` ให้ส่ง `equipment_id` เมื่อ `id === 0`
- อัปเดต `CheckoutList.jsx` ให้ส่ง `c.equipment_id` ไปด้วยทุกครั้งที่กด Return

#### ไฟล์ที่มีการแก้ไข
- `backend/routes/checkouts.js`
- `backend/routes/equipment.js`
- `frontend/src/services/api.js`
- `frontend/src/components/CheckoutList.jsx`

#### พฤติกรรมที่เปลี่ยนไปของระบบ
| รายการ | ก่อน | หลัง |
|---|---|---|
| Active Checkouts ที่ set ผ่าน Edit form | ไม่แสดง | แสดงถูกต้อง |
| Return ครุภัณฑ์ที่ไม่มี checkout record | Error/ไม่ทำงาน | ทำงานได้ผ่าน equipment_id |
| PUT equipment เปลี่ยน stock_status | แค่อัปเดต equipment table | sync checkouts table ด้วย |

#### ความเสี่ยง / หมายเหตุ
- Orphan records ที่มีอยู่ใน DB แล้ว (stock_status='Checked Out' ไม่มี checkout row) จะแสดงในหน้า Active Checkouts ทันทีโดยไม่ต้องแก้ข้อมูล
- การ Return orphan record จะอัปเดต equipment table โดยตรง (ไม่สร้าง checkout row เพื่อไม่ปนข้อมูล)

---

### ✅ งาน: Master Data Management + Advanced Asset Tracking
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
- สร้างตาราง `master_data`, `users` และ migration คอลัมน์ใหม่ใน `equipment` และ `checkouts`
- เพิ่ม seed ข้อมูลเริ่มต้นให้ `master_data` (brand, asset_type, condition, os, ram_size, disk_type, disk_size)
- สร้าง API routes สำหรับ `/api/master-data` และ `/api/users` (CRUD ครบชุด)
- อัปเดต `/api/checkouts` ให้รองรับ `user_id` และ auto-resolve ชื่อจากตาราง users
- อัปเดต `/api/equipment` ให้รองรับฟิลด์ lifecycle (`purchase_date`, `purchase_price`, `warranty_expiry_date`) และ user assignment
- เพิ่ม warranty stats และ filter ใน GET /equipment
- สร้าง `MasterDataAdmin.jsx` — UI จัดการ dropdown options และ User Directory
- อัปเดต `AssetForm.jsx` — dropdown ดึงจาก master data + ส่วน Lifecycle & Financials + RAM/Disk dynamic slots + User Assignment
- อัปเดต `AssetDetailModal.jsx` — แท็บ Lifecycle (warranty badge), History, Ownership history
- อัปเดต `CheckoutModal.jsx` — dropdown เลือกจาก User Directory (auto-fill fields)
- เพิ่ม Admin Settings tab ใน `App.jsx`
- เพิ่ม styles ใน `App.css` สำหรับ admin panel, warranty badge, detail tabs

#### ไฟล์ที่มีการแก้ไข
- `backend/database.js`
- `backend/routes/masterData.js` (ใหม่)
- `backend/routes/users.js` (ใหม่)
- `backend/routes/equipment.js`
- `backend/routes/checkouts.js`
- `backend/server.js`
- `frontend/src/services/api.js`
- `frontend/src/components/MasterDataAdmin.jsx` (ใหม่)
- `frontend/src/components/AssetForm.jsx`
- `frontend/src/components/AssetDetailModal.jsx`
- `frontend/src/components/CheckoutModal.jsx`
- `frontend/src/App.jsx`
- `frontend/src/App.css`

#### พฤติกรรมที่เปลี่ยนไปของระบบ
| รายการ | รายละเอียด |
|---|---|
| Dropdown options | Brand, Type, Condition, OS, RAM size, Disk type/size ดึงจาก master_data แทน hardcode |
| User Directory | สามารถเพิ่ม/แก้ไข/ปิดใช้งาน user ได้ผ่าน Admin Settings |
| Checkout | เลือก user จาก directory แล้ว auto-fill ชื่อ, ID, แผนก |
| Asset lifecycle | บันทึก purchase_date, purchase_price, warranty_expiry_date ได้ |
| Warranty status | แสดง badge เขียว/เหลือง/แดง ตามวันหมดประกัน |
| Asset stats | Dashboard แสดง warrantyExpired / warrantyExpiringSoon |
| Ownership history | AssetDetailModal แสดงประวัติการยืม-คืนของครุภัณฑ์ |

#### ความเสี่ยง / หมายเหตุ
- Migration เพิ่มคอลัมน์ใหม่แบบ `ADD COLUMN` — ข้อมูลเดิมไม่ได้รับผลกระทบ
- ฐานข้อมูลที่สร้างใหม่จะได้รับ seed master_data อัตโนมัติ (ฐานข้อมูลเดิมที่มี data อยู่แล้วจะไม่ถูก seed ซ้ำ)
- Frontend build ผ่านสมบูรณ์ (480 modules, ✓ built in ~9s)

---

### ✅ งาน: เพิ่ม validation ให้ Equipment API (รอบที่ 2 — Length & Trimming)
**วันที่:** 2026-05-03

#### สิ่งที่ทำ
- เพิ่ม `trimFields()` helper เพื่อตัด whitespace ออกจากทุก string field ก่อนบันทึก
- เพิ่ม `FIELD_MAX_LEN` ตาราง กำหนดความยาวสูงสุดของแต่ละฟิลด์
- อัปเดต `validateEquipmentFields()` ให้ตรวจสอบความยาวฟิลด์ครบทุกตัว
- ลบการ `.trim()` ซ้ำออกจาก POST handler (trimFields ทำแทนแล้ว)

#### ไฟล์ที่มีการแก้ไข
- `backend/routes/equipment.js`

#### พฤติกรรมที่เปลี่ยนไปของระบบ
| รายการ | รายละเอียด |
|---|---|
| Whitespace trimming | ทุก string field ถูก trim ก่อน validate และบันทึก (ทั้ง POST และ PUT) |
| Length validation | `name` ≤ 200, `asset_code` ≤ 50, `model`/`serial_number`/`brand`/`type` ≤ 100 ตัวอักษร |
| Error response | ส่ง `HTTP 400` พร้อม `{ error, errors[] }` เมื่อฟิลด์ยาวเกินกำหนด |

#### ความเสี่ยง / หมายเหตุ
- ไม่มี breaking change — ข้อมูลที่มีอยู่ในฐานข้อมูลไม่ได้รับผลกระทบ
- Frontend ที่ส่งค่าที่มี trailing space จะถูก trim ให้อัตโนมัติ (อาจเปลี่ยนพฤติกรรมเล็กน้อยแต่ถือว่าถูกต้อง)
- ยังไม่มีการตรวจสอบรูปแบบ (pattern) ของ `asset_code` — สามารถเพิ่มได้ในอนาคต

---

### ✅ งาน: เพิ่ม validation ให้ Equipment API (รอบแรก)
**วันที่:** 2026-05-03

**สิ่งที่ทำ**
- เพิ่มการตรวจสอบ input สำหรับ POST และ PUT
- แยก validation logic เป็น helper function

**ไฟล์ที่แก้ไข**
- backend/routes/equipment.js

**พฤติกรรมที่เปลี่ยนไป**
- API จะตอบกลับ HTTP 400 เมื่อข้อมูลไม่ถูกต้อง
- Error format ยังคงเดิม รองรับ frontend ปัจจุบัน

**หมายเหตุ / ความเสี่ยง**
- ไม่มี breaking change
