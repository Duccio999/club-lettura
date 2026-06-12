create extension if not exists pgcrypto with schema extensions;

alter table public.members
  add column if not exists access_token_hash text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'groups_invite_code_not_blank') then
    alter table public.groups
      add constraint groups_invite_code_not_blank check (char_length(btrim(invite_code)) between 3 and 64) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'members_nickname_not_blank') then
    alter table public.members
      add constraint members_nickname_not_blank check (char_length(btrim(nickname)) between 2 and 40) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'members_pin_hash_sha256') then
    alter table public.members
      add constraint members_pin_hash_sha256 check (pin_hash ~ '^[a-f0-9]{64}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'books_title_not_blank') then
    alter table public.books
      add constraint books_title_not_blank check (char_length(btrim(title)) between 1 and 300) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'comments_body_not_blank') then
    alter table public.comments
      add constraint comments_body_not_blank check (char_length(btrim(body)) between 1 and 4000) not valid;
  end if;
end $$;

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.books enable row level security;
alter table public.comments enable row level security;

revoke all on table public.groups from anon, authenticated;
revoke all on table public.members from anon, authenticated;
revoke all on table public.books from anon, authenticated;
revoke all on table public.comments from anon, authenticated;

create or replace function public.hash_member_access_token(p_token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
$$;

create or replace function public.resolve_member_session(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text
)
returns table (
  resolved_group_id uuid,
  resolved_member_id uuid,
  resolved_nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := btrim(coalesce(p_invite_code, ''));
begin
  if p_member_id is null or char_length(v_code) < 3 or char_length(coalesce(p_access_token, '')) < 32 then
    return;
  end if;

  return query
    select g.id, m.id, m.nickname
    from public.groups g
    join public.members m on m.group_id = g.id
    where upper(g.invite_code) = upper(v_code)
      and m.id = p_member_id
      and m.access_token_hash = public.hash_member_access_token(p_access_token)
    limit 1;
end;
$$;

create or replace function public.get_group_by_invite_code(p_invite_code text)
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
  v_code text := btrim(coalesce(p_invite_code, ''));
begin
  if char_length(v_code) < 3 or char_length(v_code) > 64 then
    return;
  end if;

  return query
    select g.id, g.name, g.invite_code, g.created_at
    from public.groups g
    where upper(g.invite_code) = upper(v_code)
    limit 1;
end;
$$;

create or replace function public.get_or_create_member(
  p_invite_code text,
  p_nickname text,
  p_pin_hash text
)
returns table (
  id uuid,
  group_id uuid,
  nickname text,
  created_at timestamptz,
  access_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := btrim(coalesce(p_invite_code, ''));
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_pin_hash text := lower(btrim(coalesce(p_pin_hash, '')));
  v_group_id uuid;
  v_member_id uuid;
  v_created_at timestamptz;
  v_access_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if char_length(v_code) < 3 or char_length(v_code) > 64 then
    raise exception 'Codice gruppo non valido.';
  end if;

  if char_length(v_nickname) < 2 or char_length(v_nickname) > 40 then
    raise exception 'Nickname non valido.';
  end if;

  if v_pin_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'PIN non valido.';
  end if;

  select g.id into v_group_id
  from public.groups g
  where upper(g.invite_code) = upper(v_code)
  limit 1;

  if v_group_id is null then
    return;
  end if;

  select m.id, m.created_at into v_member_id, v_created_at
  from public.members m
  where m.group_id = v_group_id
    and m.nickname = v_nickname
    and m.pin_hash = v_pin_hash
  limit 1;

  if v_member_id is null then
    insert into public.members (group_id, nickname, pin_hash, access_token_hash)
    values (v_group_id, v_nickname, v_pin_hash, public.hash_member_access_token(v_access_token))
    returning members.id, members.created_at into v_member_id, v_created_at;
  else
    update public.members
    set access_token_hash = public.hash_member_access_token(v_access_token)
    where members.id = v_member_id;
  end if;

  return query select v_member_id, v_group_id, v_nickname, v_created_at, v_access_token;
end;
$$;

create or replace function public.get_member_for_group(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text
)
returns table (
  id uuid,
  group_id uuid,
  nickname text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select r.resolved_member_id, r.resolved_group_id, r.resolved_nickname, m.created_at
    from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r
    join public.members m on m.id = r.resolved_member_id
    limit 1;
end;
$$;

create or replace function public.list_group_books(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text
)
returns table (
  id uuid,
  group_id uuid,
  title text,
  author text,
  description text,
  cover_url text,
  google_books_id text,
  created_by_member_id uuid,
  created_at timestamptz,
  comments_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select r.resolved_group_id into v_group_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  return query
    select
      b.id,
      b.group_id,
      b.title,
      b.author,
      b.description,
      b.cover_url,
      b.google_books_id,
      b.created_by_member_id,
      b.created_at,
      count(c.id)::integer as comments_count
    from public.books b
    left join public.comments c on c.book_id = b.id and c.deleted_at is null
    where b.group_id = v_group_id
    group by b.id
    order by b.created_at desc;
end;
$$;

create or replace function public.get_group_book(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_book_id uuid
)
returns table (
  id uuid,
  group_id uuid,
  title text,
  author text,
  description text,
  cover_url text,
  google_books_id text,
  created_by_member_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select r.resolved_group_id into v_group_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  return query
    select b.id, b.group_id, b.title, b.author, b.description, b.cover_url, b.google_books_id, b.created_by_member_id, b.created_at
    from public.books b
    where b.id = p_book_id
      and b.group_id = v_group_id
    limit 1;
end;
$$;

create or replace function public.add_group_book(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_google_books_id text,
  p_title text,
  p_author text,
  p_description text,
  p_cover_url text
)
returns table (
  id uuid,
  group_id uuid,
  title text,
  author text,
  description text,
  cover_url text,
  google_books_id text,
  created_by_member_id uuid,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_member_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_author text := nullif(btrim(coalesce(p_author, '')), '');
  v_google_books_id text := nullif(btrim(coalesce(p_google_books_id, '')), '');
  v_existing_id uuid;
begin
  select r.resolved_group_id, r.resolved_member_id into v_group_id, v_member_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  if char_length(v_title) < 1 or char_length(v_title) > 300 then
    raise exception 'Titolo libro non valido.';
  end if;

  select b.id into v_existing_id
  from public.books b
  where b.group_id = v_group_id
    and (
      (v_google_books_id is not null and b.google_books_id = v_google_books_id)
      or (
        lower(b.title) = lower(v_title)
        and lower(coalesce(b.author, '')) = lower(coalesce(v_author, ''))
      )
    )
  limit 1;

  if v_existing_id is null then
    insert into public.books (
      group_id,
      title,
      author,
      description,
      cover_url,
      google_books_id,
      created_by_member_id
    )
    values (
      v_group_id,
      v_title,
      v_author,
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_cover_url, '')), ''),
      v_google_books_id,
      v_member_id
    )
    returning books.id into v_existing_id;
  end if;

  return query
    select b.id, b.group_id, b.title, b.author, b.description, b.cover_url, b.google_books_id, b.created_by_member_id, b.created_at
    from public.books b
    where b.id = v_existing_id;
end;
$$;

create or replace function public.list_book_comments(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_book_id uuid
)
returns table (
  id uuid,
  book_id uuid,
  member_id uuid,
  body text,
  is_spoiler boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  member_nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  select r.resolved_group_id into v_group_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  if not exists (select 1 from public.books b where b.id = p_book_id and b.group_id = v_group_id) then
    return;
  end if;

  return query
    select
      c.id,
      c.book_id,
      c.member_id,
      c.body,
      c.is_spoiler,
      c.created_at,
      c.updated_at,
      c.deleted_at,
      m.nickname
    from public.comments c
    join public.members m on m.id = c.member_id
    where c.book_id = p_book_id
      and c.deleted_at is null
    order by c.created_at asc;
end;
$$;

create or replace function public.add_book_comment(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_book_id uuid,
  p_body text,
  p_is_spoiler boolean
)
returns table (
  id uuid,
  book_id uuid,
  member_id uuid,
  body text,
  is_spoiler boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  member_nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_member_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_comment_id uuid;
begin
  select r.resolved_group_id, r.resolved_member_id into v_group_id, v_member_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Commento non valido.';
  end if;

  if not exists (select 1 from public.books b where b.id = p_book_id and b.group_id = v_group_id) then
    return;
  end if;

  insert into public.comments (book_id, member_id, body, is_spoiler)
  values (p_book_id, v_member_id, v_body, coalesce(p_is_spoiler, false))
  returning comments.id into v_comment_id;

  return query
    select c.id, c.book_id, c.member_id, c.body, c.is_spoiler, c.created_at, c.updated_at, c.deleted_at, m.nickname
    from public.comments c
    join public.members m on m.id = c.member_id
    where c.id = v_comment_id;
end;
$$;

create or replace function public.update_own_comment(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_comment_id uuid,
  p_body text,
  p_is_spoiler boolean
)
returns table (
  id uuid,
  book_id uuid,
  member_id uuid,
  body text,
  is_spoiler boolean,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
  member_nickname text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_member_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select r.resolved_group_id, r.resolved_member_id into v_group_id, v_member_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  if char_length(v_body) < 1 or char_length(v_body) > 4000 then
    raise exception 'Commento non valido.';
  end if;

  update public.comments c
  set body = v_body,
      is_spoiler = coalesce(p_is_spoiler, false),
      updated_at = now()
  from public.books b
  where c.id = p_comment_id
    and c.member_id = v_member_id
    and c.book_id = b.id
    and b.group_id = v_group_id
    and c.deleted_at is null;

  return query
    select c.id, c.book_id, c.member_id, c.body, c.is_spoiler, c.created_at, c.updated_at, c.deleted_at, m.nickname
    from public.comments c
    join public.members m on m.id = c.member_id
    join public.books b on b.id = c.book_id
    where c.id = p_comment_id
      and c.member_id = v_member_id
      and b.group_id = v_group_id
      and c.deleted_at is null
    limit 1;
end;
$$;

create or replace function public.delete_own_comment(
  p_invite_code text,
  p_member_id uuid,
  p_access_token text,
  p_comment_id uuid
)
returns table (
  id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
  v_member_id uuid;
begin
  select r.resolved_group_id, r.resolved_member_id into v_group_id, v_member_id
  from public.resolve_member_session(p_invite_code, p_member_id, p_access_token) r;

  if v_group_id is null then
    return;
  end if;

  update public.comments c
  set deleted_at = now()
  from public.books b
  where c.id = p_comment_id
    and c.member_id = v_member_id
    and c.book_id = b.id
    and b.group_id = v_group_id
    and c.deleted_at is null;

  return query
    select c.id
    from public.comments c
    join public.books b on b.id = c.book_id
    where c.id = p_comment_id
      and c.member_id = v_member_id
      and b.group_id = v_group_id
      and c.deleted_at is not null
    limit 1;
end;
$$;

revoke all on function public.resolve_member_session(text, uuid, text) from public, anon, authenticated;
grant execute on function public.get_group_by_invite_code(text) to anon, authenticated;
grant execute on function public.get_or_create_member(text, text, text) to anon, authenticated;
grant execute on function public.get_member_for_group(text, uuid, text) to anon, authenticated;
grant execute on function public.list_group_books(text, uuid, text) to anon, authenticated;
grant execute on function public.get_group_book(text, uuid, text, uuid) to anon, authenticated;
grant execute on function public.add_group_book(text, uuid, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.list_book_comments(text, uuid, text, uuid) to anon, authenticated;
grant execute on function public.add_book_comment(text, uuid, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.update_own_comment(text, uuid, text, uuid, text, boolean) to anon, authenticated;
grant execute on function public.delete_own_comment(text, uuid, text, uuid) to anon, authenticated;
