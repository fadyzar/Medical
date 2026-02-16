'use client'

import { useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { Button, Input, Card, CardContent } from '@/components/ui'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) { setError('הזן כתובת אימייל'); return }
    setLoading(true)
    setError('')
    try {
      const { error: err } = await getClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (err) setError('שגיאה בשליחת האימייל')
      else setSent(true)
    } catch { setError('שגיאה לא צפויה') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <Card>
          <CardContent className="p-6">
            {sent ? (
              <div className="text-center py-6">
                <div className="text-4xl mb-4">📧</div>
                <h2 className="text-xl font-bold mb-2">נשלח בהצלחה</h2>
                <p className="text-gray-500 text-sm">בדוק את תיבת האימייל שלך לקישור לאיפוס סיסמה</p>
                <Link href="/login" className="text-blue-600 hover:underline text-sm mt-4 inline-block">חזרה להתחברות</Link>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-bold mb-2">שכחת סיסמה?</h2>
                <p className="text-gray-500 text-sm mb-6">הזן את האימייל שלך ונשלח קישור לאיפוס</p>
                {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700" role="alert">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input label="אימייל" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
                  <Button type="submit" loading={loading} className="w-full" size="lg">שלח קישור</Button>
                </form>
                <Link href="/login" className="text-blue-600 hover:underline text-sm mt-4 block text-center">חזרה להתחברות</Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
