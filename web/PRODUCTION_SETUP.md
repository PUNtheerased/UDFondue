# คู่มือขึ้น Production (โรงเรียน)

หน้าเว็บอยู่ที่โฟลเดอร์ `web/` — บน Vercel ตั้ง **Root Directory = `web`**

## 1) Environment Variables (Vercel)

ไปที่ Project → **Settings → Environment Variables** → ใส่สำหรับ **Production**  
อย่าพึ่งพาไฟล์ `web/.env` บนเซิร์ฟเวอร์ (ใช้แค่รันในเครื่อง และถูก gitignore)

| ชื่อ | จำเป็น | ที่มา |
| --- | --- | --- |
| `GAS_WEB_APP_URL` | ใช่ | Apps Script → Deploy → Web app URL |
| `GAS_API_KEY` | ใช่ | สุ่มยาว (`openssl rand -hex 32`) — **ต้องตรงกับ Script Property ชื่อเดียวกัน** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ใช่ | Cloudflare Turnstile → Site Key |
| `TURNSTILE_SECRET_KEY` | ใช่ | Cloudflare Turnstile → Secret Key |
| `NEXT_PUBLIC_SUPABASE_URL` | ใช่ | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ใช่ | Supabase → anon public key |
| `SUPABASE_SERVICE_ROLE` | **ใช่ (บังคับ)** | service_role — ห้ามใส่ฝั่ง client · ไม่มีค่านี้ track จะ 503 บน Production |
| `NEXT_PUBLIC_LIFF_ID_REPORT` | ใช่ | LINE Developers → LIFF |
| `NEXT_PUBLIC_LIFF_ID_TRACK` | ใช่ | LINE Developers → LIFF |
| `LINE_CHANNEL_ID` | ใช่ | LINE Developers → Channel ID (ตัวเลข) |
| `LINE_CHANNEL_ACCESS_TOKEN` | ใช่ | Messaging API → Channel access token (push จาก Next) |
| `ADMIN_PIN` | ใช่ | รหัสหน้า `/nimda` (ตั้งใหม่เอง · ให้ตรง Script Property `ADMIN_PASSWORD`) |
| `DEV_PIN` | แนะนำ | รหัสสลับโหมด Dev ใน Nimda |
| `ADMIN_SESSION_SECRET` | ใช่ | สุ่มยาว เช่น `openssl rand -hex 32` |
| `ADMIN_LINE_IDS` | แนะนำ | LINE userId ของครู คั่นด้วย `,` (ล็อกอิน LINE ไม่พึ่ง GAS) |
| `NEXT_PUBLIC_SITE_URL` | ใช่ | เช่น `https://ud-fondue.vercel.app` |
| `UPSTASH_REDIS_REST_URL` | แนะนำ | Upstash Redis REST URL (rate limit กลาง) |
| `UPSTASH_REDIS_REST_TOKEN` | แนะนำ | Upstash Redis REST token |

หลังใส่ครบ → **Deployments → Redeploy**

> **Rate limit:** มี Upstash → ใช้ Redis · ไม่มี → หน่วยความจำต่อ instance  
> **รูป:** อัปผ่าน `/api/upload` (service role) — รัน `storage-rls.sql` ใหม่เพื่อปิด anon insert  
> **Sheets:** แอดมินอัปเดต/เคลม/โหวต จะ `mirrorUpdate` ไปชีต (Deploy Code.gs ที่มี action นี้)

## 2) Supabase Storage + Tickets

1. สร้าง bucket ชื่อ `udfondue-images` (public)
2. รัน SQL ใน `web/supabase/storage-rls.sql`
3. รัน SQL ใน `web/supabase/tickets-schema.sql` (โปรเจกต์ใหม่)  
   **หรือ** ถ้ารัน schema เก่าแล้ว ให้รันเพิ่ม `web/supabase/audit-hardening.sql`  
   (ปิด SELECT เต็มแถวบน `tickets` + view `tickets_public` + unique handoff active)
4. รัน `web/supabase/upvote-rpc.sql` (atomic upvote)
5. ใส่ `SUPABASE_SERVICE_ROLE` บน Vercel แล้ว Redeploy

## 3) Google Apps Script

1. คัดลอก `Code.gs` ล่าสุด → Deploy → **New version**
2. ใส่ Web App URL ใน `GAS_WEB_APP_URL`
3. Script Properties (Project Settings → Script properties):
   - **`GAS_API_KEY`** = ค่าเดียวกับ Vercel `GAS_API_KEY` (บังคับ — ไม่มีแล้วเรียก GAS ไม่ได้)
   - **`ADMIN_PASSWORD`** = รหัสแอดมิน (ย้ายออกจากโค้ดแล้ว · ให้ตรง `ADMIN_PIN` บน Vercel)
   - **`LINE_CHANNEL_ACCESS_TOKEN`** = Channel access token (**จำเป็นสำหรับ push ไปกลุ่ม** จาก GAS)
   - (ถ้าใช้กลุ่ม) `GROUP_ID_FACILITY`, `GROUP_ID_LOST_FOUND`, `GROUP_ID_COUNCIL`, `GROUP_ID_GENERAL`
