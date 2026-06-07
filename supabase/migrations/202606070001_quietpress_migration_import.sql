create or replace function public.import_quietpress_export_v1(
  payload jsonb,
  choices jsonb default '{}'::jsonb,
  import_settings boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  settings_payload jsonb := payload->'settings';
  tag_item jsonb;
  post_item jsonb;
  tag_slug text;
  existing_tag_id uuid;
  existing_tag_name text;
  resolved_tag_id uuid;
  imported_post_id uuid;
  post_action text;
  tag_action text;
  base_slug text;
  target_slug text;
  suffix int;
  settings_imported boolean := false;
  tags_created int := 0;
  tags_reused int := 0;
  tags_updated int := 0;
  posts_created int := 0;
  posts_overwritten int := 0;
  posts_skipped int := 0;
  posts_duplicated int := 0;
begin
  if current_user_id is null or not public.is_admin(current_user_id) then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if payload->'meta'->>'app' <> 'quietpress'
    or coalesce((payload->'meta'->>'version')::int, 0) <> 1 then
    raise exception 'Unsupported QuietPress import package' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(2026060701);

  if import_settings
    and settings_payload is not null
    and jsonb_typeof(settings_payload) = 'object' then
    insert into public.site_settings (
      id,
      site_name,
      site_description,
      base_url,
      author_name,
      default_og_image_url,
      comments_enabled,
      image_upload_max_size_mb,
      image_compression_enabled,
      image_compression_quality,
      image_max_width,
      image_max_height,
      social_links,
      about_content,
      updated_at
    )
    values (
      'main',
      settings_payload->>'site_name',
      coalesce(settings_payload->>'site_description', ''),
      nullif(settings_payload->>'base_url', ''),
      coalesce(settings_payload->>'author_name', ''),
      nullif(settings_payload->>'default_og_image_url', ''),
      coalesce((settings_payload->>'comments_enabled')::boolean, true),
      coalesce((settings_payload->>'image_upload_max_size_mb')::int, 10),
      coalesce((settings_payload->>'image_compression_enabled')::boolean, true),
      coalesce((settings_payload->>'image_compression_quality')::int, 82),
      coalesce((settings_payload->>'image_max_width')::int, 1920),
      coalesce((settings_payload->>'image_max_height')::int, 1920),
      coalesce(settings_payload->'social_links', '{}'::jsonb),
      coalesce(settings_payload->>'about_content', ''),
      now()
    )
    on conflict (id) do update set
      site_name = excluded.site_name,
      site_description = excluded.site_description,
      base_url = excluded.base_url,
      author_name = excluded.author_name,
      default_og_image_url = excluded.default_og_image_url,
      comments_enabled = excluded.comments_enabled,
      image_upload_max_size_mb = excluded.image_upload_max_size_mb,
      image_compression_enabled = excluded.image_compression_enabled,
      image_compression_quality = excluded.image_compression_quality,
      image_max_width = excluded.image_max_width,
      image_max_height = excluded.image_max_height,
      social_links = excluded.social_links,
      about_content = excluded.about_content,
      updated_at = now();

    settings_imported := true;
  end if;

  for tag_item in
    select value from jsonb_array_elements(coalesce(payload->'tags', '[]'::jsonb))
  loop
    tag_slug := tag_item->>'slug';
    if tag_slug is null or tag_slug = '' then
      continue;
    end if;

    select id, name into existing_tag_id, existing_tag_name
    from public.tags
    where slug = tag_slug
    limit 1;

    if existing_tag_id is null then
      insert into public.tags (name, slug, created_at)
      values (
        tag_item->>'name',
        tag_slug,
        coalesce(nullif(tag_item->>'created_at', '')::timestamptz, now())
      );
      tags_created := tags_created + 1;
    else
      tag_action := coalesce(choices->'tagConflicts'->>tag_slug, 'reuse');
      if tag_action = 'overwrite' and existing_tag_name <> tag_item->>'name' then
        update public.tags
        set name = tag_item->>'name'
        where id = existing_tag_id;
        tags_updated := tags_updated + 1;
      else
        tags_reused := tags_reused + 1;
      end if;
    end if;

    existing_tag_id := null;
    existing_tag_name := null;
  end loop;

  for post_item in
    select value from jsonb_array_elements(coalesce(payload->'posts', '[]'::jsonb))
  loop
    base_slug := post_item->>'slug';
    target_slug := base_slug;
    imported_post_id := null;

    if base_slug is null or base_slug = '' then
      continue;
    end if;

    select id into imported_post_id
    from public.posts
    where slug = base_slug
    limit 1;

    if imported_post_id is not null then
      post_action := coalesce(choices->'postConflicts'->>base_slug, 'skip');
      if post_action not in ('skip', 'overwrite', 'duplicate') then
        post_action := 'skip';
      end if;

      if post_action = 'skip' then
        posts_skipped := posts_skipped + 1;
        continue;
      elsif post_action = 'duplicate' then
        target_slug := base_slug || '-imported';
        suffix := 2;

        while exists (select 1 from public.posts where slug = target_slug) loop
          target_slug := base_slug || '-imported-' || suffix::text;
          suffix := suffix + 1;
        end loop;

        imported_post_id := null;
      end if;
    end if;

    if imported_post_id is null then
      insert into public.posts (
        title,
        slug,
        excerpt,
        content_markdown,
        cover_image_url,
        status,
        seo_title,
        seo_description,
        canonical_url,
        noindex,
        reading_time_minutes,
        views_count,
        published_at,
        created_at,
        updated_at,
        author_id
      )
      values (
        post_item->>'title',
        target_slug,
        nullif(post_item->>'excerpt', ''),
        post_item->>'content_markdown',
        nullif(post_item->>'cover_image_url', ''),
        coalesce(post_item->>'status', 'draft'),
        nullif(post_item->>'seo_title', ''),
        nullif(post_item->>'seo_description', ''),
        nullif(post_item->>'canonical_url', ''),
        coalesce((post_item->>'noindex')::boolean, false),
        coalesce((post_item->>'reading_time_minutes')::int, 1),
        coalesce((post_item->>'views_count')::int, 0),
        nullif(post_item->>'published_at', '')::timestamptz,
        coalesce(nullif(post_item->>'created_at', '')::timestamptz, now()),
        coalesce(nullif(post_item->>'updated_at', '')::timestamptz, now()),
        current_user_id
      )
      returning id into imported_post_id;

      if target_slug = base_slug then
        posts_created := posts_created + 1;
      else
        posts_duplicated := posts_duplicated + 1;
      end if;
    else
      update public.posts
      set
        title = post_item->>'title',
        excerpt = nullif(post_item->>'excerpt', ''),
        content_markdown = post_item->>'content_markdown',
        cover_image_url = nullif(post_item->>'cover_image_url', ''),
        status = coalesce(post_item->>'status', 'draft'),
        seo_title = nullif(post_item->>'seo_title', ''),
        seo_description = nullif(post_item->>'seo_description', ''),
        canonical_url = nullif(post_item->>'canonical_url', ''),
        noindex = coalesce((post_item->>'noindex')::boolean, false),
        reading_time_minutes = coalesce((post_item->>'reading_time_minutes')::int, 1),
        views_count = coalesce((post_item->>'views_count')::int, 0),
        published_at = nullif(post_item->>'published_at', '')::timestamptz,
        author_id = current_user_id
      where id = imported_post_id;

      delete from public.post_tags where post_tags.post_id = imported_post_id;
      posts_overwritten := posts_overwritten + 1;
    end if;

    for tag_slug in
      select value from jsonb_array_elements_text(coalesce(post_item->'tag_slugs', '[]'::jsonb))
    loop
      select id into resolved_tag_id
      from public.tags
      where slug = tag_slug
      limit 1;

      if resolved_tag_id is not null then
        insert into public.post_tags (post_id, tag_id)
        values (imported_post_id, resolved_tag_id)
        on conflict do nothing;
      end if;

      resolved_tag_id := null;
    end loop;
  end loop;

  return jsonb_build_object(
    'settings_imported', settings_imported,
    'tags_created', tags_created,
    'tags_reused', tags_reused,
    'tags_updated', tags_updated,
    'posts_created', posts_created,
    'posts_overwritten', posts_overwritten,
    'posts_skipped', posts_skipped,
    'posts_duplicated', posts_duplicated
  );
end;
$$;

revoke all on function public.import_quietpress_export_v1(jsonb, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.import_quietpress_export_v1(jsonb, jsonb, boolean) to authenticated;
