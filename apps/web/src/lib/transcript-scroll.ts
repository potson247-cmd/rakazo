import type { RefObject } from "react";

export function transcriptIsNearEnd(
  element: Pick<HTMLElement, "scrollHeight" | "scrollTop" | "clientHeight">,
): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight < 80;
}

export function transcriptCanSnapAfterFrame(
  element: Pick<HTMLElement, "scrollTop"> | null,
  queuedElement: Pick<HTMLElement, "scrollTop">,
  queuedScrollTop: number,
): boolean {
  return element === queuedElement && queuedElement.scrollTop === queuedScrollTop;
}

export function transcriptMovedDown(previousScrollTop: number | null, scrollTop: number): boolean {
  return previousScrollTop !== null && scrollTop >= previousScrollTop;
}

export function snapTranscriptToEndAfterFrame(scroll: RefObject<HTMLDivElement | null>): void {
  const queuedElement = scroll.current;
  if (!queuedElement) return;
  const queuedScrollTop = queuedElement.scrollTop;
  window.requestAnimationFrame(() => {
    if (transcriptCanSnapAfterFrame(scroll.current, queuedElement, queuedScrollTop)) {
      queuedElement.scrollTop = queuedElement.scrollHeight;
    }
  });
}
