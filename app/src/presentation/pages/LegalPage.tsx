import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { SiteFooter } from '@/presentation/components/landing/SiteFooter'
import { SiteHeader } from '@/presentation/components/landing/SiteHeader'
import { SITE } from '@/presentation/components/landing/site'
import { formatLegalVersion, LEGAL_VERSIONS } from '@/domain/legal/legal-documents'

/**
 * Termos de uso e política de privacidade, na mesma página com conteúdo
 * diferente. O texto é a versão inicial, escrita pra bater com o que o
 * produto faz hoje (dados privados por RLS, IA sem chave no navegador, PRO
 * sem fidelidade). Revisar com quem cuida do jurídico antes de cobrar.
 */
type LegalKind = 'termos' | 'privacidade'

interface LegalSection {
  readonly title: string
  readonly paragraphs: readonly string[]
}

interface LegalDocument {
  readonly title: string
  readonly intro: string
  readonly sections: readonly LegalSection[]
}

const DOCUMENTS: Readonly<Record<LegalKind, LegalDocument>> = {
  termos: {
    title: 'Termos de uso',
    intro:
      'Estes termos regulam o uso do Momentumm. Ao criar uma conta, você concorda com o que está aqui. Escrevemos em linguagem direta de propósito: termo que ninguém lê não protege ninguém.',
    sections: [
      {
        title: '1. O serviço',
        paragraphs: [
          'O Momentumm é um sistema de progresso pessoal: você cria objetivos, o app monta um plano por etapas, organiza o seu dia, mede o seu ritmo e sugere ajustes. Ele roda no navegador, sem instalação.',
          'O serviço é oferecido em um plano gratuito e em um plano PRO. O gratuito entrega o ciclo inteiro com limites de quantidade e histórico; o PRO amplia esses limites e adiciona análises. Os limites vigentes aparecem na página de planos e em Configurações.',
        ],
      },
      {
        title: '2. Sua conta',
        paragraphs: [
          'Você precisa ter 16 anos ou mais pra criar uma conta. Você é responsável por manter a senha em sigilo e por tudo que acontece na sua conta. Recomendamos ativar a verificação em duas etapas em Configurações.',
          'Uma conta é de uma pessoa. Compartilhar credenciais ou usar o serviço pra revender acesso não é permitido.',
        ],
      },
      {
        title: '3. Seu conteúdo',
        paragraphs: [
          'Objetivos, hábitos, ações, notas e registros são seus. O Momentumm não reivindica nenhum direito sobre eles. Você pode apagar a sua conta a qualquer momento em Configurações, e isso remove os seus dados dos nossos sistemas. Pra receber uma cópia dos seus dados, use o canal de contato indicado no rodapé do site.',
          'Você nos concede apenas a licença necessária pra armazenar, processar e exibir o seu conteúdo pra você e pra quem você escolher compartilhar.',
        ],
      },
      {
        title: '4. Momentumm AI',
        paragraphs: [
          'As sugestões da IA (planos, leituras de progresso, sínteses do review) são geradas a partir dos dados que você colocou no app e devolvidas como prévia editável. Elas são apoio à sua decisão, não aconselhamento profissional de saúde, financeiro ou jurídico.',
        ],
      },
      {
        title: '5. Plano PRO e pagamento',
        paragraphs: [
          'O PRO é uma assinatura mensal ou anual, cobrada no início de cada período. Não há fidelidade: você pode cancelar quando quiser em Configurações e mantém o PRO até o fim do período já pago. Depois disso a conta volta pro plano gratuito com tudo que você criou.',
          'O preço protegido do plano anual vale enquanto a assinatura não for cancelada. Mudanças de preço são avisadas com pelo menos 30 dias de antecedência.',
        ],
      },
      {
        title: '6. Uso aceitável',
        paragraphs: [
          'Não use o serviço pra violar a lei, tentar acessar dados de outras pessoas, sobrecarregar a infraestrutura ou contornar limites de plano. Contas que fizerem isso podem ser suspensas.',
        ],
      },
      {
        title: '7. Disponibilidade e responsabilidade',
        paragraphs: [
          'Trabalhamos pra manter o serviço no ar, mas não garantimos disponibilidade ininterrupta. O Momentumm é fornecido "como está" e, na medida permitida pela lei, não nos responsabilizamos por perdas indiretas decorrentes do uso ou da indisponibilidade do serviço.',
        ],
      },
      {
        title: '8. Mudanças nestes termos',
        paragraphs: [
          'Podemos atualizar estes termos. Mudanças relevantes são avisadas no app ou por e-mail antes de entrarem em vigor. Continuar usando o serviço depois disso significa concordar com a versão nova.',
        ],
      },
      {
        title: '9. Contato',
        paragraphs: ['Dúvidas sobre estes termos podem ser enviadas pelo canal de contato indicado no rodapé do site.'],
      },
    ],
  },
  privacidade: {
    title: 'Política de privacidade',
    intro:
      'O Momentumm guarda o que você faz pra crescer. Isso é dado sensível pra você, e tratamos assim: tudo nasce privado, e a regra de quem vê o quê é aplicada no banco de dados, não só na tela.',
    sections: [
      {
        title: '1. O que coletamos',
        paragraphs: [
          'Dados de conta: e-mail, nome, foto e bio (opcionais) e as credenciais de acesso. Se você entrar com o Google, recebemos o e-mail e o nome do seu perfil Google.',
          'Dados de uso do produto: objetivos, planos, etapas, hábitos, ações, registros de atividade, check-ins, reviews e as respostas que você escreve. Também derivamos números a partir deles, como o Momentum Score.',
          'Dados técnicos: registros de acesso, tipo de navegador e eventos de uso agregados (por exemplo, "compartilhou um card"), nunca o conteúdo que você escreveu.',
        ],
      },
      {
        title: '2. Pra que usamos',
        paragraphs: [
          'Pra fazer o produto funcionar: montar o plano, calcular o progresso, gerar o review e as sugestões da IA. Pra manter a conta segura, responder ao suporte e melhorar o serviço com métricas agregadas.',
          'Não vendemos dados. Não usamos o seu conteúdo pra anúncios.',
        ],
      },
      {
        title: '3. Momentumm AI',
        paragraphs: [
          'Quando você pede um plano, uma reorganização do dia, uma leitura do progresso, o rascunho da review ou um plano de retorno, enviamos ao provedor de IA um recorte fechado da sua conta: objetivos e etapas, hábitos, ações, capacidade do dia, Momentum Score, os últimos reviews e vitórias recentes. Não enviamos e-mail, nome, observações do check-in nem dados de outras pessoas. O processamento acontece no nosso servidor; nenhuma chave de IA roda no seu navegador. Guardamos apenas o tipo da chamada, o modelo e a contagem de tokens, nunca o conteúdo. Não usamos os seus dados pra treinar modelos.',
          'A IA propõe; você decide. Nenhuma sugestão altera dados, datas ou planejamentos sem a sua confirmação.',
        ],
      },
      {
        title: '4. Com quem compartilhamos',
        paragraphs: [
          'Com provedores que operam o serviço sob contrato: hospedagem e banco de dados (Supabase), processamento de pagamento (no PRO) e provedor de IA (quando você usa a Momentumm AI). Cada um recebe só o necessário pra sua função.',
          'Com outras pessoas, apenas o que você escolher: um momento compartilhado no Círculo fica visível pros amigos aceitos; o seu progresso num desafio fica visível pros participantes daquele desafio; uma imagem gerada no Share Studio sai do seu aparelho só quando você a envia. Nada disso muda a visibilidade dos dados que ficam no app.',
          'Com autoridades, apenas quando a lei exigir.',
        ],
      },
      {
        title: '5. Segurança',
        paragraphs: [
          'Todo dado trafega criptografado. O acesso ao banco passa por Row Level Security: cada linha só é lida por quem tem permissão, e isso vale mesmo pra chamadas diretas à API. Sua conta pode ter verificação em duas etapas, e o acesso administrativo exige isso.',
        ],
      },
      {
        title: '6. Seus direitos',
        paragraphs: [
          'Você pode acessar e corrigir os seus dados no próprio app, exportar tudo em um arquivo estruturado (JSON) e apagar a conta em Configurações, a qualquer momento. Apagar a conta remove os seus dados dos nossos sistemas na hora, incluindo registros, reviews, fotos, áudios e anexos. Pra exercer qualquer direito previsto na LGPD que não esteja disponível na tela, use o canal de contato indicado no rodapé do site.',
        ],
      },
      {
        title: '7. Retenção',
        paragraphs: [
          'Guardamos os seus dados enquanto a conta existir. Depois da exclusão, cópias de segurança são descartadas em até 30 dias. Registros técnicos agregados, sem identificação, podem ser mantidos por mais tempo.',
        ],
      },
      {
        title: '8. Cookies e armazenamento local',
        paragraphs: [
          'Usamos armazenamento local do navegador pra manter a sessão, guardar preferências e, no modo demo, os dados de teste. Não usamos cookies de rastreamento de terceiros.',
          'Fotos, áudios e anexos ficam em armazenamento privado: só você acessa, por links temporários que expiram em minutos.',
        ],
      },
      {
        title: '9. Mudanças e contato',
        paragraphs: [
          'Podemos atualizar esta política; toda versão tem uma data, e o app pede o aceite de novo quando ela muda. O aceite fica registrado com a versão e a data, na sua conta.',
          'Dúvidas ou pedidos sobre privacidade podem ser enviados pelo canal de contato indicado no rodapé do site.',
        ],
      },
    ],
  },
}

