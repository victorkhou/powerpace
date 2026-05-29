import { BottomNav } from '@/components/layout/bottom-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ paddingBottom: 56 }}>
      {children}
      <BottomNav />
    </div>
  )
}
