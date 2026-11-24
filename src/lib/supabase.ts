import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env')
}

// Todas as tabelas do app moram no schema "igreja"
export const supabase = createClient(url, key, { db: { schema: 'igreja' } })
