import { createPrivateKey, createSign } from "node:crypto"

import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"
import type {
  GitHubAppClient,
  GitHubInstallationAccessToken,
  GitHubInstallationRecord,
  GitHubInstallationRepositorySummary,
} from "../application/github-app-client"

type FetchLike = typeof fetch

type GitHubInstallationApiResponse = {
  id: number
  suspended_by: { login?: string } | null
  account?: {
    login?: string
    type?: string
  } | null
  repository_selection?: string
}

type GitHubAccessTokenApiResponse = {
  token?: string
  expires_at?: string
}

type GitHubInstallationRepositoriesApiResponse = {
  repositories?: Array<{
    node_id?: string | null
    name?: string
    full_name?: string
    clone_url?: string
    default_branch?: string | null
    visibility?: "public" | "private" | "internal"
    owner?: {
      login?: string
    }
  }>
}

function encodeBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function normalizeGitHubInstallationAccountType(
  value: string | undefined,
): "user" | "organization" {
  return value === "Organization" ? "organization" : "user"
}

function normalizeInstallationTargetType(
  value: string | undefined,
): "selected" | "all" {
  return value === "all" ? "all" : "selected"
}

export class NodeGitHubAppClient implements GitHubAppClient {
  constructor(
    private readonly options: {
      appId?: string
      appSlug?: string
      privateKey?: string
      fetch?: FetchLike
    },
  ) {}

  private get fetchImpl() {
    return this.options.fetch ?? fetch
  }

  buildInstallUrl(state?: string): string {
    if (!this.options.appSlug?.trim()) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_CONFIGURED,
        503,
        "GitHub App is not configured.",
      )
    }

    const url = new URL(
      `https://github.com/apps/${this.options.appSlug.trim()}/installations/new`,
    )

    if (state?.trim()) {
      url.searchParams.set("state", state.trim())
    }

    return url.toString()
  }

  async getInstallation(installationId: string): Promise<GitHubInstallationRecord> {
    const response = await this.fetchGitHubJson<GitHubInstallationApiResponse>(
      `https://api.github.com/app/installations/${installationId}`,
      {
        authorization: `Bearer ${this.createAppJwt()}`,
      },
    )

    return {
      id: String(response.id),
      accountType: normalizeGitHubInstallationAccountType(response.account?.type),
      accountLogin: response.account?.login?.trim() || "unknown",
      targetType: normalizeInstallationTargetType(response.repository_selection),
      status: response.suspended_by ? "suspended" : "active",
    }
  }

  async listInstallationRepositories(
    installationId: string,
  ): Promise<GitHubInstallationRepositorySummary[]> {
    const token = await this.createInstallationAccessToken(installationId)
    const response = await this.fetchGitHubJson<GitHubInstallationRepositoriesApiResponse>(
      "https://api.github.com/installation/repositories",
      {
        authorization: `Bearer ${token.token}`,
      },
    )

    return (response.repositories ?? []).map((repository) => ({
      nodeId: repository.node_id ?? null,
      owner: repository.owner?.login?.trim() || "",
      name: repository.name?.trim() || "",
      fullName: repository.full_name?.trim() || "",
      url: repository.clone_url?.trim() || "",
      defaultBranch: repository.default_branch?.trim() ?? null,
      visibility: repository.visibility ?? null,
    }))
  }

  async createInstallationAccessToken(
    installationId: string,
  ): Promise<GitHubInstallationAccessToken> {
    const response = await this.fetchGitHubJson<GitHubAccessTokenApiResponse>(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: "POST",
        authorization: `Bearer ${this.createAppJwt()}`,
      },
    )

    if (!response.token?.trim() || !response.expires_at) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        502,
        "GitHub App access token response is invalid.",
      )
    }

    return {
      token: response.token.trim(),
      expiresAt: new Date(response.expires_at),
    }
  }

  private createAppJwt() {
    if (!this.options.appId?.trim() || !this.options.privateKey?.trim()) {
      throw new AppError(
        ERROR_CODES.AUTH_NOT_CONFIGURED,
        503,
        "GitHub App is not configured.",
      )
    }

    const now = Math.floor(Date.now() / 1000)
    const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const payload = encodeBase64Url(
      JSON.stringify({
        iat: now - 60,
        exp: now + 9 * 60,
        iss: this.options.appId.trim(),
      }),
    )
    const signer = createSign("RSA-SHA256")
    signer.update(`${header}.${payload}`)
    signer.end()
    const privateKey = this.options.privateKey.replace(/\\n/g, "\n")

    const signature = signer
      .sign(createPrivateKey(privateKey))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")

    return `${header}.${payload}.${signature}`
  }

  private async fetchGitHubJson<T>(
    url: string,
    init: {
      method?: string
      authorization: string
    },
  ): Promise<T> {
    const response = await this.fetchImpl(url, {
      method: init.method ?? "GET",
      headers: {
        accept: "application/vnd.github+json",
        authorization: init.authorization,
        "user-agent": "harbor-service",
        "x-github-api-version": "2022-11-28",
      },
    })

    if (!response.ok) {
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        502,
        `GitHub API request failed for ${url}.`,
      )
    }

    return (await response.json()) as T
  }
}
