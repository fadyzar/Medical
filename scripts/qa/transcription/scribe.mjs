// Consultation transcription worker — PROTOTYPE for LOCAL QA only.
//
// Joins a LiveKit consultation room as a hidden, subscribe-only participant,
// but only once the doctor AND the patient consented (consultation_transcripts).
// Records each participant's own audio track separately (speaker = track owner,
// so doctor/patient labels need no diarization), re-checks consent every few
// seconds (withdrawal stops capture and discards the audio), and after the call
// transcribes each track locally with faster-whisper, deletes the audio, and
// posts the segments to /api/consultation-transcript/ingest.
//
// Production would run the same flow as a LiveKit Agent or a post-call job on
// per-track egress recordings; see the transcription report in the handover.
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (local QA project),
//      NEXT_PUBLIC_LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
//      APP_URL, TRANSCRIPTION_INGEST_SECRET, STT_PYTHON, STT_MODEL_DIR,
//      SCRIBE_DEPS (a package.json path whose node_modules has @livekit/rtc-node)
// Never logs transcript text or audio.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createRequire } from 'node:module'

const run = promisify(execFile)
// @livekit/rtc-node is not a dependency of the app; SCRIBE_DEPS points at where it is installed.
const rtc = createRequire(process.env.SCRIBE_DEPS || import.meta.url)
const project = createRequire(import.meta.url)
const { Room, RoomEvent, TrackKind, AudioStream } = rtc('@livekit/rtc-node')
const { AccessToken } = project('livekit-server-sdk')
const { createClient } = project('@supabase/supabase-js')

const env = (k) => { const v = process.env[k]; if (!v) throw new Error(`missing ${k}`); return v }
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } })
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(env('NEXT_PUBLIC_SUPABASE_URL'))) throw new Error('scribe prototype runs against LOCAL QA only')
const APP = env('APP_URL')
const RATE = 16000
const active = new Map()
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[scribe]', ...a)

