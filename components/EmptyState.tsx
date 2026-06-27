import { Card } from "@/components/Card";

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-2xl">♙</div>
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-1 text-sm text-slate-400">{message}</p>
    </Card>
  );
}
