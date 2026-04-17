/** localStorage keys for trainer onboarding (web dashboard). */
export const LS_ONBOARDING_COMPLETE = 'onboarding_complete'
export const LS_TOUR_COMPLETE = 'tour_complete'

export function readOnboardingComplete(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(LS_ONBOARDING_COMPLETE) === 'true'
}

export function readTourComplete(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(LS_TOUR_COMPLETE) === 'true'
}

export function writeOnboardingComplete() {
  window.localStorage.setItem(LS_ONBOARDING_COMPLETE, 'true')
}

export function writeTourComplete() {
  window.localStorage.setItem(LS_TOUR_COMPLETE, 'true')
}
