-- QuietPress MCP Dynamic Client Registration metadata.

alter table public.mcp_oauth_clients
add column if not exists registration_type text not null default 'manual',
add column if not exists client_uri text,
add column if not exists logo_uri text,
add column if not exists contacts text[] not null default '{}',
add column if not exists token_endpoint_auth_method text not null default 'none',
add column if not exists grant_types text[] not null default array['authorization_code', 'refresh_token'],
add column if not exists response_types text[] not null default array['code'],
add column if not exists client_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  alter table public.mcp_oauth_clients
  add constraint mcp_oauth_clients_registration_type_check
  check (registration_type in ('manual', 'dynamic'));
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.mcp_oauth_clients
  add constraint mcp_oauth_clients_token_auth_method_check
  check (token_endpoint_auth_method = 'none');
exception
  when duplicate_object then null;
end $$;
