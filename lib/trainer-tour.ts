'use client'

import { writeTourComplete } from '@/lib/trainer-onboarding-storage'

export type TourStrings = {
  step1Title: string
  step1Desc: string
  step2Title: string
  step2Desc: string
  step3Title: string
  step3Desc: string
  step4Title: string
  step4Desc: string
  step5Title: string
  step5Desc: string
  step6Title: string
  step6Desc: string
  prevBtn: string
  nextBtn: string
  doneBtn: string
}

/**
 * driver.js replaces `{{current}}` and `{{total}}` at runtime.
 * Do not pass this through next-intl — ICU treats `{{` as syntax and throws.
 */
export function driverProgressTemplate(locale: string): string {
  return locale.toLowerCase().startsWith('hr')
    ? '{{current}} od {{total}}'
    : '{{current}} of {{total}}'
}

export type RunTrainerTourOptions = {
  strings: TourStrings
  /** next-intl locale, e.g. hr, en */
  locale: string
  onFarewell?: () => void
}

/** Product tour (driver.js). On narrow viewports the DOM targets may be hidden; we mark complete and skip. */
export async function runTrainerTour(opts: RunTrainerTourOptions): Promise<void> {
  const { strings, locale, onFarewell } = opts

  const isDesktop = typeof window !== 'undefined'
    && window.matchMedia('(min-width: 1024px)').matches

  if (!isDesktop) {
    writeTourComplete()
    onFarewell?.()
    return
  }

  const { driver } = await import('driver.js')

  const steps: {
    element: string
    popover: { title: string; description: string; side?: 'top' | 'right' | 'bottom' | 'left' }
  }[] = [
    {
      element: '[data-tour="sidebar-nav"]',
      popover: { title: strings.step1Title, description: strings.step1Desc, side: 'right' },
    },
    {
      element: '[data-tour="tour-add-client"]',
      popover: { title: strings.step2Title, description: strings.step2Desc, side: 'left' },
    },
    {
      element: '[data-tour="tour-dashboard"]',
      popover: { title: strings.step3Title, description: strings.step3Desc, side: 'right' },
    },
    {
      element: '[data-tour="tour-chat"]',
      popover: { title: strings.step4Title, description: strings.step4Desc, side: 'right' },
    },
    {
      element: '[data-tour="tour-finance"]',
      popover: { title: strings.step5Title, description: strings.step5Desc, side: 'right' },
    },
    {
      element: '[data-tour="tour-profile"]',
      popover: { title: strings.step6Title, description: strings.step6Desc, side: 'right' },
    },
  ]

  const drv = driver({
    showProgress: true,
    smoothScroll: true,
    animate: true,
    stageRadius: 12,
    stagePadding: 8,
    overlayOpacity: 0.72,
    popoverClass: 'unitlift-driver-popover',
    prevBtnText: strings.prevBtn,
    nextBtnText: strings.nextBtn,
    doneBtnText: strings.doneBtn,
    progressText: driverProgressTemplate(locale),
    steps,
    onDestroyed: () => {
      writeTourComplete()
      onFarewell?.()
    },
  })

  requestAnimationFrame(() => {
    try {
      drv.drive()
    } catch {
      writeTourComplete()
      onFarewell?.()
    }
  })
}
