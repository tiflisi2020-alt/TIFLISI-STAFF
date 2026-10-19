-- Staff portal: internal announcements and private profile details.
create table if not exists public.tiflisi_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) between 1 and 5000),
  kind text not null default 'info' check (kind in ('info', 'urgent', 'schedule', 'event')),
  is_pinned boolean not null default false,
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by bigint not null references public.tiflisi_accounts(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tiflisi_announcements_visible_idx
  on public.tiflisi_announcements (published_at desc, is_pinned desc);

create table if not exists public.tiflisi_profile_details (
  account_id bigint primary key references public.tiflisi_accounts(id) on delete cascade,
  preferred_name text check (preferred_name is null or char_length(preferred_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 40),
  bio text check (bio is null or char_length(bio) <= 500),
  emergency_contact text check (emergency_contact is null or char_length(emergency_contact) <= 120),
  updated_at timestamptz not null default now()
);

create index if not exists tiflisi_profile_details_updated_idx
  on public.tiflisi_profile_details (updated_at desc);
