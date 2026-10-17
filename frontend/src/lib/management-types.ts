export interface OrganizationData {
  id: number;
  name: string;
  slug: string;
  description: string;
  organization_type: string;
  website: string;
  city: string;
  verification_status: string;
  is_owner: boolean;
  venues: VenueData[];
}
export interface VenueReview {
  id: number;
  body: string;
  rating: number;
  author: { gamer_tag: string };
}
export interface VenueData {
  id: number;
  name: string;
  description: string;
  organization_id: number;
  organization_name: string;
  city: string;
  address: string;
  category: string;
  latitude: number;
  longitude: number;
  phone: string;
  website: string;
  opening_hours: string;
  public_visible: boolean;
  verification_status: string;
  is_owner: boolean;
  reviews: VenueReview[];
  rating_average: number | null;
  rating_count: number;
}
export interface InvitationData {
  id: number | string;
  target_url?: string;
  type: string;
  team_name: string;
  team_slug: string;
  actor: { gamer_tag: string };
  recipient: { gamer_tag: string };
  status: string;
  is_recipient: boolean;
}
export interface ChallengeData {
  id: number;
  game_name: string;
  status: string;
  challenger: { gamer_tag: string };
  opponent: { gamer_tag: string };
  scheduled_at?: string;
  result?: { winner: string; score: string };
  is_recipient: boolean;
  is_challenger: boolean;
  can_confirm: boolean;
}
