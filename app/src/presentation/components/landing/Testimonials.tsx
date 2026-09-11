import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { TESTIMONIALS_BOTTOM, TESTIMONIALS_TOP, type Testimonial } from './testimonials-data'

/**
 * Duas esteiras contínuas em sentidos opostos, sem pausa e sem emenda
 * visível: cada faixa repete a lista duas vezes e o keyframe desloca
 * exatamente uma cópia. A segunda cópia é `aria-hidden` pra leitor de tela
 * não ouvir doze depoimentos duas vezes.
 */
export function Testimonials() {
  return (
    <Section id="depoimentos" className="overflow-hidden border-t border-line" bleed>
      <div className="mx-auto max-w-5xl px-4">
        <SectionHeading
          eyebrow="Depoimentos"
          title="Quem trocou o plano ideal pelo dia real."
          description="Gente que não precisava de mais motivação, precisava de um sistema que sobrevivesse à semana."
        />
      </div>

      <Reveal className="mt-12 flex flex-col gap-4">
        <MarqueeRow items={TESTIMONIALS_TOP} />
        <MarqueeRow items={TESTIMONIALS_BOTTOM} reverse />
      </Reveal>
    </Section>
  )
}

interface MarqueeRowProps {
  readonly items: readonly Testimonial[]
  readonly reverse?: boolean
}

function MarqueeRow({ items, reverse = false }: MarqueeRowProps) {
  return (
    <div className="marquee-fade overflow-hidden">
      <div
        className={cn(
          'flex w-max gap-4 animate-marquee',
          reverse && '[animation-direction:reverse]',
        )}
      >
        <TestimonialList items={items} />
        <TestimonialList items={items} ariaHidden />
      </div>
    </div>
  )
}

interface TestimonialListProps {
  readonly items: readonly Testimonial[]
  readonly ariaHidden?: boolean
}

function TestimonialList({ items, ariaHidden = false }: TestimonialListProps) {
  return (
    <ul className="flex shrink-0 gap-4" aria-hidden={ariaHidden || undefined}>
      {items.map((item) => (
        <TestimonialCard key={item.name} item={item} />
      ))}
    </ul>
  )
}

function TestimonialCard({ item }: { readonly item: Testimonial }) {
  return (
    <li className="w-72 shrink-0 rounded-card border border-line bg-surface p-5 sm:w-80">
      <figure className="flex h-full flex-col gap-4">
        <figcaption className="flex items-center gap-3">
          <img
            src={item.photo}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            decoding="async"
            className="size-10 shrink-0 rounded-full object-cover ring-1 ring-line-hi"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{item.name}</p>
            <p className="truncate text-xs text-ink-faint">{item.role}</p>
          </div>
        </figcaption>
        <blockquote className="flex-1 text-pretty text-sm leading-relaxed text-ink-muted">
          “{item.quote}”
        </blockquote>
        <Stars rating={item.rating} />
      </figure>
    </li>
  )
}

function Stars({ rating }: { readonly rating: Testimonial['rating'] }) {
  return (
    <div className="flex gap-0.5 text-axis-leitura" role="img" aria-label={`${rating} de 5 estrelas`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          viewBox="0 0 20 20"
          className={cn('size-4', index >= rating && 'text-line-hi')}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 1.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L10 14.9l-5.3 2.8 1.1-5.9L1.5 7.7l5.9-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  )
}
