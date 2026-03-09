import { homedir } from "node:os"
import path from "node:path"
import { z } from "zod"

function toAbsolutePath(value: string) {
  if (value === "~") {
    return homedir()
  }

  if (value.startsWith("~/")) {
    return path.join(homedir(), value.slice(2))
  }

  return path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(process.cwd(), value)
}

const configSchema = z.object({
  port: z.coerce.number().int().default(3400),
  host: z.string().default("0.0.0.0"),
  serviceName: z.string().default("harbor"),
  database: z.url(),
  fileBrowserRootDirectory: z
    .string()
    .transform((value) => toAbsolutePath(value))
    .default(homedir()),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
})

const parsed = configSchema.safeParse({
  port: process.env.PORT,
  host: process.env.HOST,
  serviceName: process.env.SERVICE_NAME,
  database: process.env.DATABASE_URL,
  fileBrowserRootDirectory: process.env.FILE_BROWSER_ROOT_DIRECTORY,
  nodeEnv: process.env.NODE_ENV,
})

if (!parsed.success) {
  console.error(parsed.error.flatten())
  process.exit(1)
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.nodeEnv === "production",
}

export type ServiceConfig = typeof config
