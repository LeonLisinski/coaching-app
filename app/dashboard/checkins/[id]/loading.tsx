export default function CheckinDetailLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-48 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="space-y-3">
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  )
}