4. รัน `authorizeLinePush` หรือ `testLinePush` ใน Editor ครั้งหนึ่ง แล้ว Deploy New version อีกครั้ง
5. ถ้า URL Web App เคยเปิดสาธารณะนาน — พิจารณา Deploy ใหม่แล้วอัปเดต URL

## 4) LINE LIFF

| LIFF | Endpoint แนะนำ |
| --- | --- |
| แจ้งเรื่อง (REPORT) | `https://ud-fondue.vercel.app/` |
| ติดตาม (TRACK) | `https://ud-fondue.vercel.app/track` |
| ของหาย (ใช้ LIFF TRACK เดียวกัน) | เพิ่ม Endpoint `/lost-found` ใน LIFF TRACK หรือเปิดผ่าน `https://liff.line.me/<LIFF_ID_TRACK>` แล้วนำทางไป `/lost-found` |

Scope ที่ต้องเปิดทั้งสองแอป: **profile** + **openid** (จำเป็นสำหรับ `getIDToken` — ไม่มี openid แล้ว track/claim ใช้ไม่ได้)

**Session ค้างในแอป LINE:** ให้นักเรียนเปิดหน้าติดตามผ่าน  
`https://liff.line.me/<NEXT_PUBLIC_LIFF_ID_TRACK>`  
ไม่ใช่แค่เปิดโดเมนเว็บในเบราว์เซอร์ภายนอก (นอก LINE ต้อง OAuth ใหม่ตามปกติของ LINE)

## 5) หน้าสำคัญ

| หน้า | Path |
| --- | --- |
| ฟอร์มแจ้งเรื่อง | `/` |
| ค้นหา / เรื่องของฉัน | `/track` |
| ดูเคสตามเลขที่ | `/track/UDF-XXXX` หรือ `/track/UDF-XXXX?t=TOKEN` |
| กระดานของหาย | `/lost-found` |
| เจ้าหน้าที่ | `/nimda` |

## 6) เช็กลิสต์ Deploy (หลังแก้บัก Full Bug Check)

1. รัน SQL: `upvote-rpc.sql` (+ `audit-hardening.sql` ถ้ายังไม่รัน)
2. วาง `Code.gs` → Deploy **New version** (ตัด `trustedNext` บน purge · history เฉพาะเมื่อ status/note เปลี่ยน)
3. Vercel → Redeploy Production (env ครบตามตารางด้านบน)
4. ตรวจ LIFF TRACK มี Endpoint `/track` และ `/lost-found` · scope **openid**
5. ทดสอบสั้น ๆ: ส่งเรื่อง · track «เรื่องของฉัน» จากใน LINE · เคลมของหาย · โหวต · Nimda PIN · purge Dev (ถ้าใช้)

## 7) ตรวจก่อนเปิดใช้จริง (หลัง audit harden)

- [ ] รัน `audit-hardening.sql` + `upvote-rpc.sql` บน Supabase
- [ ] ตั้ง `GAS_API_KEY` ทั้ง Vercel + Script Properties แล้ว Deploy New version ของ GAS
- [ ] ตั้ง `ADMIN_PASSWORD` ใน Script Properties แล้ว **หมุนรหัส** (ของเก่าเคยอยู่ใน repo)
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` ใน Script Properties (กลุ่มแจ้งเหตุ)
- [ ] `SUPABASE_SERVICE_ROLE` มีบน Production
- [ ] เปิดจากแอป LINE แล้วส่งเรื่องทดสอบได้
- [ ] แนบรูปแล้วขึ้นบน track
- [ ] มีข้อความ LINE ตอบกลับหลังส่ง
- [ ] `/nimda` เข้าด้วย LINE allowlist ได้โดยไม่พึ่ง GAS; ทาง PIN ต้องได้ GAS token หรือมี Supabase SoT
- [ ] `/lost-found` ว่างจริงเมื่อไม่มีรายการ (ไม่โชว์ Sheet เก่า)
- [ ] เคลมของหายซ้อนไม่ได้; สร้างรหัสใหม่หลังหมดอายุได้ (ห้ามทับตอน `code_active`)
- [ ] `/lost-found` ไม่โชว์ข้อมูลลับยืนยันเจ้าของ
- [ ] เปิด track ผ่าน `liff.line.me/...` แล้วกลับมาแท็บ «เรื่องของฉัน» โดยไม่ต้องกดล็อกอินใหม่