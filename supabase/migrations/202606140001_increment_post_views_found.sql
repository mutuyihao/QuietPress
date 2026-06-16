drop function if exists public.increment_post_views(uuid);

create or replace function public.increment_post_views(post_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.posts
  set views_count = views_count + 1
  where id = post_id
    and status = 'published'
    and published_at is not null
    and published_at <= now();

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke all on function public.increment_post_views(uuid) from public, anon, authenticated;
grant execute on function public.increment_post_views(uuid) to anon, authenticated;
