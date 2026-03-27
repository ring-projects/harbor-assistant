"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { readBootstrapDirectoryEntries } from "../directory-picker-api"

type UseDirectoryEntriesQueryInput = {
  path: string | null
  includeHidden: boolean
  pageSize: number
}

const DIRECTORY_ENTRIES_QUERY_KEY = "directory-entries"

export function useDirectoryEntriesQuery(input: UseDirectoryEntriesQueryInput) {
  return useQuery({
    queryKey: [
      DIRECTORY_ENTRIES_QUERY_KEY,
      input.path,
      input.includeHidden,
      input.pageSize,
    ],
    queryFn: () => readBootstrapDirectoryEntries(input),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}
