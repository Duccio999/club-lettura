type EmptyStateProps = {
  title: string;
  body: string;
};

export function EmptyState({ title, body }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-moss/40 bg-white/70 p-7 text-center shadow-sm">
      <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-clay/70" />
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/70">{body}</p>
    </div>
  );
}
