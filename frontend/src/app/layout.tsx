import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WB Repricer',
  description: 'Автоматический репрайсер для Wildberries',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  )
}
