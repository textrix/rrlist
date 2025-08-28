import type { Metadata } from 'next'
import { SessionProvider } from './providers/SessionProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'RRList',
  description: 'Next.js web service',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}