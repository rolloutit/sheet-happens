"use client";

import { useEffect, useRef } from "react";

/**
 * Restores a control's own state when its `<form>` is reset.
 *
 * Native controls and Radix's Select follow `form.reset()` for free; a control backed by
 * React state does not. Several forms here call `formRef.current?.reset()` after a
 * successful Server Action (`InviteMemberForm`, `ProjectCreateForm`,
 * `AdminProjectGroupsPanel`), and without this the visible trigger would keep showing the
 * previous choice while the submitted value had already reset — a desync the user cannot
 * see and the next submit fails on.
 *
 * Resolve `element` from the trigger button: buttons expose `.form`, which respects the
 * `form="<id>"` attribute, unlike `closest("form")`.
 */
export function useFormReset(element: HTMLButtonElement | null, onReset: () => void) {
  const handlerRef = useRef(onReset);

  useEffect(() => {
    handlerRef.current = onReset;
  });

  useEffect(() => {
    const form = element?.form;
    if (!form) return;

    const handleReset = () => {
      // The browser resets its own controls after this event, so defer to match.
      window.requestAnimationFrame(() => handlerRef.current());
    };

    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [element]);
}
