export type PlanId = 'free' | 'basic' | 'pro' | 'enterprise'

export type Plan = {
  id: PlanId
  name: string
  description: string
  price_monthly: number
  stripe_price_id: string | null
  max_doctors: number
  max_appointments_per_month: number
  max_storage_gb: number
  features: Record<string, boolean>
  highlighted: boolean
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'חינם',
    description: 'מושלם להתחלה — נסו את המערכת בחינם',
    price_monthly: 0,
    stripe_price_id: null,
    max_doctors: 1,
    max_appointments_per_month: 20,
    max_storage_gb: 1,
    features: {
      video_calls: true,
      ai_triage: false,
      ai_summary: false,
      ai_prescription: false,
      questionnaires: false,
      custom_branding: false,
      email_notifications: true,
      whatsapp_notifications: false,
      analytics_dashboard: false,
      api_access: false,
      priority_support: false,
      hipaa_audit_log: false,
      multi_branch: false,
    },
    highlighted: false,
  },
  {
    id: 'basic',
    name: 'בסיסי',
    description: 'למרפאות קטנות שרוצות להתחיל עם טלמדיסן',
    price_monthly: 499,
    stripe_price_id: process.env.STRIPE_BASIC_PRICE_ID || null,
    max_doctors: 5,
    max_appointments_per_month: 200,
    max_storage_gb: 10,
    features: {
      video_calls: true,
      ai_triage: true,
      ai_summary: true,
      ai_prescription: false,
      questionnaires: true,
      custom_branding: false,
      email_notifications: true,
      whatsapp_notifications: false,
      analytics_dashboard: true,
      api_access: false,
      priority_support: false,
      hipaa_audit_log: false,
      multi_branch: false,
    },
    highlighted: false,
  },
  {
    id: 'pro',
    name: 'מקצועי',
    description: 'הפתרון המלא למרפאות מובילות',
    price_monthly: 999,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || null,
    max_doctors: 20,
    max_appointments_per_month: 1000,
    max_storage_gb: 50,
    features: {
      video_calls: true,
      ai_triage: true,
      ai_summary: true,
      ai_prescription: true,
      questionnaires: true,
      custom_branding: true,
      email_notifications: true,
      whatsapp_notifications: true,
      analytics_dashboard: true,
      api_access: false,
      priority_support: true,
      hipaa_audit_log: true,
      multi_branch: false,
    },
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'ארגוני',
    description: 'לרשתות מרפאות ובתי חולים',
    price_monthly: 2499,
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
    max_doctors: 100,
    max_appointments_per_month: 10000,
    max_storage_gb: 500,
    features: {
      video_calls: true,
      ai_triage: true,
      ai_summary: true,
      ai_prescription: true,
      questionnaires: true,
      custom_branding: true,
      email_notifications: true,
      whatsapp_notifications: true,
      analytics_dashboard: true,
      api_access: true,
      priority_support: true,
      hipaa_audit_log: true,
      multi_branch: true,
    },
    highlighted: false,
  },
]

export const FEATURE_LABELS: Record<string, string> = {
  video_calls: 'שיחות וידאו',
  ai_triage: 'מיון AI',
  ai_summary: 'סיכום AI',
  ai_prescription: 'טיוטת מרשם AI',
  questionnaires: 'שאלונים דינמיים',
  custom_branding: 'מיתוג אישי',
  email_notifications: 'התראות אימייל',
  whatsapp_notifications: 'התראות WhatsApp',
  analytics_dashboard: 'דשבורד אנליטיקס',
  api_access: 'גישת API',
  priority_support: 'תמיכה עדיפה',
  hipaa_audit_log: 'יומן ביקורת HIPAA',
  multi_branch: 'ריבוי סניפים',
}

export const RESERVED_SUBDOMAINS = [
  'www', 'api', 'admin', 'app', 'dashboard', 'mail', 'email',
  'support', 'help', 'docs', 'blog', 'status', 'cdn', 'assets',
  'static', 'media', 'images', 'files', 'upload', 'download',
  'auth', 'login', 'register', 'signup', 'signin', 'oauth',
  'billing', 'payment', 'stripe', 'webhook', 'test', 'staging',
  'dev', 'demo', 'telemed', 'telemedicine',
]
