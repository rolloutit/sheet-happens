import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/src/lib/utils";
import { BrandMark } from "../BrandMark";
import type { AuthGyroscopeProps } from "./AuthGyroscope.types";

/**
 * 60 ticks, every fifth one long: the outer ring doubles as a dial, so the cage reads as time being
 * measured rather than as generic ornament. Coordinates live in the 200×200 viewBox every ring uses.
 */
const dialTicks = Array.from({ length: 60 }, (_, index) => {
  const angle = (index / 60) * Math.PI * 2;
  const major = index % 5 === 0;
  const inner = major ? 87 : 93;
  return {
    x1: (100 + 97 * Math.sin(angle)).toFixed(2),
    y1: (100 - 97 * Math.cos(angle)).toFixed(2),
    x2: (100 + inner * Math.sin(angle)).toFixed(2),
    y2: (100 - inner * Math.cos(angle)).toFixed(2),
    major,
  };
});

interface RingProps {
  children: ReactNode;
  className?: string;
  /** Diameter as a share of the cage. */
  diameter: string;
  /** Tips the ring away from the camera. 0deg would face the viewer and read as a flat circle. */
  tiltX: string;
  /** Swings the tilted ring around the view axis, so no two rings share a horizon. */
  tiltZ: string;
  duration: string;
  reverse?: boolean;
  /**
   * Rotation the ring already carries before its loop starts. Playwright's `animations: "disabled"`
   * cancels infinite animations back to frame 0, so frame 0 is what every visual baseline captures —
   * these phases are the composition that gets screenshotted, not an arbitrary starting point.
   */
  phase: string;
  /** Stagger for the one-shot reveal. */
  delay: string;
}

