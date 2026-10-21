-- Phone push subscriptions. Only the server key may read or write this table.
create table if not exists public.tiflisi_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id bigint not null references public.tiflisi_accounts(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tiflisi_push_subscriptions_endpoint_key unique (endpoint),
  constraint tiflisi_push_subscriptions_endpoint_len check (char_length(endpoint) between 12 and 2000),
  constraint tiflisi_push_subscriptions_p256dh_len check (char_length(p256dh) between 8 and 200),
  constraint tiflisi_push_subscriptions_auth_len check (char_length(auth) between 8 and 200)
);

create index if not exists tiflisi_push_subscriptions_account_idx
  on public.tiflisi_push_subscriptions (account_id);

alter table public.tiflisi_push_subscriptions enable row level security;

revoke all on table public.tiflisi_push_subscriptions from public, anon, authenticated;
grant select, insert, update, delete on table public.tiflisi_push_subscriptions to service_role;
