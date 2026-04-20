/**
 * Split a formatted address into a short headline (area / first segment) + rest.
 */
export function splitLocationDisplay(full: string): {
  primary: string
  secondary: string | null
} {
  const t = full.trim()
  if (!t) return { primary: '', secondary: null }

  const comma = t.indexOf(',')
  if (comma !== -1) {
    const a = t.slice(0, comma).trim()
    const b = t.slice(comma + 1).trim()
    return { primary: a || t, secondary: b || null }
  }

  return { primary: t, secondary: null }
}
