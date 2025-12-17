import { apiGet, apiPost } from "./fetcher";
import { OpinionsResponse } from "./types";

export function getOpinions(listingId: string, n = 3) {
  return apiGet<OpinionsResponse>(`/listings/${listingId}/opinions?n=${n}`);
}

export function createOpinion(
  listingId: string,
  payload: {
    user_name?: string | null;
    cleanliness: number;
    safety: number;
    parking: number;
    noise: number;
    transit_access: number;
    sunlight: number;
    overall: number;
    review_text: string;
  },
  n = 3
) {
  return apiPost<OpinionsResponse>(
    `/listings/${listingId}/opinions?n=${n}`,
    payload
  );
}
