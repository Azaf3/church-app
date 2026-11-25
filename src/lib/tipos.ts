export type Papel = 'admin' | 'pastor' | 'tesoureiro' | 'obreiro' | 'secretario' | 'membro'
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
  escolaridade: string | null
  profissao: string | null
  tipo: 'membro' | 'visitante'
  etapa: Etapa | null
  responsavel_id: string | null
  proximo_passo: string | null
  prazo: string | null
  observacoes: string | null
  ativo: boolean
  criado_em: string
  primeira_visita?: string | null
  como_conheceu?: string | null
  convidado_por?: string | null
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
  tipo: 'dizimo' | 'oferta' | 'outro' | 'saida' | 'saldo_inicial'
  valor: number
  categoria: string | null
  descricao: string | null
  fundo: 'geral' | 'missoes' | 'sete'
  data: string
  pessoa_id: string | null
  nome: string | null
  forma: 'pix' | 'dinheiro' | 'cartao' | 'transferencia'
  campanha?: string | null
  contribuinte_id?: string | null
  fixa_id?: string | null
}

export interface DespesaFixa {
  id: string
  descricao: string
  categoria: string | null
  valor: number
  fundo: 'geral' | 'missoes' | 'sete'
  dia: number
  ativa: boolean
}

export interface Contribuinte {
  id: string
  codigo: string
  nome: string | null
  pessoa_id: string | null
}

export interface Contribuicao {
  id: string
  contribuinte_id: string
  ano: number
  mes: number
  tipo: 'dizimo' | 'oferta'
  valor: number
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

export interface Fechamento {
  id: string
  mes: string
  situacao: 'fechado' | 'reaberto'
  saldo_livro: number
  saldo_banco: number | null
  observacao: string | null
  fechado_por_nome: string | null
  fechado_em: string
  reaberto_por_nome: string | null
  reaberto_em: string | null
  motivo_reabertura: string | null
}

export interface Aviso {
  id: string
  tipo: 'evento' | 'aviso'
  titulo: string
  texto: string | null
  data: string | null
  hora: string | null
  local: string | null
  ate: string | null
}
