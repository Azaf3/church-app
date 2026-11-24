// Leitura de planilhas financeiras de tesouraria (Excel, CSV, Google Planilhas).
// Como cada tesoureiro organiza de um jeito, as colunas são reconhecidas pelo
// cabeçalho e podem ser corrigidas na tela antes de importar.

import { lerCSV, normalizar } from './importar'

export type Celula = string | number | boolean | Date | null
export type Tabela = Celula[][]

export type CampoFin = 'data' | 'valor' | 'entrada' | 'saida' | 'nome' | 'tipo' | 'forma' | 'descricao'

export const CAMPOS_FIN: { id: CampoFin; nome: string; dica: string }[] = [
  { id: 'data', nome: 'Data', dica: 'quando entrou' },
  { id: 'valor', nome: 'Valor', dica: 'uma coluna só com o valor (negativo = saída)' },
  { id: 'entrada', nome: 'Entrada', dica: 'se a planilha separa entradas…' },
  { id: 'saida', nome: 'Saída', dica: '…e saídas em colunas diferentes' },
  { id: 'nome', nome: 'Nome', dica: 'quem deu' },
  { id: 'tipo', nome: 'Tipo', dica: 'dízimo, oferta…' },
  { id: 'forma', nome: 'Forma', dica: 'pix, dinheiro…' },
  { id: 'descricao', nome: 'Descrição', dica: 'histórico / observação' },
]

const PADROES: [CampoFin, RegExp][] = [
  ['data', /^(data|dia|date|dt)\b/],
  ['entrada', /entrada|credito|receita|recebido/],
  ['saida', /saida|debito|despesa|gasto|pago/],
  ['valor', /valor|quantia|total|r\$|montante|importancia/],
  ['nome', /nome|membro|dizimista|ofertante|contribuinte|pessoa|irma/],
  ['tipo', /tipo|categoria|natureza|classifica|especie de/],
  ['forma', /forma|pagamento|meio|modalidade/],
  ['descricao', /descri|historico|obs|referente|detalhe/],
]

export type Mapa = Partial<Record<CampoFin, number>>

const texto = (c: Celula) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString() : String(c)).trim()

// acha a linha do cabeçalho (às vezes a planilha tem título nas primeiras linhas)
export function acharCabecalho(t: Tabela): { linha: number; mapa: Mapa } {
  let melhor = { linha: 0, mapa: {} as Mapa, pontos: -1 }
  for (let i = 0; i < Math.min(t.length, 15); i++) {
    const mapa: Mapa = {}
    t[i].forEach((c, j) => {
      const n = normalizar(texto(c))
      if (!n || n.length > 40) return
      const achou = PADROES.find(([campo, re]) => mapa[campo] === undefined && re.test(n))
      if (achou) mapa[achou[0]] = j
    })
    const pontos = Object.keys(mapa).length + (mapa.data !== undefined ? 1 : 0) + (mapa.valor !== undefined || mapa.entrada !== undefined ? 1 : 0)
    if (pontos > melhor.pontos) melhor = { linha: i, mapa, pontos }
  }
  return { linha: melhor.linha, mapa: melhor.mapa }
}

