// Thin re-export shim. All types, constants and the hook live in the context file
// so that TrainerSettingsProvider can import them without a circular dependency.
export {
  useTrainerSettingsContext as useTrainerSettings,
  type WorkoutDefaults,
  type TrainerSettings,
  DEFAULT_WORKOUT_DEFAULTS,
  NUTRITION_FIELD_OPTIONS,
  EXERCISE_FIELD_OPTIONS,
} from '@/app/contexts/trainer-settings-context'
