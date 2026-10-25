-- Run in Supabase SQL editor after creating bucket `udfondue-images` (public)

-- Allow public read
create policy "Public read udfondue images"
on storage.objects for select
to public
using (bucket_id = 'udfondue-images');

-- Allow anon insert into tickets/ and after/ prefixes only
-- หมายเหตุ (audit): anon อัปโหลดได้โดยไม่ผูก LIFF — ระยะถัดไปควรย้ายผ่าน API ที่ตรวจ idToken
-- จำกัดโฟลเดอร์แล้ว; ห้าม update/delete จาก client
drop policy if exists "Anon insert tickets and after" on storage.objects;
create policy "Anon insert tickets and after"
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'udfondue-images'
  and (
    (storage.foldername(name))[1] = 'tickets'
    or (storage.foldername(name))[1] = 'after'
  )
);

-- Deny anon update/delete (no policies = denied for those roles)
