// Importação de fichas vindas do Google Forms / planilha (CSV).
// Reconhece as colunas pelo nome do cabeçalho, junta respostas repetidas
// da mesma pessoa e corrige os erros mais comuns de digitação.

export interface PessoaImportada {
  nome: string
  telefone: string | null
  telefone_fixo: string | null
  email: string | null
  nascimento: string | null
  naturalidade: string | null
  cidade: string | null
  endereco: string | null
  data_conversao: string | null
  data_batismo: string | null
  aluno_ebd: boolean | null
  observacoes: string | null
  respostas: number // quantas linhas da planilha viraram essa pessoa
  avisos: string[]
}

type Campo = Exclude<keyof PessoaImportada, 'respostas' | 'avisos'> | 'local'

// ordem importa: o primeiro padrão que casar com o cabeçalho ganha
const COLUNAS: [Campo, RegExp][] = [
  ['nome', /^nome( completo)?$/],
  ['nascimento', /nascimento|aniversario/],
  ['naturalidade', /naturalidade/],
  ['cidade', /^cidade/],
  ['endereco', /endereco/],
  ['data_conversao', /conversao/],
  ['data_batismo', /batismo/],
  ['email', /e-?mail/],
  ['telefone_fixo', /residencial|fixo/],
  ['telefone', /celular|whats|^telefone$|^fone$/],
  ['aluno_ebd', /ebd|escola biblica/],
  ['local', /^local$|congregacao/],
]

export const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[:*]/g, '').replace(/\s+/g, ' ').trim()

export function lerCSV(texto: string): string[][] {
  const linhas: string[][] = []
  let linha: string[] = [], campo = '', aspas = false
  const t = texto.replace(/^﻿/, '')
  const sep = (t.split('\n')[0].match(/;/g)?.length ?? 0) > (t.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ','
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x.trim())) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x.trim())) linhas.push(linha)
  return linhas
}

const MINUSCULAS = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])
export function arrumarNome(nome: string) {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  // só mexe em quem escreveu tudo maiúsculo ou tudo minúsculo
  if (limpo !== limpo.toUpperCase() && limpo !== limpo.toLowerCase()) return limpo
  return limpo.toLowerCase().split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ')
}

export function arrumarData(v: string): { data: string | null; aviso?: string } {
  const s = v.trim()
  if (!s) return { data: null }
  let a: number, m: number, d: number
  let r = s.match(/^(\d{1,4})-(\d{1,2})-(\d{1,2})/)
  if (r) { a = +r[1]; m = +r[2]; d = +r[3] }
  else if ((r = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/))) { d = +r[1]; m = +r[2]; a = +r[3] }
  else return { data: null, aviso: `data "${s}" não reconhecida` }
  let aviso: string | undefined
  if (a < 100) { // "0082" ou "82" → 1982
    const corrigido = a + (a > new Date().getFullYear() % 100 ? 1900 : 2000)
    aviso = `ano ${s.slice(0, 4)} corrigido pra ${corrigido}`
    a = corrigido
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return { data: null, aviso: `data "${s}" inválida` }
  return { data: `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, aviso }
}

export function arrumarTelefone(v: string): { tel: string | null; aviso?: string } {
  const s = v.trim()
  if (!s) return { tel: null }
  const n = s.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (n.length < 8) return { tel: null, aviso: `telefone "${s}" ignorado` }
  if (n.length === 11) return { tel: `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` }
  if (n.length === 10) return { tel: `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` }
  return { tel: n }
}

const br = (v: unknown) => String(v).replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')

const texto = (v: string) => v.trim().replace(/\s+/g, ' ') || null

export function mapearColunas(cabecalho: string[]) {
  const mapa = new Map<number, Campo>()
  const usados = new Set<Campo>()
  cabecalho.forEach((h, i) => {
    const n = normalizar(h)
    const achou = COLUNAS.find(([campo, re]) => !usados.has(campo) && re.test(n))
    if (achou) { mapa.set(i, achou[0]); usados.add(achou[0]) }
  })
  return mapa
}

// campos em que vale avisar se a pessoa respondeu diferente de uma vez pra outra
const ROTULOS: Partial<Record<keyof PessoaImportada, string>> = {
  nascimento: 'nascimento', data_batismo: 'batismo', data_conversao: 'conversão', telefone: 'celular',
}

export function importar(csv: string): { pessoas: PessoaImportada[]; colunas: string[]; ignoradas: string[]; linhas: number } {
  const [cab, ...linhas] = lerCSV(csv)
  if (!cab) return { pessoas: [], colunas: [], ignoradas: [], linhas: 0 }
  const mapa = mapearColunas(cab)
  const porNome = new Map<string, PessoaImportada>()

  for (const linha of linhas) {
    const p: PessoaImportada = {
      nome: '', telefone: null, telefone_fixo: null, email: null, nascimento: null, naturalidade: null,
      cidade: null, endereco: null, data_conversao: null, data_batismo: null, aluno_ebd: null,
      observacoes: null, respostas: 1, avisos: [],
    }
    mapa.forEach((campo, i) => {
      const v = linha[i] ?? ''
      switch (campo) {
        case 'nome': p.nome = arrumarNome(v); break
        case 'nascimento': case 'data_conversao': case 'data_batismo': {
          const r = arrumarData(v); p[campo] = r.data; if (r.aviso) p.avisos.push(r.aviso); break
        }
        case 'telefone': case 'telefone_fixo': {
          const r = arrumarTelefone(v); p[campo] = r.tel; if (r.aviso) p.avisos.push(r.aviso); break
        }
        case 'aluno_ebd': { const n = normalizar(v); p.aluno_ebd = n.startsWith('s') ? true : n.startsWith('n') ? false : null; break }
        case 'email': p.email = texto(v)?.toLowerCase() ?? null; break
        case 'local': { const t = texto(v); if (t && !/^nao$/i.test(normalizar(t))) p.observacoes = `Local: ${t}`; break }
        default: p[campo] = texto(v)
      }
    })
    if (!p.nome) continue
    if (!p.telefone && p.telefone_fixo) p.telefone = p.telefone_fixo
    if (p.telefone_fixo === p.telefone) p.telefone_fixo = null

    // mesma pessoa respondeu de novo: a resposta mais nova vale, sem apagar o que só a antiga tinha
    const chave = normalizar(p.nome)
    const antiga = porNome.get(chave)
    if (antiga) {
      const junta = { ...antiga } as PessoaImportada
      for (const k of Object.keys(p) as (keyof PessoaImportada)[]) {
        if (k === 'respostas' || k === 'avisos') continue
        if (p[k] === null || p[k] === '') continue
        if (antiga[k] !== null && antiga[k] !== p[k] && ROTULOS[k]) {
          p.avisos.push(`${ROTULOS[k]} diferente nas respostas: ficou ${br(p[k])}, antes era ${br(antiga[k])}`)
        }
        (junta as unknown as Record<string, unknown>)[k] = p[k]
      }
      junta.respostas = antiga.respostas + 1
      junta.avisos = [...new Set([...antiga.avisos, ...p.avisos])]
      porNome.set(chave, junta)
    } else porNome.set(chave, p)
  }

  return {
    pessoas: [...porNome.values()].sort((a, b) => a.nome.localeCompare(b.nome)),
    colunas: [...mapa.entries()].map(([i, c]) => `${cab[i].trim()} → ${c}`),
    ignoradas: cab.filter((h, i) => h.trim() && !mapa.has(i)).map((h) => h.trim()),
    linhas: linhas.length,
  }
}
