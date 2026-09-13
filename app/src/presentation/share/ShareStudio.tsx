import { useCallback, useEffect, useMemo, useState } from 'react'
import { track } from '@/infrastructure/analytics/track'
import type { DayKey } from '@/domain/entities/day'
import type { JourneyEvent } from '@/domain/entities/journey-event'
import { toShareCardData } from '@/domain/share/share-card-adapter'
import {
  compositionsAllowedFor,
  DEFAULT_SHARE_COMPOSITION,
  DEFAULT_SHARE_FORMAT,
  DEFAULT_SHARE_TEMPLATE,
  defaultFieldsFor,
  templatesAllowedFor,
  type ShareCardData,
  type ShareCompositionId,
  type ShareField,
  type ShareFieldSet,
  type ShareFormat,
  type ShareTemplateId,
} from '@/domain/share/share-card'
import { Button } from '@/presentation/components/ui/Button'
import { Icon } from '@/presentation/components/ui/Icon'
import { EmptyState, ErrorNote } from '@/presentation/components/ui/States'
import { cn } from '@/shared/lib/cn'
import { ShareCompositionCarousel } from './ShareCompositionCarousel'
import { ShareStudioControls } from './ShareStudioControls'
import { ShareStudioPhotoPicker } from './ShareStudioPhotoPicker'
import { ShareStudioVisibilityControls } from './ShareStudioVisibilityControls'
import { UpgradeHint } from '@/presentation/components/dashboard/UpgradeHint'
import { isUnlimited } from '@/domain/entities/plan'
import { usePlanner } from '@/presentation/planner/use-planner'
import { useSharePhoto } from './use-share-photo'
import { trackShare } from './share-analytics'
import {
  downloadImage,
  fileNameFor,
  renderToBlob,
  shareImage,
  supportsFileShare,
} from './render/export-image'

interface ShareStudioProps {
  readonly event: JourneyEvent
  readonly displayName: string | null
  readonly today: DayKey
  readonly compact: boolean
}

type Status = 'idle' | 'generating' | 'shared' | 'saved' | 'cancelled'

/**
 * Share Studio.
 *
 * A tela é curta de propósito: escolher formato, escolher template, decidir o
 * que aparece, compartilhar. Não é editor — a hora que ele virar um Canva
 * dentro do app, o caminho de "concluí minha rotina" até "postei" deixa de
 * caber em poucos segundos, que é a única métrica que importa aqui.
 *
 * No celular a ordem é preview, fundo, templates, privacidade, ações. No
 * desktop vira duas colunas com o preview fixo à esquerda: personalizar sem ver
 * o resultado é escolher no escuro.
 *
 * Não existe escolha de formato: o card é feito pro Story, e um seletor com uma
 * opção só é uma pergunta que já tem resposta.
 */
