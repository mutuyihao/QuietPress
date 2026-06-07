-- QuietPress Remote MCP OAuth and audit support.

alter table public.site_settings
add column if not exists mcp_enabled boolean not null default false;

create table if not exists public.mcp_oauth_clients (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  name text not null check (length(name) between 1 and 120),
  redirect_uris text[] not null default '{}',
  scopes text[] not null default '{}',
  enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mcp_oauth_clients_redirect_uris_nonempty check (array_length(redirect_uris, 1) > 0),
  constraint mcp_oauth_clients_scopes_nonempty check (array_length(scopes, 1) > 0)
);

create table if not exists public.mcp_oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256' check (code_challenge_method = 'S256'),
  scopes text[] not null default '{}',
  resource text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  refresh_token_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null default '{}',
  resource text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  client_id text references public.mcp_oauth_clients(client_id) on delete set null,
  scopes text[] not null default '{}',
  tool_name text not null,
  resource_type text,
  resource_id text,
  input_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  request_id text not null,
  ip_hash text,
  user_agent_hash text,
  status text not null check (status in ('success', 'error')),
  error text,
  created_at timestamptz not null default now()
);

create unique index if not exists mcp_oauth_clients_client_id_idx
on public.mcp_oauth_clients (client_id);

create index if not exists mcp_oauth_codes_client_idx
on public.mcp_oauth_authorization_codes (client_id, expires_at);

create index if not exists mcp_oauth_tokens_client_user_idx
on public.mcp_oauth_tokens (client_id, user_id);

create index if not exists mcp_oauth_tokens_expires_idx
on public.mcp_oauth_tokens (expires_at)
where revoked_at is null;

create index if not exists mcp_oauth_audit_created_idx
on public.mcp_oauth_audit_logs (created_at desc);

drop trigger if exists mcp_oauth_clients_set_updated_at on public.mcp_oauth_clients;
create trigger mcp_oauth_clients_set_updated_at
before update on public.mcp_oauth_clients
for each row execute function public.set_updated_at();

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_authorization_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
alter table public.mcp_oauth_audit_logs enable row level security;

drop policy if exists "Admins can read MCP OAuth clients" on public.mcp_oauth_clients;
create policy "Admins can read MCP OAuth clients"
on public.mcp_oauth_clients
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can manage MCP OAuth clients" on public.mcp_oauth_clients;
create policy "Admins can manage MCP OAuth clients"
on public.mcp_oauth_clients
for all
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can read MCP OAuth tokens" on public.mcp_oauth_tokens;
create policy "Admins can read MCP OAuth tokens"
on public.mcp_oauth_tokens
for select
to authenticated
using (public.is_admin(auth.uid()));

drop policy if exists "Admins can update MCP OAuth tokens" on public.mcp_oauth_tokens;
create policy "Admins can update MCP OAuth tokens"
on public.mcp_oauth_tokens
for update
to authenticated
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists "Admins can read MCP audit logs" on public.mcp_oauth_audit_logs;
create policy "Admins can read MCP audit logs"
on public.mcp_oauth_audit_logs
for select
to authenticated
using (public.is_admin(auth.uid()));
