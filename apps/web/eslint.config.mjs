import { defineConfig, globalIgnores } from "eslint/config"
import eslintConfigPrettier from "eslint-config-prettier/flat"

export default defineConfig([
  globalIgnores([".next/**", ".output/**", "out/**", "build/**"]),
  eslintConfigPrettier,
])
