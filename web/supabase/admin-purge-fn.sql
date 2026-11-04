-- รันใน Supabase SQL Editor ครั้งหนึ่ง
-- ให้ Nimda Delete database เรียก truncate ได้ชัวร์

create or replace function public.admin_purge_ticket_tables()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tickets_before int;
  tickets_after int;
begin
  select count(*) into tickets_before from public.tickets;

  truncate table public.lf_handoffs restart identity cascade;
  truncate table public.ticket_status_history restart identity cascade;
  truncate table public.tickets restart identity cascade;

  select count(*) into tickets_after from public.tickets;

  return jsonb_build_object(
    'ok', tickets_after = 0,
    'tickets_before', tickets_before,
    'tickets_after', tickets_after
  );
end;
$$;

revoke all on function public.admin_purge_ticket_tables() from public;
grant execute on function public.admin_purge_ticket_tables() to service_role;
