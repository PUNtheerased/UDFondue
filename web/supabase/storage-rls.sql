-- Run in Supabase SQL editor after creating bucket `udfondue-images` (public)
-- อัปโหลดทำผ่าน Next /api/upload ด้วย service role — ไม่เปิด insert ให้ anon

-- Allow public read
drop policy if exists "Public read udfondue images" on storage.objects;
create policy "Public read udfondue images"
on storage.objects for select
to public
using (bucket_id = 'udfondue-images');

-- ปิด anon/authenticated insert (เคยเปิดไว้ก่อน audit)
drop policy if exists "Anon insert tickets and after" on storage.objects;

-- Deny anon update/delete (no policies = denied for those roles)
-- service_role ข้าม RLS ได้ตามปกติ
