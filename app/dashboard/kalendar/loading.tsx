export default function KalendarLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 bg-gray-100 rounded-lg" />
        <div className="flex gap-2">
          <div className="h-9 w-9 bg-gray-100 rounded-xl" />
          <div className="h-9 w-9 bg-gray-100 rounded-xl" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="h-6 bg-gray-100 rounded" />
        ))}
        {[...Array(35)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  )
}
