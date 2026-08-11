/**
 * The focus treatment for controls that carry their own visible border.
 *
 * `app/globals.css` gives every focusable element a 2px `--ring` outline from `@layer base`, so a
 * borderless control — a pill button, a tab, a table row — declares nothing and inherits it. That
 * outline is the wrong answer for a bordered inset control: it lands 2px outside an edge that is
 * already drawn, reading as a second ring around the first. These two brighten the existing border
 * instead, so focus changes one colour and no geometry.
 *
 * Keyed on `focus-visible:` rather than `focus:`. Radix takes focus on pointer-down, so `focus:`
 * painted a ring on every mouse click on a `Select` trigger; `:focus-visible` does not match a
 * mouse-clicked button, which is the point — pointer users get the hover tint, keyboard users get
 * the border.
 */
export const focusChromeClassName = "focus-visible:outline-none focus-visible:border-ring";

/**
 * The same treatment where the border sits on a wrapper and the focusable element is a bare
 * `<input>` or a trigger stripped of its own chrome inside it. `:has()` puts the brighten on the
 * element that actually draws the edge.
 */
export const focusChromeWithinClassName = "has-[:focus-visible]:border-ring";
