// Auto-generated with: npm run db:types
// Run after migrations to get full types
export type Database = {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization>; Relationships: [] }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User>; Relationships: [] }
      appointments: { Row: Appointment; Insert: Partial<Appointment>; Update: Partial<Appointment>; Relationships: [] }
      documents: { Row: Document; Insert: Partial<Document>; Update: Partial<Document>; Relationships: [] }
      questionnaires: { Row: Questionnaire; Insert: Partial<Questionnaire>; Update: Partial<Questionnaire>; Relationships: [] }
      questionnaire_responses: { Row: QuestionnaireResponse; Insert: Partial<QuestionnaireResponse>; Update: Partial<QuestionnaireResponse>; Relationships: [] }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification>; Relationships: [] }
      ai_conversations: { Row: AIConversation; Insert: Partial<AIConversation>; Update: Partial<AIConversation>; Relationships: [] }
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog>; Relationships: [] }
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment>; Relationships: [] }
      leads: { Row: Lead; Insert: Partial<Lead>; Update: Partial<Lead>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: {
      get_my_org_id: { Args: Record<string, never>; Returns: string }
      get_my_role: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type UserRole = 'patient' | 'doctor' | 'staff' | 'admin'
export type AppointmentStatus = 'draft' | 'pending' | 'doctor_confirmed' | 'time_selected' | 'payment_pending' | 'paid' | 'scheduled' | 'ready' | 'in_progress' | 'completed' | 'cancelled_patient' | 'cancelled_doctor' | 'no_show_patient' | 'no_show_doctor'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export type Organization = {
  id: string; name: string; subdomain: string; slug: string; custom_domain: string | null
  contact_email: string | null; contact_phone: string | null; logo_url: string | null
  primary_color: string; secondary_color: string; plan: string; subscription_status: string
  features: Record<string, boolean>; settings: Record<string, unknown>
  max_doctors: number; max_appointments_per_month: number
  stripe_customer_id: string | null; stripe_subscription_id: string | null
  trial_ends_at: string | null; max_storage_gb: number
  current_doctors: number; current_month_appointments: number; current_storage_gb: number
  created_at: string; updated_at: string
}

export type User = {
  id: string; organization_id: string; email: string; phone: string | null
  role: UserRole; is_active: boolean; first_name: string; last_name: string
  date_of_birth: string | null; gender: string | null; id_number: string | null; avatar_url: string | null
  license_number: string | null; specialties: string[] | null; bio: string | null
  languages: string[]; consultation_price: number | null
  accepts_video: boolean; accepts_clinic: boolean
  availability: AvailabilitySlot[]; total_appointments: number
  average_rating: number | null; total_ratings: number
  medical_history: MedicalHistory; emergency_contact: Record<string, string>
  insurance_info: Record<string, string>; metadata: Record<string, unknown>
  created_at: string; updated_at: string; last_login_at: string | null
}

export type AvailabilitySlot = {
  day: number; start: string; end: string // day: 0=Sunday
}

export type MedicalHistory = {
  allergies: string[]; chronic_conditions: string[]
  current_medications: string[]; past_surgeries: string[]
}

export type Appointment = {
  id: string; organization_id: string; patient_id: string; doctor_id: string | null
  requested_specialty: string | null; chief_complaint: string; complaint_description: string | null
  urgency_level: string; appointment_type: 'video' | 'clinic'; status: AppointmentStatus
  status_history: Array<{ from: string; to: string; at: string; by: string }>
  ai_triage_score: number | null; ai_triage_category: string | null; ai_triage_reasoning: string | null
  ai_triage_at: string | null
  scheduled_at: string | null; duration_minutes: number
  payment_amount: number | null; payment_status: PaymentStatus | null
  payment_transaction_id: string | null; payment_idempotency_key: string | null
  payment_completed_at: string | null; payment_method: string | null
  invoice_number: string | null; invoice_url: string | null
  video_room_id: string | null; video_room_name: string | null
  video_started_at: string | null; video_ended_at: string | null; video_duration_seconds: number | null
  subjective_notes: string | null; objective_notes: string | null
  assessment: string | null; plan: string | null; doctor_notes: string | null
  diagnosis: string | null; treatment_plan: string | null
  follow_up_instructions: string | null
  ai_summary: string | null; ai_summary_generated_at: string | null
  ai_prescription_draft: string | null; ai_used: boolean | null
  doctor_accepted_at: string | null
  completed_at: string | null; patient_rating: number | null; patient_feedback: string | null
  cancelled_at: string | null; cancellation_reason: string | null
  no_show_recorded_at: string | null
  reminder_24h_sent_at: string | null; reminder_1h_sent_at: string | null
  created_at: string; updated_at: string
  // Joined
  patient?: User; doctor?: User
}

export type Document = {
  id: string; organization_id: string; patient_id: string; appointment_id: string | null
  uploaded_by: string; file_name: string; file_type: string; file_size_bytes: number
  storage_path: string; document_type: string | null; category: string | null
  tags: string[] | null; ocr_text: string | null; is_verified: boolean
  created_at: string; updated_at: string
}

export type Questionnaire = {
  id: string; organization_id: string | null; title: string; description: string | null
  questions: QuestionItem[]; is_template: boolean; is_active: boolean; is_published: boolean
  specialties: string[] | null; conditions: string[] | null
  times_used: number; average_completion_time_seconds: number | null
  created_by: string | null; created_at: string; updated_at: string
}

export type QuestionItem = {
  id: string; text: string; type: 'text' | 'choice' | 'multi_choice' | 'scale' | 'yes_no' | 'image'
  options?: string[]; required: boolean; condition?: { question_id: string; value: string }
}

export type QuestionnaireResponse = {
  id: string; organization_id: string; questionnaire_id: string
  appointment_id: string | null; patient_id: string
  responses: Record<string, unknown>; is_complete: boolean
  started_at: string; completed_at: string | null; time_taken_seconds: number | null
  score: number | null; risk_level: string | null
  ai_analysis: string | null; ai_recommendations: Record<string, unknown> | null
  created_at: string
}

export type Notification = {
  id: string; organization_id: string; user_id: string; appointment_id: string | null
  type: string; title: string | null; template_name: string | null; content: string; variables: Record<string, unknown> | null
  recipient_phone: string | null; recipient_email: string | null
  status: string; sent_at: string | null; delivered_at: string | null; read_at: string | null
  failed_at: string | null; error_message: string | null; retry_count: number
  provider: string | null; external_id: string | null; metadata: Record<string, unknown>
  created_at: string
}

export type AIConversation = {
  id: string; organization_id: string; user_id: string; appointment_id: string | null
  agent_type: string; messages: unknown[]; result: unknown; is_complete: boolean
  input_tokens: number; output_tokens: number; model_used: string | null; created_at: string
}

export type AuditLog = {
  id: string; organization_id: string; user_id: string | null; action: string
  resource_type: string; resource_id: string | null; description: string | null
  metadata: Record<string, unknown>; created_at: string
}

export type Payment = {
  id: string; organization_id: string; appointment_id: string; patient_id: string
  amount: number; currency: string; status: 'pending' | 'completed' | 'failed' | 'refunded'
  provider: string; transaction_id: string | null; confirmation_code: string | null
  idempotency_key: string; masked_card: string | null; response_code: string | null
  metadata: Record<string, unknown>; created_at: string; updated_at: string
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
export type LeadPriority = 'low' | 'normal' | 'high' | 'urgent'
export type LeadSource = 'website' | 'whatsapp' | 'phone' | 'referral' | 'ad' | 'other'

export type Lead = {
  id: string
  organization_id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  source: LeadSource
  specialty_interest: string | null
  message: string | null
  status: LeadStatus
  priority: LeadPriority
  assigned_to: string | null
  next_follow_up: string | null
  notes: string | null
  ai_score: number | null
  ai_analysis: string | null
  ai_recommendations: string | null
  converted_patient_id: string | null
  converted_appointment_id: string | null
  created_at: string
  updated_at: string
  // Joined
  assignee?: Pick<User, 'id' | 'first_name' | 'last_name'> | null
}
