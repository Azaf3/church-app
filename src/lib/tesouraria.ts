// Regras da tesouraria: tipos, categorias de despesa e contas do caixa.
import { normalizar } from './importar'
import type { Lancamento } from './tipos'

export const ENTRADAS = { dizimo: 'Dízimo', oferta: 'Oferta', outro: 'Outra entrada' } as const
export const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência' } as const

export const CATEGORIAS: { nome: string; padrao: RegExp }[] = [
  { nome: 'Água, luz e internet', padrao: /agua|luz|energia|caesb|neoenergia|enel|ceb|internet|telefone|celular|net\b|vivo|claro|tim\b|oi\b/ },
  { nome: 'Aluguel', padrao: /aluguel|locacao|condominio|salas/ },
  { nome: 'Prebenda e ajudas', padrao: /prebenda|fgtm|salario|ajuda de custo|antecipac|auxilio|obreiro|diaria|honorario|combustivel/ },
  { nome: 'Manutenção e reforma', padrao: /manutenc|reforma|conserto|pintura|eletric|encanad|obra|material de constru/ },
  { nome: 'Limpeza e copa', padrao: /limpeza|produto|descartave|copa|cafe|agua mineral|galao/ },
  { nome: 'Sustento missionário', padrao: /miss(ao|oes)|missionar|pr\.? gilson|vem viver/ },
  { nome: 'Professores e aulas', padrao: /professor|aula|hora.?aula/ },
  { nome: 'Material e apostilas', padrao: /apostila|material|revista|livro/ },
  { nome: 'Ação social', padrao: /social|cesta|doacao|ajuda a|benefic|enfermo/ },
  { nome: 'Eventos e ministérios', padrao: /evento|congresso|retiro|culto especial|louvor|jovens|crianca|ebd|ministerio|lanche/ },
  { nome: 'Equipamentos e som', padrao: /som|equipamento|microfone|instrumento|cabo|projetor|cadeira|ventilador|ar condicionado/ },
  { nome: 'Taxas e impostos', padrao: /taxa|tarifa|imposto|iptu|banco|cartorio|contador/ },
]
export const OUTRAS = 'Outras despesas'
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
