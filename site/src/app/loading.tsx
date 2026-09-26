export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pt-16"
      role="status"
      aria-live="polite"
      aria-label="Loading page"
    >
      <span className="sr-only">Loading page…</span>
      <div className="panel panel-lit h-10 w-56 animate-pulse p-5" />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="panel panel-lit h-52 animate-pulse p-5" />
        ))}
      </div>
    </div>
  );
}
