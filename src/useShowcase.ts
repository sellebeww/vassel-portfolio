import { startTransition, useEffect, useState, type FocusEvent, type PointerEvent } from "react";

type ShowcaseOptions = { pauseOnHover?: boolean };

/** Auto-advance with no play/pause control. Keyboard focus, a mouse resting on the showcase, reduced motion,
 * dialogs and background tabs hold it. A manual pick stays up for three beats before the rotation moves on,
 * so the visitor gets time to read what they chose. `initial` is only where the showcase starts. */
export function useShowcase(count: number, enabled: boolean, reducedMotion: boolean, interval = 7000, { pauseOnHover = true }: ShowcaseOptions = {}, initial = 0) {
  const [index, setIndex] = useState(initial);
  const [picked, setPicked] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const interacting = (pauseOnHover && hovered) || keyboardFocused;
  const playing = enabled && !interacting && !reducedMotion;
  const delay = picked ? interval * 3 : interval;
  useEffect(() => {
    if (!playing) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      if (!document.hidden) timer = window.setTimeout(() => startTransition(() => { setPicked(false); setIndex(value => (value + 1) % count); }), delay);
    };
    schedule(); document.addEventListener("visibilitychange", schedule);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", schedule); };
  }, [count, playing, index, delay]);
  const select = (value: number) => startTransition(() => { setPicked(true); setIndex(((value % count) + count) % count); });
  return { index, select, delay, paused: reducedMotion, playing,
    // Pointer events, not mouse events: a tap on a phone fires mouseenter with no mouseleave, which used to hold the rotation for good.
    interaction: { onPointerEnter: (event: PointerEvent<HTMLElement>) => { if (event.pointerType === "mouse") setHovered(true); }, onPointerLeave: () => setHovered(false),
      onFocus: (event: FocusEvent<HTMLElement>) => setKeyboardFocused(event.target.matches(":focus-visible")),
      onBlur: (event: FocusEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocused(false); } } };
}
