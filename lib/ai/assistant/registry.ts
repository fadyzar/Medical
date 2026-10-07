/**
 * Role-aware tool registry for the CANNA assistant.
 *
 * There is ONE agent. What changes between a patient, a doctor and a clinic
 * admin is which tools the server puts in front of the model, and what each tool
 * is allowed to touch once called.
 *
 * Two rules this file exists to enforce:
 *
 *   1. The model never decides authorization. `toolsForRole()` builds the tool
 *      list from the authenticated caller's role, so a tool the caller may not
 *      use is never even described to Claude.
 *
 *   2. Not describing a tool is not a security control. A model can hallucinate
 *      a tool name, and a client can post one. Every executor re-checks the
 *      caller's permissions against the database, and `assertToolAllowed()` is
 *      called again at execution time. The registry is an affordance; the
 *      executor is the gate.
 */

import type Anthropic from '@anthropic-ai/sdk'
import type { CallerRole } from '@/lib/services/appointments'

export type ToolName =
  | 'get_current_context'
  | 'explain_system'
  | 'list_appointments'
  | 'get_appointment'
  | 'get_today_schedule'
  | 'check_availability'
  | 'list_doctors'
  | 'find_patients'
  | 'book_appointment'
  | 'reschedule_appointment'
  | 'cancel_appointment'
  | 'navigate_to'
  | 'get_clinic_status'
  | 'get_clinic_report'
  | 'list_my_documents'
  | 'invite_member'
  | 'generate_visit_summary'

/**
 * Tools that change data. These never execute inside the model loop: the
 * executor builds a confirmation card, the user approves it, and only then does
 * the write happen. Read tools run immediately.
 */
export const WRITE_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'book_appointment',
  'reschedule_appointment',
  'cancel_appointment',
  'invite_member',
  'generate_visit_summary',
])

/** Which roles may reach which tool. The single place this is decided. */
const ROLE_ACCESS: Record<ToolName, ReadonlySet<CallerRole>> = {
  get_current_context:    new Set(['patient', 'doctor', 'staff', 'admin']),
  explain_system:         new Set(['patient', 'doctor', 'staff', 'admin']),
  list_appointments:      new Set(['patient', 'doctor', 'staff', 'admin']),
  get_appointment:        new Set(['patient', 'doctor', 'staff', 'admin']),
  get_today_schedule:     new Set(['patient', 'doctor', 'staff', 'admin']),
  check_availability:     new Set(['patient', 'doctor', 'staff', 'admin']),
  list_doctors:           new Set(['patient', 'doctor', 'staff', 'admin']),
  // A patient may never look up another patient.
  find_patients:          new Set(['doctor', 'staff', 'admin']),
  book_appointment:       new Set(['patient', 'doctor', 'staff', 'admin']),
  reschedule_appointment: new Set(['patient', 'doctor', 'staff', 'admin']),
  cancel_appointment:     new Set(['patient', 'doctor', 'staff', 'admin']),
  navigate_to:            new Set(['patient', 'doctor', 'staff', 'admin']),
  // Clinic configuration and numbers are management information.
  get_clinic_status:      new Set(['staff', 'admin']),
  get_clinic_report:      new Set(['admin']),
  list_my_documents:      new Set(['patient']),
  invite_member:          new Set(['admin']),
  // Clinical drafting is the treating doctor's job, never staff or admin.
  generate_visit_summary: new Set(['doctor']),
}

export function isToolAllowed(role: CallerRole, tool: string): tool is ToolName {
  // Own keys only: a model-supplied name like "constructor" must not resolve
  // through Object.prototype.
  if (!Object.prototype.hasOwnProperty.call(ROLE_ACCESS, tool)) return false
  return ROLE_ACCESS[tool as ToolName].has(role)
}

/** Throws rather than returning false — call sites must not be able to ignore it. */
export function assertToolAllowed(role: CallerRole, tool: string): asserts tool is ToolName {
  if (!isToolAllowed(role, tool)) {
    throw new Error(`tool_not_permitted:${tool}`)
  }
}

const ISO_HINT = 'ISO 8601 with timezone offset, e.g. 2026-10-05T09:00:00+03:00. Israel local time.'

/**
 * Tool definitions.
 *
 * `strict: true` on every tool so the arguments Claude produces always validate
 * against the schema — an appointment id that is not a uuid never reaches an
 * executor. Optional arguments are left out of `required` rather than typed
 * nullable: the API caps strict schemas at 16 union-typed parameters in total
 * (18 nullable fields here made EVERY request fail), and it rejects `null`
 * inside an enum. Executors treat a missing argument as "not given". Descriptions are written for the model, not the user: they say when
 * to reach for the tool and what its limits are.
 */
