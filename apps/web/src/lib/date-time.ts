import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(relativeTime)

function toDayjs(value: string | null) {
  if (!value) {
    return null
  }

  const parsed = dayjs(value)
  if (!parsed.isValid()) {
    return null
  }

  return parsed
}

export function formatTimeShort(value: string | null) {
  const parsed = toDayjs(value)
  if (!parsed) {
    return "-"
  }

  return parsed.format("HH:mm")
}

export function formatDateTime(value: string | null, formatter = "YYYY-MM-DD HH:mm") {
  const parsed = toDayjs(value)
  if (!parsed) {
    return "-"
  }

  return parsed.format(formatter)
}

export function formatRelativeTimeShort(value: string | null) {
  const parsed = toDayjs(value)
  if (!parsed) {
    return "-"
  }

  return parsed.fromNow()
}
