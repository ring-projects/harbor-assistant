export default function Home() {
  return (
    <div className="bg-muted/30 flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Overview</p>
          <p className="mt-2 text-2xl font-semibold">Welcome back</p>
        </div>
        <div className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Open Tasks</p>
          <p className="mt-2 text-2xl font-semibold">8</p>
        </div>
        <div className="bg-card text-card-foreground rounded-xl border p-5">
          <p className="text-muted-foreground text-sm">Today Messages</p>
          <p className="mt-2 text-2xl font-semibold">24</p>
        </div>
      </section>

      <section className="bg-card text-card-foreground min-h-[360px] rounded-xl border p-5">
        <h2 className="text-lg font-semibold">Workspace</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          This area is the main content column. Keep your routes rendering here.
        </p>
      </section>
    </div>
  )
}
