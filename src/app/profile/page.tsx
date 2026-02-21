export default function ProfilePage() {
  return (
    <div className="bg-muted/30 flex flex-1 items-center justify-center p-6">
      <div className="bg-card text-card-foreground w-full max-w-3xl rounded-xl border p-6">
        <h1 className="text-xl font-semibold">My Profile</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          User profile content goes here.
        </p>
      </div>
    </div>
  )
}
