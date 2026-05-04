
# PR Summary Log

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