export function lerValor(c: Celula): number | null {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null
  let s = texto(c)
  if (!s) return null
  const negativo = /^\(.*\)$/.test(s) || /^-/.test(s.replace(/r\$\s*/i, '')) || /-$/.test(s)
  s = s.replace(/[^\d.,]/g, '')
  if (!s) return null
  if (s.includes(',') && s.includes('.')) {
    // o separador decimal é o que aparece por último
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  } else if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if ((s.match(/\./g) ?? []).length > 1 || /^\d{1,3}\.\d{3}$/.test(s)) {
    s = s.replace(/\./g, '') // 1.500 = mil e quinhentos
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negativo ? -n : n
}

const iso = (a: number, m: number, d: number) =>
  m >= 1 && m <= 12 && d >= 1 && d <= 31 && a > 1900 && a < 2100
    ? `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null

export function lerData(c: Celula, anoPadrao: number): string | null {
  if (c instanceof Date) return iso(c.getUTCFullYear(), c.getUTCMonth() + 1, c.getUTCDate())
  if (typeof c === 'number' && c > 20000 && c < 80000) { // número de série do Excel
    const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  const s = texto(c)
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (r) return iso(+r[1], +r[2], +r[3])
  r = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/)
  if (r) {
    let a = r[3] ? +r[3] : anoPadrao
    if (a < 100) a += 2000
    return iso(a, +r[2], +r[1])
  }
  return null
}

export function lerTipo(...campos: string[]): 'dizimo' | 'oferta' | 'outro' | 'saida' | null {
  const n = normalizar(campos.join(' '))
  if (!n) return null
  if (/saida|despesa|pagamento de|conta de|compra|gasto|debito/.test(n)) return 'saida'
  if (/dizim/.test(n)) return 'dizimo'
  if (/ofert|coleta|missoes|missao|alçada|semente|primicia/.test(n)) return 'oferta'
  return null
}

export function lerForma(c: string): 'pix' | 'dinheiro' | 'cartao' | 'transferencia' | null {
  const n = normalizar(c)
  if (!n) return null
  if (/pix/.test(n)) return 'pix'
  if (/dinheiro|especie|cash|nota/.test(n)) return 'dinheiro'
  if (/cart|credito|debito|maquin/.test(n)) return 'cartao'
  if (/transf|ted|doc|deposito|boleto/.test(n)) return 'transferencia'
  return null
}

export interface PessoaRef { id: string; nome: string }

// liga o nome escrito na planilha à ficha do membro
export function acharPessoa(nome: string, pessoas: PessoaRef[]): PessoaRef | null {
  const n = normalizar(nome)
  if (n.length < 3) return null
  const exata = pessoas.find((p) => normalizar(p.nome) === n)
  if (exata) return exata
  const partes = n.split(' ').filter((x) => x.length > 2)
  if (partes.length >= 2) {
    const [pri, ult] = [partes[0], partes[partes.length - 1]]
    const cand = pessoas.filter((p) => { const q = normalizar(p.nome).split(' '); return q[0] === pri && q.includes(ult) })
    if (cand.length === 1) return cand[0]
  }
  const comeco = pessoas.filter((p) => normalizar(p.nome).startsWith(n))
  return comeco.length === 1 ? comeco[0] : null
}

export interface LinhaFin {
  n: number // linha na planilha
  data: string | null
  valor: number | null
  tipo: 'dizimo' | 'oferta' | 'outro'
  saida: boolean
  forma: 'pix' | 'dinheiro' | 'cartao' | 'transferencia'
  nome: string
  pessoa: PessoaRef | null
  descricao: string
  problemas: string[]
}

export function montarLinhas(
  t: Tabela, linhaCab: number, mapa: Mapa, pessoas: PessoaRef[],
  op: { anoPadrao: number; tipoPadrao: 'dizimo' | 'oferta' | 'outro'; formaPadrao: LinhaFin['forma'] },
): LinhaFin[] {
  const pega = (r: Celula[], c?: number) => (c === undefined ? null : r[c] ?? null)
  const out: LinhaFin[] = []
  let ultimaData: string | null = null

  for (let i = linhaCab + 1; i < t.length; i++) {
    const r = t[i]
    if (!r || r.every((c) => !texto(c))) continue
    const nome = texto(pega(r, mapa.nome))
    const descricao = texto(pega(r, mapa.descricao))
    const tipoTxt = texto(pega(r, mapa.tipo))
    // linhas de total/saldo da planilha não são lançamentos
    if (r.some((c) => /^(total|saldo|subtotal|soma)\b/.test(normalizar(texto(c))))) continue

    let valor: number | null = null
    let saida = false
    if (mapa.entrada !== undefined || mapa.saida !== undefined) {
      const e = lerValor(pega(r, mapa.entrada)), s = lerValor(pega(r, mapa.saida))
      if (e && e > 0) valor = e
      else if (s) { valor = Math.abs(s); saida = true }
    } else {
      valor = lerValor(pega(r, mapa.valor))
      if (valor !== null && valor < 0) { valor = -valor; saida = true }
    }
    if (valor === null || valor === 0) continue

    const tipoLido = lerTipo(tipoTxt, descricao)
    if (tipoLido === 'saida') saida = true

    // célula de data vazia = mesmo dia da linha de cima (comum em livro-caixa)
    const dataCel = pega(r, mapa.data)
    let data = lerData(dataCel, op.anoPadrao)
    if (!data && !texto(dataCel) && ultimaData) data = ultimaData
    if (data) ultimaData = data

    const problemas: string[] = []
    if (!data) problemas.push(texto(dataCel) ? `data "${texto(dataCel)}" não reconhecida` : 'sem data')

    const pessoa = nome ? acharPessoa(nome, pessoas) : null
    out.push({
      n: i + 1, data, valor: Math.round(valor * 100) / 100, saida,
      tipo: tipoLido && tipoLido !== 'saida' ? tipoLido : op.tipoPadrao,
      forma: lerForma(texto(pega(r, mapa.forma))) ?? op.formaPadrao,
      nome, pessoa, descricao, problemas,
    })
  }
  return out
}

export const chaveLancamento = (data: string, valor: number, quem: string) =>
  `${data}|${Number(valor).toFixed(2)}|${normalizar(quem)}`

// lê o arquivo escolhido e devolve as abas como tabelas
export async function lerArquivo(f: File): Promise<{ aba: string; tabela: Tabela }[]> {
  const nome = f.name.toLowerCase()
  if (nome.endsWith('.csv') || nome.endsWith('.txt') || f.type === 'text/csv') {
    return [{ aba: f.name, tabela: lerCSV(await f.text()) }]
  }
  if (nome.endsWith('.xls') || nome.endsWith('.ods')) {
    throw new Error('Esse formato é antigo. No Excel ou Planilhas, salve como .xlsx ou .csv e escolha de novo.')
  }
  const { default: lerXlsx } = await import('read-excel-file/browser')
  const abas = await lerXlsx(f)
  return abas.map((a) => ({ aba: a.sheet, tabela: a.data as Tabela }))
}
