/** Keep horizontal scrollbars out of the board's height budget. Their appearance
 * must not resize the board and make the same scrollbar disappear again.
 * Visual viewport changes (for example the mobile keyboard) still apply.
 */
export function boardViewportHeight(layoutHeight: number, visualHeight: number | undefined, clientHeight: number) {
  const scrollbarHeight = Math.max(0, layoutHeight - clientHeight);
  // Match clientHeight's integer precision, including when browser zoom leaves
  // the visual viewport a fraction of a pixel above or below it.
  return Math.min(layoutHeight, Math.round(visualHeight ?? layoutHeight) + scrollbarHeight);
}
