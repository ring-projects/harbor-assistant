import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { ProjectsList } from "@/modules/projects/components"

type ProjectProgressPageProps = {
  params: Promise<{
    project_id: string
  }>
}

function PlaceholderCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "bg-muted/45 h-44 rounded-xl border border-dashed",
        className,
      )}
    />
  )
}

export default async function ProjectProgressRoutePage(
  props: ProjectProgressPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <div className="bg-background min-h-svh p-2 md:p-3">
      <SidebarProvider defaultOpen>
        <Sidebar variant="floating" collapsible="offcanvas">
          <ProjectsList activeProjectId={projectId} />
        </Sidebar>

        <SidebarInset className="min-h-[calc(100svh-1rem)] rounded-xl border">
          <div className="flex h-full flex-col gap-3 p-3 md:p-4">
            <header className="flex items-center">
              <SidebarTrigger />
            </header>

            <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <PlaceholderCard />
              <PlaceholderCard />
              <PlaceholderCard />
            </section>

            <section className="flex-1">
              <div className="bg-muted/45 h-full min-h-[58svh] rounded-xl border border-dashed" />
            </section>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
