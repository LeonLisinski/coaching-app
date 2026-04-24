export default function ChatLoading() {
  return (
    <div className="flex h-full animate-pulse">
      <div className="w-72 shrink-0 border-r border-gray-100 p-3 space-y-2">
        <div className="h-10 bg-gray-100 rounded-xl mb-3" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-14 bg-gray-100 rounded-2xl" />
        ))}
      </div>
      <div className="flex-1 flex flex-col p-4 gap-3">
        <div className="flex-1" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className={`h-10 bg-gray-100 rounded-2xl ${i % 2 === 0 ? 'w-2/3' : 'w-1/2 ml-auto'}`} />
        ))}
        <div className="h-12 bg-gray-100 rounded-2xl" />
      </div>
    </div>
  )
}
