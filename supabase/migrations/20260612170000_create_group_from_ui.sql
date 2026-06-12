create or replace function public.create_group_from_ui(
  p_name text,
  p_invite_code text
)
returns table (
  id uuid,
  name text,
  invite_code text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_invite_code text := upper(btrim(coalesce(p_invite_code, '')));
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'Il nome del gruppo deve avere tra 2 e 80 caratteri.';
  end if;

  if v_invite_code !~ '^[A-Z0-9-]{3,64}$' then
    raise exception 'Il codice gruppo generato non e valido.';
  end if;

  return query
    insert into public.groups (name, invite_code)
    values (v_name, v_invite_code)
    returning groups.id, groups.name, groups.invite_code, groups.created_at;
exception
  when unique_violation then
    return;
end;
$$;

grant execute on function public.create_group_from_ui(text, text) to anon, authenticated;
