import Link from "next/link"

type ProjectProgressPageProps = {
  params: Promise<{
    project_id: string
  }>
}

export default async function ProjectProgressPage(
  props: ProjectProgressPageProps,
) {
  const { project_id: projectId } = await props.params

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold">Progress</h1>
      <div className="mt-3">
        <Link
          href={`/${projectId}/settings`}
          className="inline-flex rounded-md border px-3 py-1.5 text-sm"
        >
          Open Settings Modal
        </Link>
      </div>
    </div>
  )
}
