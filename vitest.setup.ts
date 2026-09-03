import "@testing-library/jest-dom/vitest";

// jsdom ships no matchMedia, and next-themes still calls the deprecated addListener/
// removeListener pair — without both APIs every render that mounts ThemeProvider throws.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string): MediaQueryList => {
      const listeners = new Set<(event: MediaQueryListEvent) => void>();

      const mediaQueryList: MediaQueryList = {
        matches: false,
        media: query,
        onchange: null,
        addListener: (listener) => {
          if (listener) listeners.add(listener as (event: MediaQueryListEvent) => void);
        },
        removeListener: (listener) => {
          if (listener) listeners.delete(listener as (event: MediaQueryListEvent) => void);
        },
        addEventListener: (_type: string, listener: unknown) => {
          listeners.add(listener as (event: MediaQueryListEvent) => void);
        },
        removeEventListener: (_type: string, listener: unknown) => {
          listeners.delete(listener as (event: MediaQueryListEvent) => void);
        },
        dispatchEvent: (event) => {
          for (const listener of listeners) listener(event as MediaQueryListEvent);
          return true;
        },
      };

      return mediaQueryList;
    },
  });
}

// jsdom ships no ResizeObserver either, and Radix measures its trigger before mounting the
// hidden input that makes a checkbox part of a `<form>` — so without this stub every test
// that renders one throws in a layout effect. A no-op is enough: nothing under test reacts
// to a resize, only to the observer existing.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
