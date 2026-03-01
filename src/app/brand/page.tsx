import Image from "next/image"

const LOGO_BLACK = "/brand/harbor-logo-black.svg"
const LOGO_WHITE = "/brand/harbor-logo-white.svg"
const FAVICON_BLACK = "/brand/harbor-favicon-black.svg"
const FAVICON_WHITE = "/brand/harbor-favicon-white.svg"

function FaviconPreview(props: { src: string; label: string; dark?: boolean }) {
  const { src, label, dark = false } = props

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex size-16 items-center justify-center rounded-md border ${
          dark ? "border-white/20" : "border-black/10"
        }`}
      >
        <Image src={src} alt={label} width={32} height={32} />
      </div>
      <div className={`text-xs ${dark ? "text-white/70" : "text-black/60"}`}>
        32px
      </div>

      <div
        className={`flex size-8 items-center justify-center rounded-[4px] border ${
          dark ? "border-white/20" : "border-black/10"
        }`}
      >
        <Image src={src} alt={`${label} 16px`} width={16} height={16} />
      </div>
      <div className={`text-xs ${dark ? "text-white/70" : "text-black/60"}`}>
        16px
      </div>
    </div>
  )
}

export default function BrandPreviewPage() {
  return (
    <div className="flex min-h-full w-full flex-col items-center gap-8 bg-[#f5f5f7] p-8">
      <section className="w-full max-w-5xl rounded-xl bg-white p-8 shadow-sm">
        <p className="mb-6 text-sm font-medium text-black/50">
          Black Edition (Logo + Favicon)
        </p>
        <div className="mb-6 flex justify-center">
          <Image
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

      <section className="w-full max-w-5xl rounded-xl bg-[#1a1a1a] p-8 shadow-sm">
        <p className="mb-6 text-sm font-medium text-white/55">
          White Edition (Logo + Favicon)
        </p>
        <div className="mb-6 flex justify-center">
          <Image
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
