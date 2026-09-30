/** Use equal numeric steps, rather than rounding positions in the boundary array. */
export function getHistogramAxisTicks(lower: number, upper: number, binWidth: number, plotWidth: number): number[] {
  if (![lower, upper, binWidth, plotWidth].every(Number.isFinite)
    || upper <= lower || binWidth <= 0 || plotWidth <= 0) return []

  const minimumStep = Math.max(binWidth, (upper - lower) * 45 / plotWidth)
  const magnitude = 10 ** Math.floor(Math.log10(minimumStep))
  const fraction = minimumStep / magnitude
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
  const first = Math.ceil(lower / step) * step
  const count = Math.max(0, Math.floor((upper - first) / step) + 1)
  return Array.from({ length: count }, (_, index) => first + index * step)
}
