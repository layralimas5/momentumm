/** Spinner de tela cheia enquanto a sessão/perfil carregam. */
export function AuthLoading() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
    </div>
  )
}
