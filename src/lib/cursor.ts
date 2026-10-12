/** Shared by the 3D scene and the DOM cursor label without either importing the other. */
export const CURSOR_EVENT = "vg:cursor";

/** Names the action of the 3D object under the pointer ("" clears it) and shows the pointer cursor. */
export function setCursorLabel(label: string) {
  document.body.style.cursor = label ? "pointer" : "";
  window.dispatchEvent(new CustomEvent(CURSOR_EVENT, { detail: label }));
}
