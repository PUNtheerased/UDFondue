-- UDFondue tickets + handoff + site settings
-- รันใน Supabase SQL Editor (ครั้งเดียว)

create extension if not exists pgcrypto;

create table if not exists public.tickets (
  submit_id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  line_id text not null default '',
  name text not null default '',
  room text not null default '',
  student_no text not null default '',
  category text not null default '',
  detail text not null default '',
  image_count int not null default 0,
  image_url text not null default '',
  status text not null default 'รับเรื่องแล้ว',
  admin_note text not null default '',
  student_note text not null default '',
  status_updated timestamptz,
  is_anonymous boolean not null default false,
  contact_optional text not null default '',
  building text not null default '',
  zone text not null default '',
  location_note text not null default '',
  gps_lat text not null default '',
  gps_lng text not null default '',
  lf_type text not null default '',
  lf_when text not null default '',
  lf_return_point text not null default '',
  lf_secret_detail text not null default '',
  is_public_showcase boolean not null default false,
  track_token text not null default '',
  upvote_count int not null default 0,
  upvoted_line_ids text not null default '',
  merged_to_id text not null default '',
  assigned_group text not null default '',
  assigned_to text not null default '',
  urgency text not null default 'ปกติ',
  after_image_count int not null default 0,
  after_image_url text not null default '',
  image_storage text not null default '',
  date_th text not null default '',
  time_th text not null default ''
);

create index if not exists tickets_line_id_idx on public.tickets (line_id);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_lf_public_idx on public.tickets (is_public_showcase, lf_type)
  where is_public_showcase = true and merged_to_id = '';
create index if not exists tickets_building_zone_idx on public.tickets (building, zone);

create table if not exists public.ticket_status_history (
  id bigserial primary key,
  submit_id text not null references public.tickets (submit_id) on delete cascade,
  status text not null,
  note text not null default '',
  by_role text not null default 'system',
  at timestamptz not null default now()
);

create index if not exists ticket_status_history_submit_idx
  on public.ticket_status_history (submit_id, at desc);

create table if not exists public.lf_handoffs (
  id uuid primary key default gen_random_uuid(),
  found_submit_id text not null references public.tickets (submit_id) on delete cascade,
  claimant_line_id text not null,
  holder_line_id text not null default '',
  status text not null default 'claimed',
  code_hash text not null default '',
  code_expires_at timestamptz,
  attempt_count int not null default 0,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (found_submit_id, claimant_line_id)
);

create index if not exists lf_handoffs_found_idx on public.lf_handoffs (found_submit_id);
create index if not exists lf_handoffs_claimant_idx on public.lf_handoffs (claimant_line_id);

create table if not exists public.site_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.site_settings (key, value) values
  ('announce_home', ''),
  ('track_blurb', 'ค้นหาด้วยเลขที่แจ้ง หรือดูเรื่องของท่าน'),
  ('lost_found_blurb', 'Lost & Found'),
  ('submit_success', 'รับเรื่องแล้ว — เก็บเลขนี้ไว้ติดตามได้นะ')
on conflict (key) do nothing;

alter table public.tickets enable row level security;
alter table public.ticket_status_history enable row level security;
alter table public.lf_handoffs enable row level security;
alter table public.site_settings enable row level security;

-- Anon: อ่านเฉพาะของหายสาธารณะ + site_settings (Realtime ฝั่ง client)
drop policy if exists tickets_public_read on public.tickets;
create policy tickets_public_read on public.tickets
  for select to anon, authenticated
  using (
    is_public_showcase = true
    and merged_to_id = ''
    and status not in ('เสร็จสิ้น', 'ปิดเรื่อง', 'REJECTED_MODERATION')
  );

drop policy if exists site_settings_public_read on public.site_settings;
create policy site_settings_public_read on public.site_settings
  for select to anon, authenticated
  using (true);

-- Realtime (ข้ามถ้าเพิ่มไว้แล้ว)
do $$ begin
  alter publication supabase_realtime add table public.tickets;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.lf_handoffs;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.site_settings;
exception when duplicate_object then null;
end $$;
