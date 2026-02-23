export function getErrorCode(error) {
  return typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : null
}