create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Durable rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null
);

create index if not exists rate_limits_reset_at_idx
on public.rate_limits (reset_at);

alter table public.rate_limits enable row level security;

drop policy if exists "No direct rate limit access" on public.rate_limits;
create policy "No direct rate limit access"
on public.rate_limits
for all
using (false)
with check (false);

create or replace function public.check_rate_limit(
  rate_key text,
  window_seconds integer,
  max_requests integer
)
returns table (
  allowed boolean,
  remaining integer,
  reset_at timestamptz,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  current_reset_at timestamptz;
  next_reset_at timestamptz;
begin
  if rate_key is null or btrim(rate_key) = '' then
    raise exception 'rate_key is required' using errcode = '22023';
  end if;

  window_seconds := least(greatest(coalesce(window_seconds, 60), 1), 86400);
  max_requests := least(greatest(coalesce(max_requests, 5), 1), 100000);
  next_reset_at := now() + make_interval(secs => window_seconds);

  perform pg_advisory_xact_lock(hashtext(rate_key));

  delete from public.rate_limits
  where reset_at <= now() - interval '10 minutes';

  select rl.count, rl.reset_at
  into current_count, current_reset_at
  from public.rate_limits rl
  where rl.key = rate_key
  for update;

  if current_count is null or current_reset_at <= now() then
    insert into public.rate_limits (key, count, reset_at)
    values (rate_key, 1, next_reset_at)
    on conflict (key) do update
      set count = excluded.count,
          reset_at = excluded.reset_at
    returning rate_limits.count, rate_limits.reset_at
    into current_count, current_reset_at;
  else
    update public.rate_limits
    set count = count + 1
    where key = rate_key
    returning rate_limits.count, rate_limits.reset_at
    into current_count, current_reset_at;
  end if;

  allowed := current_count <= max_requests;
  remaining := greatest(max_requests - current_count, 0);
  reset_at := current_reset_at;
  retry_after := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (current_reset_at - now())))::integer)
  end;

  return next;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Admin audit logs
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_logs_created_at_idx
on public.admin_audit_logs (created_at desc);

create index if not exists admin_audit_logs_user_action_idx
on public.admin_audit_logs (user_id, action, created_at desc);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
on public.admin_audit_logs
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can insert audit logs" on public.admin_audit_logs;
create policy "Admins can insert audit logs"
on public.admin_audit_logs
for insert
to authenticated
with check (public.is_admin(auth.uid()));

-- ---------------------------------------------------------------------------
-- Query indexes
-- ---------------------------------------------------------------------------

create index if not exists posts_updated_at_idx
on public.posts (updated_at desc);

create index if not exists posts_status_updated_at_idx
on public.posts (status, updated_at desc);

create index if not exists posts_scheduled_publish_idx
on public.posts (published_at)
where status = 'scheduled';

create index if not exists comments_status_created_at_idx
on public.comments (status, created_at desc);

create index if not exists comments_post_parent_created_at_idx
on public.comments (post_id, parent_id, created_at);

create index if not exists newsletter_subscribers_status_created_at_idx
on public.newsletter_subscribers (status, created_at desc);

create or replace function public.get_public_comment_children(
  target_post_id uuid,
  target_parent_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'post_id', c.post_id,
        'parent_id', c.parent_id,
        'author_name', c.author_name,
        'content', c.content,
        'created_at', c.created_at,
        'children', public.get_public_comment_children(target_post_id, c.id)
      )
      order by c.created_at asc
    ),
    '[]'::jsonb
  )
  from public.comments c
  where c.post_id = target_post_id
    and c.status = 'approved'
    and c.parent_id is not distinct from target_parent_id;
$$;

create or replace function public.get_public_comment_tree(target_post_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.posts p
      where p.id = target_post_id
        and p.status = 'published'
        and p.published_at <= now()
    )
      then public.get_public_comment_children(target_post_id, null)
    else '[]'::jsonb
  end;
$$;

grant execute on function public.get_public_comment_children(uuid, uuid) to anon, authenticated;
grant execute on function public.get_public_comment_tree(uuid) to anon, authenticated;

create or replace function public.get_admin_post_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'totalPosts', (select count(*) from public.posts),
    'totalViews', (select coalesce(sum(views_count), 0) from public.posts),
    'draftsCount', (select count(*) from public.posts where status = 'draft'),
    'totalTags', (select count(*) from public.tags),
    'topPosts', coalesce((
      select jsonb_agg(row_to_json(top_posts))
      from (
        select id, title, slug, views_count
        from public.posts
        order by views_count desc, updated_at desc
        limit 3
      ) top_posts
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_post_summary() from public, anon, authenticated;
grant execute on function public.get_admin_post_summary() to authenticated;

-- ---------------------------------------------------------------------------
-- Privacy hardening for legacy cleartext comment IP values
-- ---------------------------------------------------------------------------

update public.comments
set ip_hash = encode(digest('legacy-comment-ip:' || ip_hash, 'sha256'), 'hex')
where ip_hash is not null
  and ip_hash <> ''
  and ip_hash !~ '^[a-f0-9]{64}$';
