import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProjectSettingsView } from "./project-settings-view"

const navigateMock = vi.fn()
const installUrlRefetchMock = vi.fn(async () => ({
  data: "https://github.com/apps/harbor/installations/new",
}))
const installationsRefetchMock = vi.fn(async () => [])
const repositoriesRefetchMock = vi.fn(async () => [])
const repositoryBindingRefetchMock = vi.fn(async () => undefined)
const projectRefetchMock = vi.fn(async () => undefined)
const bindRepositoryMutateAsyncMock = vi.fn()
const installUrlQueryMock = vi.fn()
const useGitHubInstallationsQueryMock = vi.fn()
const useGitHubInstallationRepositoriesQueryMock = vi.fn()
let installEventListener:
  | ((event: {
      status: "success" | "error"
      returnTo: string | null
      code: string | null
      message: string | null
    }) => void)
  | null = null

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({
    href: "/project-1/settings",
    pathname: "/project-1/settings",
    search: "",
    hash: "",
  }),
}))

vi.mock("@/modules/projects/lib/github-app-install-events", () => ({
  subscribeToGitHubAppInstallEvents: (
    onEvent: (event: {
      status: "success" | "error"
      returnTo: string | null
      code: string | null
      message: string | null
    }) => void,
  ) => {
    installEventListener = onEvent
    return () => {
      installEventListener = null
    }
  },
  formatGitHubAppInstallEventMessage: (event: {
    status: "success" | "error"
    code: string | null
    message: string | null
  }) =>
    event.status === "success"
      ? "GitHub App access updated."
      : `${event.code ?? "ERROR"}: ${event.message ?? "failed"}`,
}))

vi.mock("@/modules/projects", () => {
  class MockProjectApiClientError extends Error {
    code: string
    status: number

    constructor(message: string, options?: { code?: string; status?: number }) {
      super(message)
      this.name = "ProjectApiClientError"
      this.code = options?.code ?? "INTERNAL_ERROR"
      this.status = options?.status ?? 500
    }
  }

  return {
    ProjectApiClientError: MockProjectApiClientError,
    getProjectActionError: (error: unknown) =>
      error instanceof Error ? error.message : "Unknown project error.",
    useProjectQuery: () => ({
      isLoading: false,
      isError: false,
      data: {
        id: "project-1",
        name: "Harbor Assistant",
        source: {
          type: "git",
          repositoryUrl: "https://github.com/acme/harbor-assistant.git",
          branch: "main",
        },
        rootPath: null,
        settings: {
          retention: {
            logRetentionDays: 30,
            eventRetentionDays: 7,
          },
          codex: {
            baseUrl: null,
            apiKey: null,
          },
        },
      },
      refetch: projectRefetchMock,
    }),
    useProjectSettingsQuery: () => ({
      isLoading: false,
      isError: false,
      data: {
        retention: {
          logRetentionDays: 30,
          eventRetentionDays: 7,
        },
        codex: {
          baseUrl: null,
          apiKey: null,
        },
      },
    }),
    useProjectRepositoryBindingQuery: () => ({
      data: null,
      isLoading: false,
      isError: true,
      error: new MockProjectApiClientError("missing", {
        code: "NOT_FOUND",
        status: 404,
      }),
      refetch: repositoryBindingRefetchMock,
    }),
    useGitHubInstallUrlQuery: (...args: unknown[]) =>
      installUrlQueryMock(...args),
    useGitHubInstallationsQuery: (...args: unknown[]) =>
      useGitHubInstallationsQueryMock(...args),
    useGitHubInstallationRepositoriesQuery: (...args: unknown[]) =>
      useGitHubInstallationRepositoriesQueryMock(...args),
    useBindProjectRepositoryMutation: () => ({
      isPending: false,
      mutateAsync: bindRepositoryMutateAsyncMock,
    }),
    useUpdateProjectSettingsMutation: () => ({
      isPending: false,
      mutateAsync: vi.fn(),
    }),
    useProvisionProjectWorkspaceMutation: () => ({
      isPending: false,
      mutateAsync: vi.fn(),
    }),
    useSyncProjectWorkspaceMutation: () => ({
      isPending: false,
      mutateAsync: vi.fn(),
    }),
    useDeleteProjectMutation: () => ({
      isPending: false,
      mutateAsync: vi.fn(),
    }),
  }
})

describe("ProjectSettingsView", () => {
  afterEach(() => {
    navigateMock.mockReset()
    installUrlRefetchMock.mockClear()
    installationsRefetchMock.mockClear()
    repositoriesRefetchMock.mockClear()
    repositoryBindingRefetchMock.mockClear()
    projectRefetchMock.mockClear()
    bindRepositoryMutateAsyncMock.mockReset()
    installUrlQueryMock.mockReset()
    useGitHubInstallationsQueryMock.mockReset()
    useGitHubInstallationRepositoriesQueryMock.mockReset()
    installEventListener = null
  })

  function renderView() {
    installUrlQueryMock.mockReturnValue({
      isFetching: false,
      error: null,
      refetch: installUrlRefetchMock,
    })
    useGitHubInstallationsQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          id: "12345",
          accountType: "organization",
          accountLogin: "acme",
          targetType: "selected",
          status: "active",
        },
      ],
      refetch: installationsRefetchMock,
    })
    useGitHubInstallationRepositoriesQueryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        {
          nodeId: "repo_1",
          owner: "acme",
          name: "harbor-assistant",
          fullName: "acme/harbor-assistant",
          url: "https://github.com/acme/harbor-assistant.git",
          defaultBranch: "main",
          visibility: "private",
        },
      ],
      refetch: repositoriesRefetchMock,
    })

    return render(<ProjectSettingsView projectId="project-1" />)
  }

  it("connects repository access for an existing unbound git project", async () => {
    bindRepositoryMutateAsyncMock.mockResolvedValue({
      repositoryFullName: "acme/harbor-assistant",
    })

    renderView()

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Repository Access" }),
      ).toBeEnabled()
    })

    fireEvent.click(
      screen.getByRole("button", { name: "Connect Repository Access" }),
    )

    await waitFor(() => {
      expect(bindRepositoryMutateAsyncMock).toHaveBeenCalledWith({
        repositoryBinding: {
          provider: "github",
          installationId: "12345",
          repositoryFullName: "acme/harbor-assistant",
        },
      })
    })

    expect(
      screen.getByText(
        "Repository access connected for acme/harbor-assistant.",
      ),
    ).toBeInTheDocument()
  })

  it("refreshes installation queries after a GitHub App callback event", async () => {
    renderView()

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Connect Repository Access" }),
      ).toBeEnabled()
    })

    expect(installEventListener).not.toBeNull()

    await act(async () => {
      installEventListener?.({
        status: "success",
        returnTo: "/project-1/settings",
        code: null,
        message: null,
      })
    })

    await waitFor(() => {
      expect(installationsRefetchMock).toHaveBeenCalled()
      expect(repositoriesRefetchMock).toHaveBeenCalled()
    })

    expect(screen.getByText("GitHub App access updated.")).toBeInTheDocument()
  })
})
