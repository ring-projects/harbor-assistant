import { describe, expect, it, vi } from "vitest"

import { createDocument } from "../domain/document"
import { createDocumentUseCase } from "./create-document"
import { getDocumentUseCase } from "./get-document"
import { readDocumentContentUseCase } from "./read-document-content"
import { updateDocumentContentUseCase } from "./update-document-content"
import { publishDocumentUseCase } from "./publish-document"
import { archiveDocumentUseCase } from "./archive-document"
import { listProjectDocumentsUseCase } from "./list-project-documents"
import { listTaskDocumentsUseCase } from "./list-task-documents"
import type { DocumentRepository } from "./document-repository"
import type { DocumentContentStore } from "./document-content-store"
import type { ProjectDocumentPort } from "./project-document-port"
import { DOCUMENT_ERROR_CODES, type DocumentError } from "../errors"

describe("document use cases", () => {
  function createRepository(
    seed = [
      createDocument({
        id: "doc-1",
        projectId: "project-1",
        taskId: "task-1",
        kind: "requirements",
        title: "Runtime drift requirements",
        path: ".harbor/docs/requirements/requirements-doc-1.md",
        format: "markdown",
      }),
    ],
  ): DocumentRepository {
    const documents = new Map(seed.map((document) => [document.id, document]))
    return {
      create: vi.fn(async (document) => {
        documents.set(document.id, document)
      }),
      findById: vi.fn(async (documentId) => documents.get(documentId) ?? null),
      save: vi.fn(async (document) => {
        documents.set(document.id, document)
      }),
      delete: vi.fn(async (documentId) => {
        documents.delete(documentId)
      }),
      listByProject: vi.fn(async ({ projectId, includeArchived, kind }) =>
        [...documents.values()]
          .filter((document) => document.projectId === projectId)
          .filter(
            (document) => includeArchived || document.status !== "archived",
          )
          .filter((document) => (kind ? document.kind === kind : true))
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          ),
      ),
      listByTask: vi.fn(async ({ taskId, includeArchived, kind }) =>
        [...documents.values()]
          .filter((document) => document.taskId === taskId)
          .filter(
            (document) => includeArchived || document.status !== "archived",
          )
          .filter((document) => (kind ? document.kind === kind : true))
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          ),
      ),
    }
  }

  function createContentStore(
    seed?: Record<string, string>,
  ): DocumentContentStore {
    const contents = new Map(
      Object.entries(
        seed ?? {
          "/tmp/harbor-assistant:.harbor/docs/requirements/requirements-doc-1.md":
            "# Runtime Drift\n\nCapture requirements.",
        },
      ),
    )

    return {
      write: vi.fn(async ({ projectRootPath, path, content }) => {
        contents.set(`${projectRootPath}:${path}`, content)
      }),
      read: vi.fn(async ({ projectRootPath, path }) => {
        const content = contents.get(`${projectRootPath}:${path}`)
        if (content === undefined) {
          throw new Error("missing content")
        }

        const format: "json" | "markdown" = path.endsWith(".json")
          ? "json"
          : "markdown"

        return {
          path,
          format,
          content,
        }
      }),
      delete: vi.fn(async ({ projectRootPath, path }) => {
        contents.delete(`${projectRootPath}:${path}`)
      }),
    }
  }

  function createProjectPort(): ProjectDocumentPort {
    return {
      getProjectForDocument: vi.fn(async (projectId) => ({
        projectId,
        rootPath: "/tmp/harbor-assistant",
      })),
    }
  }

  it("creates metadata and initial content for a fresh document", async () => {
    const repository = createRepository([])
    const contentStore = createContentStore({})
    const projectDocumentPort = createProjectPort()

    const document = await createDocumentUseCase(
      {
        repository,
        contentStore,
        projectDocumentPort,
        idGenerator: () => "doc-created-1",
        now: () => new Date("2026-03-26T00:00:00.000Z"),
      },
      {
        projectId: "project-1",
        taskId: "task-1",
        kind: "requirements",
        title: "Runtime drift requirements",
        path: ".harbor/docs/requirements/requirements-doc-created-1.md",
        format: "markdown",
        content: "# Runtime Drift\n\nCapture requirements.",
      },
    )

    expect(projectDocumentPort.getProjectForDocument).toHaveBeenCalledWith(
      "project-1",
    )
    expect(repository.create).toHaveBeenCalledOnce()
    expect(contentStore.write).toHaveBeenCalledWith({
      projectRootPath: "/tmp/harbor-assistant",
      path: ".harbor/docs/requirements/requirements-doc-created-1.md",
      format: "markdown",
      content: "# Runtime Drift\n\nCapture requirements.",
    })
    expect(document).toMatchObject({
      id: "doc-created-1",
      projectId: "project-1",
      taskId: "task-1",
      status: "draft",
      version: 1,
    })
  })

  it("fails create when project does not exist", async () => {
    const repository = createRepository([])
    const contentStore = createContentStore({})

    await expect(
      createDocumentUseCase(
        {
          repository,
          contentStore,
          projectDocumentPort: {
            getProjectForDocument: vi.fn().mockResolvedValue(null),
          },
          idGenerator: () => "doc-created-1",
        },
        {
          projectId: "missing",
          kind: "requirements",
          title: "Missing project doc",
          path: ".harbor/docs/requirements/requirements-doc-created-1.md",
          format: "markdown",
          content: "# Missing",
        },
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.PROJECT_NOT_FOUND,
    } satisfies Partial<DocumentError>)
  })

  it("gets document metadata and content and fails for missing document", async () => {
    const repository = createRepository()
    const contentStore = createContentStore()

    const document = await getDocumentUseCase(repository, "doc-1")
    expect(document.title).toBe("Runtime drift requirements")

    const content = await readDocumentContentUseCase(
      { repository, contentStore, projectDocumentPort: createProjectPort() },
      "doc-1",
    )
    expect(content.content).toContain("Capture requirements")

    await expect(
      getDocumentUseCase(repository, "missing"),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.NOT_FOUND,
    } satisfies Partial<DocumentError>)
  })

  it("updates document content and increments version", async () => {
    const repository = createRepository()
    const contentStore = createContentStore()

    const updated = await updateDocumentContentUseCase(
      {
        repository,
        contentStore,
        projectDocumentPort: createProjectPort(),
        now: () => new Date("2026-03-26T00:00:00.000Z"),
      },
      {
        documentId: "doc-1",
        content: "# Runtime Drift\n\nRefined requirements.",
        summary: "Refined requirements summary",
      },
    )

    expect(updated.version).toBe(2)
    expect(updated.summary).toBe("Refined requirements summary")
    expect(contentStore.write).toHaveBeenCalledWith({
      projectRootPath: "/tmp/harbor-assistant",
      path: ".harbor/docs/requirements/requirements-doc-1.md",
      format: "markdown",
      content: "# Runtime Drift\n\nRefined requirements.",
    })
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it("publishes and archives a document while keeping query filters stable", async () => {
    const repository = createRepository([
      createDocument({
        id: "doc-1",
        projectId: "project-1",
        taskId: "task-1",
        kind: "requirements",
        title: "Runtime drift requirements",
        path: ".harbor/docs/requirements/requirements-doc-1.md",
        format: "markdown",
      }),
      createDocument({
        id: "doc-2",
        projectId: "project-1",
        taskId: "task-1",
        kind: "review",
        title: "Runtime drift review",
        path: ".harbor/docs/reviews/review-doc-2.md",
        format: "markdown",
      }),
    ])

    const published = await publishDocumentUseCase(repository, {
      documentId: "doc-1",
      now: new Date("2026-03-26T00:00:00.000Z"),
    })
    expect(published.status).toBe("published")

    const archived = await archiveDocumentUseCase(repository, {
      documentId: "doc-2",
      now: new Date("2026-03-26T00:00:00.000Z"),
    })
    expect(archived.status).toBe("archived")

    const activeProjectDocs = await listProjectDocumentsUseCase(repository, {
      projectId: "project-1",
    })
    expect(activeProjectDocs.map((document) => document.id)).toEqual(["doc-1"])

    const taskDocs = await listTaskDocumentsUseCase(repository, {
      taskId: "task-1",
      includeArchived: true,
    })
    expect(taskDocs.map((document) => document.id)).toEqual(["doc-1", "doc-2"])
  })

  it("rolls metadata back when content write fails on create", async () => {
    const repository = createRepository([])
    const projectDocumentPort = createProjectPort()
    const contentStore: DocumentContentStore = {
      write: vi.fn(async () => {
        throw new Error("disk full")
      }),
      read: vi.fn(),
      delete: vi.fn(),
    }

    await expect(
      createDocumentUseCase(
        {
          repository,
          contentStore,
          projectDocumentPort,
          idGenerator: () => "doc-created-1",
        },
        {
          projectId: "project-1",
          kind: "requirements",
          title: "Runtime drift requirements",
          path: ".harbor/docs/requirements/requirements-doc-created-1.md",
          format: "markdown",
          content: "# Runtime Drift",
        },
      ),
    ).rejects.toMatchObject({
      code: DOCUMENT_ERROR_CODES.CONFLICT,
    } satisfies Partial<DocumentError>)

    expect(repository.delete).toHaveBeenCalledWith("doc-created-1")
  })
})
