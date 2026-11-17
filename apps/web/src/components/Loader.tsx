import type { CSSProperties } from "react";
import { MARK_ARM_DIRECTIONS, MARK_ARMS } from "@mteam/shared";

/**
 * The page loader: the logo's four arrows gather into the mark, rest, and part again (design "assemble"). Drawn in CSS
 * (`.loader` in globals.css), so it runs before any script; with reduced motion it is the still mark.
 */
export function Loader() {
  return (
    <svg className="loader" viewBox="0 0 319.89 319.89" fill="currentColor" aria-hidden="true">
      <g className="loader-mark">
        {MARK_ARMS.map((arm, index) => {
          const [dx, dy] = MARK_ARM_DIRECTIONS[index];
          return (
            <g key={index} className="loader-arm" style={{ "--dx": dx, "--dy": dy } as CSSProperties}>
              <path d={arm} />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

/** The loader in the middle of the screen, over the shapes of the page that is on its way. */
export function PageLoader() {
  return (
    <div className="page-loader" aria-hidden="true">
      <Loader />
    </div>
  );
}
