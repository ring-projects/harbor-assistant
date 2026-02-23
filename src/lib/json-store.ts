import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

const fileLocks = new Map<string, Promise<void>>()

export async function readJsonFile<T>(args: {
  filePath: string
  fallback: T
}): Promise<T> {
  const { filePath, fallback } = args

  try {
    const content = await readFile(filePath, "utf8")
    const parsed = JSON.parse(content) as T
    return parsed
  } catch (error) {
    const code =
      typeof error === "object" &&
      error &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : null

    if (code === "ENOENT") {
      return fallback
    }

    throw error
  }
}

export async function writeJsonFileAtomic<T>(args: {
  filePath: string
  data: T
}): Promise<void> {
  const { filePath, data } = args
  const directory = path.dirname(filePath)

  await mkdir(directory, { recursive: true })

  const temporaryPath = path.join(
    directory,
    `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`,
  )

  const content = `${JSON.stringify(data, null, 2)}\n`
  await writeFile(temporaryPath, content, "utf8")
  await rename(temporaryPath, filePath)
}

export async function withFileLock<T>(
  filePath: string,
  operation: () => Promise<T>,
): Promise<T> {
  const tail = fileLocks.get(filePath) ?? Promise.resolve()
  const current = tail.then(operation)
  const continuation = current.then(
    () => undefined,
    () => undefined,
  )

  fileLocks.set(filePath, continuation)

  try {
    return await current
  } finally {
    if (fileLocks.get(filePath) === continuation) {
      fileLocks.delete(filePath)
    }
  }
}
