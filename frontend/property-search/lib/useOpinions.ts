import { useEffect, useState } from "react";
import { getOpinions } from "./opinions";
import type { OpinionsResponse } from "./types";

export function useOpinions(listingId?: string, n = 3) {
  const [data, setData] = useState<OpinionsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!listingId) {
      setData(null);
      setErr(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);

    getOpinions(listingId, n)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setErr(e))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [listingId, n]);

  return { data, loading, err };
}
