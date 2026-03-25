"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { buildExecutorApiUrl } from "@/lib/executor-service-url"
import type {
  DirectoryListErrorResponse,
  DirectoryListSuccessResponse,
} from "../types"

type UseDirectoryEntriesQueryInput = {
  path: string | null
  includeHidden: boolean
  pageSize: number
}

const DIRECTORY_ENTRIES_QUERY_KEY = "directory-entries"

function toErrorMessage(payload: DirectoryListErrorResponse | null) {
  if (!payload) {
    return "Failed to list directories."
  }

  return payload.error?.message ?? "Failed to list directories."
}

async function fetchDirectoryEntries(input: UseDirectoryEntriesQueryInput) {
  const response = await fetch(buildExecutorApiUrl("/v1/fs/list"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      path: input.path ?? undefined,
      limit: input.pageSize,
      includeHidden: input.includeHidden,
      cursor: null,
    }),
  })

  const payload = (await response
    .json()
    .catch(() => null)) as
    | DirectoryListSuccessResponse
    | DirectoryListErrorResponse
    | null

  if (!payload || !response.ok || payload.ok !== true) {
    throw new Error(toErrorMessage(payload as DirectoryListErrorResponse | null))
  }

  return payload
}

export function useDirectoryEntriesQuery(input: UseDirectoryEntriesQueryInput) {
  return useQuery({
    queryKey: [
      DIRECTORY_ENTRIES_QUERY_KEY,
      input.path,
      input.includeHidden,
      input.pageSize,
    ],
    queryFn: () => fetchDirectoryEntries(input),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}
