"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { HarborLogo } from "@/components/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { LandingPage } from "@/modules/landing-page"
import { useReadProjectsQuery } from "@/modules/projects"

function HomeLoadingState() {
  return (
    <div className="bg-background text-foreground min-h-full">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-14 px-6 pt-10 pb-20 md:px-8 md:pt-12 md:pb-24">
        <div className="flex items-start justify-between gap-4">
          <HarborLogo className="w-90 md:w-105" />
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
        </div>

        <div className="max-w-3xl space-y-5">
          <Skeleton className="h-6 w-40 rounded-full" />
          <Skeleton className="h-14 w-full max-w-3xl" />
          <Skeleton className="h-6 w-full max-w-2xl" />
          <Skeleton className="h-6 w-full max-w-xl" />
          <Skeleton className="mt-3 h-11 w-40" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const router = useRouter()
  const projectsQuery = useReadProjectsQuery()

  useEffect(() => {
    if (!projectsQuery.data?.length) {
      return
    }

    router.replace(`/${encodeURIComponent(projectsQuery.data[0].id)}`)
  }, [projectsQuery.data, router])

  if (projectsQuery.isPending) {
    return <HomeLoadingState />
  }

  if (!projectsQuery.data?.length) {
    return <LandingPage />
  }

  return <HomeLoadingState />
}
