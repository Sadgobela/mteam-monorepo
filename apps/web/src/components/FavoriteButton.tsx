"use client";

import { useOptimistic } from "react";
import { unstable_rethrow } from "next/navigation";
import { App } from "antd";
import type { Locale } from "@mteam/shared";
import { setFavoriteAction } from "@/lib/account-actions";
import { SubmitButton } from "./SubmitButton";

export function Heart({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 20s-7-4.5-9-9a4.8 4.8 0 0 1 9-2.5A4.8 4.8 0 0 1 21 11c-2 4.5-9 9-9 9z" />
    </svg>
  );
}

export interface FavoriteLabels {
  add: string;
  remove: string;
  added: string;
  removed: string;
  failed: string;
}

/** The heart on a listing card. It flips at once, and flips back with a note if saving fails. */
export function FavoriteButton({ locale, listingId, active, labels }: { locale: Locale; listingId: number; active: boolean; labels: FavoriteLabels }) {
  const [shown, setShown] = useOptimistic(active);
  const { message } = App.useApp();
  return (
    <form
      action={async (form) => {
        setShown(!active);
        try {
          await setFavoriteAction(form);
        } catch (error) {
          unstable_rethrow(error);
          message.error(labels.failed);
          return;
        }
        message.success(active ? labels.removed : labels.added);
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="want" value={active ? "0" : "1"} />
      {/* Busy until the saved state catches up with the heart, so it cannot be pressed twice meanwhile. */}
      <SubmitButton className="fav" pending={shown !== active} aria-label={shown ? labels.remove : labels.add}>
        <Heart filled={shown} />
      </SubmitButton>
    </form>
  );
}