function Ring({
  children,
  className,
  diameter,
  tiltX,
  tiltZ,
  duration,
  reverse = false,
  phase,
  delay,
}: RingProps) {
  return (
    // `grid` is a utility rather than part of `.auth-gyro-layer` so that a caller's `hidden` can win:
    // `cn` is tailwind-merge, so `hidden lg:grid` replaces this `grid` instead of racing it.
    <div
      className={cn("auth-gyro-layer grid place-items-center", className)}
      style={{ "--gyro-in-delay": delay } as CSSProperties}
    >
      <div
        className="auth-gyro-plane"
        style={
          {
            "--gyro-diameter": diameter,
            "--gyro-tilt-x": tiltX,
            "--gyro-tilt-z": tiltZ,
          } as CSSProperties
        }
      >
        <div
          className="auth-gyro-spin"
          style={
            {
              "--gyro-phase": phase,
              "--gyro-duration": duration,
              "--gyro-direction": reverse ? "reverse" : "normal",
              // Satellites ride a tilted plane, so they need the tilt taken back out to stay round.
              "--gyro-face": `calc(-1 * ${tiltX})`,
              // A trail has to fall behind the dot, and "behind" flips with the spin direction.
              "--gyro-trail-flip": reverse ? "1" : "-1",
            } as CSSProperties
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface SatelliteProps {
  /** Position along the ring, measured from the top. */
  angle: string;
  size: string;
  tone?: "teal" | "amber";
  /** Adds a short arc of light behind the dot. Reserve it for the largest satellite on a ring. */
  trail?: boolean;
}

/**
 * The arm spans the whole ring and only rotates; the dot sits on its top edge. Positioning the dot
 * by angle instead would need the ring's radius as a length, which a percentage-sized plane does not
 * expose.
 */
function Satellite({ angle, size, tone = "teal", trail = false }: SatelliteProps) {
  return (
    <span className="auth-gyro-arm" style={{ "--gyro-arm": angle } as CSSProperties}>
      {trail ? <span className="auth-gyro-trail" /> : null}
      <span
        className={cn("auth-gyro-dot", tone === "amber" && "auth-gyro-dot--amber")}
        style={{ "--gyro-dot": size } as CSSProperties}
      />
    </span>
  );
}

/**
 * Rollout IT's mark held still at the centre of a tilted, counter-rotating ring cage.
 *
 * The mark is an open ring with a bar through it, so the cage is the mark's own arc continued
 * outward rather than decoration parked beside it. Nothing here spins the mark: rings move around a
 * fixed centre, which reads as a brand at the heart of a system instead of as a loading spinner.
 *
 * Rings are tilted because a rotating circle that faces the viewer is, geometrically, not moving at
 * all. Speeds and directions all differ — the 17s and 26s rings sit at close radii going opposite
 * ways, and their dashes beat against each other.
 *
 * Everything animates `transform` and `opacity` on separate layers, so the whole cage stays on the
 * compositor. No dependency, no client hooks: this renders on the server.
 */
export function AuthGyroscope({ className }: AuthGyroscopeProps) {
  return (
    // Two nested elements because the drift needs two clocks. One element has a single `translate`, so
    // both axes would have to share a timeline and the cage would retrace one closed loop. Split across
    // a parent and a child they run at coprime periods and the composite path is a Lissajous figure
    // that does not close — see `globals.css`.
    <div className={cn("auth-gyro", className)} aria-hidden="true">
      <div className="auth-gyro-stage">
        <span className="auth-gyro-aura" />

        {/* The one shape that never turns. It gives the cage a horizon, so the composition still holds
            when motion is off and every ring is frozen at frame 0. */}
        <div
          className="auth-gyro-layer grid place-items-center"
          style={{ "--gyro-in-delay": "0ms" } as CSSProperties}
        >
          <div
            className="auth-gyro-plane"
            style={
              {
                "--gyro-diameter": "94%",
                "--gyro-tilt-x": "5deg",
                "--gyro-tilt-z": "0deg",
              } as CSSProperties
            }
          >
            <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" fill="none">
              <circle
                cx="100"
                cy="100"
                r="99"
                stroke="rgba(234,251,250,0.22)"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </div>

        {/* Outer dial, tipped back to a near-horizontal ellipse. */}
        <Ring diameter="100%" tiltX="58deg" tiltZ="0deg" duration="26s" phase="0deg" delay="60ms">
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full">
            {dialTicks.map((tick, index) => (
              <line
                key={index}
                x1={tick.x1}
                y1={tick.y1}
                x2={tick.x2}
                y2={tick.y2}
                stroke={tick.major ? "rgba(234,251,250,0.8)" : "rgba(234,251,250,0.34)"}
                strokeWidth={tick.major ? 2.2 : 1.2}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <circle
              cx="100"
              cy="100"
              r="99"
              fill="none"
              stroke="rgba(234,251,250,0.34)"
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Satellite angle="0deg" size="14px" trail />
          <Satellite angle="208deg" size="6px" />
        </Ring>

        {/* The sweep rides the dial's plane on its own clock — five seconds, where the dial takes
            twenty-six. It is the one element that reads as fast without anything moving quickly. */}
        <Ring
          className="hidden lg:grid"
          diameter="100%"
          tiltX="58deg"
          tiltZ="0deg"
          duration="5.2s"
          phase="140deg"
          delay="420ms"
        >
          <span className="auth-gyro-comet">
            <span className="auth-gyro-comet-arc" />
          </span>
        </Ring>

        {/* Swung a quarter turn off the dial, so the two cross at right angles: this is the ring that
            makes the cage read as a gyroscope rather than as stacked ellipses. Counter-rotating, and at
            a close enough radius that its dashes beat against the dial's ticks. */}
        <Ring
          diameter="84%"
          tiltX="64deg"
          tiltZ="84deg"
          duration="17s"
          reverse
          phase="12deg"
          delay="160ms"
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" fill="none">
            <circle
              cx="100"
              cy="100"
              r="99"
              stroke="rgba(132,244,244,0.62)"
              strokeDasharray="4 11"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Satellite angle="0deg" size="10px" trail />
          <Satellite angle="168deg" size="6px" tone="amber" />
        </Ring>

        <Ring
          className="hidden lg:grid"
          diameter="84%"
          tiltX="64deg"
          tiltZ="84deg"
          duration="7.6s"
          reverse
          phase="20deg"
          delay="480ms"
        >
          <span className="auth-gyro-comet auth-gyro-comet--soft">
            <span className="auth-gyro-comet-arc" />
          </span>
        </Ring>

        {/* Third axis, tipped the other way, so it cuts diagonally across both of the others. */}
        <Ring
          className="hidden lg:grid"
          diameter="62%"
          tiltX="-44deg"
          tiltZ="36deg"
          duration="34s"
          phase="40deg"
          delay="260ms"
        >
          <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" fill="none">
            <circle
              cx="100"
              cy="100"
              r="99"
              stroke="rgba(253,207,174,0.48)"
              strokeDasharray="7 10"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <Satellite angle="96deg" size="9px" tone="amber" trail />
        </Ring>

        {/* A timesheet app should tick. Two pings, half a cycle apart. */}
        <span className="auth-gyro-pulse" style={{ "--gyro-delay": "0s" } as CSSProperties} />
        <span className="auth-gyro-pulse" style={{ "--gyro-delay": "3s" } as CSSProperties} />

        {/* Below `lg` the panel is a 13rem banner and the cage is cropped to arcs, so the hub would
            land on top of the headline. The brand row already shows the mark there. */}
        <div className="auth-gyro-hub hidden lg:grid">
          <span className="auth-gyro-hub-core">
            <span className="auth-gyro-hub-halo" />
            <span className="auth-gyro-hub-tile size-24">
              <BrandMark size={48} tone="onDark" />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
