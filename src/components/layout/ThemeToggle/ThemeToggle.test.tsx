import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import { themeStorageKey } from "@/src/lib/theme";
import { ThemeProvider } from "../ThemeProvider";
import { ThemeToggle } from ".";

/** Listeners registered by next-themes for `(prefers-color-scheme: dark)`. */
let systemPrefersDark = false;
let mediaListeners: Array<(event: MediaQueryListEvent) => void> = [];

function setSystemPrefersDark(value: boolean) {
  systemPrefersDark = value;

  for (const listener of mediaListeners) {
    listener({ matches: value } as MediaQueryListEvent);
  }
}

beforeEach(() => {
  systemPrefersDark = false;
  mediaListeners = [];
  window.localStorage.clear();
  document.documentElement.className = "";

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      get matches() {
        return systemPrefersDark;
      },
      media: query,
      onchange: null,
      // next-themes 0.4.x still uses the deprecated pair.
      addListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.push(listener);
      },
      removeListener: (listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners = mediaListeners.filter((entry) => entry !== listener);
      },
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners.push(listener);
      },
      removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        mediaListeners = mediaListeners.filter((entry) => entry !== listener);
      },
      dispatchEvent: () => false,
    }),
  });
});

afterEach(() => {
  document.documentElement.className = "";
});

function renderToggle() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    </NextIntlClientProvider>,
  );
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Theme" }));

  return screen.findByRole("menu");
}

describe("ThemeToggle", () => {
  it("offers light, dark and system, with system selected by default", async () => {
    const user = userEvent.setup();
    renderToggle();
    await openMenu(user);

    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("stores the choice and applies it to the document element", async () => {
    const user = userEvent.setup();
    renderToggle();
    await openMenu(user);

    await user.click(screen.getByRole("menuitemradio", { name: "Light" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("light");
    });
    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
  });

  it("follows a change made in another tab", async () => {
    renderToggle();

    window.localStorage.setItem(themeStorageKey, "light");
    window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey, newValue: "light" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("light");
    });
  });

  it("re-resolves when the operating system flips while on system", async () => {
    const user = userEvent.setup();
    renderToggle();
    await openMenu(user);
    await user.click(screen.getByRole("menuitemradio", { name: "System" }));

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("light");
    });

    setSystemPrefersDark(true);

    await waitFor(() => {
      expect(document.documentElement).toHaveClass("dark");
    });
    expect(window.localStorage.getItem(themeStorageKey)).toBe("system");
  });
});
