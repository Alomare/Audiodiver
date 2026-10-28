import { t } from "@lingui/core/macro";
import type { CSSProperties, ReactNode } from "react";

/** A line as the game shows it: colours, sizes and emphasis applied, subtitle timing as marks, and the words the game
    fills in (#NAME) as chips. */
export function TextPreview({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const stack: { tag: string; style: CSSProperties }[] = [];
  const re = /\{(\d+(?:\.\d+)?)->(\d+(?:\.\d+)?)\}|<([cifs])=([^>]*)>|<\/([cifs])>|(#[A-Z][A-Z0-9_]+)|(\n)/g;
  const style = () => Object.assign({}, ...stack.map((f) => f.style)) as CSSProperties;
  let last = 0, k = 0, m: RegExpExecArray | null;
  const words = (s: string) => {
    if (!s) return;
    const st = style(); // a dotted underline: a colour the game picks as the line shows
    out.push(<span key={k++} style={st} data-tip={st.textDecoration ? t`A colour the game picks, such as a player colour` : undefined}>{s}</span>);
  };
  while ((m = re.exec(text))) {
    words(text.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) out.push(<span key={k++} className="tx-time" data-tip={t`Timing. When these words appear, in seconds from the start of the voice line`}>{m[1]}–{m[2]} s</span>);
    else if (m[3]) {
      const v = m[4], s: CSSProperties = {};
      if (m[3] === "c" && /^[0-9a-f]{8}$/i.test(v)) {
        const n = parseInt(v, 16);
        s.color = `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${((n >>> 24) / 255).toFixed(2)})`;
      } else if (m[3] === "c") s.textDecoration = "underline dotted"; // a colour the game fills in (#PLAYER_COLOR…)
      else if (m[3] === "i") s.fontStyle = "italic";
      else if (m[3] === "s" && Number(v)) s.fontSize = `${Number(v) / 20}em`;
      stack.push({ tag: m[3], style: s });
    } else if (m[5]) {
      const i = stack.map((f) => f.tag).lastIndexOf(m[5]);
      if (i >= 0) stack.splice(i, 1);
    } else if (m[6]) out.push(<span key={k++} className="tx-fill" data-tip={t`The game fills this in as the line shows, such as a name or a number`}>{m[6]}</span>);
    else out.push(<br key={k++} />);
  }
  words(text.slice(last));
  return <>{out.length ? out : <span className="muted">{t`(empty)`}</span>}</>;
}
