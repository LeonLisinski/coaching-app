import Link from 'next/link'
import { CircleCheck, Mail } from 'lucide-react'

export default function RegisterSuccessPage() {
  const BLUE = '#0066FF'
  const NAVY = '#0A1024'

  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-12"
      style={{ background: 'linear-gradient(180deg,#f5f9ff 0%,#fff 100%)' }}
    >
      <div
        className="bg-white rounded-3xl border border-gray-100 shadow-[0_8px_48px_rgba(0,0,0,0.08)] px-8 py-12 text-center max-w-md w-full space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{ background: `${BLUE}12`, border: `2px solid ${BLUE}25` }}>
            <CircleCheck size={40} style={{ color: BLUE }} />
          </div>
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-black tracking-tight" style={{ color: NAVY }}>
            Plaćanje prihvaćeno! 🎉
          </h1>
          <p className="text-gray-500 text-sm mt-2 leading-relaxed">
            Tvoj UnitLift trenerski račun se postavlja.
          </p>
        </div>

        {/* Email notice */}
        <div
          className="rounded-2xl px-5 py-4 flex items-start gap-4 text-left"
          style={{ background: `${BLUE}06`, border: `1px solid ${BLUE}20` }}
        >
          <div className="mt-0.5 shrink-0">
            <Mail size={20} style={{ color: BLUE }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: NAVY }}>Provjeri email</p>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              Za nekoliko minuta dobit ćeš email s linkom za aktivaciju računa.
              Klikni na njega da postaviš lozinku i pristupiš dashboardu.
            </p>
          </div>
        </div>

        {/* Note */}
        <p className="text-xs text-gray-400 leading-relaxed">
          Ako email ne stigne unutar 5 minuta, provjeri spam mapu ili kontaktiraj{' '}
          <a href="mailto:podrska@unitlift.com" className="underline" style={{ color: BLUE }}>
            podrska@unitlift.com
          </a>
        </p>

        {/* Already have account */}
        <p className="text-sm text-gray-500">
          Već imaš račun?{' '}
          <Link href="/login" className="font-semibold hover:underline" style={{ color: BLUE }}>
            Prijavi se
          </Link>
        </p>
      </div>
    </div>
  )
}
