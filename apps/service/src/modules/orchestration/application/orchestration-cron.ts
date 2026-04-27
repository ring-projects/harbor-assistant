import { createOrchestrationError } from "../errors"

type CronField = {
  values: Set<number>
  wildcard: boolean
}

type ParsedCronExpression = {
  minute: CronField
  hour: CronField
  dayOfMonth: CronField
  month: CronField
  dayOfWeek: CronField
}

const WEEKDAY_NAMES = new Map<string, number>([
  ["sun", 0],
  ["mon", 1],
  ["tue", 2],
  ["wed", 3],
  ["thu", 4],
  ["fri", 5],
  ["sat", 6],
])

const MONTH_NAMES = new Map<string, number>([
  ["jan", 1],
  ["feb", 2],
  ["mar", 3],
  ["apr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["aug", 8],
  ["sep", 9],
  ["oct", 10],
  ["nov", 11],
  ["dec", 12],
])

function normalizeCronValue(args: {
  token: string
  min: number
  max: number
  labels?: Map<string, number>
  allowSundaySeven?: boolean
}) {
  const normalizedToken = args.token.trim().toLowerCase()
  const mapped = args.labels?.get(normalizedToken)
  const parsedNumber = mapped ?? Number.parseInt(normalizedToken, 10)

  if (!Number.isInteger(parsedNumber)) {
    throw createOrchestrationError().invalidInput(
      `invalid cron value "${args.token}"`,
    )
  }

  const normalizedNumber =
    args.allowSundaySeven && parsedNumber === 7 ? 0 : parsedNumber

  if (normalizedNumber < args.min || normalizedNumber > args.max) {
    throw createOrchestrationError().invalidInput(
      `cron value "${args.token}" is out of range`,
    )
  }

  return normalizedNumber
}

function toFieldRange(min: number, max: number) {
  return Array.from({ length: max - min + 1 }, (_, index) => min + index)
}

function parseCronField(args: {
  expression: string
  min: number
  max: number
  labels?: Map<string, number>
  allowSundaySeven?: boolean
}): CronField {
  const expression = args.expression.trim()
  if (!expression) {
    throw createOrchestrationError().invalidInput("cron field is required")
  }

  const values = new Set<number>()
  const tokens = expression.split(",")

  for (const token of tokens) {
    const normalizedToken = token.trim()
    if (!normalizedToken) {
      throw createOrchestrationError().invalidInput(
        `invalid cron field "${expression}"`,
      )
    }

    const [baseExpression, stepExpression] = normalizedToken.split("/")
    const step = stepExpression ? Number.parseInt(stepExpression, 10) : 1

    if (!Number.isInteger(step) || step <= 0) {
      throw createOrchestrationError().invalidInput(
        `invalid cron step "${normalizedToken}"`,
      )
    }

    let baseValues: number[]
    if (baseExpression === "*") {
      baseValues = toFieldRange(args.min, args.max)
    } else if (baseExpression.includes("-")) {
      const [leftExpression, rightExpression] = baseExpression.split("-")
      const left = normalizeCronValue({
        token: leftExpression,
        min: args.min,
        max: args.max,
        labels: args.labels,
        allowSundaySeven: args.allowSundaySeven,
      })
      const right = normalizeCronValue({
        token: rightExpression,
        min: args.min,
        max: args.max,
        labels: args.labels,
        allowSundaySeven: args.allowSundaySeven,
      })

      if (right < left) {
        throw createOrchestrationError().invalidInput(
          `invalid cron range "${normalizedToken}"`,
        )
      }

      baseValues = toFieldRange(left, right)
    } else {
      const start = normalizeCronValue({
        token: baseExpression,
        min: args.min,
        max: args.max,
        labels: args.labels,
        allowSundaySeven: args.allowSundaySeven,
      })
      baseValues = stepExpression ? toFieldRange(start, args.max) : [start]
    }

    for (let index = 0; index < baseValues.length; index += step) {
      values.add(baseValues[index]!)
    }
  }

  return {
    values,
    wildcard: expression === "*",
  }
}

const timeZoneFormatters = new Map<string, Intl.DateTimeFormat>()

function getTimeZoneFormatter(timezone: string) {
  const cached = timeZoneFormatters.get(timezone)
  if (cached) {
    return cached
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
    weekday: "short",
  })
  timeZoneFormatters.set(timezone, formatter)
  return formatter
}

