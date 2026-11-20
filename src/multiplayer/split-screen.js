// Screen layouts for one or two local players. Rectangles are in canvas pixels.

export const SPLIT_LAYOUTS = ['horizontal', 'vertical'];
const GAP = 4;

/**
 * @param layout 'horizontal' stacks the views (top / bottom, the classic wide-view presentation),
 *               'vertical' puts them side by side.
 */
export function computeViewRects(width, height, playerCount, layout = 'horizontal') {
  if (playerCount <= 1) return [{ x: 0, y: 0, w: width, h: height }];
  if (layout === 'vertical') {
    const w = Math.floor((width - GAP) / 2);
    return [{ x: 0, y: 0, w, h: height }, { x: width - w, y: 0, w, h: height }];
  }
  const h = Math.floor((height - GAP) / 2);
  return [{ x: 0, y: 0, w: width, h }, { x: 0, y: height - h, w: width, h }];
}
