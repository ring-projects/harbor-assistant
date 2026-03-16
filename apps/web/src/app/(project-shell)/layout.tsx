type ProjectShellLayoutProps = {
  children: React.ReactNode
}

export default function ProjectShellLayout({
  children,
}: ProjectShellLayoutProps) {
  return <div className="bg-background h-svh overflow-hidden">{children}</div>
}
