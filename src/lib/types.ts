export interface Genre {
  id: string;
  user_id: string;
  name: string;
  cover_url: string;
  created_at: string;
  pairing_count?: number;
}

export interface Pairing {
  id: string;
  user_id: string;
  genre_id: string;
  name: string;
  description: string;
  character_tags: string[];
  cover_url: string;
  theme_color: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  track_count?: number;
  genre?: Genre;
}

export interface Track {
  id: string;
  user_id: string;
  pairing_id: string;
  title: string;
  description: string;
  youtube_url: string;
  order_index: number;
  created_at: string;
}
