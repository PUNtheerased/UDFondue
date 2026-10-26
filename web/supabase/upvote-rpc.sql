-- Atomic upvote — รันใน Supabase SQL Editor
-- กัน read-modify-write race เมื่อหลายคนโหวตพร้อมกัน

create or replace function public.upvote_ticket(p_submit_id text, p_line_id text)
returns table (upvote_count int, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ids text;
  v_voters text[];
  v_line text := trim(p_line_id);
begin
  if v_line = '' or trim(p_submit_id) = '' then
    raise exception 'ข้อมูลไม่ครบ';
  end if;

  select t.upvoted_line_ids into v_ids
  from public.tickets t
  where t.submit_id = p_submit_id
  for update;

  if not found then
    raise exception 'ไม่พบเรื่อง';
  end if;

  v_voters := array_remove(
    string_to_array(coalesce(nullif(trim(v_ids), ''), ''), ','),
    ''
  );

  if v_line = any (v_voters) then
    return query
      select t.upvote_count::int, true
      from public.tickets t
      where t.submit_id = p_submit_id;
    return;
  end if;

  v_voters := array_append(v_voters, v_line);

  update public.tickets t
  set
    upvoted_line_ids = array_to_string(v_voters, ','),
    upvote_count = cardinality(v_voters),
    updated_at = now()
  where t.submit_id = p_submit_id;

  return query select cardinality(v_voters)::int, false;
end;
$$;

revoke all on function public.upvote_ticket(text, text) from public;
grant execute on function public.upvote_ticket(text, text) to service_role;
