export default function PublicLoading() {
  return (
    <div className="max-w-[640px] mx-auto px-6 py-16 sm:py-20 animate-pulse">
      <div className="space-y-4">
        {/* Date / Category Eyebrow Placeholder */}
        <div className="h-4 bg-muted rounded w-1/4" />
        {/* Heading Placeholder */}
        <div className="h-8 bg-muted rounded w-3/4 mt-4" />
        {/* Reading time / tags Placeholder */}
        <div className="h-4 bg-muted rounded w-1/2 mt-5" />
      </div>
      
      {/* Content Body Placeholder */}
      <div className="mt-16 space-y-6">
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-5/6" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-4/5" />
        <div className="h-4 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-3/4" />
      </div>
    </div>
  )
}
