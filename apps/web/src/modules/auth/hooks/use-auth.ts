import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { logout, readAuthSession } from "../api"
import type { AuthSession } from "../types"

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const

export function useAuthSessionQuery() {
  return useQuery<AuthSession>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: readAuthSession,
    staleTime: 30_000,
    retry: 1,
  })
}

export function useLogoutMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess() {
      queryClient.setQueryData<AuthSession>(AUTH_SESSION_QUERY_KEY, {
        authenticated: false,
        user: null,
      })
    },
  })
}
