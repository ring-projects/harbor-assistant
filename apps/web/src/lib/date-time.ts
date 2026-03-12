function toDate(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function formatTimeShort(value: string | null) {
  const parsed = toDate(value)
  if (!parsed) {
    return "-"
  }

  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

export function formatDateTime(value: string | null) {
  const parsed = toDate(value)
  if (!parsed) {
    return "-"
  }

  const year = parsed.getFullYear()
  const month = pad(parsed.getMonth() + 1)
  const day = pad(parsed.getDate())
  const hours = pad(parsed.getHours())
  const minutes = pad(parsed.getMinutes())
  const seconds = pad(parsed.getSeconds())

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}
