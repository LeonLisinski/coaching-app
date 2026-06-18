export default function PrijaveLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  )
}
