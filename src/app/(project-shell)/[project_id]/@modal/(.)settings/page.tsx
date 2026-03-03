import { XIcon } from "lucide-react"
import Link from "next/link"

type ProjectSettingsModalPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectSettingsModalPage(
  props: ProjectSettingsModalPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4">
      <div className="bg-background mx-auto mt-16 w-full max-w-xl rounded-lg border p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Settings</h2>
          <Link
            href={`/${projectId}`}
            className="text-muted-foreground hover:text-foreground inline-flex size-8 items-center justify-center rounded-md border"
            aria-label="Close modal"
          >
            <XIcon className="size-4" />
          </Link>
        </div>
        <p className="text-muted-foreground text-sm">
          This is the modal settings page rendered by parallel + intercept
          route.
        </p>
      </div>
    </div>
  )
}
