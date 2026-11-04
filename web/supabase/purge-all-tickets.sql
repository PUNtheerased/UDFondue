-- รันใน Supabase SQL Editor ของโปรเจกต์ที่ผูกกับ Vercel Production
-- ใช้เมื่อ Delete database ใน Nimda แล้วยังเห็นกระดานของหาย

truncate table public.lf_handoffs restart identity cascade;
truncate table public.ticket_status_history restart identity cascade;
truncate table public.tickets restart identity cascade;
