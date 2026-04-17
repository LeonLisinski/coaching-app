import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UnitLift — Client setup',
  description: 'Set your password for the UnitLift mobile app.',
}

export default function ClientAuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
