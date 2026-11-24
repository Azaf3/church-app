import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { COR_PADRAO, aplicarTema } from './tema'
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
  recarregarEquipe: () => Promise<void>
  sair: () => Promise<void>
}

const Ctx = createContext<Sessao | null>(null)
const CHAVE = 'igreja-atual'

export function SessaoProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [authPronto, setAuthPronto] = useState(false)
  const [carregando, setCarregando] = useState(true)
  const [carregadoPara, setCarregadoPara] = useState<string | null | undefined>(undefined)
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
    if (!userId) { setIgrejas([]); setCarregando(false); setCarregadoPara(null); return }
    await supabase.rpc('aceitar_convites')
    const { data } = await supabase.from('igrejas').select('*').order('nome')
    setIgrejas(data ?? [])
    setCarregando(false)
    setCarregadoPara(userId)
  }, [userId])

  useEffect(() => { if (authPronto) recarregar() }, [authPronto, recarregar])

  const igreja = igrejas.find((i) => i.id === igrejaId) ?? igrejas[0] ?? null

  const recarregarEquipe = useCallback(async () => {
    if (!igreja) { setEquipe([]); return }
    const { data } = await supabase.from('equipe').select('*').eq('igreja_id', igreja.id).order('nome')
    setEquipe((data as MembroEquipe[]) ?? [])
  }, [igreja?.id])

  useEffect(() => {
    if (igreja) { try { localStorage.setItem(CHAVE, igreja.id) } catch { /* sem storage */ } }
    recarregarEquipe()
  }, [recarregarEquipe])

  useEffect(() => { aplicarTema(igreja?.cor ?? COR_PADRAO) }, [igreja?.cor])

  // aba do navegador com o nome e o logo da igreja
  useEffect(() => {
    if (!igreja) return
    document.title = igreja.nome
    const link = document.querySelector<HTMLLinkElement>('link[rel=icon]')
    if (link && igreja.logo) { link.href = igreja.logo; link.type = igreja.logo.slice(5, igreja.logo.indexOf(';')) }
  }, [igreja?.nome, igreja?.logo])

  const papel = equipe.find((e) => e.user_id === userId)?.papel
  const nomeDe = (id: string | null) => equipe.find((e) => e.user_id === id)?.nome ?? '—'

  const valor: Sessao = {
    carregando: !authPronto || carregando || carregadoPara !== (userId ?? null),
    session, userId, igrejas, igreja, papel, equipe, nomeDe,
    trocarIgreja: setIgrejaId,
    recarregar,
    recarregarEquipe,
    sair: async () => { await supabase.auth.signOut() },
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export function useSessao() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSessao fora do provider')
  return s
}
