import { z } from 'zod'

export const onboardingClinicSchema = z.object({
  name: z.string().min(2, 'שם המרפאה חייב להכיל לפחות 2 תווים'),
  contact_email: z.string().email('כתובת אימייל לא תקינה'),
  contact_phone: z.string().regex(/^0[2-9]\d{7,8}$/, 'מספר טלפון ישראלי לא תקין'),
  subdomain: z.string()
    .min(3, 'תת-דומיין חייב להכיל לפחות 3 תווים')
    .max(30, 'תת-דומיין יכול להכיל עד 30 תווים')
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, 'תת-דומיין יכול להכיל אותיות קטנות באנגלית, מספרים ומקפים בלבד'),
})

export const onboardingBrandingSchema = z.object({
  logo_url: z.string().url('כתובת URL לא תקינה').or(z.literal('')).optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע לא תקין'),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'צבע לא תקין'),
})

export const onboardingAdminSchema = z.object({
  first_name: z.string().min(2, 'שם פרטי חייב להכיל לפחות 2 תווים'),
  last_name: z.string().min(2, 'שם משפחה חייב להכיל לפחות 2 תווים'),
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string()
    .min(8, 'סיסמה חייבת להכיל לפחות 8 תווים')
    .regex(/[a-z]/, 'חייבת אות קטנה')
    .regex(/[A-Z]/, 'חייבת אות גדולה')
    .regex(/\d/, 'חייב מספר'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'הסיסמאות לא תואמות',
  path: ['confirm_password'],
})

export const onboardingFullSchema = z.object({
  // Clinic
  name: z.string().min(2),
  contact_email: z.string().email(),
  contact_phone: z.string().regex(/^0[2-9]\d{7,8}$/),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
  // Plan
  plan: z.enum(['free', 'basic', 'pro', 'enterprise']),
  // Branding
  logo_url: z.string().url().or(z.literal('')).optional(),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // Admin
  first_name: z.string().min(2),
  last_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
  confirm_password: z.string(),
  // Doctors (optional)
  doctors: z.array(z.object({
    name: z.string().min(2),
    email: z.string().email(),
  })).optional(),
}).refine(d => d.password === d.confirm_password, {
  message: 'הסיסמאות לא תואמות',
  path: ['confirm_password'],
})

export type OnboardingClinicInput = z.infer<typeof onboardingClinicSchema>
export type OnboardingBrandingInput = z.infer<typeof onboardingBrandingSchema>
export type OnboardingAdminInput = z.infer<typeof onboardingAdminSchema>
export type OnboardingFullInput = z.infer<typeof onboardingFullSchema>
