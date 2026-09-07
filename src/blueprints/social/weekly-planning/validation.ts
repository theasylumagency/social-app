/** Reference keys are valid in structured mapping fields, never in founder-facing prose. */
export function validatePlanningProse(value: unknown, keys: string[]): string[] {
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${keys.join("|")})(?![\\p{L}\\p{N}_])`, "u")
  const errors: string[] = []
  const visit = (item: unknown, path: string) => {
    if (typeof item === "string" && pattern.test(item)) errors.push(`${path}: replace opaque reference keys with the actual audience name, goal title or direction meaning`)
    else if (Array.isArray(item)) item.forEach((entry, i) => visit(entry, `${path}[${i}]`))
    else if (item && typeof item === "object") for (const [key, entry] of Object.entries(item)) if (!/(Key|Keys)$/.test(key)) visit(entry, `${path}.${key}`)
  }
  if (keys.length) visit(value, "output")
  return errors
}
