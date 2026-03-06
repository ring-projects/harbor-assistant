import "server-only"

import { ERROR_CODES } from "@/constants"

type ServiceRequestMethod = "GET" | "POST" | "PUT" | "DELETE"

type ServiceRequestArgs = {
  path: string
  method: ServiceRequestMethod
  payload?: unknown
  headers?: Record<string, string>
}

const DEFAULT_SERVICE_BASE_URL = "http://127.0.0.1:3400"

function resolveServiceBaseUrl() {
  const value = process.env.EXECUTOR_SERVICE_BASE_URL?.trim()
  if (!value) {
    return DEFAULT_SERVICE_BASE_URL
  }

  return value.replace(/\/+$/, "")
}

function isJsonContentType(contentType: string | null) {
  if (!contentType) {
    return false
  }

  return contentType.toLowerCase().includes("application/json")
}

function toResponse(response: Response) {
  return new Response(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  })
}

function serviceErrorResponse(message: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message,
      },
    },
    { status: 502 },
  )
}

async function sendServiceRequest(args: ServiceRequestArgs) {
  const baseUrl = resolveServiceBaseUrl()
  const targetUrl = `${baseUrl}${args.path}`

  try {
    return await fetch(targetUrl, {
      method: args.method,
      headers:
        args.payload === undefined
          ? args.headers
          : {
              "Content-Type": "application/json",
              ...(args.headers ?? {}),
            },
      body: args.payload === undefined ? undefined : JSON.stringify(args.payload),
      cache: "no-store",
    })
  } catch (error) {
    return serviceErrorResponse(`Failed to request service: ${String(error)}`)
  }
}

export async function proxyToService(args: ServiceRequestArgs) {
  const response = await sendServiceRequest(args)
  return toResponse(response)
}

export async function requestServiceJson<T>(args: ServiceRequestArgs): Promise<{
  status: number
  body: T | null
}> {
  const response = await sendServiceRequest(args)
  const contentType = response.headers.get("content-type")

  if (!isJsonContentType(contentType)) {
    return {
      status: response.status,
      body: null,
    }
  }

  try {
    const body = (await response.json()) as T
    return {
      status: response.status,
      body,
    }
  } catch {
    return {
      status: response.status,
      body: null,
    }
  }
}
