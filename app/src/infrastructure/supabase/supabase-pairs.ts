import { z } from 'zod'
import { parseDayKey } from '@/domain/entities/day'
import {
  ENCOURAGEMENT_KINDS,
  INVITE_STATUSES,
  type Encouragement,
  type EncouragementKind,
  type InvitePreview,
  type Pair,
  type PairInvite,
  type PairMember,
} from '@/domain/entities/pair'
import type { PairRepository } from '@/domain/repositories/pair-repository'
import { supabase } from './client'
import { rpc, rpcVoid, translateRpcError } from './rpc'

/**
 * O Juntos contra o Supabase.
 *
 * Seis chamadas de função e UM update — nenhum `select` em tabela. Não é
 * estilo: `pair_overview()` é a única porta pro estado da dupla, e é ela que
 * garante que o app não consegue pedir mais do que booleanos sobre a outra
 * pessoa nem que quisesse.
 */

const dayRow = z.object({ day: z.string(), advanced: z.boolean() })

const memberRow = z.object({
  user_id: z.string(),
  is_me: z.boolean(),
  name: z.string().nullable(),
  avatar_url: z.string().nullable(),
  advanced_today: z.boolean(),
  days: z.array(dayRow).nullable(),
})

const encouragementRow = z.object({
  id: z.string(),
  kind: z.enum(ENCOURAGEMENT_KINDS),
  sender_id: z.string(),
  recipient_id: z.string(),
  created_at: z.string(),
  read_at: z.string().nullable(),
})

const overviewSchema = z.object({
  pair: z
    .object({
      id: z.string(),
      created_at: z.string(),
      days_together: z.number().int(),
      members: z.array(memberRow),
      encouragements_today: z.array(encouragementRow),
    })
    .nullable(),
})

const inviteSchema = z.object({
  id: z.string(),
  token: z.string(),
  expires_at: z.string(),
})

const previewSchema = z.object({
  status: z.enum(INVITE_STATUSES),
  inviter_name: z.string().nullable().optional(),
  inviter_avatar: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  can_accept: z.boolean().optional(),
})

function toMember(row: z.infer<typeof memberRow>): PairMember {
  return {
    userId: row.user_id,
    isMe: row.is_me,
    // Conta sem nome existe (cadastro por Google sem nome no perfil): "Alguém"
    // é melhor do que um card com um espaço vazio onde deveria ter uma pessoa.
    name: row.name?.trim() || 'Alguém',
    avatarUrl: row.avatar_url,
    advancedToday: row.advanced_today,
    days: (row.days ?? []).map((item) => ({
      day: parseDayKey(item.day),
      advanced: item.advanced,
    })),
  }
}

function toEncouragement(row: z.infer<typeof encouragementRow>): Encouragement {
  return {
    id: row.id,
    kind: row.kind,
    senderId: row.sender_id,
    recipientId: row.recipient_id,
    createdAt: new Date(row.created_at),
    readAt: row.read_at ? new Date(row.read_at) : null,
  }
}

export class SupabasePairRepository implements PairRepository {
  async load(): Promise<Pair | null> {
    const data = await rpc('pair_overview', {}, overviewSchema)
    if (!data.pair) return null

    return {
      id: data.pair.id,
      createdAt: new Date(data.pair.created_at),
      daysTogether: data.pair.days_together,
      members: data.pair.members.map(toMember),
      encouragementsToday: data.pair.encouragements_today.map(toEncouragement),
    }
  }

  async createInvite(): Promise<PairInvite> {
    const data = await rpc('pair_create_invite', {}, inviteSchema)
    return { id: data.id, token: data.token, expiresAt: new Date(data.expires_at) }
  }

  async previewInvite(token: string): Promise<InvitePreview> {
    const data = await rpc('pair_invite_preview', { p_token: token }, previewSchema)
    return {
      status: data.status,
      inviterName: data.inviter_name ?? null,
      inviterAvatar: data.inviter_avatar ?? null,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
      canAccept: data.can_accept ?? false,
    }
  }

  async acceptInvite(token: string): Promise<string> {
    return rpc('pair_accept_invite', { p_token: token }, z.string())
  }

  async declineInvite(token: string): Promise<void> {
    await rpcVoid('pair_decline_invite', { p_token: token })
  }

  async sendEncouragement(kind: EncouragementKind): Promise<void> {
    await rpcVoid('pair_send_encouragement', { p_kind: kind })
  }

  /**
   * Marcar como lido é o único `update` direto do Juntos.
   *
   * Ele cabe numa política (`auth.uid() = recipient_id`) sem ambiguidade
   * nenhuma, e uma função só pra isso seria cerimônia — a RLS já diz tudo que
   * precisa ser dito.
   */
  async markRead(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return
    const { error } = await supabase()
      .from('pair_encouragements')
      .update({ read_at: new Date().toISOString() })
      .in('id', [...ids])
    if (error) throw translateRpcError(error)
  }

  async leave(): Promise<void> {
    await rpcVoid('pair_leave', {})
  }
}
