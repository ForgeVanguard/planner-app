# Planner App (name pending, in testing)

![Status: Work in Progress](https://img.shields.io/badge/status-work%20in%20progress-orange)
![Stage: In Testing](https://img.shields.io/badge/stage-in%20testing-yellow)
![Expo](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

> **🚧 Work in progress / in testing.** The name is a placeholder and features, data shapes and screens may change. Not yet published to any app store.

A quarterly planning and daily execution app. You set a 13-week plan across four life areas, check off daily tactics, log a short end-of-day review, and track how consistently you execute. One Expo codebase runs on web, Android and iOS.

This is an independent, original project. It is not affiliated with, endorsed by, or derived from the code of any other planning product or publisher.

## Features

- **Quarter plan**: a vision statement plus four areas (Calibration, Connection, Condition, Contribution), each with an objective, a daily tactic, an optional second tactic and day-30 / day-60 checkpoints. Editable in one place.
- **Today**: check off tactics and up to six daily non-negotiables, back-fill missed days, and log an end-of-day review (Sustain / Improve / Adjust).
- **Snapshot**: streaks, points, an execution radar and a 91-day heatmap.
- **Quarter review**: rate each objective with your own execution data in view.
- **Teams and standings**: optional teams with their own weekly call day, plus a shared community board that compares everyone on the same quarter calendar.
- **Archive**: closed quarters stay read-only on the record, with trends, a two-quarter compare and lifetime achievements.
- **Exports**: JSON, CSV and Markdown.
- **Offline first**: every edit is saved locally and queued; sync merges per field (last write wins) when a backend is connected.
- Accessibility pass: contrast checks, labelled controls, loading and offline states, a desktop layout.

## Quick start (demo mode)

Demo mode needs no accounts or keys. It signs in as a fictional demo user (`demo@example.com` / `demo`) with a sample quarter, two closed quarters and a demo team.

```bash
npm install
npm run web        # http://localhost:43123
```

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest) for quarters, weeks, scoring, streaks, sync and archive |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run export:web` | Production web bundle in `dist/` |
| `npx expo start` | Run on a device with Expo Go |

## Optional backend (Supabase)

Leave the env vars empty to stay on-device. To try a backend:

1. Create a Supabase project.
2. Run `supabase/migrations/001_init.sql`, then `supabase/seed.sql`.
3. Copy `.env.example` to `.env` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never commit `.env` or a service-role key.

Row-level security is enabled: you read and write your own data, and see others' plans only when their visibility setting allows it.

## Project layout

```
app/                  Expo Router screens (web, iOS, Android)
brand.json            App name, scheme and bundle id (single rename point)
src/domain/           Pure quarter, week, scoring, streak, sync and archive logic
src/data/             Demo seed, local storage, Supabase client and sync
src/state/store.tsx   Optimistic updates, durable queue, online/offline
src/screens/          Today, Plan, Snapshot, Review, Standings, Team, Archive
supabase/             SQL schema, RLS policies, seed data
tests/                Vitest unit tests
```

## Scoring

| Action | Points |
| --- | --- |
| Each area tactic completed | 1 |
| All four areas in one day | +2 |
| All non-negotiables done (if any are set) | +1 |
| End-of-day review logged | +1 |

## Roadmap / known gaps

- [ ] Final product name and icon
- [ ] Load teams from the database instead of the in-app catalog when a backend is connected
- [ ] Test remote quarter-review sync end to end
- [ ] EAS project setup (`eas init`) and store builds
- [ ] Wider device testing

## License

MIT © Steven Drew
