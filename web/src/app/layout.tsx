import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'FIXIT SLM — Fix it. Build it. Understand it.',
  description: 'An ultra-practical Small Language Model that helps you understand, build, repair, troubleshoot, and improve things in the real world.',
  keywords: ['repair', 'troubleshoot', 'build', 'fix', 'AI assistant', 'practical'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  )
}
