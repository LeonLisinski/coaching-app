import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Pretvara zarez u točku kod unosa decimala i poziva onChange */
export function onDecimalChange(
  e: React.ChangeEvent<HTMLInputElement>,
  setValue: (val: string) => void
) {
  setValue(e.target.value.replace(',', '.'))
}

/** Handler za keyDown — zamjenjuje zarez točkom u text/decimal inputima.
 *  type="number" inputi ne podržavaju setSelectionRange pa ih preskačemo —
 *  za njima koristi inputMode="decimal" + type="text" ako trebaš decimale. */
export function decimalKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === ',') {
    e.preventDefault()
    const input = e.currentTarget
    if (input.type === 'number') return
    const start  = input.selectionStart ?? input.value.length
    const end    = input.selectionEnd   ?? input.value.length
    const newVal = input.value.slice(0, start) + '.' + input.value.slice(end)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(input, newVal)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    requestAnimationFrame(() => input.setSelectionRange(start + 1, start + 1))
  }
}