const DEFINITIONS: Record<ToolName, Anthropic.Tool> = {
  get_current_context: {
    name: 'get_current_context',
    description:
      'Who the current user is (name, role, clinic) and what today\'s date and time are in Israel. ' +
      'Call this first whenever the request depends on the user\'s identity or on "today", "tomorrow", ' +
      '"next week" — never guess the date.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },

  explain_system: {
    name: 'explain_system',
    description:
      'Reference material about how CANNA works: the appointment lifecycle, payments, video visits, ' +
      'documents, questionnaires, and what each role can do. Use it to answer "how do I..." and ' +
      '"what does this status mean" questions instead of guessing.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          enum: [
            'overview', 'appointments', 'payments', 'video', 'documents', 'questionnaires', 'roles',
            'notifications', 'whatsapp', 'integrations', 'domains', 'summaries', 'doctor_workflow',
            'admin_guide', 'consultation_prep',
          ],
          description: 'Which area to explain.',
        },
      },
      required: ['topic'],
      additionalProperties: false,
    },
  },

  list_appointments: {
    name: 'list_appointments',
    description:
      'Appointments the current user is allowed to see. A patient gets their own; a doctor gets theirs; ' +
      'staff and admin get the clinic\'s. Use it for "my appointments", "what is booked this week", ' +
      'and to find the appointment id needed before rescheduling or cancelling.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        scope: {
          type: 'string',
          enum: ['upcoming', 'past', 'all', 'needs_action'],
          description: 'upcoming = future and active; needs_action = awaiting confirmation or payment.',
        },
        patient_id: { type: 'string', description: 'Restrict to one patient. Staff, admin and doctors only.' },
        from: { type: 'string', description: `Start of range. ${ISO_HINT}` },
        to: { type: 'string', description: `End of range. ${ISO_HINT}` },
        limit: { type: 'integer', description: 'Max rows, 1-50. Defaults to 20.' },
      },
      required: ['scope'],
      additionalProperties: false,
    },
  },

  get_appointment: {
    name: 'get_appointment',
    description:
      'Full detail of one appointment: status, time, doctor, patient, complaint, payment state. ' +
      'Call before proposing a change so the confirmation card shows the real current values.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { appointment_id: { type: 'string', description: 'The appointment uuid.' } },
      required: ['appointment_id'],
      additionalProperties: false,
    },
  },

  get_today_schedule: {
    name: 'get_today_schedule',
    description:
      'The schedule for a single day, in Israel time, ordered by start time. Answers "what do I have today", ' +
      '"who is my next patient", "what does tomorrow morning look like". Defaults to today when no date is given.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Day to show, YYYY-MM-DD in Israel time. Omit for today.' },
        doctor_id: { type: 'string', description: 'Staff and admin may pick a doctor. A doctor always gets their own.' },
      },
      required: [],
      additionalProperties: false,
    },
  },

  check_availability: {
    name: 'check_availability',
    description:
      'Free appointment slots for a doctor, from the doctor\'s working hours minus what is already booked. ' +
      'Always call this before proposing a time — never invent a slot. Returns Israel local times.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'string', description: 'A specific doctor, omit for every doctor in the clinic.' },
        from: { type: 'string', description: 'Earliest day to consider, YYYY-MM-DD. Omit to start from now.' },
        days: { type: 'integer', description: 'How many days ahead to search, 1-60. Defaults to 14.' },
        limit: { type: 'integer', description: 'Max slots to return, 1-50. Defaults to 20.' },
      },
      required: [],
      additionalProperties: false,
    },
  },

  list_doctors: {
    name: 'list_doctors',
    description:
      'Bookable doctors with their specialties, price and rating. Use it to resolve a doctor named in plain ' +
      'language ("Dr. Cohen", "a dermatologist") into the id the booking tools need.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        specialty: { type: 'string', description: 'Filter by specialty slug, e.g. dermatology.' },
        name: { type: 'string', description: 'Partial first or last name.' },
      },
      required: [],
      additionalProperties: false,
    },
  },

  find_patients: {
    name: 'find_patients',
    description:
      'Search patients by name, email or phone. Staff and admin search their whole clinic; a doctor only ' +
      'reaches patients they treat. Needs at least 2 characters. Use it to turn "David" into a patient id. ' +
      'If more than one patient matches, show the choices and ask — never pick one yourself.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, email or phone fragment. Minimum 2 characters.' },
        limit: { type: 'integer', description: 'Max results, 1-25. Defaults to 10.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },

  book_appointment: {
    name: 'book_appointment',
    description:
      'Create an appointment. Requires confirmation from the user before anything is written — calling this ' +
      'produces a confirmation card, not a booking. Confirm the slot is free with check_availability first. ' +
      'A patient may only book for themselves.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        doctor_id: { type: 'string', description: 'The doctor uuid, from list_doctors.' },
        patient_id: { type: 'string', description: 'Who the appointment is for. Omit for the current user.' },
        scheduled_at: { type: 'string', description: `The chosen slot. ${ISO_HINT}` },
        chief_complaint: { type: 'string', description: 'Short reason for the visit, in the user\'s own words.' },
        appointment_type: {
          // Values match the appointments.appointment_type CHECK constraint.
          type: 'string',
          enum: ['video', 'clinic'],
          description: 'video = online consultation (default), clinic = visit at the clinic.',
        },
        notes: { type: 'string', description: 'Any extra detail the user gave.' },
      },
      required: ['doctor_id', 'scheduled_at', 'chief_complaint'],
      additionalProperties: false,
    },
  },

  reschedule_appointment: {
    name: 'reschedule_appointment',
    description:
      'Move an appointment to a new time. Requires confirmation before anything is written. Check the new ' +
      'slot with check_availability first. When a patient does this it becomes a request to the clinic ' +
      'rather than a decision — say so.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: 'The appointment uuid.' },
        scheduled_at: { type: 'string', description: `The new slot. ${ISO_HINT}` },
        reason: { type: 'string', description: 'Why it is moving, if the user said.' },
      },
      required: ['appointment_id', 'scheduled_at'],
      additionalProperties: false,
    },
  },

  cancel_appointment: {
    name: 'cancel_appointment',
    description:
      'Cancel an appointment. Requires confirmation before anything is written. Cancelling is not reversible ' +
      'from here — the appointment would have to be booked again.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        appointment_id: { type: 'string', description: 'The appointment uuid.' },
        reason: { type: 'string', description: 'Reason given by the user, if any.' },
      },
      required: ['appointment_id'],
      additionalProperties: false,
    },
  },

  navigate_to: {
    name: 'navigate_to',
    description:
      'Offer the user a button that opens a page of the app. Use it whenever the user asks where something is, ' +
      'or to "take me to" / "open" a screen, and after explaining a feature that lives on a specific page. ' +
      'Only pages this user can open are listed. The user clicks the button — you do not navigate yourself.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          enum: [
            'dashboard', 'appointments', 'new_appointment', 'documents', 'profile', 'payment',
            'calendar', 'availability', 'patients', 'questionnaires',
            'users', 'integrations', 'whatsapp_settings', 'email_settings', 'domain_settings',
            'reports', 'billing', 'settings', 'audit_log', 'templates', 'leads',
          ],
          description: 'Which page to open.',
        },
      },
      required: ['page'],
      additionalProperties: false,
    },
  },

  get_clinic_status: {
    name: 'get_clinic_status',
    description:
      'Operational health of the user\'s clinic: which integrations are configured (WhatsApp, payments, domain; ' +
      'email and video are run by CANNA), team size and pending invitations, today\'s workload, appointments ' +
      'waiting for action and recent failed notifications. Use it for "is everything set up", "why didn\'t the ' +
      'patient get a WhatsApp", "what needs my attention". Never returns credentials.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },

  get_clinic_report: {
    name: 'get_clinic_report',
    description:
      'Numbers for the clinic over a period: appointments by status, completed visits, cancellations, paid ' +
      'revenue, AI summaries generated and notification delivery. Use it for "how was this month", reports and trends.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'How many days back, 1-365. Defaults to 30.' },
      },
      required: [],
      additionalProperties: false,
    },
  },

  list_my_documents: {
    name: 'list_my_documents',
    description:
      'The medical documents the patient has uploaded (names, types, dates — not their contents). Use it for ' +
      '"what did I upload", "is my blood test attached".',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },

  invite_member: {
    name: 'invite_member',
    description:
      'Invite a doctor, staff member or another admin to the clinic by email. Requires confirmation before anything ' +
      'is sent. Ask for the email if you do not have it; the name is optional.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'The invitee\'s email address.' },
        role: { type: 'string', enum: ['doctor', 'staff', 'admin'], description: 'Their role in the clinic.' },
        name: { type: 'string', description: 'Full name, if the user gave it.' },
      },
      required: ['email', 'role'],
      additionalProperties: false,
    },
  },

  generate_visit_summary: {
    name: 'generate_visit_summary',
    description:
      'Draft (or redraft) the AI SOAP summary of one of the doctor\'s own consultations from the notes already ' +
      'written. Requires confirmation. The draft is saved for the doctor to review and edit; it is NOT sent to the ' +
      'patient — the doctor sends it after reviewing. Never present the draft as a diagnosis.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: { appointment_id: { type: 'string', description: 'The appointment uuid.' } },
      required: ['appointment_id'],
      additionalProperties: false,
    },
  },
}

/** The tool list for one role. Order is stable so the prompt cache prefix holds. */
export function toolsForRole(role: CallerRole): Anthropic.Tool[] {
  return (Object.keys(DEFINITIONS) as ToolName[])
    .filter(name => isToolAllowed(role, name))
    .map(name => DEFINITIONS[name])
}
