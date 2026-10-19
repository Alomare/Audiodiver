import type { CSSProperties } from "react";
import big from "@logo/logo-fullres.png";
import small from "@logo/logo-lowres.png";

/** Audiodiver's logo (assets/logo, the official files). It is drawn in the highlight colour: the image is used as a
    mask, so the mark follows the theme and the colour chosen in Settings ▸ Theme, Super Earth yellow unless changed.
    `detail` takes the full-size file, for where it shows large. */
export function Logo({ className, detail }: { className?: string; detail?: boolean }) {
  return <span className={`logo${className ? ` ${className}` : ""}`} style={{ ["--logo" as any]: `url("${detail ? big : small}")` } as CSSProperties} aria-hidden />;
}
