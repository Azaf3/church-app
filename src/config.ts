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

// false = o link não cria igreja nova: quem se cadastra entra como MEMBRO desta igreja
// (a que tem "cadastro_aberto" no banco) e a equipe dá os cargos depois.
// true = cada igreja nova se cadastra sozinha (pra vender como produto).
export const NOVAS_IGREJAS = false

// cultos fixos da igreja: dia da semana (0 = domingo ... 6 = sábado)
export const CULTOS = [
  { titulo: 'Culto de domingo', dia: 0, horario: '10h às 12h' },
  { titulo: 'Culto de oração', dia: 5, horario: 'sexta, 19h às 21h' },
]
