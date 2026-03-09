import { z } from "zod";

const configSchema = z.object({
  port: z.coerce.number().int().default(3400),
  host: z.string().default("0.0.0.0"),
  serviceName: z.string().default("harbor"),
  database: z.url(),
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = configSchema.safeParse({
  port: process.env.PORT,
  host: process.env.HOST,
  serviceName: process.env.SERVICE_NAME,
  database: process.env.DATABASE_URL,
  nodeEnv: process.env.NODE_ENV,
});

if (!parsed.success) {
  console.error(parsed.error.flatten());
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.nodeEnv === "production",
};

export type ServiceConfig = typeof config;