type ProjectLayoutProps = {
  children: React.ReactNode
  modal: React.ReactNode
}

export default function ProjectLayout({ children, modal }: ProjectLayoutProps) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
