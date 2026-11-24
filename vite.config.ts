import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// No modo demo troca o Supabase real por dados de exemplo em memória
// e gera um único index.html (pra mostrar sem servidor).
const supabaseDemo = (): Plugin => ({
  name: 'supabase-demo',
  enforce: 'pre',
  load(id) {
    if (id.replace(/\\/g, '/').endsWith('/src/lib/supabase.ts')) {
      return "export { supabase } from './supabase-demo'\nexport const supabaseConfigurado = true\nexport { criarClienteAvulso } from './supabase-demo'"
    }
  },
})

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : process.env.BASE_PATH || '/',
  plugins: [react(), ...(mode === 'demo' ? [supabaseDemo(), viteSingleFile()] : [])],
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
}))
