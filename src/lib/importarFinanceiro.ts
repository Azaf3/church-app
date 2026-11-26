// Leitura de planilhas financeiras de tesouraria (Excel, CSV, Google Planilhas).
// Como cada tesoureiro organiza de um jeito, as colunas são reconhecidas pelo
// cabeçalho e podem ser corrigidas na tela antes de importar.

import { lerCSV, normalizar } from './importar'
import { adivinharCategoria, fundoDaDescricao, type Fundo } from './tesouraria'

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
  categoria: string | null
  fundo: Fundo
  aba?: string
  forma: 'pix' | 'dinheiro' | 'cartao' | 'transferencia'
  nome: string
  pessoa: PessoaRef | null
  descricao: string
  problemas: string[]
}

export function montarLinhas(
  t: Tabela, linhaCab: number, mapa: Mapa, pessoas: PessoaRef[],
  op: { anoPadrao: number; tipoPadrao: 'auto' | 'dizimo' | 'oferta' | 'outro'; formaPadrao: LinhaFin['forma'] },
): LinhaFin[] {
  const pega = (r: Celula[], c?: number) => (c === undefined ? null : r[c] ?? null)
  const out: LinhaFin[] = []
  let ultimaData: string | null = null
  // colunas de texto do lançamento (o que estiver do lado, como "Total Dízimos", não conta)
  const colsTexto = [mapa.data, mapa.nome, mapa.descricao, mapa.tipo].filter((c) => c !== undefined) as number[]

  for (let i = linhaCab + 1; i < t.length; i++) {
    const r = t[i]
    const usadas = [mapa.data, mapa.nome, mapa.descricao, mapa.tipo, mapa.valor, mapa.entrada, mapa.saida]
      .filter((c) => c !== undefined) as number[]
    // linha em branco nas colunas do caixa: o que vem depois não herda a data de cima
    if (!r || usadas.every((c) => !texto(r[c] ?? null))) { ultimaData = null; continue }
    const nome = texto(pega(r, mapa.nome))
    const descricao = texto(pega(r, mapa.descricao))
    const tipoTxt = texto(pega(r, mapa.tipo))
    if (colsTexto.some((c) => /^(total|saldo|subtotal|soma)\b/.test(normalizar(texto(r[c] ?? null))))) continue

    // valores: uma coluna só (negativo = saída) ou colunas de entrada e saída
    const valores: { valor: number; saida: boolean }[] = []
    if (mapa.entrada !== undefined || mapa.saida !== undefined) {
      const e = lerValor(pega(r, mapa.entrada)), s = lerValor(pega(r, mapa.saida))
      if (e) valores.push({ valor: Math.abs(e), saida: e < 0 })
      if (s) valores.push({ valor: Math.abs(s), saida: true })
    } else {
      const v = lerValor(pega(r, mapa.valor))
      if (v) valores.push({ valor: Math.abs(v), saida: v < 0 })
    }
    const dataCel = pega(r, mapa.data)
    let data = lerData(dataCel, op.anoPadrao)
    if (!data && !texto(dataCel) && ultimaData) data = ultimaData
    if (data) ultimaData = data
    if (!valores.length) continue

    const tipoLido = lerTipo(tipoTxt, descricao)
    const pessoa = nome ? acharPessoa(nome, pessoas) : null
    const problemas: string[] = []
    if (!data) problemas.push(texto(dataCel) ? `data "${texto(dataCel)}" não reconhecida` : 'sem data')

    valores.forEach((x, k) => {
      const saida = x.saida || (valores.length === 1 && tipoLido === 'saida')
      out.push({
        n: (i + 1) + k / 10, data, valor: Math.round(x.valor * 100) / 100, saida,
        categoria: saida ? adivinharCategoria(descricao, tipoTxt, nome) : null,
        fundo: fundoDaDescricao(descricao, tipoTxt, nome),
        tipo: tipoLido && tipoLido !== 'saida' ? tipoLido
          : op.tipoPadrao !== 'auto' ? op.tipoPadrao
          // descrição que não fala de dízimo nem oferta (empréstimo, devolução, SETE...) é "outra entrada"
          : descricao || tipoTxt ? 'outro' : nome ? 'dizimo' : 'oferta',
        forma: lerForma(texto(pega(r, mapa.forma))) ?? op.formaPadrao,
        nome, pessoa: saida ? null : pessoa, descricao, problemas,
      })
    })
  }
  return out
}

// "Saldo Anterior" que aparece no topo da aba (livro-caixa mensal)
export function saldoAnterior(t: Tabela, linhaCab: number): number | null {
  const cab = t[linhaCab] ?? []
  const col = cab.findIndex((c) => /saldo anterior|saldo inicial/.test(normalizar(texto(c))))
  if (col < 0) return null
  for (let i = linhaCab + 1; i <= linhaCab + 3 && i < t.length; i++) {
    const v = lerValor(t[i]?.[col] ?? null)
    if (v !== null) return v
  }
  return null
}

// aba de um mês só (ex.: "Jun26") com uma data de outro mês no meio: quase sempre é erro de digitação
// (07/07 em vez de 07/06). Traz pro mês da aba e avisa.
export function corrigirMesForaDaAba(linhas: LinhaFin[]) {
  const meses: Record<string, number> = {}
  for (const l of linhas) if (l.data) meses[l.data.slice(0, 7)] = (meses[l.data.slice(0, 7)] ?? 0) + 1
  const [mes, qtd] = Object.entries(meses).sort((a, b) => b[1] - a[1])[0] ?? []
  const total = Object.values(meses).reduce((a, b) => a + b, 0)
  if (!mes || qtd < 5 || qtd / total < 0.8) return
  const [a, m] = mes.split('-').map(Number)
  const ultimoDia = new Date(a, m, 0).getDate()
  for (const l of linhas) {
    if (!l.data || l.data.startsWith(mes)) continue
    const dia = Math.min(Number(l.data.slice(8, 10)), ultimoDia)
    const nova = `${mes}-${String(dia).padStart(2, '0')}`
    l.problemas.push(`data ${l.data.split('-').reverse().join('/')} fora do mês da aba: ficou ${nova.split('-').reverse().join('/')}`)
    l.data = nova
  }
}

