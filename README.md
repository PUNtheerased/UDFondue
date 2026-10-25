# UDFondue — ระบบแจ้งเรื่องและติดตามปัญหาผ่าน LINE LIFF

ระบบ LINE Official Account สำหรับให้นักเรียนแจ้งเรื่องผ่านฟอร์มบน LINE ติดตามสถานะ และให้เจ้าหน้าที่อัปเดตสถานะผ่านหน้า Admin โดยข้อมูลบันทึกลง Google Sheets รูปภาพอัปโหลดตรงไป Supabase Storage และ backend อยู่ที่ Google Apps Script (`Code.gs` v11)

**ประเภทเรื่องที่แจ้งได้:**
1. ปัญหาที่พบ
2. ตามหาของหาย
3. เสนอความคิดเห็นต่อสภานักเรียน
4. อื่นๆ (+ หมวดหมู่เพิ่มเติม)

---

## โครงสร้างไฟล์ (v11)

| เส้นทาง | หน้าที่ |
| --- | --- |
| `web/` | Next.js App Router (ฟอร์ม / track / lost-found / nimda + API) |
| `web/.env.example` | ตัวแปร Turnstile, Supabase, LIFF, Admin |
| `web/supabase/storage-rls.sql` | RLS สำหรับ Direct Client Upload |
| `Code.gs` | Backend Google Apps Script (`v11-full-upgrade`) |

### Deploy แนะนำ

1. ตั้งค่า env จาก `web/.env.example` บน Vercel — **Root Directory = `web`**
2. สร้าง Turnstile + Supabase bucket `udfondue-images` แล้วรัน SQL ใน `web/supabase/storage-rls.sql`
3. Deploy `Code.gs` → **New version** แล้วใส่ `GAS_WEB_APP_URL`
4. ตั้ง Script Properties: `GROUP_ID_FACILITY`, `GROUP_ID_LOST_FOUND`, `GROUP_ID_COUNCIL`, `GROUP_ID_GENERAL`
5. อัปเดต LIFF Endpoint เป็น URL ของ `/` และ deep link `/track/{id}?t=...`

| หน้า | Path |
| --- | --- |
| แจ้งเรื่อง | `/` |
| ติดตาม | `/track/[ticketId]?t=...` |
| ของหาย | `/lost-found` |
| Admin | `/nimda` |

> **สำคัญ:** หลังแก้ `Code.gs` ทุกครั้ง ต้อง Deploy → Manage deployments → **New version**

---

## API Actions (Code.gs v11)

| Action | คำอธิบาย |
| --- | --- |
| `submit` | บันทึกเรื่องใหม่ (รับ `imageUrls[]`, สร้าง `trackToken`) |
| `uploadImage` | อัปโหลดรูป Drive (legacy) |
| `trackList` / `trackDetail` | รายการ/รายละเอียดตาม lineId |
| `trackPublicDetail` | ติดตามด้วย `submitId` + `trackToken` |
| `getZoneActiveIssues` | เรื่องค้างในโซน (สำหรับ upvote) |
| `upvoteTicket` | +1 ด้วย `LockService` |
| `getPublicLostFound` | กระดานของหาย (strip secrets) |
| `adminAuth` / `adminBootstrap` / `adminList` | Admin |
| `adminUpdate` | อัปเดตสถานะ + After URLs + text notify |
| `adminMergeTickets` | รวมเคสซ้ำ (`LockService`) |
| `adminModerationHide` | ซ่อนด้วย `REJECTED_MODERATION` |

---

## หมายเหตุ / การแก้ปัญหา

- แก้ `Code.gs` แล้วต้อง **Deploy New version** ทุกครั้ง
- รูปใหม่ใช้ Supabase Storage (direct upload); Drive ยังใช้กับ legacy upload ได้
- Admin session หมดอายุ 8 ชั่วโมง — login ใหม่ได้
- อย่าเผยแพร่ `/nimda` และ `ADMIN_PIN` สาธารณะ
