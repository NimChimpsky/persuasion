import type { RefObject } from "preact";
import { useEffect, useState } from "preact/hooks";

export function useDesktopBoardHeight(
  layoutRef: RefObject<HTMLElement>,
  characterCount: number,
): { desktopBoardHeight: number | null; isDesktopLayout: boolean } {
  const [desktopBoardHeight, setDesktopBoardHeight] = useState<number | null>(
    null,
  );
  const [isDesktopLayout, setIsDesktopLayout] = useState(false);

  useEffect(() => {
    const host = globalThis;
    const recalc = () => {
      const desktop = host.matchMedia("(min-width: 981px)").matches;
      setIsDesktopLayout(desktop);

      if (!desktop) {
        setDesktopBoardHeight(null);
        return;
      }

      const layout = layoutRef.current;
      if (!layout) return;

      const rect = layout.getBoundingClientRect();
      const bottomPadding = 8;
      const next = Math.max(
        360,
        Math.floor(host.innerHeight - rect.top - bottomPadding),
      );
      setDesktopBoardHeight(next);
    };

    const run = () => host.requestAnimationFrame(recalc);
    run();
    host.addEventListener("resize", run);

    return () => {
      host.removeEventListener("resize", run);
    };
  }, [layoutRef, characterCount]);

  return { desktopBoardHeight, isDesktopLayout };
}
