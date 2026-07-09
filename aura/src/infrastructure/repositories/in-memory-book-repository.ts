import type { BookRepository } from '@/domain/repositories/book-repository'
import { BookRules, type Book, type NewBook, type ReadingStatus } from '@/domain/entities/book'

/**
 * Repositório em memória — demo enquanto o Supabase não está configurado.
 * NÃO persiste entre reloads.
 */
export class InMemoryBookRepository implements BookRepository {
  private books: Book[]

  constructor(seed: Book[] = defaultSeed()) {
    this.books = [...seed]
  }

  async listByUser(userId: string): Promise<Book[]> {
    return this.books.filter((b) => b.userId === userId)
  }

  async create(userId: string, data: NewBook): Promise<Book> {
    const status = data.status ?? 'to_read'
    const book: Book = {
      id: crypto.randomUUID(),
      userId,
      title: data.title.trim(),
      author: data.author ?? null,
      status,
      progress: BookRules.progressForStatus(status),
      notes: null,
      createdAt: new Date().toISOString(),
    }
    this.books = [book, ...this.books]
    return book
  }

  async updateStatus(id: string, status: ReadingStatus): Promise<Book> {
    const book = this.books.find((b) => b.id === id)
    if (!book) throw new Error(`Livro ${id} não encontrado`)
    book.status = status
    book.progress = BookRules.progressForStatus(status)
    return book
  }

  async remove(id: string): Promise<void> {
    this.books = this.books.filter((b) => b.id !== id)
  }
}

function defaultSeed(): Book[] {
  const now = new Date().toISOString()
  return [
    {
      id: 'seed-book-1',
      userId: 'demo',
      title: 'O Poder do Hábito',
      author: 'Charles Duhigg',
      status: 'reading',
      progress: 50,
      notes: null,
      createdAt: now,
    },
    {
      id: 'seed-book-2',
      userId: 'demo',
      title: 'A Coragem de Ser Imperfeito',
      author: 'Brené Brown',
      status: 'to_read',
      progress: 0,
      notes: null,
      createdAt: now,
    },
    {
      id: 'seed-book-3',
      userId: 'demo',
      title: 'Mulheres que Correm com os Lobos',
      author: 'Clarissa Pinkola Estés',
      status: 'read',
      progress: 100,
      notes: null,
      createdAt: now,
    },
  ]
}
