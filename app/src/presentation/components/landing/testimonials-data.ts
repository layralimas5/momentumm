/**
 * Depoimentos de vitrine enquanto não há usuários pra citar. As fotos vêm
 * de um banco de retratos liberado pra interface (randomuser.me), não de
 * gente que usou o produto. Quando existirem relatos reais, é aqui que eles
 * entram, e só aqui.
 */
export interface Testimonial {
  readonly name: string
  readonly role: string
  readonly quote: string
  readonly rating: 3 | 4 | 5
  readonly photo: string
}

function portrait(gender: 'men' | 'women', id: number): string {
  return `https://randomuser.me/api/portraits/${gender}/${id}.jpg`
}

export const TESTIMONIALS_TOP: readonly Testimonial[] = [
  {
    name: 'Bruna Carvalho',
    role: 'Designer freelancer',
    quote:
      'Eu abandonava todo plano na segunda semana. O dia adaptável me deixou continuar mesmo quando entreguei menos, e isso mudou tudo.',
    rating: 5,
    photo: portrait('women', 44),
  },
  {
    name: 'Rafael Nogueira',
    role: 'Desenvolvedor',
    quote:
      'O score de momentum é a primeira métrica que fez sentido pra mim. Não mede se eu fui perfeito, mede se eu continuei.',
    rating: 5,
    photo: portrait('men', 32),
  },
  {
    name: 'Camila Duarte',
    role: 'Estudante de medicina',
    quote:
      'Montei o plano do semestre em dois minutos. A IA quebrou o objetivo em blocos que cabem no meu dia de verdade, não no dia ideal.',
    rating: 5,
    photo: portrait('women', 65),
  },
  {
    name: 'Thiago Almeida',
    role: 'Personal trainer',
    quote:
      'Uso pra mim e indico pros meus alunos. A retomada depois de um dia ruim é o que faz a pessoa não desistir.',
    rating: 4,
    photo: portrait('men', 75),
  },
  {
    name: 'Juliana Pires',
    role: 'Gerente de projetos',
    quote:
      'Sem feed, sem gamificação vazia. Só o que eu preciso fazer hoje e o quanto isso empurra o objetivo. Direto ao ponto.',
    rating: 5,
    photo: portrait('women', 12),
  },
  {
    name: 'Marcos Vieira',
    role: 'Empreendedor',
    quote:
      'O review semanal só fala quando tem padrão de verdade. Me apontou que eu travava toda quarta e ofereceu o ajuste na hora.',
    rating: 5,
    photo: portrait('men', 41),
  },
]

export const TESTIMONIALS_BOTTOM: readonly Testimonial[] = [
  {
    name: 'Larissa Mendes',
    role: 'Concurseira',
    quote:
      'Estudo sozinha há dois anos. É o primeiro app que funciona sem eu precisar de grupo, ranking ou amigo pra cobrar.',
    rating: 5,
    photo: portrait('women', 33),
  },
  {
    name: 'Pedro Henrique',
    role: 'Analista de dados',
    quote:
      'O número que aparece no dashboard é o mesmo em toda tela. Parece detalhe, mas foi isso que me fez confiar no app.',
    rating: 5,
    photo: portrait('men', 22),
  },
  {
    name: 'Fernanda Rocha',
    role: 'Professora',
    quote:
      'Meditação, leitura e treino no mesmo lugar, cada um com a própria cor. Bato o olho e sei onde estou na semana.',
    rating: 4,
    photo: portrait('women', 8),
  },
  {
    name: 'Lucas Ferreira',
    role: 'Músico',
    quote:
      'Nunca tinha passado de 10 dias seguidos em nada. Fechei 60 dias de estudo de teoria com o plano se ajustando comigo.',
    rating: 5,
    photo: portrait('men', 56),
  },
  {
    name: 'Aline Barbosa',
    role: 'Advogada',
    quote:
      'Privado por padrão. Eu não queria expor meta nenhuma e o app não me empurra pra isso em momento algum.',
    rating: 5,
    photo: portrait('women', 26),
  },
  {
    name: 'Diego Santana',
    role: 'Estudante de engenharia',
    quote:
      'A sessão de foco com o bloco do dia já carregado tirou a parte chata de decidir o que fazer. Sento e começo.',
    rating: 5,
    photo: portrait('men', 11),
  },
]
