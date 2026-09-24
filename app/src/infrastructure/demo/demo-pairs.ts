import { addDays, dayKeyOf } from '@/domain/entities/day'
import type {
  EncouragementKind,
  InvitePreview,
  Pair,
  PairInvite,
  PairOverview,
} from '@/domain/entities/pair'
import { PLAN_LIMITS, isUnlimited } from '@/domain/entities/plan'
import type { PairRepository } from '@/domain/repositories/pair-repository'
import { DomainError } from '@/shared/errors'

/**
 * O Juntos no modo demo.
 *
 * Existe uma dupla montada: a pessoa que está olhando e a "Carol". É o único
 * jeito de a tela poder ser vista e trabalhada sem Supabase — e a alternativa
 * (tela vazia com "convide alguém" e um convite que não vai a lugar nenhum)
 * não mostra nada do que o recurso é.
 *
 * O aviso de que isso é demonstração é responsabilidade da tela, como no resto
 * do app. Aqui não se inventa dado de outra pessoa real: a Carol é fictícia e
 * o avanço dela é fixo.
 *
 * O teto de duplas sai de `PLAN_LIMITS.free` porque o perfil de demonstração é
 * gratuito (ver `demo-store`). É o que faz o modo demo mostrar o limite de
 * verdade em vez de uma versão sem trava que não existe em nenhum plano.
 */
export class DemoPairRepository implements PairRepository {
  private pairs: Pair[] = []
  private token: string | null = null

  constructor() {
    this.pairs = [this.build('demo-pair', 'demo-carol', 'Carol')]
  }

  private get max(): number {
    return PLAN_LIMITS.free.pairs
  }

  private build(id: string, partnerId: string, partnerName: string): Pair {
    const today = dayKeyOf(new Date())
    const days = (pattern: readonly boolean[]) =>
      pattern.map((advanced, index) => ({
        day: addDays(today, -(pattern.length - 1 - index)),
        advanced,
      }))

    return {
      id,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      daysTogether: 3,
      members: [
        {
          userId: 'demo-user',
          isMe: true,
          name: 'Você',
          avatarUrl: null,
          advancedToday: true,
          days: days([true, false, true, true, true, true, true]),
        },
        {
          userId: partnerId,
          isMe: false,
          name: partnerName,
          avatarUrl: null,
          advancedToday: false,
          days: days([true, true, true, true, true, true, false]),
        },
      ],
      encouragementsToday: [],
    }
  }

  async load(): Promise<PairOverview> {
    const max = this.max
    return {
      pairs: this.pairs,
      max: isUnlimited(max) ? null : max,
      room: isUnlimited(max) || this.pairs.length < max,
    }
  }

  async createInvite(): Promise<PairInvite> {
    if (!isUnlimited(this.max) && this.pairs.length >= this.max) {
      throw new DomainError(
        `No teu plano cabe ${this.max === 1 ? '1 dupla' : `${this.max} duplas`} ativa. O PRO abre quantas você quiser.`,
      )
    }
    this.token = 'demo-convite'
    return {
      id: 'demo-invite',
      token: this.token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }
  }

  async previewInvite(token: string): Promise<InvitePreview> {
    if (token !== this.token) {
      return {
        status: 'invalido',
        inviterName: null,
        inviterAvatar: null,
        expiresAt: null,
        canAccept: false,
      }
    }
    return {
      status: 'pendente',
      inviterName: 'Carol',
      inviterAvatar: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      canAccept: true,
    }
  }

  async acceptInvite(token: string): Promise<string> {
    if (token !== this.token) throw new DomainError('Esse convite não é válido.')
    if (!isUnlimited(this.max) && this.pairs.length >= this.max) {
      throw new DomainError(
        `No teu plano cabe ${this.max === 1 ? '1 dupla' : `${this.max} duplas`} ativa. O PRO abre quantas você quiser.`,
      )
    }

    const nova = this.build(`demo-pair-${this.pairs.length + 1}`, 'demo-amigo', 'Alex')
    this.pairs = [...this.pairs, nova]
    this.token = null
    return nova.id
  }

  async declineInvite(): Promise<void> {
    this.token = null
  }

  async sendEncouragement(pairId: string, kind: EncouragementKind): Promise<void> {
    const pair = this.pairs.find((item) => item.id === pairId)
    if (!pair) throw new DomainError('Você não está nessa dupla.')

    const me = pair.members.find((member) => member.isMe)
    const other = pair.members.find((member) => !member.isMe)
    if (!me || !other) return

    // O mesmo gesto duas vezes no dia não duplica, igual ao servidor.
    if (pair.encouragementsToday.some((item) => item.senderId === me.userId && item.kind === kind)) {
      return
    }

    /*
      O teto por dia também vale aqui.

      Sem ele, o modo demo mostraria os três gestos livres e a produção recusaria
      o segundo: divergência entre os dois repositórios do mesmo contrato é o
      começo de dois produtos saindo do mesmo código.
    */
    const teto = PLAN_LIMITS.free.pairEncouragementsPerDay
    if (pair.encouragementsToday.filter((item) => item.senderId === me.userId).length >= teto) {
      throw new DomainError(
        'No teu plano cabe 1 incentivo por dia nessa dupla. Os três gestos, todo dia, fazem parte do PRO.',
      )
    }

    this.replace({
      ...pair,
      encouragementsToday: [
        ...pair.encouragementsToday,
        {
          id: `demo-${kind}-${Date.now()}`,
          kind,
          senderId: me.userId,
          recipientId: other.userId,
          createdAt: new Date(),
          readAt: null,
        },
      ],
    })
  }

  private replace(pair: Pair): void {
    this.pairs = this.pairs.map((item) => (item.id === pair.id ? pair : item))
  }

  async markRead(ids: readonly string[]): Promise<void> {
    const alvo = new Set(ids)
    this.pairs = this.pairs.map((pair) => ({
      ...pair,
      encouragementsToday: pair.encouragementsToday.map((item) =>
        alvo.has(item.id) ? { ...item, readAt: new Date() } : item,
      ),
    }))
  }

  async leave(pairId: string): Promise<void> {
    this.pairs = this.pairs.filter((pair) => pair.id !== pairId)
  }
}
