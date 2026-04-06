import { redirect } from 'next/navigation'

export default function AvailabilityRedirect() {
  redirect('/dashboard/doctor/calendar')
}
