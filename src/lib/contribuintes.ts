import { supabase } from './supabase'
import { normalizar } from './importar'
import type { Contribuinte } from './tipos'

type PessoaRef = { id: string; nome: string }

// como o contribuinte aparece: nome da ficha ligada, nome dado ou o código da planilha
export const rotuloContribuinte = (c: Contribuinte, pessoas: PessoaRef[]) =>
  pessoas.find((p) => p.id === c.pessoa_id)?.nome ?? c.nome ?? c.codigo

// acha (ou cria) o contribuinte a partir do que foi digitado: código, nome ou nome de uma ficha
export async function resolverContribuinte(
  igrejaId: string, texto: string, contribuintes: Contribuinte[], pessoas: PessoaRef[],
): Promise<Contribuinte | null> {
  const t = normalizar(texto.trim())
  if (!t) return null
  const achado = contribuintes.find((c) => normalizar(rotuloContribuinte(c, pessoas)) === t || normalizar(c.codigo) === t || (c.nome && normalizar(c.nome) === t))
  if (achado) return achado
  const pessoa = pessoas.find((p) => normalizar(p.nome) === t)
  if (pessoa) {
    const ligado = contribuintes.find((c) => c.pessoa_id === pessoa.id)
    if (ligado) return ligado
  }
  const { data } = await supabase.from('contribuintes')
    .insert({ igreja_id: igrejaId, codigo: pessoa?.nome ?? texto.trim(), nome: null, pessoa_id: pessoa?.id ?? null })
    .select().single()
  return (data as Contribuinte) ?? null
}