async function ingest(body) {
  const r = await fetch(`${APP}/api/consultation-transcript/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-transcription-secret': env('TRANSCRIPTION_INGEST_SECRET') },
    body: JSON.stringify(body),
  })
  return { status: r.status, body: await r.json().catch(() => ({})) }
}

function wav(int16, file) {
  const data = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12)
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24)
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40)
  fs.writeFileSync(file, Buffer.concat([h, data]), { mode: 0o600 })
}

async function session(apt) {
  const t0 = Date.now()
  const tracks = new Map() // speaker -> { chunks: Int16Array[], written: samples }
  let stopped = false, withdrawn = false, lastRemoteAt = Date.now()

  const at = new AccessToken(env('LIVEKIT_API_KEY'), env('LIVEKIT_API_SECRET'), { identity: `scribe-${apt.appointment_id}`, name: 'scribe', ttl: '2h' })
  at.addGrant({ room: apt.video_room_name, roomJoin: true, canSubscribe: true, canPublish: false, canPublishData: false, hidden: true })
  const room = new Room()

  const speakerOf = (identity) => identity === apt.doctor_id ? 'doctor' : identity === apt.patient_id ? 'patient' : null
  const capture = async (track, participant) => {
    const speaker = speakerOf(participant.identity)
    if (!speaker || track.kind !== TrackKind.KIND_AUDIO) return
    const buf = tracks.get(speaker) ?? { chunks: [], written: 0 }
    tracks.set(speaker, buf)
    log(`capturing ${speaker} audio`)
    const stream = new AudioStream(track, { sampleRate: RATE, numChannels: 1 })
    for await (const frame of stream) {
      if (stopped) break
      // Keep each track on the session clock: pad gaps (muted/unsubscribed time) with silence.
      const due = Math.floor((Date.now() - t0) / 1000 * RATE) - frame.samplesPerChannel
      if (due - buf.written > RATE / 5) { buf.chunks.push(new Int16Array(due - buf.written)); buf.written = due }
      buf.chunks.push(new Int16Array(frame.data))
      buf.written += frame.samplesPerChannel
    }
  }
  room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => { capture(track, participant).catch(e => log('capture error', e.message)) })

  await room.connect(env('NEXT_PUBLIC_LIVEKIT_URL'), await at.toJwt(), { autoSubscribe: true, dynacast: false })
  const started = await ingest({ appointmentId: apt.appointment_id, event: 'started', provider: 'local-faster-whisper', language: 'he' })
  if (started.status !== 200) { log('not allowed to start', started.status); stopped = true; await room.disconnect(); return }
  log('joined room (hidden)')

  // Watch consent and the consultation state.
  while (!stopped) {
    await new Promise(r => setTimeout(r, 3000))
    const c = await ingest({ appointmentId: apt.appointment_id, event: 'check' })
    if (!c.body.allowed) { withdrawn = true; stopped = true; break }
    const { data } = await db.from('appointments').select('status').eq('id', apt.appointment_id).single()
    if (room.remoteParticipants.size > 0) lastRemoteAt = Date.now()
    if (data?.status === 'completed' || Date.now() - lastRemoteAt > 30000) stopped = true
  }
  await room.disconnect()

  if (withdrawn) {
    tracks.clear() // nothing was written to disk; dropping the buffers discards the audio
    log('consent withdrawn: capture stopped, audio discarded')
    return
  }

  await ingest({ appointmentId: apt.appointment_id, event: 'processing' })
  const dir = fs.mkdtempSync(path.join(process.env.SCRIBE_TMP || os.tmpdir(), 'scribe-'))
  fs.chmodSync(dir, 0o700)
  const segments = []
  let audioDeleted = true
  try {
    for (const [speaker, buf] of tracks) {
      const all = new Int16Array(buf.written)
      let o = 0; for (const c of buf.chunks) { all.set(c, o); o += c.length }
      buf.chunks = []
      const file = path.join(dir, `${speaker}.wav`)
      wav(all, file)
      try {
        const { stdout } = await run(env('STT_PYTHON'), [path.join(path.dirname(new URL(import.meta.url).pathname), 'transcribe.py'), file, env('STT_MODEL_DIR')], { maxBuffer: 32 * 1024 * 1024, timeout: 15 * 60 * 1000 })
        for (const s of JSON.parse(stdout).segments) segments.push({ speaker, start: s.start, end: s.end, text: s.text })
      } finally {
        fs.rmSync(file, { force: true })
        if (fs.existsSync(file)) audioDeleted = false
      }
    }
  } catch (e) {
    log('transcription failed:', e.message?.slice(0, 120))
    fs.rmSync(dir, { recursive: true, force: true })
    await ingest({ appointmentId: apt.appointment_id, event: 'failed', error: 'transcription failed', audioDeleted: true })
    return
  }
  fs.rmSync(dir, { recursive: true, force: true })
  segments.sort((a, b) => a.start - b.start)
  const res = await ingest({
    appointmentId: apt.appointment_id, event: 'completed', segments, audioDeleted,
    provider: 'local-faster-whisper', model: path.basename(env('STT_MODEL_DIR')), language: 'he',
    durationSeconds: Math.round((Date.now() - t0) / 1000),
  })
  log(`transcript delivered: ${segments.length} segments, status ${res.status}, audio deleted: ${audioDeleted}`)
}

async function tick() {
  const { data } = await db.from('consultation_transcripts')
    .select('appointment_id, status, doctor_consent_at, patient_consent_at, appointment:appointment_id(status, video_room_name, doctor_id, patient_id)')
    .eq('status', 'consent_pending').not('doctor_consent_at', 'is', null).not('patient_consent_at', 'is', null)
  for (const r of data || []) {
    const a = r.appointment
    if (!a || a.status !== 'in_progress' || !a.video_room_name || active.has(r.appointment_id)) continue
    const apt = { appointment_id: r.appointment_id, ...a }
    active.set(r.appointment_id, session(apt).catch(e => log('session error', e.message)).finally(() => active.delete(r.appointment_id)))
  }
}

log('watching for consented consultations (local QA)')
setInterval(() => tick().catch(e => log('tick error', e.message)), 3000)
