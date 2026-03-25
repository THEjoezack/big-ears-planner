import { useCallback, useState } from "react";

import {
  encodeShareImportToken,
  SHARE_URL_WARN_LENGTH,
} from "@/lib/shareImportCodec";

/**
 * Build share URL and run Web Share API or clipboard fallback (same behavior as Settings).
 */
export function useShareScheduleLink(
  festivalId: string,
  activeProfileId: string
) {
  const [shareHint, setShareHint] = useState<string | null>(null);

  const shareOrCopy = useCallback(async () => {
    setShareHint(null);
    const { token, length } = encodeShareImportToken(
      festivalId,
      activeProfileId
    );
    const url = `${window.location.origin}${window.location.pathname}#import=${token}`;

    if (length > SHARE_URL_WARN_LENGTH) {
      setShareHint(
        "This link is very long; some apps or browsers may not handle it. If sharing fails, use Export (Base64) in Settings instead."
      );
    }

    try {
      if (navigator.share) {
        const shareData = {
          url,
          title: "Big Ears schedule share",
          text: "Shared festival planner data",
        };
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          return;
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setShareHint("Share was cancelled or failed. Use Copy link.");
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareHint("Link copied to clipboard.");
    } catch {
      setShareHint(
        "Could not copy automatically. Copy the link from Settings if needed."
      );
    }
  }, [festivalId, activeProfileId]);

  const copyShareUrl = useCallback(() => {
    setShareHint(null);
    const { token } = encodeShareImportToken(festivalId, activeProfileId);
    const url = `${window.location.origin}${window.location.pathname}#import=${token}`;
    void navigator.clipboard.writeText(url).then(
      () => setShareHint("Link copied to clipboard."),
      () => setShareHint("Could not copy to clipboard.")
    );
  }, [festivalId, activeProfileId]);

  return { shareHint, setShareHint, shareOrCopy, copyShareUrl };
}
