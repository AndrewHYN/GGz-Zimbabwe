export interface User {
  id: number;
  username: string;
  email: string;
}

export interface GamerProfile {
  id: number;
  user: User;
  gamer_tag: string;
  avatar: string | null;
  cover: string | null;
  bio: string;
  location: string;
  platform: string;
  rank: string;
  availability: string;
  respect_points: number;
  tournament_wins: number;
  games: Game[];
  is_online: boolean;
  last_seen: string;
}

export interface Game {
  id: number;
  name: string;
  slug: string;
  cover_art_url: string | null;
  description: string;
  genre: string;
  developer: string;
  publisher: string;
  platform: string;
  player_count: number;
  popularity: number;
  release_year: number;
  free_to_play: boolean;
  featured: boolean;
  sponsored: boolean;
  local_developer: boolean;
  steam_url: string | null;
  epic_url: string | null;
  store_url: string | null;
  trailer_url: string | null;
  igdb_id: number | null;
  igdb_slug: string | null;
  igdb_url: string | null;
  igdb_rating: number | null;
  igdb_genres: string | null;
  igdb_platforms: string | null;
  igdb_summary: string | null;
}

export interface Tournament {
  id: number;
  organizer: GamerProfile;
  game: Game;
  name: string;
  slug: string;
  description: string;
  banner: string | null;
  format: string;
  max_participants: number;
  start_date: string;
  registration_deadline: string;
  location: string;
  city: string;
  mode: string;
  entry_type: string;
  prize_description: string;
  rules: string;
  status: string;
  registration_count: number;
}

export interface TournamentMatch {
  id: number;
  tournament: Tournament;
  game: Game;
  player_one: GamerProfile | null;
  player_two: GamerProfile | null;
  winner: GamerProfile | null;
  round: number;
  scheduled_at: string | null;
  score: string;
  status: string;
}

export interface Event {
  id: number;
  organizer: GamerProfile;
  organization: Organization | null;
  game: Game | null;
  name: string;
  description: string;
  banner: string | null;
  start_date: string;
  location: string;
  city: string;
  mode: string;
  capacity: number;
  status: string;
  featured: boolean;
  rsvp_count: number;
}

export interface Organization {
  id: number;
  owner: GamerProfile;
  name: string;
  slug: string;
  description: string;
  organization_type: string;
  website: string | null;
  logo: string | null;
  verification_status: string;
  event_count: number;
}

export interface Listing {
  id: number;
  seller: GamerProfile;
  title: string;
  description: string;
  category: string;
  price: string;
  condition: string;
  location: string;
  game: Game | null;
  platform: string;
  status: string;
  images: ListingImage[];
  save_count: number;
  created_at: string;
}

export interface ListingImage {
  id: number;
  image: string;
  order: number;
}

export interface Team {
  id: number;
  owner: GamerProfile;
  game: Game | null;
  name: string;
  tag: string;
  slug: string;
  description: string;
  logo: string | null;
  banner: string | null;
  location: string;
  status: string;
  member_count: number;
  matches_played: number;
  wins: number;
  losses: number;
}

export interface Post {
  id: number;
  author: GamerProfile;
  content: string;
  image: string | null;
  created_at: string;
  updated_at: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_saved: boolean;
}

export interface Comment {
  id: number;
  author: GamerProfile;
  post: number;
  content: string;
  created_at: string;
}

export interface Notification {
  id: number;
  actor: GamerProfile;
  verb: string;
  target_type: string;
  target_id: number;
  is_read: boolean;
  created_at: string;
}

export interface Conversation {
  id: number;
  other_participant: GamerProfile;
  last_message: Message | null;
  unread_count: number;
  updated_at: string;
}

export interface Message {
  id: number;
  sender: GamerProfile;
  content: string;
  created_at: string;
  is_read: boolean;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

export interface SearchResult {
  games: Game[];
  gamers: GamerProfile[];
  teams: Team[];
  tournaments: Tournament[];
  events: Event[];
}
