import { SidebarTrigger } from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { ProjectStoreProvider } from "@/modules/projects/providers"

type ProjectProgressPageProps = {
  params: Promise<{
    project_id: string
  }>
}

function PlaceholderCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("bg-muted/45 h-44 border", className)}
    />
  )
}

export default async function ProjectProgressRoutePage(
  props: ProjectProgressPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <ProjectStoreProvider key={projectId} projectId={projectId}>
      <div className="flex h-full min-h-svh flex-col">
        <header className="flex h-12 items-center border-b px-3">
          <SidebarTrigger />
        </header>

        <section className="grid grid-cols-1 gap-3 p-3 lg:grid-cols-3">
          <PlaceholderCard />
          <PlaceholderCard />
          <PlaceholderCard />
        </section>

        <section className="flex-1 p-3 pt-0">
          <div className="bg-muted/45 h-full min-h-[58svh] border" />
        </section>
      </div>
    </ProjectStoreProvider>
  )
}
