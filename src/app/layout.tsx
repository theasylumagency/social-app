import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "UNDA — Brand setup",
  description: "თქვენი სოციალური მედიის AI ოპერატორი",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ka">
      <body>{children}</body>
    </html>
  )
}
