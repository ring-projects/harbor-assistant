"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

type ThemeProviderProps = {
  children: React.ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      themes={["light", "dark"]}
      disableTransitionOnChange
      storageKey="harbor-theme"
    >
      {children}
    </NextThemesProvider>
  )
}
