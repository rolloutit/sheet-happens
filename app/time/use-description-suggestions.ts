"use client";

import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import type { SuggestInputLabels, SuggestOption } from "@/src/components/ui/SuggestInput";
import { formatDateLabel } from "@/src/lib/formatting";
import type { DescriptionSuggestion } from "@/src/server/time-tracking";

/** How many of a project's own suggestions the list carries before the fallback group is added. */
const OWN_SUGGESTIONS_SHOWN = 8;

/**
 * Below this, a project is treated as having no usable history of its own and borrows from the
 * others — the first week on a new assignment, which is otherwise the one time a blank field is
 * guaranteed.
 */
const OWN_SUGGESTIONS_SPARSE = 3;

/** At most three borrowed, always under their own heading. */
const OTHER_SUGGESTIONS_SHOWN = 3;

export const SUGGESTION_GROUP_OTHER = "other";

/**
 * What `useDescriptionSuggestions` hands down.
 *
 * Passed as one object rather than as three props because every consumer needs all three: the
 * options for whichever project it has selected, the labels, and the chance to remember what it
 * just logged.
 */
export type DescriptionSuggestionsController = {
  optionsFor: (projectId: string) => SuggestOption[];
  labels: SuggestInputLabels;
  remember: (projectId: string, description: string) => void;
};

/**
 * The `/time` payload's flat suggestion list, as options for one project's description field.
 *
 * Two things live here rather than in `TimeGridClient`. The **scoping** — a project's own
 * suggestions first, and only when it has almost none, a clearly separated handful from the rest —
 * because a borrowed description can name the wrong client, so where that line sits should be one
 * readable decision rather than a filter buried in a render. And the **session merge**: every
 * mutating action on `/time` revalidates the page, so a description typed at 09:00 is in the
 * server's list by 09:01, but the composer that is open right now would not have it. `remember`
 * puts it at the top until the next payload arrives and makes it real.
 */
export function useDescriptionSuggestions(
  suggestions: readonly DescriptionSuggestion[],
): DescriptionSuggestionsController {
  const locale = useLocale();
  const t = useTranslations("TimeTracking");
  /* Session-local, deliberately not persisted: it is a copy of what the server is about to say. */
  const [justUsed, setJustUsed] = useState<Array<{ projectId: string; text: string }>>([]);

  const remember = useCallback((projectId: string, description: string) => {
    const text = description.trim().replace(/\s+/g, " ");

    if (!text) return;

    setJustUsed((current) => [
      { projectId, text },
      ...current.filter(
        (entry) => entry.projectId !== projectId || entry.text.toLowerCase() !== text.toLowerCase(),
      ),
    ]);
  }, []);

  const optionsFor = useCallback(
    (projectId: string): SuggestOption[] => {
      const seen = new Set<string>();
      const own: SuggestOption[] = [];

      for (const entry of justUsed) {
        if (entry.projectId !== projectId) continue;
        if (seen.has(entry.text.toLowerCase())) continue;

        seen.add(entry.text.toLowerCase());
        own.push({ text: entry.text, meta: t("suggestions.justUsed") });
      }

      for (const suggestion of suggestions) {
        if (suggestion.projectId !== projectId) continue;
        if (seen.has(suggestion.text.toLowerCase())) continue;
        if (own.length >= OWN_SUGGESTIONS_SHOWN) break;

        seen.add(suggestion.text.toLowerCase());
        own.push({ text: suggestion.text, meta: metaFor(suggestion, locale, t) });
      }

      if (own.length >= OWN_SUGGESTIONS_SPARSE) return own;

      const borrowed: SuggestOption[] = [];

      for (const suggestion of suggestions) {
        if (suggestion.projectId === projectId) continue;
        if (seen.has(suggestion.text.toLowerCase())) continue;
        if (borrowed.length >= OTHER_SUGGESTIONS_SHOWN) break;

        seen.add(suggestion.text.toLowerCase());
        borrowed.push({
          text: suggestion.text,
          meta: metaFor(suggestion, locale, t),
          group: SUGGESTION_GROUP_OTHER,
        });
      }

      return [...own, ...borrowed];
    },
    [justUsed, locale, suggestions, t],
  );

  const labels: SuggestInputLabels = {
    list: t("suggestions.label"),
    count: (count: number) => t("suggestions.count", { count }),
    empty: t("suggestions.empty"),
    hint: t("suggestions.hint"),
    groups: {
      [SUGGESTION_GROUP_OTHER]: t("suggestions.otherProjects"),
    },
  };

  return { optionsFor, labels, remember };
}

/** `12 times · last used Sep 3` — the date through `Intl`, like every other date on the page. */
function metaFor(
  suggestion: DescriptionSuggestion,
  locale: string,
  t: ReturnType<typeof useTranslations>,
) {
  return t("suggestions.meta", {
    count: suggestion.useCount,
    date: formatDateLabel(suggestion.lastUsedOn, locale, { style: "short" }),
  });
}
