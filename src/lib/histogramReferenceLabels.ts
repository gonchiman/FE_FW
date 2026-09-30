/** Place reference labels beside their lines, then resolve collisions at the chart edges. */
export function layoutHistogramReferenceLabels<T extends { x: number; width: number }>(
  references: readonly T[],
  plotLeft: number,
  plotRight: number,
  compact: boolean,
): { labels: (T & { y: number })[]; top: number } {
  const labels = references.map(reference => ({ ...reference, y: compact ? 10 : 14 }))
  const [left, right] = [...labels].sort((first, second) => first.x - second.x)
  const clampStart = (x: number, width: number) => Math.max(plotLeft, Math.min(plotRight - width, x))

  if (compact) {
    if (left) left.x = clampStart(left.x + (right ? -left.width - 4 : 4), left.width)
    if (right) right.x = clampStart(right.x + 4, right.width)
  } else {
    labels.forEach(label => { label.x = clampStart(label.x + 4, label.width) })
  }

  const overlap = left !== undefined && right !== undefined && left.x + left.width + 6 > right.x
  if (overlap) right.y += compact ? 16 : 15
  return { labels, top: compact ? overlap ? 32 : 16 : 44 }
}
