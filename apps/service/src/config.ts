export type ServiceConfig = {
  port: number
  host: string
  serviceName: string
  isProduction: boolean
}

function parsePort(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }

  return Math.trunc(parsed)
}

export function getServiceConfig(): ServiceConfig {
  return {
    port: parsePort(process.env.EXECUTOR_PORT, 3400),
    host: process.env.EXECUTOR_HOST?.trim() || "0.0.0.0",
    serviceName: process.env.EXECUTOR_SERVICE_NAME?.trim() || "service",
    isProduction: process.env.NODE_ENV === "production",
  }
}
