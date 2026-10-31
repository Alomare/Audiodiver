import type { CSSProperties, ReactNode } from "react";
import type { Tag } from "./api";
import { hueOf } from "./music";
import { useItemIndex } from "./store";

/** A category's colour as a custom property: its hue, which styles.css turns into a colour at the lightness and
    strength the theme sets. Nothing for a category the Index doesn't have. */
export function useHue(category: string | undefined): CSSProperties | undefined {
  const itemIndex = useItemIndex(); // not useEditor(): every tag of a long list holds one
  const hue = itemIndex ? hueOf(itemIndex, category) : undefined;
  return hue === undefined ? undefined : ({ ["--hue" as any]: hue } as CSSProperties);
}

/** What the Index knows about something, in its category's colour. With `onOpen` it is a link to that item. */
export function CatTag({ tag, onOpen, tip }: { tag: Tag; onOpen?: () => void; tip?: string }) {
  const style = useHue(tag.category);
  const cls = `ctag${style ? "" : " plain"}`;
  if (onOpen) return <button className={`${cls} link`} style={style} onClick={(e) => { e.stopPropagation(); onOpen(); }} data-tip={tip}>{tag.name}</button>;
  return <span className={cls} style={style} data-tip={tip}>{tag.name}</span>;
}

/** Each Index category's icon, drawn on a 24-unit grid in lines. */
const CAT_ICONS: Record<string, ReactNode> = {
  music: <><path d="M9 18V5.5l11-2V16" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  weapons: <><circle cx="12" cy="12" r="7" /><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5" /></>,
  // a stratagem beacon on the ground, its beam going up
  stratagems: <><circle cx="12" cy="17.6" r="3.1" /><path d="M12 14.5V2.6" /><path d="M5.6 17.6H2.8M21.2 17.6h-2.8M7.3 12.9 5.3 10.9M16.7 12.9l2-2" /></>,
  vehicles: <><path d="M3 15V9h10l3 3h5v3z" /><circle cx="7" cy="17.5" r="2" /><circle cx="17" cy="17.5" r="2" /></>,
  // a person: head and shoulders
  helldivers: <><circle cx="12" cy="7.6" r="3.9" /><path d="M4.2 21v-.8a6.4 6.4 0 0 1 6.4-6.4h2.8a6.4 6.4 0 0 1 6.4 6.4v.8z" /></>,
  allies: <><path d="M4 5h16v11h-9l-4.5 4v-4H4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  enemies: <><path d="M5 11a7 7 0 0 1 14 0v3.5l-2 1.5v3.5H7V16l-2-1.5z" /><circle cx="9.3" cy="11.5" r="1.6" /><circle cx="14.7" cy="11.5" r="1.6" /><path d="M10.5 19.5v-2M13.5 19.5v-2" /></>,
  planets: <><circle cx="12" cy="12" r="5.5" /><path d="M5.6 9.7C2.8 11 1.6 12.6 2.3 13.9c1 1.8 6 1.3 11.2-1.2s8.8-6 7.8-7.8c-.6-1.1-2.6-1.3-5.3-.7" /></>,
  interface: <><rect x="3" y="4.5" width="18" height="12" /><path d="M9 20.5h6M12 16.5v4" /></>,
  // a microphone
  voices: <><rect x="8.5" y="2.8" width="7" height="11.4" rx="3.5" /><path d="M5 11.2a7 7 0 0 0 14 0M12 18.2v3M8.2 21.2h7.6" /></>,
  // a boot
  movement: <><path d="M7.2 3.2h6.6v8.4l5.3 2.8a2.9 2.9 0 0 1 1.5 2.5v1.4H4.4l.9-6.4z" /><path d="M4.2 21h16.4" /></>,
  // a burst
  impacts: <><path d="m12 2.6 2 5.5 5.4-2.5-2.5 5.4 5.5 2-5.5 2 2.5 5.4-5.4-2.5-2 5.5-2-5.5-5.4 2.5 2.5-5.4-5.5-2 5.5-2-2.5-5.4 5.4 2.5z" /></>,
  // a field radio and its aerial
  radio: <><rect x="4.5" y="9.4" width="15" height="11.6" /><path d="M8 9.4 17 3" /><circle cx="9.5" cy="15.2" r="2.1" /><path d="M14.6 13.2h2M14.6 15.2h2M14.6 17.2h2" /></>,
  // hills under a sun
  ambience: <><path d="M2.4 20.4 9 8.6l4.3 7.6 2.5-3.7 5.8 7.9z" /><circle cx="17.2" cy="6.2" r="2.3" /></>,
  // a sound's wave
  other: <><path d="M3 12h1.8M7.6 8v8M12 4v16M16.4 7.5v9M20.6 11v2" /></>,
  // a bug seen from above: head, body and six legs
  bugs: <><circle cx="12" cy="6.2" r="2.6" /><ellipse cx="12" cy="14.2" rx="4.2" ry="6" /><path d="M8.2 11.2 3.8 8.6M7.8 14.6H3M8.4 17.6l-3.8 2.8M15.8 11.2l4.4-2.6M16.2 14.6H21M15.6 17.6l3.8 2.8" /></>,
  // a machine's head
  cyborgs: <><rect x="5" y="6.4" width="14" height="13.6" /><path d="M12 6.4V2.8M2.6 11.6H5M19 11.6h2.4M8.6 16.2h6.8" /><circle cx="9.2" cy="11.4" r="1.5" /><circle cx="14.8" cy="11.4" r="1.5" /></>,
  // an eye in a triangle
  illuminate: <><path d="M12 3.2 21.8 20.4H2.2z" /><circle cx="12" cy="14.4" r="2.6" /></>,
  // a storage box with its lid: whole archives, from All Archives
  archives: <><rect x="3.5" y="4.5" width="17" height="4" /><path d="M5 8.5v11h14v-11M10 12.5h4" /></>,
};

/** A category's icon in its colour, before its name: a square for something the Index has no icon for. */
export function CatMark({ category }: { category: string }) {
  const style = useHue(category);
  return (
    <svg className={`cat-mark${style ? "" : " plain"}`} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      {CAT_ICONS[category.replace("hd1/", "")] ?? <rect x="7" y="7" width="10" height="10" fill="currentColor" />}
    </svg>
  );
}
