export function parseBooleanLike(value: string | null | undefined) {
  if (!value) {
    return false
  }

  return value === "1" || value === "true" || value === "on"
}

export function parseFormBoolean(input: FormDataEntryValue | null) {
  if (typeof input !== "string") {
    return false
  }

  return parseBooleanLike(input)
}
