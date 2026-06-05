-- QuietPress 初始数据库 bootstrap，用于首次公开发布。
-- 该 migration 面向全新的 Supabase 项目。

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content_markdown text not null,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published', 'archived')),
  seo_title text,
  seo_description text,
  canonical_url text,
  noindex boolean not null default false,
  reading_time_minutes integer not null default 1 check (reading_time_minutes >= 1),
  views_count integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

create table if not exists public.site_settings (
  id text primary key default 'main' check (id = 'main'),
  site_name text not null default 'QuietPress',
  site_description text not null default '一个安静记录想法的地方。',
  base_url text,
  author_name text not null default '',
  default_og_image_url text,
  comments_enabled boolean not null default true,
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 's3', 'r2')),
  storage_quota_mb bigint,
  image_upload_max_size_mb integer not null default 10,
  image_compression_enabled boolean not null default true,
  image_compression_quality integer not null default 82,
  image_max_width integer not null default 1920,
  image_max_height integer not null default 1920,
  social_links jsonb not null default '{}'::jsonb,
  about_content text not null default '欢迎来到 QuietPress。',
  updated_at timestamptz not null default now()
);

create table if not exists public.view_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  viewed_at timestamptz not null default now()
);

create table if not exists public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  title text not null,
  content_markdown text not null,
  excerpt text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_name text not null default 'Anonymous',
  author_email text,
  author_website text,
  content text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'spam')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  status text not null default 'active' check (status in ('active', 'unsubscribed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists posts_status_published_at_idx on public.posts (status, published_at desc);
create index if not exists posts_slug_idx on public.posts (slug);
create index if not exists tags_slug_idx on public.tags (slug);
create index if not exists post_tags_tag_id_idx on public.post_tags (tag_id);
create index if not exists idx_view_events_post_date on public.view_events (post_id, viewed_at desc);
create index if not exists idx_view_events_date on public.view_events (viewed_at desc);
create index if not exists idx_post_revisions_post on public.post_revisions (post_id, created_at desc);
create index if not exists idx_comments_post on public.comments (post_id, status, created_at desc);
create index if not exists idx_comments_parent on public.comments (parent_id);
create index if not exists idx_newsletter_email on public.newsletter_subscribers (email);
create index if not exists idx_newsletter_status on public.newsletter_subscribers (status);

-- ---------------------------------------------------------------------------
-- Shared helpers and triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

drop trigger if exists newsletter_subscribers_set_updated_at on public.newsletter_subscribers;
create trigger newsletter_subscribers_set_updated_at
before update on public.newsletter_subscribers
for each row execute function public.set_updated_at();

create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = uid
  );
$$;

create or replace function public.first_admin_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.admin_profiles
  );
$$;

