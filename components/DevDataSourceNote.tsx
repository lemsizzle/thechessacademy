export function DevDataSourceNote({ show }: { show: boolean }) {
  if (!show || process.env.NODE_ENV !== "development") return null;

  return (
    <div className="mb-4 rounded-md border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">
      Using mock data because Supabase is not configured.
    </div>
  );
}
