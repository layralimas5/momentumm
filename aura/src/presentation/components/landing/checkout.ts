/**
 * Config do checkout (venda). O modelo é "checkout direto": a pessoa paga na
 * plataforma escolhida e recebe acesso por e-mail (via webhook, futuramente).
 *
 * Enquanto a URL estiver vazia, os CTAs levam à página interna "/vagas"
 * (aviso de abertura em breve) — ninguém entra no app sem passar pelo funil.
 * Pra ATIVAR: cole a URL do checkout (Kiwify/Hotmart/Stripe) do plano fundadora.
 */
export const CHECKOUT_URL = ''

/** true quando há um checkout configurado. */
export const CHECKOUT_ENABLED = CHECKOUT_URL.trim().length > 0
