-- Planner App schema. Apply in the Supabase SQL editor or with the Supabase CLI.
-- Client-generated ids are text so a quarter created on a phone keeps its id across sync.
-- Quarters are never deleted by policy. The archive is permanent.

create extension if not exists pgcrypto;

create table public.teams (
  id text primary key,
  name text not null unique,
  blurb text not null default '',
  week_start_day smallint not null default 1 check (week_start_day between 0 and 6),
  call_time text not null default '19:00',
  time_zone text not null default 'America/New_York',
  leader_id uuid,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  team_id text references public.teams (id),
  visibility text not null default 'team' check (visibility in ('everyone', 'team', 'private')),
  morning_reminder text not null default '07:00',
  evening_reminder text not null default '21:00',
  reminders_enabled boolean not null default true,
  onboarded boolean not null default false,
  field_times jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.teams
  add constraint teams_leader_fk foreign key (leader_id) references public.profiles (id) on delete set null;

create table public.quarters (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  start_date date not null,
  end_date date not null,
  status text not null check (status in ('active', 'draft', 'closed')),
  vision text not null default '',
  carry_forward_note text not null default '',
  field_times jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.quadrant_plans (
  quarter_id text not null references public.quarters (id) on delete cascade,
  quadrant text not null check (quadrant in ('calibration', 'connection', 'condition', 'contribution')),
  objective text not null default '',
  tactic text not null default '',
  secondary_tactic text not null default '',
  checkpoint_30 text not null default '',
  checkpoint_60 text not null default '',
  checkpoint_30_done boolean not null default false,
  checkpoint_60_done boolean not null default false,
  field_times jsonb not null default '{}'::jsonb,
  primary key (quarter_id, quadrant)
);

create table public.non_negotiables (
  id text primary key,
  quarter_id text not null references public.quarters (id) on delete cascade,
  position int not null check (position between 1 and 12),
  label text not null default '',
  deleted boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.day_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quarter_id text not null references public.quarters (id) on delete cascade,
  log_date date not null,
  tactic_calibration boolean not null default false,
  tactic_connection boolean not null default false,
  tactic_condition boolean not null default false,
  tactic_contribution boolean not null default false,
  non_negotiable_checks jsonb not null default '{}'::jsonb,
  sustain text not null default '',
  improve text not null default '',
  adjust text not null default '',
  logged_at timestamptz,
  field_times jsonb not null default '{}'::jsonb,
  unique (user_id, log_date)
);

create table public.reviews (
  quarter_id text primary key references public.quarters (id) on delete cascade,
  calibration_rating text check (calibration_rating in ('hit', 'partial', 'missed')),
  calibration_notes text not null default '',
  connection_rating text check (connection_rating in ('hit', 'partial', 'missed')),
  connection_notes text not null default '',
  condition_rating text check (condition_rating in ('hit', 'partial', 'missed')),
  condition_notes text not null default '',
  contribution_rating text check (contribution_rating in ('hit', 'partial', 'missed')),
  contribution_notes text not null default '',
  sustain text not null default '',
  improve text not null default '',
  adjust text not null default '',
  carry_forward text not null default '',
  closed boolean not null default false,
  field_times jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.quarter_snapshots (
  quarter_id text primary key references public.quarters (id) on delete cascade,
  points int not null default 0,
  full_fours int not null default 0,
  best_streak int not null default 0,
  streak_at_close int not null default 0,
  days_logged int not null default 0,
  execution jsonb not null default '{}'::jsonb,
  team_rank int,
  council_rank int,
  team_size int,
  council_size int,
  badges text[] not null default '{}',
  closed_at timestamptz not null default now()
);

create table public.public_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  quarter_id text not null references public.quarters (id) on delete cascade,
  quarter_label text not null,
  points int not null default 0,
  days_logged int not null default 0,
  full_fours int not null default 0,
  current_streak int not null default 0,
  badges text[] not null default '{}',
  evening_logs int not null default 0,
  recent jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, quarter_id)
);

create table public.board_posts (
  id text primary key,
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.leader_requests (
  id uuid primary key default gen_random_uuid(),
  team_id text not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (team_id, user_id)
);

create table public.feedback (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('idea', 'bug', 'other')),
  body text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.can_read_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles me
    join public.profiles them on them.id = target
    where me.id = auth.uid()
      and (
        them.id = auth.uid()
        or them.visibility = 'everyone'
        or (
          them.visibility = 'team'
          and them.team_id is not null
          and them.team_id = me.team_id
        )
      )
  );
$$;

alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.quarters enable row level security;
alter table public.quadrant_plans enable row level security;
alter table public.non_negotiables enable row level security;
alter table public.day_logs enable row level security;
alter table public.reviews enable row level security;
alter table public.quarter_snapshots enable row level security;
alter table public.public_stats enable row level security;
alter table public.board_posts enable row level security;
alter table public.leader_requests enable row level security;
alter table public.feedback enable row level security;

create policy teams_read on public.teams for select to authenticated using (true);
create policy teams_leader_update on public.teams for update to authenticated
  using (leader_id = auth.uid())
  with check (leader_id = auth.uid());

create policy profiles_read on public.profiles for select to authenticated
  using (public.can_read_member(id) or id = auth.uid());
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy quarters_own on public.quarters for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy plans_own on public.quadrant_plans for all to authenticated
  using (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()));

create policy nn_own on public.non_negotiables for all to authenticated
  using (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()));

create policy logs_own on public.day_logs for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy reviews_own on public.reviews for all to authenticated
  using (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()));

create policy snapshots_own on public.quarter_snapshots for all to authenticated
  using (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()))
  with check (exists (select 1 from public.quarters q where q.id = quarter_id and q.user_id = auth.uid()));

create policy stats_write on public.public_stats for insert to authenticated
  with check (user_id = auth.uid());
create policy stats_update on public.public_stats for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy stats_read on public.public_stats for select to authenticated
  using (public.can_read_member(user_id));

create policy posts_read on public.board_posts for select to authenticated
  using (exists (
    select 1 from public.profiles me
    where me.id = auth.uid() and me.team_id = board_posts.team_id
  ));
create policy posts_write on public.board_posts for insert to authenticated
  with check (user_id = auth.uid());

create policy lead_own on public.leader_requests for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy feedback_own on public.feedback for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- No delete policies for quarters. Closing a quarter changes status; it does not remove the row.
revoke delete on public.quarters from authenticated;
revoke delete on public.day_logs from authenticated;
