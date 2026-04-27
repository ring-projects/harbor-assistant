export const SCHEDULE_CRON_PRESETS = [
  {
    label: "Every 5 min",
    value: "*/5 * * * *",
  },
  {
    label: "Every 15 min",
    value: "*/15 * * * *",
  },
  {
    label: "Hourly",
    value: "0 * * * *",
  },
  {
    label: "Daily 09:00",
    value: "0 9 * * *",
  },
  {
    label: "Weekdays 09:00",
    value: "0 9 * * mon-fri",
  },
] as const
