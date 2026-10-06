/**
 * The dynamic-import boundary for Motion's feature bundle.
 *
 * `LazyMotion` loads this on the client after first paint, which is what keeps ~30 KB of animation
 * and layout-projection code out of every other route — `/time` is the only consumer.
 *
 * **`domMax`, not `domAnimation`.** The two differ by exactly the thing this feature is built on:
 * `domAnimation` omits layout projection and drag, so `layout` and `layoutId` would silently become
 * no-ops and the level change would go back to being three screens swapping.
 */
export { domMax as default } from "motion/react";
