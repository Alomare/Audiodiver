// The "?" and the words that open a Wiki page, apart from the Wiki itself: every tab shows them, and the Wiki and
// its pages load only when it opens.
import { t } from "@lingui/core/macro";
import { nav } from "./nav";

/** Words that open a Wiki page: what the app explains at length, it explains there. */
export function WikiLink({ page, about, children }: { page: string; about: string; children: React.ReactNode }) {
  return <button className="link-text" onClick={() => nav.go("wiki", page)}
    data-tip={t({ message: `${about}: open the Wiki`, comment: "Tooltip of words that open a Wiki page. about is the subject of the page." })}>{children}</button>;
}

/** A "?" that holds a description, so the screen doesn't have to: hovering (or focusing) it shows `tip`, and a click
    opens `page` (a Wiki page, or "page#heading" for the section on it) for the long version. Every "?" has one. */
export function Help({ tip, page }: { tip: string; page: string }) {
  // inside a label, a click on the "?" must not tick the checkbox or focus the field the label is for
  return (
    <button className="wiki-q" onClick={(e) => { e.preventDefault(); e.stopPropagation(); nav.go("wiki", page); }} aria-label={t`${tip} Open the Wiki section.`}
      data-tip={tip} data-tip-more={t`Click for the Wiki section`} data-tip-always>?</button>
  );
}
