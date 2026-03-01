import type { Metadata } from "next"
import { Geist_Mono, Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"

import { QueryProvider } from "@/components/providers/query-provider"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Harbor Assistant",
  description: "Harbor Assistant projects",
  icons: {
    icon: [
      {
        url: "/brand/harbor-favicon-black.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/harbor-favicon-white.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    shortcut: "/brand/harbor-favicon-black.svg",
    apple: "/brand/harbor-favicon-black.svg",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${geistMono.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <QueryProvider>
          <main className="flex h-screen w-screen">{children}</main>
        </QueryProvider>
      </body>
    </html>
  )
}
