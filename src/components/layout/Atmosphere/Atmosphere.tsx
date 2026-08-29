import { arc, mintBlob, peachBlob, wave } from "./Atmosphere.shapes";

/* The decorative brand layer behind the app: blob glows, a wave ridge, a line-art swoosh, the dot
 * lattice (`.sheet-atmosphere`), and the grain overlay (`.sheet-grain`) that keeps the aurora from
 * banding. All geometry comes from the styleguide exports in `Atmosphere.shapes.ts`; positioning,
 * motion and theming live in `app/globals.css`. Rendered once by `AppShell` and once by
 * `AuthShell`, inside a positioned container, with the shell's own content lifted to `z-index: 2`.
 * Both themes; only `.sheet-grain` is dark-only, because banding is a near-black artifact.
 *
 * Each blob is the brand's signature composition: a gradient-lit fill plus the same silhouette as
 * an offset outline echo (see `svgs/Group-1.svg`). The echo is what lets the eye read the shape's
 * form without the fill getting loud — the glow carries light, the line carries edge.
 *
 * Nothing in this file is per-theme: geometry, blurs, offsets and drift are shared, and the themes
 * differ only in the `--atmo-*` values they resolve. In dark the shapes stop being ink and become
 * light; in light they go back to being ink — a printed pastel with its echo line — which is the
 * medium the styleguide drew them in to begin with.
 */

type BlobShape = {
  viewBox: string;
  d: string;
};

type EchoBlobProps = {
  className: string;
  shape: BlobShape;
  gradientId: string;
  fillVar: string;
  lineVar: string;
  /* CSS `translate` for the echo layer, mirroring the Group compositions' offset outline. */
  echoOffset: string;
};

function EchoBlob({ className, shape, gradientId, fillVar, lineVar, echoOffset }: EchoBlobProps) {
  /* Fill and echo are separate SVG layers because they need different blurs: the fill is blurred
     into a glow, while the echo keeps a near-crisp edge — one shared filter would either sharpen
     the glow into a sticker or dissolve the line. The container carries the drift animations. */
  return (
    <div className={className}>
      <svg className="sheet-blob-fill" viewBox={shape.viewBox} fill="none">
        <defs>
          <radialGradient id={gradientId} cx="38%" cy="34%" r="78%">
            <stop offset="0%" style={{ stopColor: `var(${fillVar})` }} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <path d={shape.d} fill={`url(#${gradientId})`} />
      </svg>
      <svg
        className="sheet-blob-echo"
        viewBox={shape.viewBox}
        fill="none"
        style={{ translate: echoOffset }}
      >
        <path
          d={shape.d}
          style={{ stroke: `var(${lineVar})` }}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Atmosphere() {
  return (
    <>
      <div className="sheet-atmosphere" aria-hidden="true">
        <EchoBlob
          className="sheet-blob sheet-blob--mint"
          shape={mintBlob}
          gradientId="atmo-grad-mint"
          fillVar="--atmo-blob-mint"
          lineVar="--atmo-line-mint"
          echoOffset="3.5% 3%"
        />
        <EchoBlob
          className="sheet-blob sheet-blob--peach"
          shape={peachBlob}
          gradientId="atmo-grad-peach"
          fillVar="--atmo-blob-peach"
          lineVar="--atmo-line-peach"
          echoOffset="-3% 3%"
        />
        {/* Stroke, not fill. `wave` is a closed three-hump silhouette, and filling it with a warm
            token over near-black produced a soft-edged tan cloud — the single most
            camouflage-looking element in the layer, and no amount of blur or gradient fixed it,
            because a large low-chroma warm mass *is* a khaki blotch. As an outline it becomes what
            the design intends, a horizon ridge, and it joins the arc in the layer's line-art
            language: the glows carry light, the lines carry edge. */}
        <svg className="sheet-wave" viewBox={wave.viewBox} fill="none">
          <path
            d={wave.d}
            style={{ stroke: "var(--atmo-line-peach)" }}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <svg className="sheet-arc" viewBox={arc.viewBox} fill="none">
          <path
            d={arc.d}
            style={{ stroke: "var(--atmo-line-mint)" }}
            strokeWidth={15}
            strokeMiterlimit={10}
          />
        </svg>
      </div>
      <div className="sheet-grain" aria-hidden="true" />
    </>
  );
}
