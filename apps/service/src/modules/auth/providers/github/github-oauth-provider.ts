import { AppError } from "../../../../lib/errors/app-error"
import { ERROR_CODES } from "../../../../constants/errors"

type FetchLike = typeof fetch

type GitHubTokenResponse = {
  access_token?: string
  error?: string
  error_description?: string
}

type GitHubUserProfile = {
  id: number
  login: string
  name: string | null
  avatar_url: string | null
}

type GitHubUserEmail = {
  email: string
  primary: boolean
  verified: boolean
}

type GitHubOrg = {
  login: string
}

export type GitHubIdentity = {
  providerUserId: string
  login: string
  name: string | null
  email: string | null
  avatarUrl: string | null
  organizations: string[]
}

export function buildGitHubAuthorizeUrl(args: {
  clientId: string
  redirectUri: string
  state: string
  scopes: string[]
}) {
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", args.clientId)
  url.searchParams.set("redirect_uri", args.redirectUri)
  url.searchParams.set("scope", args.scopes.join(" "))
  url.searchParams.set("state", args.state)
  return url.toString()
}

export class GitHubOAuthProvider {
  constructor(
    private readonly options: {
      clientId: string
      clientSecret: string
      fetch?: FetchLike
    },
  ) {}

  private get fetchImpl() {
    return this.options.fetch ?? fetch
  }

  buildAuthorizeUrl(args: {
    redirectUri: string
    state: string
    scopes: string[]
  }) {
    return buildGitHubAuthorizeUrl({
      clientId: this.options.clientId,
      redirectUri: args.redirectUri,
      state: args.state,
      scopes: args.scopes,
    })
  }

  async exchangeCodeForIdentity(args: {
    code: string
    redirectUri: string
    includeOrganizations?: boolean
  }): Promise<GitHubIdentity> {
    const token = await this.exchangeCodeForAccessToken(args)
    const profilePromise = this.fetchGitHubJson<GitHubUserProfile>(
      "https://api.github.com/user",
      token,
    )
    const emailsPromise = this.fetchGitHubJson<GitHubUserEmail[]>(
      "https://api.github.com/user/emails",
      token,
    )
    const orgsPromise = args.includeOrganizations
      ? this.fetchGitHubJson<GitHubOrg[]>(
          "https://api.github.com/user/orgs",
          token,
        )
      : Promise.resolve([])

    const [profile, emails, orgs] = await Promise.all([
      profilePromise,
      emailsPromise,
      orgsPromise,
    ])

    const primaryEmail =
      emails.find((email) => email.primary && email.verified)?.email ??
      emails.find((email) => email.verified)?.email ??
      emails[0]?.email ??
      null

    return {
      providerUserId: String(profile.id),
      login: profile.login,
      name: profile.name,
      email: primaryEmail,
      avatarUrl: profile.avatar_url,
      organizations: orgs.map((org) => org.login),
    }
  }

  private async exchangeCodeForAccessToken(args: {
    code: string
    redirectUri: string
  }) {
    const response = await this.fetchImpl(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "user-agent": "harbor-service",
        },
        body: JSON.stringify({
          client_id: this.options.clientId,
          client_secret: this.options.clientSecret,
          code: args.code,
          redirect_uri: args.redirectUri,
        }),
      },
    )

    const payload = (await response.json()) as GitHubTokenResponse
    const accessToken = payload.access_token?.trim()

    if (!response.ok || !accessToken) {
      throw new AppError(
        ERROR_CODES.AUTH_CALLBACK_FAILED,
        502,
        payload.error_description || "Failed to exchange GitHub OAuth code.",
      )
    }

    return accessToken
  }

  private async fetchGitHubJson<T>(
    url: string,
    accessToken: string,
  ): Promise<T> {
    const response = await this.fetchImpl(url, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        "user-agent": "harbor-service",
        "x-github-api-version": "2022-11-28",
      },
    })

    if (!response.ok) {
      throw new AppError(
        ERROR_CODES.AUTH_CALLBACK_FAILED,
        502,
        `GitHub API request failed for ${url}.`,
      )
    }

    return (await response.json()) as T
  }
}
