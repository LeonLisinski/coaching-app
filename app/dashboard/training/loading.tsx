export default function TrainingLoading() {
  return (
    <div className="flex flex-col h-full animate-pulse">
      <div className="shrink-0 border-b border-gray-100 px-4 lg:px-6 py-3 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-9 w-24 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="flex-1 p-4 lg:p-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
