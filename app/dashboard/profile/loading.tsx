export default function ProfileLoading() {
  return (
    <div className="max-w-2xl space-y-5 animate-pulse">
      <div className="h-8 w-40 bg-gray-100 rounded-lg" />
      <div className="h-32 bg-gray-100 rounded-2xl" />
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl" />
        ))}
      </div>
      <div className="h-10 w-28 bg-gray-100 rounded-xl" />
    </div>
  )
}
