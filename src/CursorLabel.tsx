import { useEffect, useRef, useState } from "react";
import { CURSOR_EVENT } from "./lib/cursor";

/** A small label beside the pointer that names what a 3D object does when clicked. The room's hit targets
 * (screens, rain window, projector, certificates) have no hover state of their own, so without it they are
 * invisible affordances. Fine pointers only; the native cursor stays, so nothing about pointing changes. */
export default function CursorLabel() {
  const node = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  const showing = useRef(false);
  showing.current = label !== "";
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let x = -200, y = -200, cx = x, cy = y, frame = 0;
    const place = () => node.current?.style.setProperty("transform", `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`);
    // Exponential follow: each frame closes 35% of the gap (about 90 ms to settle at 60 fps).
    // It reads as attached to the pointer, never floaty. The loop stops once it has caught up.
    const step = () => {
      cx += (x - cx) * .35; cy += (y - cy) * .35; place();
      frame = Math.abs(x - cx) + Math.abs(y - cy) > .4 ? requestAnimationFrame(step) : 0;
    };
    const move = (event: PointerEvent) => {
      x = event.clientX; y = event.clientY;
      if (reduced) { cx = x; cy = y; place(); } else if (!frame) frame = requestAnimationFrame(step);
    };
    const onLabel = (event: Event) => setLabel((event as CustomEvent<string>).detail);
    // The camera moves under a still pointer while scrolling, so no pointer-out arrives: clear on scroll.
    const clear = () => { if (showing.current) setLabel(""); };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener(CURSOR_EVENT, onLabel);
    window.addEventListener("scroll", clear, { passive: true });
    window.addEventListener("blur", clear);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move); window.removeEventListener(CURSOR_EVENT, onLabel);
      window.removeEventListener("scroll", clear); window.removeEventListener("blur", clear);
    };
  }, []);
  return <div ref={node} className={`cursor-label ${label ? "is-visible" : ""}`} aria-hidden="true"><span>{label}</span></div>;
}
