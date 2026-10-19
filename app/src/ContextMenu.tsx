import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type MenuEntry = { label: string; run: () => void; disabled?: boolean; keys?: string } | "-";
type Open = { x: number; y: number; entries: MenuEntry[] };

/** A right-click menu: open(event, entries) shows it at the pointer; it closes on a choice, Escape, a click
    elsewhere, scrolling or leaving the window. */
export function useContextMenu() {
  const [menu, setMenu] = useState<Open | null>(null);
  const open = useCallback((e: React.MouseEvent, entries: MenuEntry[]) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, entries });
  }, []);
  const element = menu ? <Menu {...menu} onClose={() => setMenu(null)} /> : null;
  return [element, open] as const;
}

function Menu({ x, y, entries, onClose }: Open & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  useLayoutEffect(() => { // keep it inside the window
    const r = ref.current!.getBoundingClientRect();
    setPos({ left: Math.min(x, window.innerWidth - r.width - 6), top: Math.min(y, window.innerHeight - r.height - 6) });
    ref.current!.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [x, y]);
  useEffect(() => {
    const away = (e: Event) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); } };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key, true);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);
  const move = (e: React.KeyboardEvent) => { // arrow keys walk the entries
    const d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const items = [...ref.current!.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(i + d + items.length) % items.length]?.focus();
  };
  return (
    <div className="ctx-menu" role="menu" ref={ref} style={pos} onKeyDown={move} onContextMenu={(e) => e.preventDefault()}>
      {entries.map((m, i) => m === "-" ? <div key={i} className="ctx-sep" role="separator" /> : (
        <button key={i} role="menuitem" disabled={m.disabled} onClick={() => { onClose(); m.run(); }}>
          <span>{m.label}</span>{m.keys && <span className="ctx-keys">{m.keys}</span>}
        </button>
      ))}
    </div>
  );
}
