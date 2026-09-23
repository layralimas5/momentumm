import { addDays, dayKeyOf } from '@/domain/entities/day'
import type {
  EncouragementKind,
  InvitePreview,
  Pair,
  PairInvite,
} from '@/domain/entities/pair'
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
 */
export class DemoPairRepository implements PairRepository {
  private pair: Pair | null = null
  private token: string | null = null

  constructor() {
    this.pair = this.build()
  }

  private build(): Pair {
    const today = dayKeyOf(new Date())
    const days = (pattern: readonly boolean[]) =>
      pattern.map((advanced, index) => ({
        day: addDays(today, -(pattern.length - 1 - index)),
        advanced,
      }))

    return {
      id: 'demo-pair',
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
          userId: 'demo-carol',
          isMe: false,
          name: 'Carol',
          avatarUrl: null,
          advancedToday: false,
          days: days([true, true, true, true, true, true, false]),
        },
      ],
      encouragementsToday: [],
    }
  }

  async load(): Promise<Pair | null> {
    return this.pair
  }

  async createInvite(): Promise<PairInvite> {
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
    this.pair = this.build()
    this.token = null
    return this.pair.id
  }

  async declineInvite(): Promise<void> {
    this.token = null
  }

  async sendEncouragement(kind: EncouragementKind): Promise<void> {
    if (!this.pair) throw new DomainError('Você não está em uma dupla.')
    const me = this.pair.members.find((member) => member.isMe)
    const other = this.pair.members.find((member) => !member.isMe)
    if (!me || !other) return

    // O mesmo gesto duas vezes no dia não duplica, igual ao servidor.
    if (this.pair.encouragementsToday.some((item) => item.senderId === me.userId && item.kind === kind)) {
      return
    }

    this.pair = {
      ...this.pair,
      encouragementsToday: [
        ...this.pair.encouragementsToday,
        {
          id: `demo-${kind}-${Date.now()}`,
          kind,
          senderId: me.userId,
          recipientId: other.userId,
          createdAt: new Date(),
          readAt: null,
        },
      ],
    }
  }

  async markRead(ids: readonly string[]): Promise<void> {
    if (!this.pair) return
    const alvo = new Set(ids)
    this.pair = {
      ...this.pair,
      encouragementsToday: this.pair.encouragementsToday.map((item) =>
        alvo.has(item.id) ? { ...item, readAt: new Date() } : item,
      ),
    }
  }

  async leave(): Promise<void> {
    this.pair = null
  }
}
