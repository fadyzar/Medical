import { Spinner } from '@/components/ui'

export default function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  )
}
