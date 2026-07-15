import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'
import { MobileHeader } from '@/components/layout/mobile-header'
import { AuthGuard } from '@/components/layout/auth-guard'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* app shell de altura fixa: só o main rola, header/nav ficam sempre visíveis */}
      <div className="flex h-dvh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <MobileHeader />
          <main className="flex-1 overflow-y-auto pb-24 md:pb-0">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
