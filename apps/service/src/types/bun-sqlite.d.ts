declare module "bun:sqlite" {
  export class Statement {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): unknown
  }

  export class Database {
    constructor(
      filename?: string,
      options?: {
        readonly?: boolean
        create?: boolean
        strict?: boolean
        safeIntegers?: boolean
      },
    )

    query(sql: string): Statement
    exec(sql: string): void
    close(): void
  }
}
