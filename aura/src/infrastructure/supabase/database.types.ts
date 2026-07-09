/**
 * Tipos do banco (schema public). Mantidos à mão por enquanto — quando o
 * projeto Supabase estiver de pé, gerar automaticamente com:
 *   npx supabase gen types typescript --project-id <id> > src/infrastructure/supabase/database.types.ts
 */

export type GoalStatusRow = 'active' | 'completed' | 'archived'
export type ReadingStatusRow = 'to_read' | 'reading' | 'read'
export type UserRoleRow = 'user' | 'admin'
export type SubscriptionStatusRow = 'pending' | 'active' | 'canceled' | 'blocked'

export interface Database {
  public: {
    Tables: {
      goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          progress: number
          status: GoalStatusRow
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          progress?: number
          status?: GoalStatusRow
          due_date?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          progress?: number
          status?: GoalStatusRow
          due_date?: string | null
        }
        Relationships: []
      }
      books: {
        Row: {
          id: string
          user_id: string
          title: string
          author: string | null
          status: ReadingStatusRow
          progress: number
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          author?: string | null
          status?: ReadingStatusRow
          progress?: number
          notes?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          author?: string | null
          status?: ReadingStatusRow
          progress?: number
          notes?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string | null
          role: UserRoleRow
          subscription_status: SubscriptionStatusRow
          plan: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          role?: UserRoleRow
          subscription_status?: SubscriptionStatusRow
          plan?: string | null
          created_at?: string
        }
        Update: {
          email?: string | null
          role?: UserRoleRow
          subscription_status?: SubscriptionStatusRow
          plan?: string | null
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      goal_status: GoalStatusRow
      reading_status: ReadingStatusRow
      user_role: UserRoleRow
      subscription_status: SubscriptionStatusRow
    }
    CompositeTypes: Record<never, never>
  }
}
