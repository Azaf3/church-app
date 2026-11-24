import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Sem as chaves o app mostra uma tela de aviso em vez de quebrar (ver App.tsx)
export const supabaseConfigurado = Boolean(url && key)

// Todas as tabelas do app moram no schema "igreja"
export const supabase = createClient(
  url || 'https://configure-o-env.supabase.co',
  key || 'sem-chave',
  { db: { schema: 'igreja' } },
)
