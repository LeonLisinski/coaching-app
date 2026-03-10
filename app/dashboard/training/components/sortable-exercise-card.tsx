'use client'

import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { GripVertical, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type PlanExercise = {
  exercise_id: string
  name: string
  sets: number
  reps: string
  rest_seconds: number
  notes: string
  exercise_type?: 'strength' | 'endurance'
}

type Props = {
  ex: PlanExercise
  index: number
  onUpdate: (field: string, value: any) => void
  onRemove: () => void
  labelSets: string
  labelRest: string
  labelNotes: string
}

export default function SortableExerciseCard({
  ex, index, onUpdate, onRemove, labelSets, labelRest, labelNotes
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.exercise_id })

  const isEndurance = ex.exercise_type === 'endurance'

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="border rounded-md p-3 space-y-2 bg-gray-50/40"
    >
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            {...listeners}
            {...attributes}
            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none"
            tabIndex={-1}
          >
            <GripVertical size={14} />
          </button>
          <span className="text-sm font-medium text-gray-800 truncate">{index + 1}. {ex.name}</span>
          {isEndurance && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 shrink-0">
              Izdržljivost
            </span>
          )}
        </div>
        <button type="button" onClick={onRemove} className="shrink-0">
          <X size={12} className="text-gray-400 hover:text-red-500" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">{labelSets}</Label>
          <Input type="number" value={ex.sets}
            onChange={e => onUpdate('sets', parseInt(e.target.value) || 0)}
            className="h-7 text-xs" />
        </div>
        <div>
          <Label className="text-xs">{isEndurance ? 'Trajanje' : 'Ponav.'}</Label>
          <Input value={ex.reps}
            onChange={e => onUpdate('reps', e.target.value)}
            className="h-7 text-xs"
            placeholder={isEndurance ? '2min ili 1:30' : '10 ili 8-12'} />
        </div>
        <div>
          <Label className="text-xs">{labelRest}</Label>
          <Input type="number" value={ex.rest_seconds}
            onChange={e => onUpdate('rest_seconds', parseInt(e.target.value) || 0)}
            className="h-7 text-xs" />
        </div>
      </div>

      <Input value={ex.notes}
        onChange={e => onUpdate('notes', e.target.value)}
        placeholder={labelNotes}
        className="h-7 text-xs" />
    </div>
  )
}
