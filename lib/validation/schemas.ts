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

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type AppointmentInput = z.infer<typeof appointmentSchema>
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>
export type SOAPInput = z.infer<typeof soapSchema>
