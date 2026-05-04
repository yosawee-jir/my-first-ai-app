
# PROJECT PROGRESS

## ⏳ In Progress
- (none)

## ✅ Completed
- Task: Robust CSV parsing — disable cellDates, force string, whitespace trim, month-name date parser
  - frontend/src/components/AssetTable.jsx — parseDateMMDDYYYY, parseCSVFile, mapRow, payload builder, error messages
  - Build: ✅ 481 modules, no errors

- Task: Enhanced Error Log — multi-error collection per row + specific messages + enum validation
  - frontend/src/components/AssetTable.jsx — handleImportNew + handleImportUpdate loops refactored
  - Build: ✅ 481 modules, no errors

- Task: Dual CSV Import (New + Bulk Update) + User Assignment + Multi-disk Storage
  - backend/routes/equipment.js — PATCH /:id partial update endpoint + employee_id in POST checkout INSERT
  - frontend/src/services/api.js — updateEquipmentPartial (PATCH)
  - frontend/src/components/AssetTable.jsx — handleImportNew, handleImportUpdate, parseStorageCSV, parseRAMCSV, downloadNewTemplate, downloadUpdateTemplate, dual refs/state
  - frontend/src/App.css — .btn-export.update style
  - Build: ✅ 481 modules, no errors
- Task: Fix Lifecycle tab blank — replace all direct new Date().toLocaleDateString() with formatDate()
  - frontend/src/components/AssetDetailModal.jsx — purchase_date, warranty_expiry_date, created_at, updated_at
  - Build: ✅ 481 modules, no errors

## ✅ Completed
- Task: Fix Active Checkouts / Assets data consistency bug
  - backend/routes/checkouts.js — GET driven by equipment.stock_status; PATCH handles orphan id=0
  - backend/routes/equipment.js — PUT syncs checkouts table on stock_status change
  - frontend/src/services/api.js — returnAsset sends equipment_id when id=0
  - frontend/src/components/CheckoutList.jsx — passes equipment_id to handleReturn

- Task: Master Data Management + Advanced Asset Tracking
- All files created and verified:
  - backend/database.js — tables: master_data, users + migrations for equipment/checkouts
  - backend/routes/masterData.js — CRUD for dropdown options
  - backend/routes/users.js — CRUD for user directory
  - backend/routes/equipment.js — lifecycle fields, warranty stats/filter, user assignment
  - backend/routes/checkouts.js — user_id support, auto-resolve from users table
  - backend/server.js — all routes registered
  - frontend/src/services/api.js — all API calls (master-data, users, checkouts, equipment)
  - frontend/src/components/MasterDataAdmin.jsx — admin UI: dropdown options + user directory
  - frontend/src/components/AssetForm.jsx — dynamic dropdowns + lifecycle + user assignment
  - frontend/src/components/AssetDetailModal.jsx — warranty badge + lifecycle tab + ownership history
  - frontend/src/components/CheckoutModal.jsx — user dropdown with auto-fill
  - frontend/src/App.jsx — Admin Settings tab added
  - frontend/src/App.css — styles for all new components
- Frontend build: ✅ 480 modules, no errors
- Backend startup: ✅ no errors
- PR summary written to PR_SUMMARY.md

- File: backend/routes/equipment.js
- Task: เพิ่ม validation ครบชุด — enum check, length limits, field trimming ใน POST และ PUT
- Details:
  - trimFields() — trim whitespace ทุก string field
  - FIELD_MAX_LEN — กำหนดความยาวสูงสุดต่อฟิลด์
  - validateEquipmentFields() — ตรวจสอบ name, stock_status, status, และ length
  - จัดทำ PR-style summary ใน PR_SUMMARY.md แล้ว

## ⛔ Blocked / Stopped
- Reason: (none)
- File:
- Line (approx):
- Done:
- Remaining:
- Next command to run (if any):

- Task: Fix CSV date parsing — flexible string, Excel serial, JS Date object, single-digit months
  - frontend/src/components/AssetTable.jsx — parseDateMMDDYYYY handles Date objects + numbers + m/d/yyyy
  - XLSX.read: cellDates:true so Excel date cells → Date objects; sheet_to_json: raw:true
  - DATE_FIELDS set preserves raw values before stringify in field mapping
  - Build: ✅ | Unit tests: ✅ 10/10 (single-digit, padded, serial int, serial decimal, Date obj, empty, invalid)

- Task: Data Integrity + Mandatory Fields + CSV Import/Error Log + Data Sanitization
  - backend/routes/equipment.js — MANDATORY_LABELS, requireAll validation, serial_number uniqueness check in POST+PUT
  - frontend/src/components/AssetForm.jsx — required asterisk on 6 fields, frontend validation, trim-on-submit
  - frontend/src/components/AssetTable.jsx — CSV Import (validate, duplicate check, error log), Download Template
  - frontend/src/App.css — import stats modal + import button styles
  - Build: ✅ 481 modules, no errors
  - PR summary written to PR_SUMMARY.md

- Task: Reusable dropdown sort utility + refactor Brand/Asset Type/Purpose dropdowns
  - frontend/src/utils/sortOptions.js — สร้างใหม่ `sortDropdownOptions()`
  - frontend/src/components/AssetForm.jsx — brandOpts, typeOpts, purposeOpts
  - frontend/src/components/AssetTable.jsx — brands filter, typeOpts filter
  - Build: ✅ 481 modules, no errors
  - PR summary written to PR_SUMMARY.md

## ▶️ Next Steps
- All planned features complete. Ready for testing or next feature request.
