
/**
 * InteractionLock
 */

export function installInteractionLock(root: HTMLElement = document.body) {

  if (!root) return;

  root.style.userSelect = "none";
  root.style.webkitUserSelect = "none";
  // @ts-ignore
  root.style.msUserSelect = "none";

  root.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  // @ts-ignore
  root.style.webkitTouchCallout = "none";

}
