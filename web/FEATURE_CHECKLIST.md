# สถานะฟีเจอร์ตามสเปกโรงเรียน / LINE Webview

อัปเดตล่าสุด: เทียบกับรายการ UX + Security ของ UDFondue

## UX / UI

| รายการ | สถานะ | ตำแหน่งหลัก |
| --- | --- | --- |
| `100dvh` + Safe Area (`viewport-fit=cover`, `pb-safe`) | ✅ | `app/layout.tsx`, `globals.css` |
| Wizard 3 ขั้น | ✅ | `components/ReportForm.tsx` |
| LocalStorage Draft (debounce, ไม่เก็บรูป) | ✅ | `hooks/useFormDraft.ts` |
| Offline banner + อัปโหลดแยก + Retry | ✅ | `ReportForm.tsx`, `hooks/useOnlineStatus.ts` |
| Dropdown โซน 2 ระดับ + GPS เสริม | ✅ | `constants/schoolZones.ts`, `ReportForm.tsx` |
| เช็กเรื่องซ้ำ + ปุ่ม (+1) | ✅ | `ReportForm.tsx`, `/api/zone-issues`, `/api/upvote` |
| คัดลอกเลขที่ + Toast | ✅ | `ReportForm.tsx` (หน้าสำเร็จ) |
| `/track` ค้นหา + `/track/[id]?t=` | ✅ | `app/track/*` |
| `/lost-found` สาธารณะ | ✅ | `app/lost-found` |

## Security / Privacy

| รายการ | สถานะ | ตำแหน่งหลัก |
| --- | --- | --- |
| Cloudflare Turnstile ก่อนส่ง | ✅ | `components/Turnstile.tsx`, `/api/submit` |
| Verify LIFF ID Token ฝั่งเซิร์ฟเวอร์ | ✅ | `lib/lineAuth.ts`, `/api/submit`, `/api/upvote` |
| Rate limit 2 ชั้น (Next IP+LINE + GAS lineId) | ✅ | `lib/rateLimit.ts`, `Code.gs` |
| PDPA เตือนใบหน้า + Anonymous | ✅ | `ReportForm.tsx`, `toTrackReport_` |
| Strip secrets ใน API สาธารณะ | ✅ | `lib/stripPublic.ts`, GAS public mappers |
| EXIF strip ผ่าน JPEG re-encode | ✅ | `lib/compressImage.ts` |
| Supabase Storage RLS | ✅ (SQL) | `supabase/storage-rls.sql` — ต้องรันในโปรเจกต์ |
| Profanity + `REJECTED_MODERATION` | ✅ | `lib/profanity.ts`, Nimda ซ่อน, GAS |
| Admin Guard (PIN / ADMIN_LINE_IDS) | ✅ | `/nimda`, `/api/admin/login` |

## งานฝั่ง Ops ที่ต้องทำเอง

- [ ] ใส่ env ครบบน Vercel (ดู `PRODUCTION_SETUP.md`)
- [ ] รัน `storage-rls.sql` บน Supabase
- [ ] Deploy `Code.gs` New version
- [ ] LIFF Endpoint: `/` และ `/track` + scope `openid`
