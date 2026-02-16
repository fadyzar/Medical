export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" dir="rtl">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600 mx-auto" />
        <p className="text-gray-500 text-sm mt-4">טוען...</p>
      </div>
    </div>
  )
}
