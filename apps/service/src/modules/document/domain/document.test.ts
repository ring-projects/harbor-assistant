import { describe, expect, it } from "vitest"

import {
  archiveDocument,
  assertDocumentCanWrite,
  createDocument,
  publishDocument,
  reviseDocument,
} from "./document"
import { DOCUMENT_ERROR_CODES, type DocumentError } from "../errors"

describe("document domain", () => {
  it("creates a draft document with default version", () => {
    const document = createDocument({
      id: "doc-1",
      projectId: "project-1",
      kind: "requirements",
      title: "Runtime drift requirements",
      path: ".harbor/docs/requirements/requirements-doc-1.md",
      format: "markdown",
    })

    expect(document).toMatchObject({
      id: "doc-1",
      projectId: "project-1",
      taskId: null,
      kind: "requirements",
      title: "Runtime drift requirements",
      path: ".harbor/docs/requirements/requirements-doc-1.md",
      format: "markdown",
      status: "draft",
      version: 1,
      summary: null,
    })
  })

  it("rejects paths outside the project .harbor workspace", () => {
    expect(() =>
      createDocument({
        id: "doc-1",
        projectId: "project-1",
        kind: "requirements",
        title: "Runtime drift requirements",
        path: "../requirements.md",
        format: "markdown",
      }),
    ).toThrow(
      expect.objectContaining({
        code: DOCUMENT_ERROR_CODES.INVALID_PATH,
      } satisfies Partial<DocumentError>),
    )
  })

  it("rejects path traversal under the workspace", () => {
    expect(() =>
      createDocument({
        id: "doc-1",
        projectId: "project-1",
        kind: "requirements",
        title: "Runtime drift requirements",
        path: ".harbor/docs/requirements/../../escape.md",
        format: "markdown",
      }),
    ).toThrow(
      expect.objectContaining({
        code: DOCUMENT_ERROR_CODES.INVALID_PATH,
      } satisfies Partial<DocumentError>),
    )
  })

  it("rejects unsupported format for the document kind", () => {
    expect(() =>
      createDocument({
        id: "doc-1",
        projectId: "project-1",
        kind: "context_bundle",
        title: "Bundle for runtime drift",
        path: ".harbor/docs/bundles/bundle-doc-1.md",
        format: "markdown",
      }),
    ).toThrow(
      expect.objectContaining({
        code: DOCUMENT_ERROR_CODES.INVALID_FORMAT,
      } satisfies Partial<DocumentError>),
    )
  })

  it("increments version when the document is revised", () => {
    const document = createDocument({
      id: "doc-1",
      projectId: "project-1",
      kind: "plan",
      title: "Runtime drift plan",
      path: ".harbor/docs/plans/plan-doc-1.md",
      format: "markdown",
    })

    const revised = reviseDocument(
      document,
      new Date("2026-03-26T00:00:00.000Z"),
    )

    expect(revised.version).toBe(2)
    expect(revised.updatedAt.toISOString()).toBe("2026-03-26T00:00:00.000Z")
  })

  it("prevents writing to archived documents", () => {
    const document = createDocument({
      id: "doc-1",
      projectId: "project-1",
      kind: "review",
      title: "Runtime drift review",
      path: ".harbor/docs/reviews/review-doc-1.md",
      format: "markdown",
    })

    const archived = archiveDocument(
      document,
      new Date("2026-03-26T00:00:00.000Z"),
    )

    expect(() => assertDocumentCanWrite(archived)).toThrow(
      expect.objectContaining({
        code: DOCUMENT_ERROR_CODES.ARCHIVED,
      } satisfies Partial<DocumentError>),
    )
    expect(() => reviseDocument(archived)).toThrow(
      expect.objectContaining({
        code: DOCUMENT_ERROR_CODES.ARCHIVED,
      } satisfies Partial<DocumentError>),
    )
  })

  it("publishes a draft document without changing identity", () => {
    const document = createDocument({
      id: "doc-1",
      projectId: "project-1",
      taskId: "task-1",
      kind: "task_summary",
      title: "Runtime drift summary",
      path: ".harbor/docs/summaries/summary-doc-1.md",
      format: "markdown",
    })

    const published = publishDocument(
      document,
      new Date("2026-03-26T00:00:00.000Z"),
    )

    expect(published.id).toBe("doc-1")
    expect(published.taskId).toBe("task-1")
    expect(published.status).toBe("published")
  })
})
