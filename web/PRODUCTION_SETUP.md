# คู่มือขึ้น Production (โรงเรียน)

หน้าเว็บอยู่ที่โฟลเดอร์ `web/` — บน Vercel ตั้ง **Root Directory = `web`**

## 1) Environment Variables (Vercel)

ไปที่ Project → **Settings → Environment Variables** → ใส่สำหรับ **Production**  
อย่าพึ่งพาไฟล์ `web/.env` บนเซิร์ฟเวอร์ (ใช้แค่รันในเครื่อง และถูก gitignore)

| ชื่อ | จำเป็น | ที่มา |
| --- | --- | --- |
| `GAS_WEB_APP_URL` | ใช่ | Apps Script → Deploy → Web app URL |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ใช่ | Cloudflare Turnstile → Site Key |
| `TURNSTILE_SECRET_KEY` | ใช่ | Cloudflare Turnstile → Secret Key |
| `NEXT_PUBLIC_SUPABASE_URL` | ใช่ (ถ้าแนบรูป) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ใช่ (ถ้าแนบรูป) | Supabase → anon public key |
| `SUPABASE_SERVICE_ROLE` | ไม่บังคับ | service_role (ห้ามใส่ฝั่ง client) |
| `NEXT_PUBLIC_LIFF_ID_REPORT` | ใช่ | LINE Developers → LIFF |
| `NEXT_PUBLIC_LIFF_ID_TRACK` | ใช่ | LINE Developers → LIFF |
| `LINE_CHANNEL_ID` | ใช่ | LINE Developers → Channel ID (ตัวเลข) |
| `ADMIN_PIN` | ใช่ | รหัสหน้า `/nimda` (ตั้งใหม่เอง) |
| `ADMIN_SESSION_SECRET` | ใช่ | สุ่มยาว เช่น `openssl rand -hex 32` |
| `ADMIN_LINE_IDS` | แนะนำ | LINE userId ของครู คั่นด้วย `,` |
| `NEXT_PUBLIC_SITE_URL` | ใช่ | เช่น `https://ud-fondue.vercel.app` |

ตัวอย่างชื่อตัวแปรดูได้ที่ `web/.env.example`

หลังใส่ครบ → **Deployments → Redeploy**

## 2) Supabase Storage

1. สร้าง bucket ชื่อ `udfondue-images` (public)
2. รัน SQL ใน `web/supabase/storage-rls.sql`

## 3) Google Apps Script

1. คัดลอก `Code.gs` ล่าสุด → Deploy → **New version**
2. ใส่ Web App URL ใน `GAS_WEB_APP_URL`
3. (ถ้าใช้กลุ่ม LINE) Script Properties: `GROUP_ID_FACILITY`, `GROUP_ID_LOST_FOUND`, `GROUP_ID_COUNCIL`, `GROUP_ID_GENERAL`

## 4) LINE LIFF

| LIFF | Endpoint แนะนำ |
| --- | --- |
| แจ้งเรื่อง | `https://ud-fondue.vercel.app/` |
| ติดตาม | `https://ud-fondue.vercel.app/track` |

Scope ที่ต้องเปิด: **profile** + **openid** (จำเป็นสำหรับ `getIDToken`)

## 5) หน้าสำคัญ

| หน้า | Path |
| --- | --- |
| ฟอร์มแจ้งเรื่อง | `/` |
| ค้นหา / เรื่องของฉัน | `/track` |
| ดูเคสตามเลขที่ | `/track/UDF-XXXX` หรือ `/track/UDF-XXXX?t=TOKEN` |
| กระดานของหาย | `/lost-found` |
| เจ้าหน้าที่ | `/nimda` |

## 6) ตรวจก่อนเปิดใช้จริง

- [ ] เปิดจากแอป LINE แล้วส่งเรื่องทดสอบได้
- [ ] แนบรูปแล้วขึ้นบน track
- [ ] มีข้อความ LINE ตอบกลับหลังส่ง
- [ ] `/nimda` เข้าด้วยรหัสใหม่ได้ และคนนอกเข้าไม่ได้
- [ ] `/lost-found` ไม่โชว์ข้อมูลลับยืนยันเจ้าของ
