import { ThemeToggle } from '@/components/layout/theme-toggle'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-4 right-4 safe-top">
        <ThemeToggle />
      </div>
      {children}
    </div>
  )
}