create or replace function public.claim_first_admin(admin_email text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(2026060102);

  if public.is_admin(current_user_id) then
    return true;
  end if;

  if exists (select 1 from public.admin_profiles) then
    return false;
  end if;

  insert into public.admin_profiles (user_id, email, role)
  values (
    current_user_id,
    coalesce(nullif(admin_email, ''), current_user_id::text),
    'admin'
  );

  return true;
end;
$$;

revoke all on function public.claim_first_admin(text) from public;
grant execute on function public.claim_first_admin(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Content and analytics RPC
-- ---------------------------------------------------------------------------

create or replace function public.search_posts(search_query text default '', limit_count integer default 50)
returns table (
  id uuid,
  title text,
  slug text,
  excerpt text,
  created_at timestamptz,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select
      left(regexp_replace(btrim(coalesce(search_query, '')), '\s+', ' ', 'g'), 200) as q,
      least(greatest(coalesce(limit_count, 50), 1), 100) as lim
  ),
  pattern as (
    select
      q,
      lim,
      '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' as like_pattern
    from normalized
  )
  select p.id, p.title, p.slug, p.excerpt, p.created_at, p.published_at
  from public.posts p
  cross join pattern
  where p.status = 'published'
    and p.published_at is not null
    and p.published_at <= now()
    and (
      pattern.q = ''
      or p.title ilike pattern.like_pattern escape '\'
      or coalesce(p.excerpt, '') ilike pattern.like_pattern escape '\'
    )
  order by p.published_at desc nulls last, p.created_at desc
  limit (select lim from pattern);
$$;

revoke all on function public.search_posts(text, integer) from public;
grant execute on function public.search_posts(text, integer) to anon, authenticated;

create or replace function public.increment_post_views(post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set views_count = views_count + 1
  where id = post_id
    and status = 'published'
    and published_at is not null
    and published_at <= now();
end;
$$;

revoke all on function public.increment_post_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_post_views(uuid) to anon, authenticated;

create or replace function public.get_daily_views(start_date date, end_date date)
returns table(view_date date, count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return query
  select date(v.viewed_at) as view_date, count(*)::bigint
  from public.view_events v
  where date(v.viewed_at) between start_date and end_date
  group by date(v.viewed_at)
  order by view_date;
end;
$$;

revoke all on function public.get_daily_views(date, date) from public, anon, authenticated;
grant execute on function public.get_daily_views(date, date) to authenticated;

create or replace function public.get_top_posts_daily(
  start_date date,
  end_date date,
  limit_count int default 10
)
returns table(post_id uuid, post_title text, view_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return query
  select v.post_id, p.title, count(*)::bigint as view_count
  from public.view_events v
  join public.posts p on p.id = v.post_id
  where date(v.viewed_at) between start_date and end_date
  group by v.post_id, p.title
  order by view_count desc
  limit least(greatest(coalesce(limit_count, 10), 1), 100);
end;
$$;

revoke all on function public.get_top_posts_daily(date, date, int) from public, anon, authenticated;
grant execute on function public.get_top_posts_daily(date, date, int) to authenticated;

create or replace function public.get_comment_counts(post_ids uuid[])
returns table(post_id uuid, count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select c.post_id, count(*)::bigint
  from public.comments c
  where c.post_id = any(post_ids)
    and c.status = 'approved'
    and exists (
      select 1
      from public.posts p
      where p.id = c.post_id
        and p.status = 'published'
        and p.published_at is not null
        and p.published_at <= now()
    )
  group by c.post_id;
end;
$$;

revoke all on function public.get_comment_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.get_comment_counts(uuid[]) to anon, authenticated;

create or replace function public.get_storage_bucket_usage(_bucket_name text default 'blog-images')
returns table (
  bucket_id text,
  used_bytes bigint,
  object_count bigint,
  bucket_file_size_limit bigint
)
language plpgsql
stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return query
  select
    b.id::text as bucket_id,
    coalesce(sum(
      case
        when coalesce(o.metadata->>'size', '') ~ '^\d+$'
          then (o.metadata->>'size')::bigint
        else 0
      end
    ), 0)::bigint as used_bytes,
    count(o.id)::bigint as object_count,
    b.file_size_limit::bigint as bucket_file_size_limit
  from storage.buckets b
  left join storage.objects o on o.bucket_id = b.id
  where b.id = _bucket_name
  group by b.id, b.file_size_limit;
end;
$$;

revoke all on function public.get_storage_bucket_usage(text) from public, anon, authenticated;
grant execute on function public.get_storage_bucket_usage(text) to authenticated;

create or replace function public.cleanup_old_revisions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_revisions int := 50;
  revision_count int;
begin
  select count(*) into revision_count
  from public.post_revisions
  where post_id = new.post_id;

  if revision_count > max_revisions then
    delete from public.post_revisions
    where id in (
      select id
      from public.post_revisions
      where post_id = new.post_id
      order by created_at asc
      limit (revision_count - max_revisions)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists post_revisions_cleanup_old on public.post_revisions;
create trigger post_revisions_cleanup_old
after insert on public.post_revisions
for each row execute function public.cleanup_old_revisions();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.posts enable row level security;
alter table public.tags enable row level security;
alter table public.post_tags enable row level security;
alter table public.site_settings enable row level security;
alter table public.view_events enable row level security;
alter table public.post_revisions enable row level security;
alter table public.comments enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Admins can read admin profiles" on public.admin_profiles;
create policy "Admins can read admin profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists "First authenticated user can claim admin" on public.admin_profiles;
create policy "First authenticated user can claim admin"
on public.admin_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.first_admin_available()
);

drop policy if exists "Admins can manage admin profiles" on public.admin_profiles;
create policy "Admins can manage admin profiles"
on public.admin_profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published posts" on public.posts;
create policy "Public can read published posts"
on public.posts
for select
to anon, authenticated
using (
  status = 'published'
  and published_at is not null
  and published_at <= now()
);

drop policy if exists "Admins can manage posts" on public.posts;
create policy "Admins can manage posts"
on public.posts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read tags" on public.tags;
create policy "Public can read tags"
on public.tags
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can manage tags" on public.tags;
create policy "Admins can manage tags"
on public.tags
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read published post tags" on public.post_tags;
create policy "Public can read published post tags"
on public.post_tags
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = post_tags.post_id
      and posts.status = 'published'
      and posts.published_at is not null
      and posts.published_at <= now()
  )
);

drop policy if exists "Admins can manage post tags" on public.post_tags;
create policy "Admins can manage post tags"
on public.post_tags
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Public can read site settings" on public.site_settings;
create policy "Public can read site settings"
on public.site_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert site settings" on public.site_settings;
create policy "Admins can insert site settings"
on public.site_settings
for insert
to authenticated
with check (public.is_admin());

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
on public.site_settings
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Allow insert view events" on public.view_events;
create policy "Allow insert view events"
on public.view_events
for insert
to anon, authenticated
with check (
  exists (
    select 1
    from public.posts p
    where p.id = view_events.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  )
);

drop policy if exists "Admins can read view events" on public.view_events;
create policy "Admins can read view events"
on public.view_events
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can read revisions" on public.post_revisions;
create policy "Admins can read revisions"
on public.post_revisions
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can insert revisions" on public.post_revisions;
create policy "Admins can insert revisions"
on public.post_revisions
for insert
to authenticated
with check (public.is_admin(auth.uid()));

drop policy if exists "Public can read approved comments" on public.comments;
create policy "Public can read approved comments"
on public.comments
for select
to anon, authenticated
using (
  status = 'approved'
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  )
);

drop policy if exists "Public can submit comments" on public.comments;
create policy "Public can submit comments"
on public.comments
for insert
to anon, authenticated
with check (
  status = 'pending'
  and content is not null
  and length(content) > 0
  and length(content) <= 5000
  and length(author_name) between 1 and 80
  and (author_email is null or length(author_email) <= 320)
  and exists (
    select 1
    from public.posts p
    where p.id = comments.post_id
      and p.status = 'published'
      and p.published_at is not null
      and p.published_at <= now()
  )
);

drop policy if exists "Admins can manage comments" on public.comments;
create policy "Admins can manage comments"
on public.comments
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Allow public insert" on public.newsletter_subscribers;
create policy "Allow public insert"
on public.newsletter_subscribers
for insert
to anon, authenticated
with check (
  status = 'active'
  and email = lower(btrim(email))
  and length(email) between 3 and 320
);

drop policy if exists "Admins can read subscribers" on public.newsletter_subscribers;
create policy "Admins can read subscribers"
on public.newsletter_subscribers
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can update subscribers" on public.newsletter_subscribers;
create policy "Admins can update subscribers"
on public.newsletter_subscribers
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Storage bucket and policies
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'blog-images',
  'blog-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read access for blog images" on storage.objects;
create policy "Public read access for blog images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'blog-images');

drop policy if exists "Admins can upload blog images" on storage.objects;
create policy "Admins can upload blog images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'blog-images'
  and public.is_admin(auth.uid())
);

drop policy if exists "Admins can delete blog images" on storage.objects;
create policy "Admins can delete blog images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'blog-images'
  and public.is_admin(auth.uid())
);

drop policy if exists "Admins can update blog images" on storage.objects;
create policy "Admins can update blog images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'blog-images'
  and public.is_admin(auth.uid())
)
with check (
  bucket_id = 'blog-images'
  and public.is_admin(auth.uid())
);

-- ---------------------------------------------------------------------------
-- Default singleton data
-- ---------------------------------------------------------------------------

insert into public.site_settings (id)
values ('main')
on conflict (id) do nothing;
