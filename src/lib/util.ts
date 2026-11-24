import type { Etapa, Papel } from './tipos'

export const NOME_PRODUTO = 'Pastoreio'

export const ETAPAS: { id: Etapa; nome: string; acao: string }[] = [
  { id: 'novo', nome: 'Novo', acao: 'Fazer o primeiro contato' },
  { id: 'relacionamento', nome: 'Relacionamento', acao: 'Convidar pra um encontro' },
  { id: 'integracao', nome: 'Integração', acao: 'Conversar sobre membresia' },
  { id: 'membresia', nome: 'Membresia', acao: 'Convidar pra um pequeno grupo' },
  { id: 'pequeno_grupo', nome: 'Pequeno grupo', acao: 'Convidar pra servir' },
]

export const PAPEIS: Record<Papel, string> = {
  admin: 'Administrador',
  pastor: 'Pastor',
  tesoureiro: 'Tesoureiro',
  obreiro: 'Obreiro',
}

export const podeFinanceiro = (p?: Papel) => p === 'admin' || p === 'pastor' || p === 'tesoureiro'
export const podeEquipe = (p?: Papel) => p === 'admin' || p === 'pastor'

export function linkWhats(telefone: string | null, texto = '') {
  if (!telefone) return null
  let n = telefone.replace(/\D/g, '')
  if (n.length <= 11) n = '55' + n
  return `https://wa.me/${n}${texto ? '?text=' + encodeURIComponent(texto) : ''}`
}

// ignora títulos como Pr., Pra., Dr., Dona, Seu
export const primeiroNome = (nome: string) => {
  const partes = nome.trim().split(/\s+/)
  return partes.find((p) => !/^(pr|pra|pastor|pastora|dr|dra|dona|seu|irmã|irmão|ir)\.?$/i.test(p)) ?? partes[0]
}

export const hojeISO = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

// início/fim de um dia local em ISO (UTC), pra filtrar timestamptz certo
export const inicioDia = (d = hojeISO()) => new Date(`${d}T00:00:00`).toISOString()
export const fimDia = (d = hojeISO()) => new Date(`${d}T23:59:59`).toISOString()

export const dataBR = (iso: string | null) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}${a !== String(new Date().getFullYear()) ? '/' + a : ''}`
}

export const horaBR = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

export const dinheiro = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const iniciais = (nome: string) =>
  nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')

export function situacaoPrazo(prazo: string | null) {
  if (!prazo) return null
  const hoje = hojeISO()
  if (prazo < hoje) return { rotulo: 'Atrasado', classe: 'tag tag-alerta' }
  if (prazo === hoje) return { rotulo: 'Hoje', classe: 'tag tag-hoje' }
  return { rotulo: 'No prazo', classe: 'tag' }
}

// mês/dia do aniversário (ignora o ano)
export const mesDia = (nasc: string) => nasc.slice(5, 10)

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
  'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
