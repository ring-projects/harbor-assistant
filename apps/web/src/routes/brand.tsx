import { createFileRoute } from "@tanstack/react-router"

const LOGO_BLACK = "/brand/harbor-logo-black.svg"
const LOGO_WHITE = "/brand/harbor-logo-white.svg"
const FAVICON_BLACK = "/brand/harbor-favicon-black.svg"
const FAVICON_WHITE = "/brand/harbor-favicon-white.svg"

export const Route = createFileRoute("/brand")({
  component: BrandPreviewPage,
})

function FaviconPreview(props: { src: string; label: string; dark?: boolean }) {
  const { src, label, dark = false } = props

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex size-16 items-center justify-center rounded-md border ${
          dark ? "border-primary-foreground/20" : "border-border"
        }`}
      >
        <img src={src} alt={label} width={32} height={32} />
      </div>
      <div
        className={`text-xs ${dark ? "text-primary-foreground/70" : "text-muted-foreground"}`}
      >
        32px
      </div>

      <div
        className={`flex size-8 items-center justify-center rounded-[4px] border ${
          dark ? "border-primary-foreground/20" : "border-border"
        }`}
      >
        <img src={src} alt={`${label} 16px`} width={16} height={16} />
      </div>
      <div
        className={`text-xs ${dark ? "text-primary-foreground/70" : "text-muted-foreground"}`}
      >
        16px
      </div>
    </div>
  )
}

function BrandPreviewPage() {
  return (
    <div className="bg-background text-foreground flex min-h-full w-full flex-col items-center gap-8 p-8">
      <section className="bg-card w-full max-w-5xl rounded-xl border p-8 shadow-sm">
        <p className="text-muted-foreground mb-6 text-sm font-medium">
          Black Edition (Logo + Favicon)
        </p>
        <div className="mb-6 flex justify-center">
          <img
            src={LOGO_BLACK}
            alt="Harbor black logo"
            width={493}
            height={97}
            className="w-full max-w-[720px]"
          />
        </div>
        <div className="flex justify-center">
          <FaviconPreview src={FAVICON_BLACK} label="Harbor black favicon" />
        </div>
      </section>

      <section className="bg-primary text-primary-foreground w-full max-w-5xl rounded-xl border border-primary/20 p-8 shadow-sm">
        <p className="mb-6 text-sm font-medium text-primary-foreground/70">
          White Edition (Logo + Favicon)
        </p>
        <div className="mb-6 flex justify-center">
          <img
            src={LOGO_WHITE}
            alt="Harbor white logo"
            width={493}
            height={97}
            className="w-full max-w-[720px]"
          />
        </div>
        <div className="flex justify-center">
          <FaviconPreview
            src={FAVICON_WHITE}
            label="Harbor white favicon"
            dark
          />
        </div>
      </section>
    </div>
  )
}
