import { useMemo, useRef } from "react";

/** Functions that keep one identity for the life of the component and always run their latest version. Handed to
    rows wrapped in React.memo, they let a row skip drawing when only its list drew again: with fresh closures every
    render, every row of a long list would draw on every selection change. */
export function useStable<T extends Record<string, (...args: never[]) => unknown>>(fns: T): T {
  const latest = useRef(fns);
  latest.current = fns;
  return useMemo(() => Object.fromEntries(Object.keys(latest.current).map((k) =>
    [k, (...args: never[]) => (latest.current[k] as (...a: never[]) => unknown)(...args)])) as T, []);
}
