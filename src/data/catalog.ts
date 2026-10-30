import type { BoardPost, SampleMember, Team } from "../types";

export const TEAMS: Team[] = [
  {
    id: "team-northline",
    name: "Northline",
    blurb: "Men who train before work and tell the truth about the week.",
    weekStartDay: 4,
    callTime: "19:00",
    timeZone: "America/New_York",
    leaderId: "demo-user",
    leaderName: "Marcus Hale",
  },
  {
    id: "team-harbor",
    name: "Harbor Watch",
    blurb: "Fathers who keep a weekly table and a short list.",
    weekStartDay: 1,
    callTime: "20:00",
    timeZone: "America/Chicago",
    leaderId: "sample-ortiz",
    leaderName: "Samuel Ortiz",
  },
  {
    id: "team-cedar",
    name: "Red Cedar",
    blurb: "Tradesmen and builders. The call is Tuesday night.",
    weekStartDay: 2,
    callTime: "18:30",
    timeZone: "America/Denver",
    leaderId: "sample-peck",
    leaderName: "Jonah Peck",
  },
  {
    id: "team-lantern",
    name: "Lantern & Co",
    blurb: "Small business owners comparing the week they actually worked.",
    weekStartDay: 3,
    callTime: "07:30",
    timeZone: "America/Los_Angeles",
    leaderId: "sample-adebayo",
    leaderName: "Tomi Adebayo",
  },
  {
    id: "team-kiln",
    name: "Kiln",
    blurb: "Makers and designers. Thursday is the call.",
    weekStartDay: 4,
    callTime: "12:00",
    timeZone: "America/New_York",
    leaderId: "sample-cho",
    leaderName: "Elliot Cho",
  },
  {
    id: "team-shift",
    name: "Second Shift",
    blurb: "Night-schedule workers. Their week opens on Sunday.",
    weekStartDay: 0,
    callTime: "21:00",
    timeZone: "America/Chicago",
    leaderId: "sample-nunez",
    leaderName: "Andre Nunez",
  },
  {
    id: "team-water",
    name: "Open Water",
    blurb: "Endurance and time outside. The call is Saturday morning.",
    weekStartDay: 6,
    callTime: "08:00",
    timeZone: "America/Los_Angeles",
    leaderId: "sample-berg",
    leaderName: "Nils Berg",
  },
  {
    id: "team-table",
    name: "The Long Table",
    blurb: "A meal and a check-in. Nothing fancier. Friday evening.",
    weekStartDay: 5,
    callTime: "18:00",
    timeZone: "America/New_York",
    leaderId: "sample-okonkwo",
    leaderName: "Chidi Okonkwo",
  },
];

const Q2 = "q2-2026";
const Q3 = "q3-2026";
const Q4 = "q4-2026";

export const SAMPLE_MEMBERS: SampleMember[] = [
  member("sample-ward", "Elias Ward", "team-northline", "everyone", [88, 102, 96], 40, 18, 6, ["streak-7", "full-10"], 4),
  member("sample-brennan", "Patrick Brennan", "team-northline", "team", [70, 64, 80], 28, 9, 3, ["streak-3"], 2),
  member("sample-okonkwo", "Chidi Okonkwo", "team-table", "everyone", [110, 124, 118], 50, 22, 11, ["streak-14", "full-10"], 1),
  member("sample-ortiz", "Samuel Ortiz", "team-harbor", "everyone", [76, 90, 84], 33, 12, 5, ["streak-7"], 6),
  member("sample-peck", "Jonah Peck", "team-cedar", "team", [54, 61, 58], 22, 4, 2, ["streak-3"], 0),
  member("sample-adebayo", "Tomi Adebayo", "team-lantern", "everyone", [130, 141, 136], 55, 30, 9, ["streak-14", "full-30"], 3),
  member("sample-cho", "Elliot Cho", "team-kiln", "team", [44, 51, 47], 18, 3, 1, [], 1),
  member("sample-nunez", "Andre Nunez", "team-shift", "everyone", [61, 73, 69], 25, 7, 4, ["streak-7"], 8),
  member("sample-berg", "Nils Berg", "team-water", "everyone", [95, 88, 101], 36, 16, 8, ["streak-7", "full-10"], 0),
  member("sample-dalton", "Hugh Dalton", "team-harbor", "private", [40, 36, 42], 12, 1, 0, [], 2),
  member("sample-reid", "Calvin Reid", "team-northline", "everyone", [82, 79, 91], 31, 11, 4, ["streak-7"], 5),
  member("sample-moreau", "Luc Moreau", "team-table", "team", [58, 66, 62], 20, 5, 2, ["streak-3"], 1),
  member("sample-singh", "Arun Singh", "team-lantern", "everyone", [99, 107, 104], 38, 14, 7, ["streak-7", "full-10"], 2),
  member("sample-vogel", "Markus Vogel", "team-kiln", "everyone", [71, 68, 74], 24, 6, 3, ["streak-3"], 0),
];

function member(
  userId: string,
  name: string,
  teamId: string,
  visibility: SampleMember["visibility"],
  points: [number, number, number],
  daysLogged: number,
  fullFours: number,
  streak: number,
  badges: string[],
  eveningLogs: number,
): SampleMember {
  return {
    userId,
    name,
    teamId,
    visibility,
    pointsByQuarter: { [Q2]: points[0], [Q3]: points[1], [Q4]: points[2] },
    daysLogged,
    fullFours,
    streak,
    badges,
    eveningLogs,
  };
}

export const CATALOG_POSTS: BoardPost[] = [
  {
    id: "post-1",
    teamId: "team-northline",
    authorId: "sample-ward",
    authorName: "Elias Ward",
    body: "Thursday call is 7pm Eastern. Have your week closed out before then — the numbers we read on the call are Wednesday's, not whatever you remember in the moment.",
    createdAt: "2026-10-12T14:00:00.000Z",
  },
  {
    id: "post-2",
    teamId: "team-northline",
    authorId: "sample-reid",
    authorName: "Calvin Reid",
    body: "I logged two late days from a job site with no signal. They show as late corrections. The quarter total still counted them.",
    createdAt: "2026-10-15T11:12:00.000Z",
  },
  {
    id: "post-3",
    teamId: "team-harbor",
    authorId: "sample-ortiz",
    authorName: "Samuel Ortiz",
    body: "Harbor Watch weeks run Monday through Sunday. Don't compare our weekly board to a Thursday team — the community board is the fair one.",
    createdAt: "2026-10-06T16:40:00.000Z",
  },
];
