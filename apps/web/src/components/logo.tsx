import Image, { type ImageProps } from "next/image"

import { cn } from "@/lib/utils"

type HarborLogoProps = Omit<ImageProps, "src" | "alt"> & {
  variant?: "adaptive" | "black" | "white"
}

export function HarborLogo({
  className,
  variant = "adaptive",
  width = 493,
  height = 97,
  ...props
}: HarborLogoProps) {
  if (variant === "adaptive") {
    return (
      <>
        <Image
          src="/brand/harbor-logo-black.svg"
          alt="Harbor logo"
          width={width}
          height={height}
          className={cn("h-auto dark:hidden", className)}
          {...props}
        />
        <Image
          src="/brand/harbor-logo-white.svg"
          alt="Harbor logo"
          width={width}
          height={height}
          className={cn("hidden h-auto dark:block", className)}
          {...props}
        />
      </>
    )
  }

  const src =
    variant === "white"
      ? "/brand/harbor-logo-white.svg"
      : "/brand/harbor-logo-black.svg"

  return (
    <Image
      src={src}
      alt="Harbor logo"
      width={width}
      height={height}
      className={cn("h-auto", className)}
      {...props}
    />
  )
}