function getTimeZoneParts(date: Date, timezone: string) {
  const parts = getTimeZoneFormatter(timezone).formatToParts(date)
  const values = new Map<string, string>()

  for (const part of parts) {
    if (part.type !== "literal") {
      values.set(part.type, part.value)
    }
  }

  const weekday = WEEKDAY_NAMES.get(
    values.get("weekday")!.slice(0, 3).toLowerCase(),
  )

  if (weekday === undefined) {
    throw createOrchestrationError().invalidState("failed to resolve weekday")
  }

  return {
    minute: Number.parseInt(values.get("minute") ?? "", 10),
    hour: Number.parseInt(values.get("hour") ?? "", 10),
    dayOfMonth: Number.parseInt(values.get("day") ?? "", 10),
    month: Number.parseInt(values.get("month") ?? "", 10),
    dayOfWeek: weekday,
  }
}

export function parseCronExpression(expression: string): ParsedCronExpression {
  const normalizedExpression = expression.trim()
  const fields = normalizedExpression.split(/\s+/)

  if (fields.length !== 5) {
    throw createOrchestrationError().invalidInput(
      `invalid cron expression "${expression}"`,
    )
  }

  return {
    minute: parseCronField({
      expression: fields[0]!,
      min: 0,
      max: 59,
    }),
    hour: parseCronField({
      expression: fields[1]!,
      min: 0,
      max: 23,
    }),
    dayOfMonth: parseCronField({
      expression: fields[2]!,
      min: 1,
      max: 31,
    }),
    month: parseCronField({
      expression: fields[3]!,
      min: 1,
      max: 12,
      labels: MONTH_NAMES,
    }),
    dayOfWeek: parseCronField({
      expression: fields[4]!,
      min: 0,
      max: 6,
      labels: WEEKDAY_NAMES,
      allowSundaySeven: true,
    }),
  }
}

export function matchesCronSchedule(args: {
  expression: ParsedCronExpression
  timezone: string
  date: Date
}) {
  const localDate = getTimeZoneParts(args.date, args.timezone)
  const minuteMatches = args.expression.minute.values.has(localDate.minute)
  const hourMatches = args.expression.hour.values.has(localDate.hour)
  const monthMatches = args.expression.month.values.has(localDate.month)
  const dayOfMonthMatches = args.expression.dayOfMonth.values.has(
    localDate.dayOfMonth,
  )
  const dayOfWeekMatches = args.expression.dayOfWeek.values.has(
    localDate.dayOfWeek,
  )

  const dayMatches =
    args.expression.dayOfMonth.wildcard && args.expression.dayOfWeek.wildcard
      ? true
      : args.expression.dayOfMonth.wildcard
        ? dayOfWeekMatches
        : args.expression.dayOfWeek.wildcard
          ? dayOfMonthMatches
          : dayOfMonthMatches || dayOfWeekMatches

  return minuteMatches && hourMatches && monthMatches && dayMatches
}

export function resolveNextCronOccurrence(args: {
  cronExpression: string
  timezone: string
  after: Date
  maxLookaheadMinutes?: number
}) {
  const parsedExpression = parseCronExpression(args.cronExpression)
  const maxLookaheadMinutes = args.maxLookaheadMinutes ?? 60 * 24 * 366
  const nextMinute = Math.floor(args.after.getTime() / 60_000) * 60_000 + 60_000

  for (let offset = 0; offset < maxLookaheadMinutes; offset += 1) {
    const candidate = new Date(nextMinute + offset * 60_000)

    if (
      matchesCronSchedule({
        expression: parsedExpression,
        timezone: args.timezone,
        date: candidate,
      })
    ) {
      return candidate
    }
  }

  throw createOrchestrationError().invalidInput(
    `unable to resolve next trigger for cron "${args.cronExpression}"`,
  )
}
