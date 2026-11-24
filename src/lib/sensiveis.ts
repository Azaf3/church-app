// CPF e faixa de renda ficam numa tabela à parte (igreja.dados_sensiveis):
// só administrador, tesoureiro e a própria pessoa conseguem ler ou gravar.
import { supabase } from './supabase'
import type { Papel } from './tipos'

export const ESCOLARIDADES = [
  'Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo',
  'Técnico', 'Superior incompleto', 'Superior completo', 'Pós-graduação', 'Mestrado ou doutorado',
]

export const FAIXAS_RENDA = [
  'Sem renda', 'Até 1 salário mínimo', 'De 1 a 2 salários mínimos', 'De 2 a 3 salários mínimos',
  'De 3 a 5 salários mínimos', 'De 5 a 10 salários mínimos', 'Acima de 10 salários mínimos', 'Prefiro não informar',
]

export const podeVerSensiveis = (p?: Papel) => p === 'admin' || p === 'tesoureiro'

export const soDigitos = (s: string) => s.replace(/\D/g, '')

export function cpfValido(cpf: string) {
  const d = soDigitos(cpf)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (n: number) => {
    let s = 0
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}

export const formatarCpf = (cpf: string | null) => {
  const d = soDigitos(cpf ?? '')
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : cpf ?? ''
}

export interface Sensiveis { cpf: string | null; renda_faixa: string | null }

export async function lerSensiveis(pessoaId: string): Promise<Sensiveis | null> {
  const { data } = await supabase.from('dados_sensiveis').select('cpf, renda_faixa').eq('pessoa_id', pessoaId).limit(1)
  return (data?.[0] as Sensiveis) ?? null
}

export async function salvarSensiveis(igrejaId: string, pessoaId: string, s: Sensiveis) {
  const reg = { igreja_id: igrejaId, pessoa_id: pessoaId, cpf: s.cpf ? soDigitos(s.cpf) : null, renda_faixa: s.renda_faixa || null, atualizado_em: new Date().toISOString() }
  const { data } = await supabase.from('dados_sensiveis').select('pessoa_id').eq('pessoa_id', pessoaId).limit(1)
  const q = data?.length
    ? supabase.from('dados_sensiveis').update(reg).eq('pessoa_id', pessoaId)
    : supabase.from('dados_sensiveis').insert(reg)
  const { error } = await q
  return !error
}
