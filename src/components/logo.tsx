import Image, { type ImageProps } from "next/image"

import { cn } from "@/lib/utils"

type HarborLogoProps = Omit<ImageProps, "src" | "alt"> & {
  variant?: "black" | "white"
}

export function HarborLogo({
  className,
  variant = "black",
  width = 493,
  height = 97,
  ...props
}: HarborLogoProps) {
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