export function ShareStudio({ event, displayName, today, compact }: ShareStudioProps) {
  const { limits } = usePlanner()
  /*
    O gratuito escolhe entre três arranjos e duas cores (preto e PNG); o PRO
    leva os oito, as quatro cores, a foto de fundo e os toggles do que entra
    no card. Os arranjos e cores trancados continuam VISÍVEIS: é o preview que
    vende o PRO, e o botão de compartilhar é quem recusa.
  */
  const unlimited = isUnlimited(limits.shareTemplates)
  const allowedCompositions = compositionsAllowedFor(unlimited)
  const allowedTemplates = templatesAllowedFor(unlimited)
  const customizable = limits.shareCustomization
  const format: ShareFormat = DEFAULT_SHARE_FORMAT
  const [template, setTemplate] = useState<ShareTemplateId>(DEFAULT_SHARE_TEMPLATE)
  const [composition, setComposition] = useState<ShareCompositionId>(DEFAULT_SHARE_COMPOSITION)
  const [fields, setFields] = useState<ShareFieldSet>(() => defaultFieldsFor(event.type))
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const background = useSharePhoto()

  // Momento novo, decisões de privacidade zeradas. Herdar os toggles do card
  // anterior faria o nome de um objetivo aparecer num card que a pessoa nunca
  // pediu pra expor.
  useEffect(() => {
    setFields(defaultFieldsFor(event.type))
    setStatus('idle')
    setError(null)
  }, [event.id, event.type])

  const data = useMemo<ShareCardData>(
    () => toShareCardData(event, { fields, displayName, today }),
    [event, fields, displayName, today],
  )

  const analytics = useMemo(
    () => ({ activity_type: event.type, template, format, composition }),
    [event.type, template, format, composition],
  )

  useEffect(() => {
    trackShare('share_studio_opened', { activity_type: event.type, template, composition, format })
    // A dependência é só o momento: incluir template e formato transformaria
    // cada troca de opção numa nova "abertura" e inflaria a métrica.
  }, [event.id])

  const toggleField = useCallback((field: ShareField, value: boolean) => {
    setFields((current) => ({ ...current, [field]: value }))
    setStatus('idle')
  }, [])

  const chooseTemplate = useCallback(
    (next: ShareTemplateId) => {
      setTemplate(next)
      setStatus('idle')
      trackShare('share_template_selected', { ...analytics, template: next })
    },
    [analytics],
  )

  const chooseComposition = useCallback(
    (next: ShareCompositionId) => {
      setComposition(next)
      setStatus('idle')
      trackShare('share_composition_selected', { ...analytics, composition: next })
    },
    [analytics],
  )

  const generate = useCallback(async () => {
    const blob = await renderToBlob({
      data,
      template,
      composition,
      format,
      photo: background.photo,
    })
    trackShare('share_generated', analytics)
    return blob
  }, [data, template, composition, format, background.photo, analytics])

  const handleShare = useCallback(async () => {
    setStatus('generating')
    setError(null)
    try {
      const blob = await generate()
      const name = fileNameFor({ data, template, composition, format }, event.day)


      // Sem share nativo (desktop, quase sempre), o botão principal salva em
      // vez de não fazer nada: a pessoa clicou em "Compartilhar" e precisa sair
      // com o arquivo na mão.
      if (!supportsFileShare()) {
        downloadImage(blob, name)
        trackShare('share_saved', analytics)
        track('share_exported', 'compartilhamento', { template, mode: 'download' })
        setStatus('saved')
        return
      }

      const outcome = await shareImage(blob, name, data.title)
      if (outcome === 'shared') {
        trackShare('share_shared', analytics)
        track('share_exported', 'compartilhamento', { template, mode: 'share' })
        setStatus('shared')
        return
      }
      setStatus(outcome === 'cancelled' ? 'cancelled' : 'idle')
    } catch (cause) {
      setStatus('idle')
      setError(messageOf(cause))
    }
  }, [generate, data, template, format, event.day, analytics])

  const handleSave = useCallback(async () => {
    setStatus('generating')
    setError(null)
    try {
      const blob = await generate()
      downloadImage(blob, fileNameFor({ data, template, composition, format }, event.day))
      trackShare('share_saved', analytics)
      setStatus('saved')
    } catch (cause) {
      setStatus('idle')
      setError(messageOf(cause))
    }
  }, [generate, data, template, format, event.day, analytics])

  if (!hasSomethingToShow(data)) {
    return (
      <EmptyState
        title="Ainda não há o que mostrar aqui"
        description="Esse momento não tem nenhum número pra virar card. Registra alguma coisa hoje e volta — o card fica bom quando tem o que contar."
      />
    )
  }

  const busy = status === 'generating'
  const lockedChoice =
    !allowedCompositions.includes(composition) || !allowedTemplates.includes(template)

  const preview = (
    <ShareCompositionCarousel
      data={data}
      template={template}
      format={format}
      value={composition}
      photo={background.photo}
      onChange={chooseComposition}
      allowed={allowedCompositions}
      className={cn('mx-auto w-full', compact ? '' : 'max-w-md')}
    />
  )

  const options = (
    <div className="flex flex-col gap-5">
      {customizable ? (
        <Field label="Fundo">
          <ShareStudioPhotoPicker state={background} />
        </Field>
      ) : null}

      <Field
        label="Cor"
        {...(background.photo
          ? { hint: 'Com foto, a cor sai de cena: o texto vira branco com sombra.' }
          : {})}
      >
        <ShareStudioControls value={template} onChange={chooseTemplate} allowed={allowedTemplates} />
      </Field>

      {customizable ? (
        <Field
          label="Mostrar no card"
          hint="Começa com o mínimo. Nada que você escreveu entra sem você ligar."
        >
          <ShareStudioVisibilityControls
            event={event}
            fields={fields}
            onToggle={toggleField}
          />
        </Field>
      ) : (
        <UpgradeHint message="No PRO você libera os oito arranjos, as quatro cores, a foto de fundo e escolhe o que aparece no card." />
      )}
    </div>
  )

  /*
    O bloco de ação.

    Ele é separado do resto por uma linha e por um respiro maior: acima moram
    escolhas reversíveis (formato, template, o que aparece), aqui mora a que
    publica. Colado nos toggles, o "Compartilhar" virava mais uma linha da
    lista de opções.

    Botões grandes porque é um app de celular: `lg` dá 52px de altura, que é o
    alvo confortável pro polegar. O retorno ("Imagem salva") fica ABAIXO dos
    botões de propósito — acima, ele empurraria os dois pra baixo bem no
    instante em que a pessoa acabou de mirar neles.
  */
  const actions = (
    <div className="flex flex-col gap-4 border-t border-line pt-6">
      {/*
        `sm:flex-1`, nunca `flex-1` solto.

        Empilhados, o container é uma COLUNA, e ali o eixo principal do flex é o
        vertical: `flex-1` traz `flex-basis: 0%`, que atropela a altura da classe
        e faz o botão encolher até o tamanho do texto. Era esse o motivo de eles
        parecerem espremidos — 24px em vez dos 52px do tamanho `lg`. Lado a lado,
        a partir do `sm`, o eixo vira horizontal e aí `flex-1` faz o que se
        espera: divide a largura em partes iguais.
      */}
      {lockedChoice ? (
        <UpgradeHint message="Esse arranjo ou essa cor é do PRO. Escolhe um dos liberados pra compartilhar, ou libera todos." />
      ) : null}

      <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
        <Button
          size="lg"
          className="w-full sm:w-auto sm:flex-1"
          loading={busy}
          disabled={lockedChoice}
          onClick={() => void handleShare()}
        >
          <Icon name="jornada" className="size-4.5" />
          Compartilhar
        </Button>
        <Button
          size="lg"
          variant="secondary"
          className="w-full sm:w-auto sm:flex-1"
          disabled={busy || lockedChoice}
          onClick={() => void handleSave()}
        >
          <Icon name="arquivar" className="size-4.5" />
          Salvar imagem
        </Button>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-center text-sm text-ink-muted sm:text-left"
      >
        {statusMessage(status)}
      </p>
    </div>
  )

  if (compact) {
    // `pb-2` soma ao respiro do próprio sheet: sem ele, o último botão encosta
    // no risco de gestos do aparelho.
    return (
      <div className="flex flex-col gap-6 pb-2">
        {preview}
        {options}
        {actions}
      </div>
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      {/* Preview colado no topo: ele continua visível enquanto a coluna da
          direita rola, que é o ponto inteiro de existir duas colunas. */}
      <div className="lg:sticky lg:top-0 lg:self-start">{preview}</div>

      <div className="flex min-w-0 flex-col gap-6">
        {options}
        {actions}
      </div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string
  readonly hint?: string
  readonly children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">{label}</h3>
        {hint ? <p className="mt-1 text-sm text-ink-faint">{hint}</p> : null}
      </div>
      {children}
    </div>
  )
}

function statusMessage(status: Status): string {
  switch (status) {
    case 'generating':
      return 'Gerando a imagem…'
    case 'shared':
      return 'Compartilhado.'
    case 'saved':
      return 'Imagem salva. Agora é só postar.'
    case 'cancelled':
      return 'Compartilhamento cancelado. A imagem continua aqui.'
    case 'idle':
      return ''
  }
}

/**
 * Card sem número nenhum não é card.
 *
 * Acontece quando o evento não tem métrica e a pessoa desligou tudo. Em vez de
 * exportar um retângulo com um título solto, a tela diz o que falta.
 */
function hasSomethingToShow(data: ShareCardData): boolean {
  return (
    Boolean(data.primaryMetric.value) ||
    data.items.length > 0 ||
    data.momentumAfter !== null ||
    Boolean(data.secondaryMetric)
  )
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error && cause.message) return cause.message
  return 'Não consegui gerar a imagem agora. Tenta de novo em instantes.'
}
