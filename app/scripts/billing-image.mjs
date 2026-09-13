// Gera `supabase/functions/_shared/product-image.ts` a partir do ícone da
// marca. O checkout do Asaas exige uma imagem por item, em base64; o ícone
// de 180px é o menor que ainda aparece nítido na página de pagamento.
import { readFileSync, writeFileSync } from 'node:fs'

const source = 'public/apple-touch-icon.png'
const target = 'supabase/functions/_shared/product-image.ts'
const base64 = readFileSync(source).toString('base64')

writeFileSync(
  target,
  [
    '// Momentumm: o ícone da marca em base64, exigido pelo checkout do Asaas no item.',
    `// GERADO a partir de ${source} por 'npm run billing:image'. Não editar.`,
    `export const PRODUCT_IMAGE_BASE64 = '${base64}'`,
    '',
  ].join('\n'),
)
console.log(`${target}: ${base64.length} caracteres`)
