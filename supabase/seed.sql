-- Sample teams. Week start day is the call day: 0 Sunday … 6 Saturday.
-- A Thursday team (4) runs Thursday–Wednesday and finalizes numbers by end of Wednesday.

insert into public.teams (id, name, blurb, week_start_day, call_time, time_zone)
values
  ('team-northline', 'Northline', 'Men who train before work and tell the truth about the week.', 4, '19:00', 'America/New_York'),
  ('team-harbor', 'Harbor Watch', 'Fathers who keep a weekly table and a short list.', 1, '20:00', 'America/Chicago'),
  ('team-cedar', 'Red Cedar', 'Tradesmen and builders. The call is Tuesday night.', 2, '18:30', 'America/Denver'),
  ('team-lantern', 'Lantern & Co', 'Small business owners comparing the week they actually worked.', 3, '07:30', 'America/Los_Angeles'),
  ('team-kiln', 'Kiln', 'Makers and designers. Thursday is the call.', 4, '12:00', 'America/New_York'),
  ('team-shift', 'Second Shift', 'Night-schedule workers. Their week opens on Sunday.', 0, '21:00', 'America/Chicago'),
  ('team-water', 'Open Water', 'Endurance and time outside. The call is Saturday morning.', 6, '08:00', 'America/Los_Angeles'),
  ('team-table', 'The Long Table', 'A meal and a check-in. Nothing fancier. Friday evening.', 5, '18:00', 'America/New_York')
on conflict (id) do update set
  name = excluded.name,
  blurb = excluded.blurb,
  week_start_day = excluded.week_start_day,
  call_time = excluded.call_time,
  time_zone = excluded.time_zone;
