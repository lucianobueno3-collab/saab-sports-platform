import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Saab Sports Platform',
  description: 'Sistema de Gestão de Performance Atlética',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark h-full">
      <body className={`${inter.variable} font-sans antialiased min-h-full`}>
        {children}
      </body>
    </html>
  )
}
