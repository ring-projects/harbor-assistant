"use client"

import { useNavigate } from "@tanstack/react-router"
import { EllipsisIcon, LogOutIcon } from "lucide-react"

import { HarborMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  useAuthSessionQuery,
  useLogoutMutation,
} from "@/modules/auth/hooks/use-auth"

function getDisplayName(input: { name: string | null; githubLogin: string }) {
  return input.name?.trim() || input.githubLogin
}

function getAvatarFallbackLabel(input: {
  name: string | null
  githubLogin: string
}) {
  const displayName = getDisplayName(input).trim()
  return displayName.charAt(0).toUpperCase()
}

export function SidebarUserPanel() {
  const navigate = useNavigate()
  const authSessionQuery = useAuthSessionQuery()
  const logoutMutation = useLogoutMutation()
  const user = authSessionQuery.data?.user

  if (!user) {
    return null
  }

  const displayName = getDisplayName({
    name: user.name,
    githubLogin: user.githubLogin,
  })
  const avatarFallbackLabel = getAvatarFallbackLabel({
    name: user.name,
    githubLogin: user.githubLogin,
  })

  return (
    <div className="border-sidebar-border mt-auto border-t px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <div className="bg-sidebar-accent text-sidebar-foreground flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={`${displayName} avatar`}
              className="size-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : avatarFallbackLabel ? (
            <span className="text-[13px] font-semibold">
              {avatarFallbackLabel}
            </span>
          ) : (
            <HarborMark className="size-4.5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] leading-none font-medium">
            {displayName}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-sidebar-border bg-background text-sidebar-foreground hover:bg-sidebar-accent size-8 rounded-full shadow-none"
              aria-label="Open user menu"
            >
              <EllipsisIcon className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-2 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  {displayName}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  @{user.githubLogin}
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={logoutMutation.isPending}
              onSelect={() => {
                void logoutMutation.mutateAsync().then(() => {
                  void navigate({
                    to: "/login",
                    replace: true,
                  })
                })
              }}
            >
              <LogOutIcon className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
