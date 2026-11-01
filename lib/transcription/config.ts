/**
 * Consultation transcription — configuration and consent text.
 *
 * Transcription runs only when all three hold:
 *   1. the server has a transcription service configured (TRANSCRIPTION_PROVIDER
 *      plus TRANSCRIPTION_INGEST_SECRET for the worker that delivers transcripts);
 *   2. the clinic turned it on (organizations.settings.transcription_enabled);
 *   3. the doctor AND the patient consented for this consultation.
 * Production has no provider configured, so the feature is invisible there.
 */

export const CONSENT_TEXT_VERSION = 'he-2026-11-v1'

export const CONSENT_TEXT =
  'אני מסכים/ה שהשיחה תתומלל לטקסט כדי לעזור לרופא להכין את סיכום הייעוץ. ' +
  'ההקלטה הקולית נמחקת מיד לאחר התמלול. התמלול נשמר בתיק לרופא המטפל בלבד, ' +
  'ונמחק אוטומטית בתום תקופת השמירה. הסכמה היא רשות: אפשר לסרב, ואפשר להפסיק את התמלול בכל רגע במהלך השיחה.'

/** Days a transcript is kept after it is produced (clinic policy; legal review pending). */
export const TRANSCRIPT_RETENTION_DAYS = Number(process.env.TRANSCRIPT_RETENTION_DAYS || 30)

export function transcriptionConfigured(): boolean {
  return !!process.env.TRANSCRIPTION_PROVIDER && !!process.env.TRANSCRIPTION_INGEST_SECRET
}

export function clinicEnabled(settings: unknown): boolean {
  return !!settings && typeof settings === 'object' && (settings as Record<string, unknown>).transcription_enabled === true
}
