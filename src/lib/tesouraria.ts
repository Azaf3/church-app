// Regras da tesouraria: tipos, categorias de despesa e contas do caixa.
import { normalizar } from './importar'
import type { Lancamento } from './tipos'

export const ENTRADAS = { dizimo: 'Dízimo', oferta: 'Oferta', outro: 'Outra entrada' } as const
export const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência' } as const

export const CATEGORIAS: { nome: string; padrao: RegExp }[] = [
  { nome: 'Água, luz e internet', padrao: /agua|luz|energia|caesb|neoenergia|ceb|internet|telefone|celular|net\b|vivo|claro|tim\b|oi\b/ },
  { nome: 'Aluguel', padrao: /aluguel|locacao|condominio/ },
  { nome: 'Prebenda e ajudas', padrao: /prebenda|salario|ajuda de custo|pastor|obreiro|pagamento (do|de) |diaria|honorario/ },
  { nome: 'Manutenção e reforma', padrao: /manutenc|reforma|conserto|pintura|eletric|encanad|obra|material de constru/ },
  { nome: 'Limpeza e copa', padrao: /limpeza|produto|descartave|copa|cafe|agua mineral|galao/ },
  { nome: 'Missões', padrao: /miss(ao|oes)|missionar/ },
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
