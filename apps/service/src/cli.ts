#!/usr/bin/env node

import { runHarborCli } from "./cli/harbor-cli"

const exitCode = await runHarborCli(process.argv.slice(2))
if (exitCode !== 0) {
  process.exitCode = exitCode
}
