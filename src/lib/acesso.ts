import { criarClienteAvulso, supabase } from './supabase'
import type { Papel } from './tipos'

export interface NovoAcesso {
  igrejaId: string
  nome: string
  email: string
  senha: string
  papel: Papel
  pessoaId: string | null
  titulo?: string | null // cargo na igreja (Pastor, Diácono…)
  google: boolean // true = entra com a conta Google, sem senha
}

export type ResultadoAcesso =
  | { ok: true; jaTinhaConta: boolean; pendente: boolean }
  | { ok: false; erro: string }

// Cria o login de alguém da equipe:
// 1) registra o convite (com função e pessoa ligada)
// 2) cria a conta com e-mail e senha num cliente separado
// 3) já entra com essa conta e aceita o convite, pra pessoa aparecer na equipe na hora
export async function criarAcesso(a: NovoAcesso): Promise<ResultadoAcesso> {
  const email = a.email.trim().toLowerCase()
  if (!a.google && a.senha.length < 6) return { ok: false, erro: 'A senha precisa de pelo menos 6 caracteres.' }

  await supabase.from('convites').delete().eq('igreja_id', a.igrejaId).eq('email', email)
  const { error: eConvite } = await supabase.from('convites').insert({
    igreja_id: a.igrejaId, email, nome: a.nome.trim(), papel: a.papel, pessoa_id: a.pessoaId, titulo: a.titulo?.trim() || null,
  })
  if (eConvite) return { ok: false, erro: 'Não deu pra registrar o acesso. Só administrador e pastor podem criar logins.' }

  // com Google não cria senha: o acesso fica guardado e vale no primeiro login com essa conta
  if (a.google) return { ok: true, jaTinhaConta: false, pendente: true }

  const avulso = criarClienteAvulso()
  const { data, error } = await avulso.auth.signUp({ email, password: a.senha })

  if (error) {
    // e-mail que já tem conta: o convite fica guardado e vale no próximo login dela
    if (/already|registered|exists/i.test(error.message)) return { ok: true, jaTinhaConta: true, pendente: true }
    await supabase.from('convites').delete().eq('igreja_id', a.igrejaId).eq('email', email)
    return { ok: false, erro: traduzir(error.message) }
  }

  // conta nova criada pelo próprio admin: ele já coloca a pessoa na equipe
  // (não depende do e-mail ser comprovado, porque foi o admin quem criou)
  if (!data.user?.id) return { ok: true, jaTinhaConta: false, pendente: true }
  const { error: eEquipe } = await supabase.from('equipe').insert({
    igreja_id: a.igrejaId, user_id: data.user.id, nome: a.nome.trim(), papel: a.papel, pessoa_id: a.pessoaId, titulo: a.titulo?.trim() || null,
  })
  await supabase.from('convites').delete().eq('igreja_id', a.igrejaId).eq('email', email)
  if (data.session) await avulso.auth.signOut()
  if (eEquipe) return { ok: false, erro: 'A conta foi criada, mas não entrou na equipe. Tente de novo.' }
  return { ok: true, jaTinhaConta: false, pendente: !data.session }
}

function traduzir(msg: string) {
  if (/password/i.test(msg)) return 'Senha fraca. Use pelo menos 6 caracteres.'
  if (/email/i.test(msg) && /invalid/i.test(msg)) return 'E-mail inválido.'
  if (/rate|too many/i.test(msg)) return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  return 'Não deu pra criar o login: ' + msg
}

export function gerarSenha() {
  const letras = 'abcdefghjkmnpqrstuvwxyz'
  const s = Array.from({ length: 4 }, () => letras[Math.floor(Math.random() * letras.length)]).join('')
  return s + String(Math.floor(1000 + Math.random() * 9000))
}

export const linkDoApp = () => window.location.origin + import.meta.env.BASE_URL
