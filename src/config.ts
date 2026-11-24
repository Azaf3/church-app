// Chaves do Supabase. A chave "publishable" (antiga anon) é pública por natureza:
// vai pro navegador de qualquer jeito; quem protege os dados são as regras RLS do banco.
// O .env (local) ou as variáveis do GitHub, se existirem, têm prioridade.
export const SUPABASE_URL = 'https://ookhqypqbtaasmspiiqq.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_CoDu554JJInCT_lBU_Ngag_mYKSTEkt'

// Identidade desta instalação (tela de login, aba do navegador e atalho no celular).
// Depois de entrar, o app usa o nome e o logo salvos em Configurações.
export const APP_NOME = 'Igreja Cristã Esperança'
export const APP_SIGLA = 'ICESP'
export const APP_ICONE = 'logos/icesp.png'
export const APP_COR = '#2b6439'

// false = só entra quem a equipe liberou (Equipe → Criar login). Sem "Criar conta" e
// sem cadastrar igreja nova. true = aberto, pra vender como produto (cada igreja se cadastra).
export const CADASTRO_ABERTO = false
