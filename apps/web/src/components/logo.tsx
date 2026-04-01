import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

type ImageProps = ComponentPropsWithoutRef<"img">

type HarborMarkProps = Omit<ImageProps, "src" | "alt"> & {
  variant?: "adaptive" | "black" | "white"
}

type HarborLogoProps = Omit<ImageProps, "src" | "alt"> & {
  variant?: "adaptive" | "black" | "white"
}

export function HarborMark({
  className,
  variant = "adaptive",
  width = 32,
  height = 32,
  ...props
}: HarborMarkProps) {
  if (variant === "adaptive") {
    return (
      <>
        <img
          src="/brand/harbor-favicon-black.svg"
          alt="Harbor logo"
          width={width}
          height={height}
          className={cn("dark:hidden", className)}
          {...props}
        />
        <img
          src="/brand/harbor-favicon-white.svg"
          alt="Harbor logo"
          width={width}
          height={height}
          className={cn("hidden dark:block", className)}
          {...props}
        />
      </>
    )
  }

  const src =
    variant === "white"
      ? "/brand/harbor-favicon-white.svg"
      : "/brand/harbor-favicon-black.svg"

  return (
    <img
      src={src}
      alt="Harbor logo"
      width={width}
      height={height}
      className={className}
      {...props}
    />
  )
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
        <img
          src="/brand/harbor-logo-black.svg"
          alt="Harbor logo"
          width={width}
          height={height}
          className={cn("h-auto dark:hidden", className)}
          {...props}
        />
        <img
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
    <img
      src={src}
      alt="Harbor logo"
      width={width}
      height={height}
      className={cn("h-auto", className)}
      {...props}
    />
  )
}
