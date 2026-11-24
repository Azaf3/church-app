export type Papel = 'admin' | 'pastor' | 'tesoureiro' | 'obreiro' | 'membro'
export type Etapa = 'novo' | 'relacionamento' | 'integracao' | 'membresia' | 'pequeno_grupo'

export interface Igreja { id: string; nome: string; cidade: string | null; cor: string; logo: string | null }

export interface MembroEquipe {
  igreja_id: string
  user_id: string
  nome: string
  papel: Papel
  pessoa_id: string | null
}

export interface Pessoa {
  id: string
  igreja_id: string
  nome: string
  telefone: string | null
  endereco: string | null
  nascimento: string | null
  email: string | null
  telefone_fixo: string | null
  naturalidade: string | null
  cidade: string | null
  data_conversao: string | null
  data_batismo: string | null
  aluno_ebd: boolean | null
  congregacao: string | null
  tipo: 'membro' | 'visitante'
  etapa: Etapa | null
  responsavel_id: string | null
  proximo_passo: string | null
  prazo: string | null
  observacoes: string | null
  ativo: boolean
  criado_em: string
}

export interface Contato {
  id: string
  pessoa_id: string
  autor_nome: string | null
  meio: 'whatsapp' | 'ligacao' | 'visita' | 'presencial'
  nota: string | null
  criado_em: string
}

export interface Culto { id: string; data: string; titulo: string }

export interface Lancamento {
  id: string
  tipo: 'dizimo' | 'oferta' | 'outro'
  valor: number
  data: string
  pessoa_id: string | null
  nome: string | null
  forma: 'pix' | 'dinheiro' | 'cartao' | 'transferencia'
}

export interface Compromisso {
  id: string
  titulo: string
  tipo: 'visita' | 'culto_no_lar' | 'aconselhamento' | 'reuniao' | 'outro'
  inicio: string
  local: string | null
  pessoa_id: string | null
  responsavel_id: string | null
  feito: boolean
}
