import React from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { AlertTriangle } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  description: React.ReactNode
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export default function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Potvrdi',
  cancelLabel = 'Odustani',
  destructive = false,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent className="max-w-md w-full">
        <AlertDialogHeader>
          {destructive && (
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-red-600">Upozorenje</span>
            </div>
          )}
          <AlertDialogTitle className="text-base font-semibold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-sm text-gray-600 space-y-2">
              {typeof description === 'string' ? <p>{description}</p> : description}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-2">
          <AlertDialogCancel onClick={onCancel} className="flex-1">
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={`flex-1 ${destructive ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : ''}`}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}