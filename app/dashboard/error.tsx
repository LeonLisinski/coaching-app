'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle size={22} className="text-red-500" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-gray-900">Nešto je pošlo po krivu</p>
        <p className="text-xs text-gray-500">
          Greška je zabilježena. Pokušaj ponovo ili osvježi stranicu.
        </p>
        {error.digest && (
          <p className="text-[10px] text-gray-400 font-mono mt-1">ref: {error.digest}</p>
        )}
      </div>
      <Button size="sm" variant="outline" onClick={reset}>
        Pokušaj ponovo
      </Button>
    </div>
  )
}
