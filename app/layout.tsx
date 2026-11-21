import type { Metadata } from 'next'
import '../src/index.css'

export const metadata: Metadata = {
  title: '일일업무보고',
  description: '직원 일일업무보고 · 매니저 보드 · 주간/월간 요약',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