// lê todas as abas que parecem livro-caixa (data + valor) de uma vez
export function lerTodasAbas(
  abas: { aba: string; tabela: Tabela }[], pessoas: PessoaRef[], anoPadrao: number,
) {
  const lidas = abas.map((a) => {
    const c = acharCabecalho(a.tabela)
    const ok = c.mapa.data !== undefined && (c.mapa.valor !== undefined || c.mapa.entrada !== undefined)
    const linhas = ok
      ? montarLinhas(a.tabela, c.linha, c.mapa, pessoas, { anoPadrao, tipoPadrao: 'auto', formaPadrao: 'dinheiro' })
        .map((l) => ({ ...l, aba: a.aba, n: l.n + abas.indexOf(a) * 100000 }))
      : []
    corrigirMesForaDaAba(linhas)
    const datas = linhas.map((l) => l.data).filter(Boolean).sort() as string[]
    return { aba: a.aba, linhas, primeira: datas[0] ?? null, saldo: ok ? saldoAnterior(a.tabela, c.linha) : null }
  }).filter((a) => a.linhas.some((l) => l.data))
  const ordem = [...lidas].sort((a, b) => (a.primeira ?? '9').localeCompare(b.primeira ?? '9'))
  const primeira = ordem[0]
  return {
    abas: ordem.map((a) => a.aba),
    linhas: ordem.flatMap((a) => a.linhas),
    saldoInicial: primeira && primeira.saldo !== null && primeira.primeira
      ? { valor: primeira.saldo, data: primeira.primeira.slice(0, 8) + '01', aba: primeira.aba } : null,
  }
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

// escolhe sozinho a aba com mais lançamentos válidos
export function melhorAba(abas: { aba: string; tabela: Tabela }[], anoPadrao: number) {
  let melhor = { i: 0, n: -1 }
  abas.forEach((a, i) => {
    const c = acharCabecalho(a.tabela)
    const n = montarLinhas(a.tabela, c.linha, c.mapa, [], { anoPadrao, tipoPadrao: 'auto', formaPadrao: 'dinheiro' })
      .filter((l) => !l.saida && l.data).length
    if (n > melhor.n) melhor = { i, n }
  })
  return melhor.i
}

// ---------- Relação de dizimistas / ofertantes (código × mês) ----------

export interface RelacaoLida {
  aba: string
  tipo: 'dizimo' | 'oferta'
  linhas: { codigo: string; valores: (number | null)[] }[] // 12 meses
  totais: (number | null)[] // linha "Total" da planilha, pra conferir
}

const MES_RE = [/^jan/, /^fev/, /^mar/, /^abr/, /^mai/, /^jun/, /^jul/, /^ago/, /^set/, /^out/, /^nov/, /^dez/]

export function lerRelacoes(abas: { aba: string; tabela: Tabela }[]): RelacaoLida[] {
  const out: RelacaoLida[] = []
  for (const a of abas) {
    const n = normalizar(a.aba)
    const tipo = /dizim/.test(n) ? 'dizimo' : /ofert/.test(n) ? 'oferta' : null
    if (!tipo) continue
    const t = a.tabela
    // cabeçalho: a linha com os 12 meses
    let cab = -1; let cols: number[] = []
    for (let i = 0; i < Math.min(t.length, 30) && cab < 0; i++) {
      const r = t[i] ?? []
      const c = MES_RE.map((re) => r.findIndex((x) => re.test(normalizar(texto(x ?? null)))))
      if (c.filter((x) => x >= 0).length >= 10) { cab = i; cols = c }
    }
    if (cab < 0) continue
    const primeira = Math.min(...cols.filter((x) => x >= 0))
    const colCodigo = primeira - 1, colNumero = primeira - 2
    const linhas: RelacaoLida['linhas'] = []
    let totais: (number | null)[] = Array(12).fill(null)
    let atual: RelacaoLida['linhas'][number] | null = null
    for (let i = cab + 1; i < t.length; i++) {
      const r = t[i] ?? []
      const codigo = texto(r[colCodigo] ?? null).trim()
      const numero = colNumero >= 0 ? texto(r[colNumero] ?? null).trim() : ''
      const valores = cols.map((c) => (c < 0 ? null : lerValor(r[c] ?? null)))
      if (/^total/.test(normalizar(codigo))) { totais = valores; break }
      const tem = valores.some((v) => v)
      if (codigo || numero) {
        atual = { codigo: codigo || `Sem código nº ${numero} (${tipo === 'dizimo' ? 'dízimos' : 'ofertas'})`, valores: Array(12).fill(null) }
        linhas.push(atual)
      }
      if (!tem) continue
      if (!atual) { atual = { codigo: 'Sem código', valores: Array(12).fill(null) }; linhas.push(atual) }
      // linha sem nome e sem número logo abaixo: é mais um valor da mesma pessoa
      valores.forEach((v, k) => { if (v) atual!.valores[k] = Math.round(((atual!.valores[k] ?? 0) + v) * 100) / 100 })
    }
    out.push({ aba: a.aba, tipo, linhas, totais })
  }
  return out
}
