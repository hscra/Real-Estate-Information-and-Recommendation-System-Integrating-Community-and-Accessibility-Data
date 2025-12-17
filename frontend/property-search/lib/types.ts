export type PricePoint = { date: string; price: number };

export type Listing = {
  listing_id: string;
  city?: string;
  type?: "buy" | "rent";
  square_m?: number;
  rooms?: number;
  floor?: number;
  floor_count?: number;
  build_year?: number;
  latitude?: number;
  longitude?: number;
  price?: number;
  // Optional model predictions from backend
  predicted_svm?: number;
  predicted_hgbr?: number;
  predicted_nn?: number;
  has_parking_space?: boolean;
  has_balcony?: boolean;
  has_elevator?: boolean;
  has_security?: boolean;
  has_storage_room?: boolean;
  price_history?: PricePoint[];
  school_distance?: number;
  clinic_distance?: number;
  post_office_distance?: number;
  kindergarten_distance?: number;
  restaurant_distance?: number;
  college_distance?: number;
  pharmacy_distance?: number;
};

export type ListingsResponse = {
  items: Listing[];
  page: number;
  page_size: number;
  total: number;
};

export interface Opinion {
  opinion_id: string;
  listing_id: string;
  cleanliness: number;
  safety: number;
  parking: number;
  noise: number;
  transit_access: number;
  sunlight: number;
  overall: number;
  review_text: string; // NOTE: 'review_text' (backend column rename)
  source: string;
}

export interface OpinionsResponse {
  listing_id: string;
  opinions: Opinion[];
}

// What-if price impact
export type PriceImpactRequest = {
  centre_distance_km_change?: number | null;
  transit_upgrade?: boolean | null;
  transit_access_delta?: number | null;
  new_poi_delta?: number | null;
  amenity_distance_changes?: Record<string, number> | null; // meters (negative = closer)
};

export type PriceImpactResponse = {
  listing_id: string;
  base_price: number;
  adjusted_price: number;
  delta_amount: number;
  delta_pct: number; // fraction, e.g. 0.025 = +2.5%
  used_prediction: boolean;
  breakdown: Record<string, number>; // factor -> percent (fraction)
};