export function LegalPage({ kind }: { readonly kind: LegalKind }) {
  const document = DOCUMENTS[kind]

  useEffect(() => {
    const previous = window.document.title
    window.document.title = `${document.title} · ${SITE.name}`
    return () => {
      window.document.title = previous
    }
  }, [document.title])

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo
      </a>

      <SiteHeader />

      <main id="conteudo" className="mx-auto max-w-3xl px-4 pb-24 pt-32 sm:pt-40">
        <header>
          <p className="text-sm font-medium tracking-wide text-brand-hi uppercase">Legal</p>
          <h1 className="mt-3 text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {document.title}
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-lg text-ink-muted">{document.intro}</p>
          <p className="mt-4 text-sm text-ink-faint">Versão de {formatLegalVersion(LEGAL_VERSIONS[kind])}. O aceite fica registrado na tua conta com essa data.</p>
        </header>

        <div className="mt-12 flex flex-col gap-10">
          {document.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-xl font-semibold tracking-tight text-ink">{section.title}</h2>
              <div className="mt-3 flex flex-col gap-3">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-pretty text-ink-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <nav aria-label="Outros documentos" className="mt-14 border-t border-line pt-6 text-sm">
          {kind === 'termos' ? (
            <Link to="/privacidade" className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Ler a política de privacidade
            </Link>
          ) : (
            <Link to="/termos" className="text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Ler os termos de uso
            </Link>
          )}
        </nav>
      </main>

      <SiteFooter />
    </div>
  )
}
