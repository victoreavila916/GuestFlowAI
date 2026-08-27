export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-border bg-card px-4 py-3">
        <div className="flex gap-1">
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}