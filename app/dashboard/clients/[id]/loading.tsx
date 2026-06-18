export default function ClientDetailLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        <div className="h-8 w-48 bg-gray-100 rounded-lg" />
        <div className="ml-auto flex gap-2">
          <div className="h-9 w-24 bg-gray-100 rounded-xl" />
          <div className="h-9 w-9 bg-gray-100 rounded-xl" />
        </div>
      </div>
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <div className="h-48 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
        </div>
        <div className="space-y-3">
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-24 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}
