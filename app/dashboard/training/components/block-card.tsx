'use client'

import { useState, useRef, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, verticalListSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, ChevronDown, ChevronUp, Search, Layers } from 'lucide-react'
import type { TemplateBlock, TemplateExercise, ExerciseOption } from '../lib/template-blocks'

// Letter prefixes for exercises inside a block: A1, A2, B1…
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

// ─── Exercise row inside a block ──────────────────────────────────────────────
function BlockExerciseRow({
  ex, letter, isDark, onUpdate, onRemove, onMoveOut,
}: {
  ex: TemplateExercise
  letter: string
  isDark?: boolean
  onUpdate: (field: string, value: any) => void
  onRemove: () => void
  onMoveOut: () => void
}) {
  const t = useTranslations('training.dialogs.template')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: ex.exercise_id })

  const inputCls = (w = 'w-14') =>
    `h-6 ${w} rounded border px-1.5 text-xs focus:outline-none ${
      isDark
        ? 'bg-white/[0.06] border-violet-800/40 text-gray-200 focus:border-violet-500'
        : 'bg-white border-violet-200 focus:border-violet-400'
    }`

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex items-start gap-2 py-1.5 px-2 rounded-lg border ${
        isDark ? 'bg-white/[0.025] border-white/[0.06]' : 'bg-white border-violet-100'
      }`}
    >
      <button
        type="button" {...listeners} {...attributes}
        className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0 touch-none mt-1"
        tabIndex={-1}
      >
        <GripVertical size={12} />
      </button>

      {/* Letter badge */}
      <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
        isDark ? 'bg-violet-900/50 text-violet-300' : 'bg-violet-100 text-violet-700'
      }`}>
        {letter}
      </div>

      {/* Name + inputs */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
          {ex.name}
        </p>
        <div className="flex items-end gap-2 flex-wrap">
          {/* Reps */}
          <div className="flex flex-col gap-0.5">
            <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400/70' : 'text-violet-500'}`}>
              {t('repsLabel')}
            </span>
            <input
              value={ex.reps}
              onFocus={e => e.target.select()}
              onChange={e => onUpdate('reps', e.target.value)}
              placeholder="8-12"
              className={inputCls('w-16')}
            />
          </div>

          {/* Rest between exercises (per-exercise override of block.rest_between_exercises; 0 = use block default) */}
          <div className="flex flex-col gap-0.5">
            <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400/70' : 'text-violet-500'}`}>
              {t('restBetweenExercises')}
            </span>
            <input
              value={ex.rest_seconds || ''}
              type="text" inputMode="numeric"
              onFocus={e => e.target.select()}
              onChange={e => { const v = parseInt(e.target.value.replace(/\D/g, '')); onUpdate('rest_seconds', isNaN(v) ? 0 : v) }}
              placeholder="0"
              className={inputCls('w-14')}
            />
          </div>

        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button" onClick={onMoveOut}
          title={t('removeFromBlock')}
          className={`p-1 rounded text-[10px] transition-colors leading-none ${
            isDark
              ? 'text-gray-600 hover:text-gray-300 hover:bg-white/[0.06]'
              : 'text-gray-300 hover:text-gray-600 hover:bg-gray-100'
          }`}
        >
          ↑
        </button>
        <button
          type="button" onClick={onRemove}
          title={t('removeExerciseHandleTitle')}
          className={`p-1 rounded transition-colors ${
            isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <X size={11} />
        </button>
      </div>
    </div>
  )
}

// ─── Block card (sortable in root list) ───────────────────────────────────────
export type BlockCardProps = {
  block: TemplateBlock
  blockIndex: number        // position among blocks (for letter labels A, B, C…)
  isDark?: boolean
  exerciseOptions: ExerciseOption[]
  usedExerciseIds: Set<string>
  onUpdateBlock: (blockId: string, field: keyof TemplateBlock, value: any) => void
  onAddExerciseToBlock: (blockId: string, exercise: ExerciseOption) => void
  onUpdateExerciseInBlock: (blockId: string, exerciseId: string, field: string, value: any) => void
  onRemoveExerciseFromBlock: (blockId: string, exerciseId: string) => void
  onRemoveBlock: (blockId: string) => void
  onMoveExerciseOut: (blockId: string, exerciseId: string) => void
}

export default function BlockCard({
  block, blockIndex, isDark,
  exerciseOptions, usedExerciseIds,
  onUpdateBlock, onAddExerciseToBlock, onUpdateExerciseInBlock,
  onRemoveExerciseFromBlock, onRemoveBlock, onMoveExerciseOut,
}: BlockCardProps) {
  const t = useTranslations('training.dialogs.template')
  const [expanded, setExpanded] = useState(true)
  const [innerSearch, setInnerSearch] = useState('')
  const [innerFocused, setInnerFocused] = useState(false)
  const [innerDropIdx, setInnerDropIdx] = useState(-1)
  const innerSearchRef = useRef<HTMLInputElement>(null)
  const exercisesEndRef = useRef<HTMLDivElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.block_id })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const blockLetter = LETTERS[blockIndex % 26] ?? 'S'

  // Exercises available to add to this block (not already used anywhere)
  const filteredInner = exerciseOptions.filter(e =>
    e.name.toLowerCase().includes(innerSearch.toLowerCase()) &&
    !usedExerciseIds.has(e.id) &&
    !block.exercises.find(be => be.exercise_id === e.id)
  )
  const showInnerDrop = innerFocused || innerSearch.length > 0

  const handleInnerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showInnerDrop || filteredInner.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setInnerDropIdx(i => Math.min(i + 1, filteredInner.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setInnerDropIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && innerDropIdx >= 0) { e.preventDefault(); handleAdd(filteredInner[innerDropIdx]) }
    else if (e.key === 'Escape') { setInnerFocused(false); setInnerDropIdx(-1) }
  }

  const handleAdd = useCallback((exercise: ExerciseOption) => {
    onAddExerciseToBlock(block.block_id, exercise)
    setInnerSearch('')
    setInnerDropIdx(-1)
    setInnerFocused(false)
    innerSearchRef.current?.blur()
    // Scroll newly added exercise into view after state update
    setTimeout(() => exercisesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }, [block.block_id, onAddExerciseToBlock])

  const handleInnerDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIdx = block.exercises.findIndex(e => e.exercise_id === active.id)
      const newIdx = block.exercises.findIndex(e => e.exercise_id === over!.id)
      if (oldIdx !== -1 && newIdx !== -1) {
        onUpdateBlock(block.block_id, 'exercises', arrayMove(block.exercises, oldIdx, newIdx))
      }
    }
  }

  const numInput = (
    value: number | string,
    onChange: (v: number) => void,
    min = 0,
  ) => (
    <input
      type="text" inputMode="numeric"
      value={value || ''}
      onFocus={e => e.target.select()}
      onChange={e => { const v = parseInt(e.target.value.replace(/\D/g, '')); onChange(isNaN(v) ? min : Math.max(min, v)) }}
      className={`h-6 w-14 rounded border px-2 text-xs focus:outline-none ${
        isDark
          ? 'bg-white/[0.06] border-violet-800/40 text-gray-200 focus:border-violet-500'
          : 'bg-white border-violet-200 focus:border-violet-400'
      }`}
    />
  )

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`border-2 rounded-xl overflow-visible ${
        isDark ? 'border-violet-800/50 bg-violet-950/30' : 'border-violet-200 bg-violet-50/50'
      }`}
    >
      {/* ── Block header ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <button
          type="button" {...listeners} {...attributes}
          className={`cursor-grab active:cursor-grabbing shrink-0 touch-none transition-colors ${
            isDark ? 'text-violet-500 hover:text-violet-300' : 'text-violet-300 hover:text-violet-500'
          }`}
          tabIndex={-1}
          title={t('dragHandleTitle')}
        >
          <GripVertical size={15} />
        </button>

        {/* Icon */}
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
          isDark ? 'bg-violet-800/50' : 'bg-violet-200'
        }`}>
          <Layers size={11} className={isDark ? 'text-violet-300' : 'text-violet-600'} />
        </div>

        {/* Label + summary (clickable to expand) */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          <span className={`text-xs font-bold ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
            {block.label || t('blockLabel', { index: blockIndex + 1 })}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            isDark ? 'bg-violet-900/60 text-violet-400' : 'bg-violet-100 text-violet-600'
          }`}>
            {block.exercises.length} {t('exercisesShort')} · {block.rounds} {t('roundsShort')}
          </span>
          {!expanded && block.exercises.length > 0 && (
            <span className={`text-[10px] truncate flex-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              {block.exercises.map((e, i) => `${blockLetter}${i + 1}: ${e.name}`).join(' + ')}
            </span>
          )}
        </button>

        {expanded
          ? <ChevronUp size={13} className="text-violet-400 shrink-0 cursor-pointer" onClick={() => setExpanded(false)} />
          : <ChevronDown size={13} className="text-violet-400 shrink-0 cursor-pointer" onClick={() => setExpanded(true)} />}

        <button
          type="button" onClick={() => onRemoveBlock(block.block_id)}
          className={`shrink-0 p-1 rounded transition-colors ${
            isDark ? 'text-gray-600 hover:text-red-400 hover:bg-red-900/20' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'
          }`}
          title={t('removeExerciseHandleTitle')}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Block body ── */}
      {expanded && (
        <div className={`px-3 pb-3 pt-2 border-t space-y-3 ${isDark ? 'border-violet-800/40' : 'border-violet-200'}`}>

          {/* Settings row */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{t('rounds')}</span>
              {numInput(block.rounds, v => onUpdateBlock(block.block_id, 'rounds', v), 1)}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{t('restBetweenExercises')}</span>
              {numInput(block.rest_between_exercises, v => onUpdateBlock(block.block_id, 'rest_between_exercises', v))}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{t('restBetweenRounds')}</span>
              {numInput(block.rest_between_rounds, v => onUpdateBlock(block.block_id, 'rest_between_rounds', v))}
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span className={`text-[9px] uppercase font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{t('blockLabelField')}</span>
              <input
                value={block.label || ''}
                onChange={e => onUpdateBlock(block.block_id, 'label', e.target.value)}
                placeholder={`Superset ${blockLetter}`}
                className={`h-6 w-full rounded border px-2 text-xs focus:outline-none ${
                  isDark
                    ? 'bg-white/[0.06] border-violet-800/40 text-gray-200 focus:border-violet-500 placeholder:text-gray-600'
                    : 'bg-white border-violet-200 focus:border-violet-400 placeholder:text-gray-400'
                }`}
              />
            </div>
          </div>

          {/* Exercises inside block */}
          {block.exercises.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleInnerDragEnd}>
              <SortableContext items={block.exercises.map(e => e.exercise_id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {block.exercises.map((ex, i) => (
                    <BlockExerciseRow
                      key={ex.exercise_id}
                      ex={ex}
                      letter={`${blockLetter}${i + 1}`}
                      isDark={isDark}
                      onUpdate={(field, value) => onUpdateExerciseInBlock(block.block_id, ex.exercise_id, field, value)}
                      onRemove={() => onRemoveExerciseFromBlock(block.block_id, ex.exercise_id)}
                      onMoveOut={() => onMoveExerciseOut(block.block_id, ex.exercise_id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          <div ref={exercisesEndRef} />
          <div className="relative">
            <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? 'text-gray-600' : 'text-gray-400'}`} size={12} />
            <input
              ref={innerSearchRef}
              value={innerSearch}
              onChange={e => { setInnerSearch(e.target.value); setInnerDropIdx(-1) }}
              onFocus={() => setInnerFocused(true)}
              onBlur={() => setTimeout(() => { setInnerFocused(false); setInnerDropIdx(-1) }, 150)}
              onKeyDown={handleInnerKeyDown}
              placeholder={t('addExerciseToBlock')}
              className={`w-full h-7 pl-7 pr-6 rounded-lg border text-xs focus:outline-none ${
                isDark
                  ? 'bg-white/[0.04] border-violet-800/40 text-gray-300 placeholder:text-gray-600 focus:border-violet-500'
                  : 'bg-white border-violet-200 placeholder:text-gray-400 focus:border-violet-400'
              }`}
            />
            {innerSearch && (
              <button type="button" onClick={() => setInnerSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={10} />
              </button>
            )}

            {/* Inner dropdown — positioned ABOVE the search field to avoid clipping */}
            {showInnerDrop && (
              <div className={`absolute bottom-full left-0 right-0 z-50 mb-1 border rounded-xl shadow-xl overflow-hidden ${
                isDark ? 'border-white/10 bg-[oklch(0.18_0.018_264)]' : 'border-violet-100 bg-white'
              }`}>
                <div className="overflow-y-auto max-h-40">
                  {filteredInner.length === 0 ? (
                    <p className="px-3 py-2.5 text-xs text-gray-400 text-center">
                      {innerSearch ? t('noResults', { search: innerSearch }) : t('allAdded')}
                    </p>
                  ) : filteredInner.map((e, i) => (
                    <button
                      key={e.id} type="button"
                      onMouseDown={ev => ev.preventDefault()}
                      onClick={() => handleAdd(e)}
                      onMouseEnter={() => setInnerDropIdx(i)}
                      className={`w-full text-left px-3 py-2 text-xs border-b last:border-0 transition-colors ${
                        innerDropIdx === i
                          ? 'bg-violet-600 text-white'
                          : isDark ? 'border-white/5 hover:bg-white/[0.06] text-gray-200' : 'border-violet-50 hover:bg-violet-50 text-gray-800'
                      }`}
                    >
                      <span className="font-medium">{e.name}</span>
                      <span className={`ml-1.5 text-[10px] ${innerDropIdx === i ? 'text-violet-200' : 'text-gray-400'}`}>{e.category}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {block.exercises.length < 2 && (
            <p className={`text-[10px] ${isDark ? 'text-violet-400/60' : 'text-violet-400'}`}>
              ⚠ {t('blockNeedsExercises')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
