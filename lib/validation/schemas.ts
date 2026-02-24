import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים'),
})

export const registerSchema = z.object({
  first_name: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  last_name: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה'),
  phone: z.string().regex(/^0[2-9]\d{7,8}$/, 'מספר טלפון לא תקין'),
  password: z.string().min(8, 'סיסמה חייבת להכיל לפחות 8 תווים')
    .regex(/[a-z]/, 'חייבת אות קטנה')
    .regex(/[A-Z]/, 'חייבת אות גדולה')
    .regex(/\d/, 'חייב מספר'),
  confirm_password: z.string(),
  id_number: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  agree_terms: z.literal(true, { errorMap: () => ({ message: 'חובה להסכים לתנאי השימוש' }) }),
}).refine(d => d.password === d.confirm_password, { message: 'הסיסמאות לא תואמות', path: ['confirm_password'] })

export const appointmentSchema = z.object({
  requested_specialty: z.string().min(1, 'בחר התמחות'),
  doctor_id: z.string().uuid().optional(),
  chief_complaint: z.string().min(5, 'תאר את הבעיה בלפחות 5 תווים').max(500),
  complaint_description: z.string().max(2000).optional(),
  urgency_level: z.enum(['routine', 'soon', 'urgent']).default('routine'),
  preferred_times: z.array(z.object({
    date: z.string(),
    time_range: z.enum(['morning', 'afternoon', 'evening']),
  })).optional(),
})

export const profileUpdateSchema = z.object({
  first_name: z.string().min(2).optional(),
  last_name: z.string().min(2).optional(),
  phone: z.string().regex(/^0[2-9]\d{7,8}$/).optional(),
  date_of_birth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
})

export const soapSchema = z.object({
  subjective_notes: z.string().optional(),
  objective_notes: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
  diagnosis: z.string().optional(),
  follow_up_instructions: z.string().optional(),
  follow_up_date: z.string().optional(),
})

// ── API request body schemas ──────────────────────────
export const appointmentIdSchema = z.object({
  appointmentId: z.string().uuid('מזהה תור לא תקין'),
})

export const aiSummarySchema = z.object({
  appointmentId: z.string().uuid('מזהה תור לא תקין'),
  action: z.enum(['summary', 'prescription_draft']).default('summary'),
})

// ── Form schemas ──────────────────────────────────────

const optionalPhone = z.string().regex(/^0[2-9]\d{7,8}$/, 'מספר טלפון לא תקין').or(z.literal(''))

export const forgotPasswordSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
})

export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'הסיסמה חייבת להכיל לפחות 8 תווים')
    .regex(/[a-z]/, 'הסיסמה חייבת להכיל אות קטנה')
    .regex(/[A-Z]/, 'הסיסמה חייבת להכיל אות גדולה')
    .regex(/\d/, 'הסיסמה חייבת להכיל מספר'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'הסיסמאות לא תואמות',
  path: ['confirmPassword'],
})

export const patientProfileSchema = z.object({
  first_name: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  last_name: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  phone: optionalPhone.optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  id_number: z.string().optional(),
  emergency_phone: optionalPhone.optional(),
})

export const doctorProfileSchema = z.object({
  bio: z.string().max(2000, 'ביוגרפיה ארוכה מדי').optional(),
  consultation_price: z.string()
    .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'מחיר לא תקין')
    .optional(),
  license_number: z.string().optional(),
  phone: optionalPhone.optional(),
})

export const adminSettingsSchema = z.object({
  name: z.string().min(2, 'שם המרפאה חייב להכיל לפחות 2 תווים'),
  contact_email: z.string().email('כתובת אימייל לא תקינה').or(z.literal('')).optional(),
  contact_phone: optionalPhone.optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע לא תקין'),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע לא תקין'),
  default_price: z.string()
    .refine(v => !v || (!isNaN(Number(v)) && Number(v) >= 0), 'מחיר לא תקין')
    .optional(),
})

export const newAppointmentSchema = z.object({
  specialty: z.string().min(1, 'בחר התמחות'),
  doctor_id: z.string().optional(),
  chief_complaint: z.string().min(5, 'תאר את הבעיה בלפחות 5 תווים').max(500, 'עד 500 תווים'),
  complaint_description: z.string().max(2000, 'עד 2000 תווים').optional(),
  urgency_level: z.enum(['routine', 'soon', 'urgent']).default('routine'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AppointmentInput = z.infer<typeof appointmentSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type SOAPInput = z.infer<typeof soapSchema>
