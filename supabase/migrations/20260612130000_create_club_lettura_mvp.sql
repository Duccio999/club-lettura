create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null,
  created_at timestamptz default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  nickname text not null,
  pin_hash text not null,
  created_at timestamptz default now(),
  constraint members_group_nickname_pin_unique unique (group_id, nickname, pin_hash)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  author text,
  description text,
  cover_url text,
  google_books_id text,
  created_by_member_id uuid references public.members(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid references public.books(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  body text not null,
  is_spoiler boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz,
  deleted_at timestamptz
);

create unique index if not exists books_group_google_books_id_unique
  on public.books (group_id, google_books_id)
  where google_books_id is not null;

create unique index if not exists books_group_title_author_unique
  on public.books (group_id, lower(title), lower(coalesce(author, '')));

create index if not exists members_group_id_idx on public.members (group_id);
create index if not exists books_group_id_idx on public.books (group_id);
create index if not exists comments_book_id_created_at_idx on public.comments (book_id, created_at);
create index if not exists comments_member_id_idx on public.comments (member_id);
