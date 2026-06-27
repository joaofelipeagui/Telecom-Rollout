import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Telecom Rollout PM',
  description: 'AI-powered project management for telecom rollout projects',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} panel-texture text-gray-100 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  )
}
