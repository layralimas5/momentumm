/**
 * O esqueleto de um card enquanto o feed carrega.
 *
 * Ele tem a FORMA do card real — avatar redondo, duas linhas de texto, um
 * bloco 4:5 de foto, uma fileira de ações — e não um retângulo genérico. A
 * diferença aparece no instante da troca: com a forma certa nada se move
 * quando o conteúdo chega, e com um retângulo a tela inteira se reorganiza.
 *
 * `aria-hidden` porque quem anuncia o carregamento é o `role="status"` da tela
 * em volta, com uma frase. Um leitor de tela lendo "imagem, imagem, imagem"
 * não informa nada.
 */
export function PostSkeleton() {
  return (
    <div aria-hidden="true" className="flex animate-pulse flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="size-10 shrink-0 rounded-full bg-surface-hi" />
        <span className="flex flex-1 flex-col gap-1.5">
          <span className="h-3 w-28 rounded-full bg-surface-hi" />
          <span className="h-2.5 w-20 rounded-full bg-surface-hi" />
        </span>
      </div>

      <span className="block w-full rounded-xl bg-surface-hi" style={{ aspectRatio: '4 / 5' }} />

      <span className="flex gap-3">
        <span className="size-6 rounded-full bg-surface-hi" />
        <span className="size-6 rounded-full bg-surface-hi" />
        <span className="size-6 rounded-full bg-surface-hi" />
      </span>

      <span className="h-3 w-3/4 rounded-full bg-surface-hi" />
    </div>
  )
}
