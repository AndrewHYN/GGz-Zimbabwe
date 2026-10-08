export interface Competition {
  id: number;
  slug: string;
  name: string;
  game_name: string;
  status: string;
  start_date: string;
  location: string;
  mode: string;
  max_participants: number;
  participant_count: number;
  prize_description?: string;
  format?: string;
}
export interface CompetitionDetail extends Competition {
  game_id: number;
  description: string;
  rules: string;
  entry_type: string;
  registration_deadline: string;
  registration_open: boolean;
  authenticated: boolean;
  eligible: boolean;
  is_organizer: boolean;
  registration_status: string | null;
  organizer: { gamer_tag: string };
  participants: { gamer_tag: string }[];
  matches: {
    id: number;
    round: number;
    status: string;
    score: string | null;
    player_one: string | null;
    player_two: string | null;
    player_one_id: number | null;
    player_two_id: number | null;
    winner: string | null;
  }[];
}
export function eventTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Harare",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
export function safeNext(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return "/dashboard";
  return /^\/(tournaments|dashboard|organize|discover)(\/|\?|$)/.test(value)
    ? value
    : "/dashboard";
}
