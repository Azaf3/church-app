// Regras da tesouraria: tipos, categorias de despesa e contas do caixa.
import { normalizar } from './importar'
import type { Lancamento } from './tipos'

export const ENTRADAS = { dizimo: 'Dízimo', oferta: 'Oferta', outro: 'Outra entrada' } as const
// "de onde veio": mensalidade do SETE (outra entrada no caixa do SETE) aparece separada
export const ORIGENS = { dizimo: 'Dízimo(s)', oferta: 'Oferta(s)', outro: 'Outras entrada(s)', sete: 'SETE (mensalidades)' } as const
export type Origem = keyof typeof ORIGENS
export const origemDe = (l: Pick<Lancamento, 'tipo' | 'fundo'>): Origem =>
  l.tipo === 'outro' && l.fundo === 'sete' ? 'sete' : (l.tipo as Origem)
export const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência' } as const

// "pra onde foi": a ordem importa (FGTM fala de prebenda; aluguel do espaço SETE é aluguel)
export const CATEGORIAS: { nome: string; padrao: RegExp }[] = [
  { nome: 'Prebenda pastoral', padrao: /^(?!.*fgtm).*(prebenda|antecipac)/ },
  { nome: 'FGTM', padrao: /fgtm/ },
  { nome: 'Aluguéis', padrao: /aluguel|alugueis|locacao|condominio/ },
  { nome: 'Oferta Missionária', padrao: /miss(ao|oes)|missionar|gilson|vem viver/ },
  { nome: 'SETE (aulas/apostilas)', padrao: /\bsete\b|seminario|apostila|aula|professor/ },
  { nome: 'Neoenergia, água e Internet', padrao: /neoenergia|energia|enel|\bceb\b|caesb|\bagua\b(?! mineral)|internet|\bluz\b/ },
]
export const OUTRAS = 'Outros'
export const NOMES_CATEGORIAS = [...CATEGORIAS.map((c) => c.nome), OUTRAS]

export function adivinharCategoria(...textos: (string | null | undefined)[]) {
  const n = normalizar(textos.filter(Boolean).join(' '))
  return CATEGORIAS.find((c) => c.padrao.test(n))?.nome ?? OUTRAS
}

export const ehSaida = (l: Pick<Lancamento, 'tipo'>) => l.tipo === 'saida'
export const ehEntrada = (l: Pick<Lancamento, 'tipo'>) => l.tipo === 'dizimo' || l.tipo === 'oferta' || l.tipo === 'outro'
export const ehSaldoInicial = (l: Pick<Lancamento, 'tipo'>) => l.tipo === 'saldo_inicial'
export const somar = (ls: { valor: number | null }[]) => ls.reduce((s, l) => s + Number(l.valor), 0)

// rótulo curto do mês: "nov/26"
export const mesCurto = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(a).slice(2)
}
export const mesesAte = (ym: string, n: number) => {
  const [a, m] = ym.split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 - (n - 1 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

export type Fundo = 'geral' | 'missoes' | 'sete'
export const FUNDOS: Record<Fundo, string> = { geral: 'Caixa geral', missoes: 'Missões', sete: 'SETE' }

// caixa pela descrição: missões e SETE têm caixa próprio
export function fundoDaDescricao(...textos: (string | null | undefined)[]): Fundo {
  const n = normalizar(textos.filter(Boolean).join(' '))
  if (/miss(ao|oes|ionari)|vem viver|pr\.? gilson/.test(n)) return 'missoes'
  if (/\bsete\b|seminario|apostila/.test(n)) return 'sete'
  return 'geral'
}
