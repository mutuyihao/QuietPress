create table if not exists public.post_slug_redirects (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  constraint post_slug_redirects_slug_not_empty check (btrim(slug) <> '')
);

create unique index if not exists post_slug_redirects_slug_key
on public.post_slug_redirects (slug);

create index if not exists post_slug_redirects_post_id_idx
on public.post_slug_redirects (post_id);

alter table public.post_slug_redirects enable row level security;

drop policy if exists "Public can read published post slug redirects"
on public.post_slug_redirects;

create policy "Public can read published post slug redirects"
on public.post_slug_redirects
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.posts
    where posts.id = post_slug_redirects.post_id
      and posts.status = 'published'
      and posts.published_at is not null
      and posts.published_at <= now()
  )
);

drop policy if exists "Admins can manage post slug redirects"
on public.post_slug_redirects;

create policy "Admins can manage post slug redirects"
on public.post_slug_redirects
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
