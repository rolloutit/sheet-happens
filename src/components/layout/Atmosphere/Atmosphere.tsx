/* The decorative brand layer behind the app: blobs and a dot lattice (`.sheet-atmosphere`), plus
 * the grain overlay (`.sheet-grain`) that keeps the aurora from banding. All geometry, motion and
 * theming live in `app/globals.css`; this component only supplies the DOM. Rendered once by
 * `AppShell` and once by `AuthShell`, inside a positioned container, with the shell's own content
 * lifted to `z-index: 2`. Dark-only — `.light` hides both layers.
 *
 * PROVISIONAL SHAPES: the paths below are superellipse stubs. The real silhouettes must be
 * exported as SVG from the styleguide's "Graphical elements" frame — the specific shapes are the
 * brand, and redrawing them by eye is not an option (docs/dark-mode-redesign.md §5, Layer 2).
 */

/* A superellipse (|x/100|⁴ + |y/100|⁴ = 1) approximated with one cubic per quadrant. */
const stubBlobPath =
  "M100 2 C 154 2 198 46 198 100 C 198 154 154 198 100 198 C 46 198 2 154 2 100 C 2 46 46 2 100 2 Z";

type StubBlobProps = {
  className: string;
  gradientId: string;
  colorVar: string;
};

function StubBlob({ className, gradientId, colorVar }: StubBlobProps) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none">
      <defs>
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" style={{ stopColor: `var(${colorVar})` }} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      <path d={stubBlobPath} fill={`url(#${gradientId})`} />
    </svg>
  );
}

export function Atmosphere() {
  return (
    <>
      <div className="sheet-atmosphere" aria-hidden="true">
        <StubBlob
          className="sheet-blob sheet-blob--mint"
          gradientId="atmo-blob-gradient-mint"
          colorVar="--atmo-blob-mint"
        />
        <StubBlob
          className="sheet-blob sheet-blob--peach"
          gradientId="atmo-blob-gradient-peach"
          colorVar="--atmo-blob-peach"
        />
      </div>
      <div className="sheet-grain" aria-hidden="true" />
    </>
  );
}
