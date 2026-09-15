import { cn } from '@/shared/lib/cn'
import { Reveal } from './Reveal'
import { Section, SectionHeading } from './Section'
import { TESTIMONIALS_BOTTOM, TESTIMONIALS_TOP, type Testimonial } from './testimonials-data'

/**
 * Três depoimentos, colados no preço: prova social decide na hora da
 * escolha, não logo depois do hero. Grade estática, sem esteira: no celular
 * a esteira custava duas telas.
 */
const FEATURED: readonly Testimonial[] = [
  ...TESTIMONIALS_TOP.slice(0, 2),
  ...TESTIMONIALS_BOTTOM.slice(0, 1),
]

export function Testimonials() {
  return (
    <Section id="depoimentos" compact className="border-t border-line">
      <SectionHeading eyebrow="Depoimentos" title="Quem trocou o plano ideal pelo dia real." />

      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {FEATURED.map((item, index) => (
          <Reveal key={item.name} delay={index * 0.06} className="h-full">
            <TestimonialCard item={item} />
          </Reveal>
        ))}
      </ul>
    </Section>
  )
}

function TestimonialCard({ item }: { readonly item: Testimonial }) {
  return (
    <li className="h-full rounded-card border border-line bg-surface p-5">
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
    <div
      className="flex gap-0.5 text-axis-leitura"
      role="img"
      aria-label={`${rating} de 5 estrelas`}
    >
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
