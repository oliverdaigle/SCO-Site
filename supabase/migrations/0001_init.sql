-- Lotwise database. Paste this whole file into the Supabase SQL editor and press Run. It is safe to run more than once.

-- 1. Profiles: one row per signed-in user, created automatically on first sign-in.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  mode text check (mode in ('business', 'learner')),
  notation text check (notation in ('heizer', 'chopra', 'cachon', 'jacobs')),
  state jsonb,                       -- synced work: saved scenarios, practice progress, streak
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

-- 2. Subscriptions: written only by the Stripe webhook (service role). Users can read their own.
create table if not exists public.subscriptions (
  id text primary key,               -- Stripe subscription id, or checkout session id for the one-time semester pass
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('business_monthly', 'learner_monthly', 'learner_semester')),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- 3. Events: first-party, privacy-friendly analytics. No IP address, no cookies, no personal data.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null,
  props jsonb not null default '{}'::jsonb,
  mode text,
  path text,
  session text,                      -- random per-tab id, not tied to a person
  created_at timestamptz not null default now()
);
create index if not exists events_name_time_idx on public.events (name, created_at desc);
create index if not exists events_time_idx on public.events (created_at desc);

-- Row Level Security: every table is locked down, then opened only as far as needed.
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.events enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "subscriptions: read own" on public.subscriptions;
create policy "subscriptions: read own" on public.subscriptions for select using (auth.uid() = user_id);
-- events: no policies at all, so only the server (service role) can read or write them.

-- Users may change their own name, mode, notation and synced state, but never their billing link.
revoke update on public.profiles from authenticated, anon;
grant update (name, mode, notation, state, last_seen_at) on public.profiles to authenticated;

-- Create the profile row when someone signs up, and count the signup.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  insert into public.events (name, props) values ('signup', '{}'::jsonb);
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Numbers for the owner dashboard. Callable only with the service role key (from /api/admin/stats).
create or replace function public.admin_stats(days int default 30) returns jsonb language sql stable security definer set search_path = public as $$
  with win as (select now() - make_interval(days => days) as since),
  ev as (select e.* from public.events e, win where e.created_at >= win.since)
  select jsonb_build_object(
    'days', days,
    'signups', (select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'n', coalesce(c.n, 0)) order by d), '[]'::jsonb)
                from generate_series(current_date - (days - 1), current_date, interval '1 day') d
                left join (select created_at::date as dd, count(*) as n from public.profiles group by 1) c on c.dd = d::date),
    'totals', jsonb_build_object(
      'signups', (select count(*) from public.profiles),
      'signups30', (select count(*) from public.profiles p, win where p.created_at >= win.since),
      'active7', (select count(distinct session) from public.events where created_at >= now() - interval '7 days' and session is not null),
      'active30', (select count(distinct session) from public.events where created_at >= now() - interval '30 days' and session is not null),
      'bizPro', (select count(*) from public.subscriptions where plan = 'business_monthly' and status in ('active', 'trialing', 'past_due')),
      'learnPro', (select count(*) from public.subscriptions where plan = 'learner_monthly' and status in ('active', 'trialing', 'past_due')),
      'semester', (select count(*) from public.subscriptions where plan = 'learner_semester' and status = 'active' and current_period_end > now())),
    'topCalcs', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select props ->> 'calc' as id, count(*) as n from ev where name = 'calc_view' and props ? 'calc' group by 1 order by 2 desc limit 12) t),
    'misses', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (select lower(props ->> 'q') as q, count(*) as n from ev where name = 'search_miss' and props ? 'q' group by 1 order by 2 desc limit 15) t),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Visited', 'n', (select count(distinct session) from ev where session is not null)),
      jsonb_build_object('step', 'Used a calculator', 'n', (select count(distinct session) from ev where name in ('calc_view', 'calc_run') and session is not null)),
      jsonb_build_object('step', 'Saw an upgrade prompt', 'n', (select count(distinct session) from ev where name = 'upgrade_view' and session is not null)),
      jsonb_build_object('step', 'Started checkout', 'n', (select count(distinct session) from ev where name = 'checkout_start' and session is not null)),
      jsonb_build_object('step', 'Subscribed', 'n', (select count(*) from ev where name = 'subscribe'))),
    'modes', jsonb_build_object(
      'business', (select count(*) from ev where name = 'calc_view' and mode = 'business'),
      'learner', (select count(*) from ev where name = 'calc_view' and mode = 'learner'))
  );
$$;
revoke all on function public.admin_stats(int) from public, anon, authenticated;
grant execute on function public.admin_stats(int) to service_role;
