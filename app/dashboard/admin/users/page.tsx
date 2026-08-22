'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { getClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button, Input, Select, Card, CardHeader, CardContent, Badge, PageLoading, EmptyState } from '@/components/ui'
import { formatDateTime, SPECIALTIES, cn } from '@/lib/utils'
import type { User, UserRole } from '@/types/database'

type UserForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  role: UserRole
  specialties: string[]
  license_number: string
  consultation_price: string
  bio: string
}

const emptyForm: UserForm = {
  first_name: '', last_name: '', email: '', phone: '',
  role: 'doctor', specialties: [], license_number: '',
  consultation_price: '', bio: '',
}

const ROLE_OPTIONS = [
  { value: 'doctor', label: 'רופא' },
  { value: 'staff', label: 'צוות שירות' },
  { value: 'admin', label: 'מנהל' },
]

const ROLE_LABELS: Record<string, string> = {
  patient: 'מטופל', doctor: 'רופא', staff: 'צוות', admin: 'מנהל',
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [patients, setPatients] = useState<User[]>([])
  const [aptCounts, setAptCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [orgId, setOrgId] = useState('')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'staff' | 'patients'>('staff')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('doctor')
  const [showInvite, setShowInvite] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteSuccess, setInviteSuccess] = useState('')
  const supabase = getClient()

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!profile) return
      setOrgId(profile.organization_id)

      const [staffRes, patientsRes] = await Promise.all([
        supabase.from('users')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .neq('role', 'patient')
          .order('created_at', { ascending: false }),
        supabase.from('users')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('role', 'patient')
          .order('created_at', { ascending: false }),
      ])

      setUsers((staffRes.data || []) as unknown as User[])
      setPatients((patientsRes.data || []) as unknown as User[])

      // Real appointment counts (the users.total_appointments field can be stale)
      const { data: aptRows } = await supabase.from('appointments')
        .select('patient_id, doctor_id')
        .eq('organization_id', profile.organization_id)
      const counts: Record<string, number> = {}
      for (const r of (aptRows || []) as Array<{ patient_id: string | null; doctor_id: string | null }>) {
        if (r.patient_id) counts[r.patient_id] = (counts[r.patient_id] || 0) + 1
        if (r.doctor_id) counts[r.doctor_id] = (counts[r.doctor_id] || 0) + 1
      }
      setAptCounts(counts)
    } catch {
      toast.error('שגיאה בטעינת רשימת המשתמשים')
    } finally {
      setLoading(false)
    }
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      specialties: user.specialties || [],
      license_number: user.license_number || '',
      consultation_price: user.consultation_price?.toString() || '',
      bio: user.bio || '',
    })
    setError('')
    setShowModal(true)
  }

  async function handleSave() {
    if (!editingUser) return
    if (!form.first_name || !form.last_name || !form.email) {
      setError('יש למלא שם פרטי, שם משפחה ואימייל')
      return
    }

    setSaving(true)
    setError('')

    const updateData: Record<string, unknown> = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone || null,
      role: form.role,
      specialties: form.role === 'doctor' ? form.specialties : null,
      license_number: form.role === 'doctor' ? form.license_number || null : null,
      consultation_price: form.consultation_price ? Number(form.consultation_price) : null,
      bio: form.bio || null,
    }

    const { error: err } = await supabase.from('users')
      .update(updateData)
      .eq('id', editingUser.id)
    if (err) {
      setError('שגיאה בעדכון: ' + err.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setShowModal(false)
    loadUsers()
  }

  async function toggleActive(user: User) {
    setMessage(null)
    const { error: err } = await supabase.from('users')
      .update({ is_active: !user.is_active })
      .eq('id', user.id)
    if (err) {
      setMessage({ type: 'error', text: 'שגיאה בעדכון סטטוס המשתמש' })
    } else {
      setMessage({ type: 'success', text: `${user.first_name} ${user.last_name} ${user.is_active ? 'הושבת' : 'הופעל'} בהצלחה` })
      setTimeout(() => setMessage(null), 3000)
    }
    loadUsers()
  }

  async function handleInvite() {
    if (!inviteEmail) return
    setInviting(true)
    setInviteSuccess('')
    setError('')

    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, name: inviteName || undefined }),
      })
      if (res.ok) {
        setInviteSuccess(`הזמנה נשלחה ל-${inviteEmail}`)
        setInviteEmail('')
        setInviteName('')
      } else {
        const data = await res.json()
        setError(data.error || 'שגיאה בשליחת הזמנה')
      }
    } catch {
      setError('שגיאה בשליחת הזמנה')
    }
    setInviting(false)
  }

  const filtered = (activeTab === 'staff' ? users : patients).filter(u => {
    const matchSearch = !search || `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
    const matchRole = activeTab === 'patients' || !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  if (loading) return <PageLoading />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-2xl font-bold">ניהול משתמשים</h2>
        {activeTab === 'staff' && (
          <Button onClick={() => setShowInvite(!showInvite)} size="sm">
            {showInvite ? 'סגור הזמנה' : '+ הזמן משתמש'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('staff'); setSearch(''); setRoleFilter('') }}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'staff' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          צוות ורופאים ({users.length})
        </button>
        <button
          onClick={() => { setActiveTab('patients'); setSearch(''); setRoleFilter('') }}
          className={cn(
            'pb-3 px-1 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'patients' ? 'border-teal-600 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          מטופלים ({patients.length})
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className={cn(
          'flex items-center gap-3 p-3 rounded-lg text-sm',
          message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        )} role="status">
          {message.text}
        </div>
      )}

      {/* Invite panel */}
      {showInvite && (
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500 mb-3">שלח הזמנה באימייל — המוזמן יקבל קישור להרשמה במערכת</p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
              <Input
                label="שם"
                value={inviteName}
                onChange={e => setInviteName(e.target.value)}
                placeholder="שם מלא"
              />
              <Input
                label="אימייל"
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
              />
              <Select
                label="תפקיד"
                options={ROLE_OPTIONS}
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as UserRole)}
              />
              <Button onClick={handleInvite} loading={inviting} size="md">שלח הזמנה</Button>
            </div>
            {inviteSuccess && <p className="text-sm text-green-600 mt-2">{inviteSuccess}</p>}
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="חיפוש לפי שם או אימייל..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select
            options={[{ value: '', label: 'כל התפקידים' }, ...ROLE_OPTIONS]}
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Users table */}
      {filtered.length === 0 ? (
        <EmptyState icon={<svg className="w-10 h-10 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>} title="לא נמצאו משתמשים" description="הוסף רופאים וצוות למערכת" />
      ) : (
        <Card>
          <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 backdrop-blur border-b border-slate-200">
                  {['שם', 'אימייל', 'תפקיד', 'התמחויות', 'תורים', 'סטטוס', 'הצטרפות', 'פעולות'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-teal-50/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700">
                          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{user.first_name} {user.last_name}</p>
                          {user.license_number && (
                            <p className="text-xs text-slate-400">רישיון: {user.license_number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.role === 'admin' ? 'danger' : user.role === 'doctor' ? 'info' : 'default'}>
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(user.specialties || []).map(s => {
                          const spec = SPECIALTIES.find(sp => sp.id === s)
                          return <Badge key={s} variant="default">{spec?.label || s}</Badge>
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{aptCounts[user.id] ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? 'success' : 'danger'}>
                        {user.is_active ? 'פעיל' : 'מושבת'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>עריכה</Button>
                        <Button
                          variant={user.is_active ? 'ghost' : 'outline'}
                          size="sm"
                          onClick={() => toggleActive(user)}
                        >
                          {user.is_active ? 'השבת' : 'הפעל'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit/Create modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h3 className="text-lg font-bold">עריכת משתמש</h3>

            <div className="grid grid-cols-2 gap-3">
              <Input label="שם פרטי" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
              <Input label="שם משפחה" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>

            <Input label="אימייל" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} disabled={!!editingUser} />
            <Input label="טלפון" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="050-1234567" />

            <Select
              label="תפקיד"
              options={ROLE_OPTIONS}
              value={form.role}
              onChange={e => setForm({ ...form, role: e.target.value as UserRole })}
            />

            {form.role === 'doctor' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">התמחויות</label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTIES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          const has = form.specialties.includes(s.id)
                          setForm({
                            ...form,
                            specialties: has
                              ? form.specialties.filter(x => x !== s.id)
                              : [...form.specialties, s.id],
                          })
                        }}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                          form.specialties.includes(s.id)
                            ? 'bg-teal-100 text-teal-800 border-teal-300'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="מספר רישיון" value={form.license_number} onChange={e => setForm({ ...form, license_number: e.target.value })} />
                <Input label="מחיר ייעוץ (₪)" type="number" value={form.consultation_price} onChange={e => setForm({ ...form, consultation_price: e.target.value })} />
              </>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-700">אודות</label>
              <textarea
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:outline-none resize-y min-h-[80px]"
                value={form.bio}
                onChange={e => setForm({ ...form, bio: e.target.value })}
                placeholder="תיאור קצר..."
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>ביטול</Button>
              <Button onClick={handleSave} loading={saving}>שמור שינויים</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
