import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "UNDA Social",
  description: "თქვენი სოციალური მედიის AI გუნდი",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  )
}
