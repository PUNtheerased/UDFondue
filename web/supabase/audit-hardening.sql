-- รันบนโปรเจกต์ที่มี tickets-schema อยู่แล้ว (incremental hardening จาก system audit)
-- ไม่ลบข้อมูล

-- กันเคลมซ้อน
create unique index if not exists lf_handoffs_one_active_per_found
  on public.lf_handoffs (found_submit_id)
  where status in ('claimed', 'code_active', 'locked');

-- ปิด SELECT เต็มแถวบน tickets
drop policy if exists tickets_public_read on public.tickets;

create or replace view public.tickets_public
with (security_invoker = false) as
select
  submit_id,
  created_at,
  updated_at,
  category,
  detail,
  image_count,
  image_url,
  status,
  status_updated,
  is_anonymous,
  building,
  zone,
  location_note,
  lf_type,
  lf_when,
  lf_return_point,
  is_public_showcase,
  upvote_count,
  merged_to_id,
  assigned_group,
  assigned_to,
  urgency,
  after_image_count,
  after_image_url,
  date_th,
  time_th
from public.tickets
where
  is_public_showcase = true
  and merged_to_id = ''
  and status not in ('เสร็จสิ้น', 'ปิดเรื่อง', 'REJECTED_MODERATION');

grant select on public.tickets_public to anon, authenticated;
