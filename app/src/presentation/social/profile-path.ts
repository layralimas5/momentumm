/**
 * O endereço de um perfil.
 *
 * Uma função e não uma string interpolada em nove lugares: o card do feed, o
 * comentário, a bandeja de stories, a lista de seguidores, a busca e as
 * sugestões todos levam ao mesmo lugar, e o dia em que esse lugar mudar não
 * pode depender de alguém achar as nove.
 *
 * `/app/perfil` (sem id) continua sendo o próprio perfil, que é uma tela
 * diferente: ela tem edição, ajustes e os números da evolução. Por isso o
 * próprio id também cai nela, em vez de abrir a versão pública de si mesmo.
 */
export function profilePath(userId: string, me?: string | null): string {
  return me && me === userId ? '/app/perfil' : `/app/perfil/${userId}`
}

export function postPath(postId: string): string {
  return `/app/publicacao/${postId}`
}
