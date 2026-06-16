export default function AdminLoading() {
  return (
    <div className="admin-page animate-pulse">
      <div className="admin-page-header">
        <div className="h-8 w-40 rounded bg-muted" />
        <div className="mt-3 h-4 w-72 rounded bg-muted" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="admin-panel p-5">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="mt-5 h-7 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-5 w-32 rounded bg-muted" />
          <div className="admin-panel divide-y divide-border/50">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-4 w-2/3 rounded bg-muted" />
                  <div className="h-3 w-1/3 rounded bg-muted" />
                </div>
                <div className="h-8 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="admin-panel h-64 p-5" />
          <div className="admin-panel h-80 p-5" />
        </div>
      </div>
    </div>
  );
}
