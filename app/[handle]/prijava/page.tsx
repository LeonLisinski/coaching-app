import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import LeadFormClient from './form-client'

type Question = {
  id: string
  order_index: number
  type: string
  label: string
  label_en: string | null
  required: boolean
  options: string[] | null
}

type FormData = {
  id: string
  trainer_id: string
  title: string
  title_en: string | null
  description: string | null
  description_en: string | null
  accent_color: string
  photo_url: string | null
  questions: Question[]
  trainer_name: string
}

async function getFormData(handle: string): Promise<FormData | null> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: profile } = await db
    .from('profiles')
    .select('id, full_name')
    .ilike('handle', handle)
    .eq('role', 'trainer')
    .single()

  if (!profile) return null

  const { data: form } = await db
    .from('lead_forms')
    .select('id, trainer_id, title, title_en, description, description_en, accent_color, photo_url, is_active')
    .eq('trainer_id', profile.id)
    .eq('is_active', true)
    .single()

  if (!form) return null

  const { data: questions } = await db
    .from('lead_form_questions')
    .select('id, order_index, type, label, label_en, required, options')
    .eq('form_id', form.id)
    .order('order_index')

  return {
    ...form,
    questions: (questions || []) as Question[],
    trainer_name: profile.full_name,
  }
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const form = await getFormData(handle)
  if (!form) return { title: 'Forma nije pronađena' }
  return {
    title: form.title || 'Prijavna forma',
    description: form.description || `Prijava za trening — ${form.trainer_name}`,
  }
}

export default async function LeadFormPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const form = await getFormData(handle)

  if (!form) notFound()

  return (
    <LeadFormClient
      formId={form.id}
      trainerId={form.trainer_id}
      title={form.title}
      titleEn={form.title_en}
      description={form.description}
      descriptionEn={form.description_en}
      accentColor={form.accent_color}
      photoUrl={form.photo_url}
      trainerName={form.trainer_name}
      questions={form.questions}
    />
  )
}
