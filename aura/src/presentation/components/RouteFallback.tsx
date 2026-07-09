/** Placeholder enquanto uma rota lazy carrega. */
export function RouteFallback() {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className="flex min-h-[40svh] items-center justify-center"
    >
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}
