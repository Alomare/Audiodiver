import type { CSSProperties } from "react";

/** Where a slider's thumb is, for the fill the slider styles draw (styles.css, "sliders"): `--p` from 0 to 1, and on
    a fader `--z`, where 0 dB is, so the fill runs from there to the thumb. */
export const rangeVars = (value: number, min: number, max: number, zero?: number): CSSProperties => {
  const at = (v: number) => Math.max(0, Math.min(1, (v - min) / (max - min || 1)));
  return { "--p": at(value), ...(zero !== undefined ? { "--z": at(zero) } : {}) } as CSSProperties;
};
