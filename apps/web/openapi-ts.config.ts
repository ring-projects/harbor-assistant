import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  input: "../service/generated/openapi/openapi.json",
  output: "src/lib/api/generated/harbor",
})
