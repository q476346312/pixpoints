import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PixPoints',
  description: '每一次下载都是独一无二的数字资产',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192x192.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
