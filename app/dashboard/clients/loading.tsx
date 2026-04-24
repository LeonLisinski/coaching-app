export default function ClientsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 bg-gray-100 rounded-lg" />
        <div className="h-9 w-32 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
