import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Igreja, MembroEquipe, Papel } from './tipos'

interface Sessao {
  carregando: boolean
  session: Session | null
  userId: string | null
  igrejas: Igreja[]
  igreja: Igreja | null
  papel: Papel | undefined
  equipe: MembroEquipe[]
  nomeDe: (userId: string | null) => string
  trocarIgreja: (id: string) => void
  recarregar: () => Promise<void>
  sair: () => Promise<void>
}

const Ctx = createContext<Sessao | null>(null)
const CHAVE = 'igreja-atual'

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authPronto, setAuthPronto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [igrejas, setIgrejas] = useState<Igreja[]>([])
  const [igrejaId, setIgrejaId] = useState<string | null>(() => {
    try { return localStorage.getItem(CHAVE) } catch { return null }
  })
  const [equipe, setEquipe] = useState<MembroEquipe[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthPronto(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id ?? null

  const recarregar = useCallback(async () => {
    if (!userId) { setIgrejas([]); setCarregando(false); return }
    setCarregando(true)
    await supabase.rpc('aceitar_convites')
    const { data } = await supabase.from('igrejas').select('id, nome, cidade').order('nome')
    setIgrejas(data ?? [])
    setCarregando(false)
  }, [userId])

  useEffect(() => { if (authPronto) recarregar() }, [authPronto, recarregar])

  const igreja = igrejas.find((i) => i.id === igrejaId) ?? igrejas[0] ?? null

  useEffect(() => {
    if (!igreja) { setEquipe([]); return }
    try { localStorage.setItem(CHAVE, igreja.id) } catch { /* sem storage */ }
    supabase.from('equipe').select('igreja_id, user_id, nome, papel')
      .eq('igreja_id', igreja.id).order('nome')
      .then(({ data }) => setEquipe((data as MembroEquipe[]) ?? []))
  }, [igreja?.id])

  const papel = equipe.find((e) => e.user_id === userId)?.papel
  const nomeDe = (id: string | null) => equipe.find((e) => e.user_id === id)?.nome ?? '—'

  const valor: Sessao = {
    carregando: !authPronto || carregando,
    session, userId, igrejas, igreja, papel, equipe, nomeDe,
    trocarIgreja: setIgrejaId,
    recarregar,
    sair: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSessao() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSessao fora do provider')
  return s
}
