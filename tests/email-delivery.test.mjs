// Delivery tracking: "accepted by Resend" must never be shown as "delivered".
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mapResendEvent, verifyResendSignature } from '../lib/email/delivery.ts'

test('suppressed, bounced and complained are failures with a reason', () => {
  for (const e of ['email.suppressed', 'email.bounced', 'email.complained', 'suppressed', 'failed']) {
    const u = mapResendEvent(e)
    assert.equal(u.status, 'failed', e)
    assert.ok(u.reason, e)
  }
})

test('delivered/opened are delivered; queued/sent stay sent; unknown is ignored', () => {
  assert.equal(mapResendEvent('email.delivered').status, 'delivered')
  assert.equal(mapResendEvent('opened').status, 'delivered')
  assert.equal(mapResendEvent('queued').status, 'sent')
  assert.equal(mapResendEvent('email.sent').status, 'sent')
  assert.equal(mapResendEvent('contact.created'), null)
})

const secretBytes = Buffer.from('test-secret-for-canna-webhooks!!')
const secret = 'whsec_' + secretBytes.toString('base64')
const sign = (id, ts, body) => 'v1,' + createHmac('sha256', secretBytes).update(`${id}.${ts}.${body}`).digest('base64')

test('accepts a correctly signed, fresh webhook', () => {
  const body = '{"type":"email.delivered","data":{"email_id":"x"}}'
  const ts = '1700000000'
  assert.equal(verifyResendSignature({ secret, id: 'msg_1', timestamp: ts, signatureHeader: `v1,AAAA ${sign('msg_1', ts, body)}`, body, nowSeconds: 1700000010 }), true)
})

test('rejects tampered body, wrong secret, missing headers and replays', () => {
  const body = '{"type":"email.delivered"}'
  const ts = '1700000000'
  const sig = sign('msg_1', ts, body)
  assert.equal(verifyResendSignature({ secret, id: 'msg_1', timestamp: ts, signatureHeader: sig, body: body + ' ', nowSeconds: 1700000010 }), false)
  assert.equal(verifyResendSignature({ secret: 'whsec_' + Buffer.from('other').toString('base64'), id: 'msg_1', timestamp: ts, signatureHeader: sig, body, nowSeconds: 1700000010 }), false)
  assert.equal(verifyResendSignature({ secret, id: null, timestamp: ts, signatureHeader: sig, body, nowSeconds: 1700000010 }), false)
  assert.equal(verifyResendSignature({ secret, id: 'msg_1', timestamp: ts, signatureHeader: sig, body, nowSeconds: 1700000000 + 3600 }), false)
})
