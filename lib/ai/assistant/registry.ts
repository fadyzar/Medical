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

/**
 * Tools that change data. These never execute inside the model loop: the
 * executor builds a confirmation card, the user approves it, and only then does
 * the write happen. Read tools run immediately.
 */
export const WRITE_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>([
  'book_appointment',
  'reschedule_appointment',
  'cancel_appointment',
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
}

export function isToolAllowed(role: CallerRole, tool: string): tool is ToolName {
  const allowed = ROLE_ACCESS[tool as ToolName]
  return !!allowed && allowed.has(role)
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
 * executor. Descriptions are written for the model, not the user: they say when
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
          enum: ['appointments', 'payments', 'video', 'documents', 'questionnaires', 'roles', 'overview'],
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
        patient_id: { type: ['string', 'null'], description: 'Restrict to one patient. Staff, admin and doctors only.' },
        from: { type: ['string', 'null'], description: `Start of range. ${ISO_HINT}` },
        to: { type: ['string', 'null'], description: `End of range. ${ISO_HINT}` },
        limit: { type: ['integer', 'null'], description: 'Max rows, 1-50. Defaults to 20.' },
      },
      required: ['scope', 'patient_id', 'from', 'to', 'limit'],
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
        date: { type: ['string', 'null'], description: 'Day to show, YYYY-MM-DD in Israel time. Null means today.' },
        doctor_id: { type: ['string', 'null'], description: 'Staff and admin may pick a doctor. A doctor always gets their own.' },
      },
      required: ['date', 'doctor_id'],
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
        doctor_id: { type: ['string', 'null'], description: 'A specific doctor, or null for every doctor in the clinic.' },
        from: { type: ['string', 'null'], description: 'Earliest day to consider, YYYY-MM-DD. Null means from now.' },
        days: { type: ['integer', 'null'], description: 'How many days ahead to search, 1-60. Defaults to 14.' },
        limit: { type: ['integer', 'null'], description: 'Max slots to return, 1-50. Defaults to 20.' },
      },
      required: ['doctor_id', 'from', 'days', 'limit'],
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
        specialty: { type: ['string', 'null'], description: 'Filter by specialty slug, e.g. dermatology.' },
        name: { type: ['string', 'null'], description: 'Partial first or last name.' },
      },
      required: ['specialty', 'name'],
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
        limit: { type: ['integer', 'null'], description: 'Max results, 1-25. Defaults to 10.' },
      },
      required: ['query', 'limit'],
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
        patient_id: { type: ['string', 'null'], description: 'Who the appointment is for. Null means the current user.' },
        scheduled_at: { type: 'string', description: `The chosen slot. ${ISO_HINT}` },
        chief_complaint: { type: 'string', description: 'Short reason for the visit, in the user\'s own words.' },
        appointment_type: {
          type: ['string', 'null'],
          enum: ['video', 'phone', 'in_person', null],
          description: 'Defaults to video.',
        },
        notes: { type: ['string', 'null'], description: 'Any extra detail the user gave.' },
      },
      required: ['doctor_id', 'patient_id', 'scheduled_at', 'chief_complaint', 'appointment_type', 'notes'],
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
        reason: { type: ['string', 'null'], description: 'Why it is moving, if the user said.' },
      },
      required: ['appointment_id', 'scheduled_at', 'reason'],
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
        reason: { type: ['string', 'null'], description: 'Reason given by the user, if any.' },
      },
      required: ['appointment_id', 'reason'],
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
