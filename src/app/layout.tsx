import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/context/auth-context'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Saab Sports Platform',
  description: 'Sistema de Gestão de Performance Atlética',
  applicationName: 'Saab Sports',
  appleWebApp: {
    capable: true,
    title: 'Saab Sports',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

// aplica o tema salvo antes da hidratação para não piscar na troca de página
const themeInit = `(function(){try{var t=localStorage.getItem('saab-theme');if(t==='light'){document.documentElement.classList.remove('dark')}var m=document.querySelector('meta[name="theme-color"]');if(m){m.setAttribute('content',t==='light'?'#f5f5f8':'#0a0a0f')}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark h-full" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased min-h-full`}>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
