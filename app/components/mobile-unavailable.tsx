'use client'
import { Monitor } from 'lucide-react'

export default function MobileUnavailable({ title = 'Ova sekcija' }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
        <Monitor size={28} className="text-gray-400" />
      </div>
      <div>
        <p className="text-base font-bold text-gray-800">{title} nije dostupna na mobitelu</p>
        <p className="text-sm text-gray-400 mt-1.5 leading-relaxed max-w-[260px]">
          Za kreiranje planova, konfiguraciju i napredne postavke koristi desktop verziju.
        </p>
      </div>
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-50 border border-gray-100">
        <span className="text-xs text-gray-400 font-medium">unitlift.com</span>
        <span className="text-gray-300">·</span>
        <span className="text-xs text-gray-400">Otvori na računalu</span>
      </div>
    </div>
  )
}
