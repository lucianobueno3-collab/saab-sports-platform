import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/context/auth-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Saab Sports Platform',
  description: 'Sistema de Gestão de Performance Atlética',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark h-full" suppressHydrationWarning>
      <head>
        {/* Aplica o tema salvo antes da primeira pintura para evitar flash */}
        <script dangerouslySetInnerHTML={{ __html:
          `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.remove('dark')}catch(e){}`
        }} />
      </head>
      <body className={`${inter.variable} font-sans antialiased min-h-full`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
