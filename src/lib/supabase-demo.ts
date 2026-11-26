/* eslint-disable @typescript-eslint/no-explicit-any */
// Cliente falso do Supabase pra demonstração: dados em memória, sem servidor.
// Só é usado no build "demo" (npm run build:demo).

import logoDemo from '../assets/demo-logo.png'

type Linha = Record<string, any>
const uid = () => crypto.randomUUID()
const agora = () => new Date().toISOString()

function dia(offset: number) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.toLocaleDateString('sv-SE')
}
function quando(offset: number, hora: string) {
  return new Date(`${dia(offset)}T${hora}`).toISOString()
}
function niver(offsetDias: number, ano: number) {
  return `${ano}-${dia(offsetDias).slice(5)}`
}

// ---------- Dados de exemplo ----------
const IG = 'igreja-esperanca'
const EU = 'u-pastor', ANA = 'u-ana', CARLOS = 'u-carlos', PAULA = 'u-paula'

const nomes: [string, string, 'membro' | 'visitante', string | null, string | null, string | null, number | null][] = [
  // nome, telefone, tipo, etapa, responsável, nascimento(ano), offset do niver
  ['Fernanda Reis', '61991230001', 'visitante', 'novo', EU, '1994', null],
  ['Rafael Nunes', '61991230002', 'visitante', 'novo', ANA, '1988', null],
  ['Juliana Prado', '61991230003', 'visitante', 'novo', null, '2001', null],
  ['Bianca Lopes', '61991230004', 'visitante', 'relacionamento', EU, '1997', 2],
  ['Lucas Andrade', '61991230005', 'visitante', 'relacionamento', PAULA, '1990', null],
  ['Gustavo Lima', '61991230006', 'visitante', 'integracao', EU, '1985', null],
  ['Aline Castro', '61991230007', 'visitante', 'integracao', null, '1999', null],
  ['Eduardo Pires', '61991230008', 'membro', 'membresia', ANA, '1979', null],
  ['Larissa Campos', '61991230009', 'membro', 'membresia', EU, '1993', null],
  ['Natália Rocha', '61991230010', 'membro', 'pequeno_grupo', PAULA, '1991', null],
  ['Vinícius Moura', '61991230011', 'membro', 'pequeno_grupo', EU, '1987', null],
  ['Dona Cida Ferreira', '61991230012', 'membro', null, null, '1952', 0],
  ['Seu Antônio Ribeiro', '61991230013', 'membro', null, null, '1948', null],
  ['Márcia Oliveira', '61991230014', 'membro', null, null, '1975', 5],
  ['João Batista Souza', '61991230015', 'membro', null, null, '1982', null],
  ['Patrícia Gomes', '61991230016', 'membro', null, null, '1989', null],
  ['Roberto Alves', '61991230017', 'membro', null, null, '1970', null],
  ['Sandra Mendes', '61991230018', 'membro', null, null, '1966', null],
  ['Thiago Martins', '61991230019', 'membro', null, null, '1996', null],
  ['Kelly Cristina', '61991230020', 'membro', null, null, '1984', null],
]
const ETAPA_ACAO: Record<string, string> = {
  novo: 'Fazer o primeiro contato', relacionamento: 'Convidar pra um encontro',
  integracao: 'Conversar sobre membresia', membresia: 'Convidar pra um pequeno grupo',
  pequeno_grupo: 'Convidar pra servir',
}
const prazos = [0, 1, -2, 3, 4, -1, 6, 2, 0, 5, 7]

const pessoas: Linha[] = nomes.map(([nome, tel, tipo, etapa, resp, ano, off], i) => ({
  id: 'p' + i, igreja_id: IG, nome, telefone: tel, tipo, etapa, responsavel_id: resp,
  endereco: `Quadra ${10 + i}, Conjunto ${String.fromCharCode(65 + (i % 6))}, Gama - DF`,
  nascimento: off !== null ? niver(off, Number(ano)) : `${ano}-${String((i % 12) + 1).padStart(2, '0')}-${String((i * 3) % 27 + 1).padStart(2, '0')}`,
  proximo_passo: etapa ? ETAPA_ACAO[etapa] : null,
  prazo: etapa ? dia(prazos[i] ?? 3) : null,
  observacoes: i === 0 ? 'Veio com a prima no culto de domingo. Mora perto da igreja.' : null,
  ativo: true, criado_em: quando(-(30 - i), '19:00'),
}))

const cultos: Linha[] = [
  { id: 'c1', igreja_id: IG, data: dia(-9), titulo: 'Culto de domingo', criado_em: agora() },
  { id: 'c2', igreja_id: IG, data: dia(-2), titulo: 'Culto de domingo', criado_em: agora() },
]
const ausentes2 = new Set(['p12', 'p15', 'p18'])
const presencas: Linha[] = [
  ...pessoas.filter((p) => p.tipo === 'membro').map((p) => ({ culto_id: 'c1', pessoa_id: p.id, igreja_id: IG })),
  ...pessoas.filter((p) => !ausentes2.has(p.id)).map((p) => ({ culto_id: 'c2', pessoa_id: p.id, igreja_id: IG })),
]

const valores = [250, 180, 320, 90, 150, 400, 120, 75, 210, 60]
const lancamentos: Linha[] = [
  ...valores.map((v, i) => ({
    id: 'l' + i, igreja_id: IG, tipo: 'dizimo', valor: v, data: dia(-i * 2), pessoa_id: 'p' + (8 + i),
    nome: null, forma: i % 3 ? 'pix' : 'dinheiro', criado_por: CARLOS, criado_em: agora(),
  })),
  { id: 'lo1', igreja_id: IG, tipo: 'oferta', valor: 412.5, data: dia(-2), pessoa_id: null, nome: 'Oferta do culto', forma: 'dinheiro', criado_por: CARLOS, criado_em: agora() },
  { id: 'lo2', igreja_id: IG, tipo: 'oferta', valor: 388, data: dia(-9), pessoa_id: null, nome: 'Oferta do culto', forma: 'dinheiro', criado_por: CARLOS, criado_em: agora() },
  { id: 'lo3', igreja_id: IG, tipo: 'oferta', valor: 50, data: dia(-4), pessoa_id: null, nome: 'Missões', forma: 'pix', criado_por: CARLOS, criado_em: agora() },
  ...([
    [-3, 189.9, 'Neoenergia, água e Internet', 'Neoenergia'], [-5, 850, 'Aluguéis', 'Aluguel do salão'], [-8, 120, 'Outros', 'Produtos de limpeza'],
    [-12, 3200, 'Prebenda pastoral', 'Prebenda pastoral'], [-12, 256, 'FGTM', 'FGTM (8% prebenda pastoral)'], [-15, 95.5, 'Neoenergia, água e Internet', 'Internet'],
    [-18, 500, 'Oferta Missionária', 'Missões (missionário)'], [-20, 210, 'Outros', 'Conserto do ventilador'],
  ] as [number, number, string, string][]).map(([d, v, c, desc], i) => ({
    id: 's' + i, igreja_id: IG, tipo: 'saida', valor: v, data: dia(d), pessoa_id: null, nome: null, categoria: c, descricao: desc, forma: 'pix', criado_por: CARLOS, criado_em: agora(),
  })),
  // meses anteriores, pra ter o gráfico
  ...[1, 2, 3, 4, 5].flatMap((k) => [
    { id: `h${k}e`, igreja_id: IG, tipo: 'dizimo', valor: 2400 + k * 130, data: dia(-30 * k - 2), pessoa_id: null, nome: 'Dízimos do mês', forma: 'pix', criado_por: CARLOS, criado_em: agora() },
    { id: `h${k}o`, igreja_id: IG, tipo: 'oferta', valor: 700 + k * 40, data: dia(-30 * k - 3), pessoa_id: null, nome: 'Ofertas do mês', forma: 'dinheiro', criado_por: CARLOS, criado_em: agora() },
    { id: `h${k}s`, igreja_id: IG, tipo: 'saida', valor: 1900 + (k % 3) * 400, data: dia(-30 * k - 5), pessoa_id: null, nome: null, categoria: 'Aluguéis', descricao: 'Despesas do mês', forma: 'pix', criado_por: CARLOS, criado_em: agora() },
  ]),
]

// campanha de exemplo
lancamentos.push(
  { id: 'cp1', igreja_id: IG, tipo: 'oferta', valor: 1250, data: dia(-25), pessoa_id: null, nome: null, descricao: 'Oferta especial', campanha: 'Reforma do telhado', forma: 'pix', criado_por: CARLOS, criado_em: agora() },
  { id: 'cp2', igreja_id: IG, tipo: 'oferta', valor: 840, data: dia(-11), pessoa_id: null, nome: null, descricao: 'Bazar', campanha: 'Reforma do telhado', forma: 'dinheiro', criado_por: CARLOS, criado_em: agora() },
  { id: 'cp3', igreja_id: IG, tipo: 'saida', valor: 1600, data: dia(-6), pessoa_id: null, nome: null, categoria: 'Outros', descricao: 'Telhas e calhas', campanha: 'Reforma do telhado', forma: 'pix', criado_por: CARLOS, criado_em: agora() },
)

// relação de dizimistas/ofertantes (código anonimizado, como na planilha)
const ANO_DEMO = new Date().getFullYear(), MES_DEMO = new Date().getMonth() + 1
const contribuintes: Linha[] = ['703xxx68FF', '796xxx87GC', '339xxx91GF', '759xxx04RA', '702xxx58TS', '943xxx00MC', '458xxx34DC', '806xxx91IC', '014xxx25LH', '052xxx58NB']
  .map((codigo, i) => ({ id: 'ct' + i, igreja_id: IG, codigo, nome: null, pessoa_id: i === 0 ? 'p8' : null }))
const contribuicoes: Linha[] = contribuintes.flatMap((c, i) => Array.from({ length: MES_DEMO }, (_, k) => k + 1)
  .filter((m) => i < 5 || (i < 8 && (m + i) % 3 === 0))
  .flatMap((m) => [
    { id: `cb${i}-${m}`, igreja_id: IG, contribuinte_id: c.id, ano: ANO_DEMO, mes: m, tipo: 'dizimo', valor: [1000, 800, 400, 1500, 130, 500, 300, 100][i] ?? 100 },
    ...(i % 2 ? [{ id: `co${i}-${m}`, igreja_id: IG, contribuinte_id: c.id, ano: ANO_DEMO, mes: m, tipo: 'oferta', valor: 20 + i * 10 }] : []),
  ]))

const avisos: Linha[] = [
  { id: 'av1', igreja_id: IG, tipo: 'evento', titulo: 'Culto de Santa Ceia', data: dia(4), hora: '10h', local: 'Templo', texto: null, ate: null },
  { id: 'av2', igreja_id: IG, tipo: 'evento', titulo: 'Culto de oração', data: dia(2), hora: '19h', local: 'Templo', texto: null, ate: null },
  { id: 'av3', igreja_id: IG, tipo: 'aviso', titulo: 'Inscrições abertas pro retiro de jovens', data: null, hora: null, local: null, texto: 'Falar com a secretaria até dia 10.', ate: dia(20) },
]

const agenda: Linha[] = [
  { id: 'a1', igreja_id: IG, titulo: 'Visita · Dona Cida Ferreira', tipo: 'visita', inicio: quando(0, '15:00'), local: pessoas[11].endereco, pessoa_id: 'p11', responsavel_id: EU, feito: false },
  { id: 'a2', igreja_id: IG, titulo: 'Culto no lar · Família Pires', tipo: 'culto_no_lar', inicio: quando(0, '20:00'), local: pessoas[7].endereco, pessoa_id: 'p7', responsavel_id: EU, feito: false },
  { id: 'a3', igreja_id: IG, titulo: 'Aconselhamento · Gustavo Lima', tipo: 'aconselhamento', inicio: quando(1, '19:00'), local: 'Gabinete pastoral', pessoa_id: 'p5', responsavel_id: EU, feito: false },
  { id: 'a4', igreja_id: IG, titulo: 'Reunião de obreiros', tipo: 'reuniao', inicio: quando(2, '19:30'), local: 'Salão da igreja', pessoa_id: null, responsavel_id: ANA, feito: false },
  { id: 'a5', igreja_id: IG, titulo: 'Visita · Seu Antônio Ribeiro', tipo: 'visita', inicio: quando(3, '10:00'), local: pessoas[12].endereco, pessoa_id: 'p12', responsavel_id: PAULA, feito: false },
].map((a) => ({ ...a, criado_em: agora() }))

const contatos: Linha[] = [
  { id: 'k1', igreja_id: IG, pessoa_id: 'p0', autor_id: EU, autor_nome: 'Pr. Marcos Vieira', meio: 'presencial', nota: 'Recebi na porta no domingo. Pediu oração pelo emprego.', criado_em: quando(-2, '21:00') },
  { id: 'k2', igreja_id: IG, pessoa_id: 'p3', autor_id: EU, autor_nome: 'Pr. Marcos Vieira', meio: 'whatsapp', nota: 'Respondeu rápido, gostou do louvor. Vai trazer o marido.', criado_em: quando(-5, '10:00') },
  { id: 'k3', igreja_id: IG, pessoa_id: 'p5', autor_id: EU, autor_nome: 'Pr. Marcos Vieira', meio: 'ligacao', nota: 'Quer entender o batismo. Marquei conversa.', criado_em: quando(-3, '18:00') },
]

const db: Record<string, Linha[]> = {
  igrejas: [{ id: IG, nome: 'Igreja Cristã Esperança', cidade: 'Gama - DF', cor: '#2b6439', logo: logoDemo, criado_em: agora() }],
  equipe: [
    { igreja_id: IG, user_id: EU, nome: 'Pr. Marcos Vieira', papel: 'admin', pessoa_id: null },
    { igreja_id: IG, user_id: ANA, nome: 'Ana Souza', papel: 'obreiro', pessoa_id: null },
    { igreja_id: IG, user_id: CARLOS, nome: 'Carlos Henrique', papel: 'tesoureiro', pessoa_id: null },
    { igreja_id: IG, user_id: PAULA, nome: 'Paula Freitas', papel: 'obreiro', pessoa_id: null },
  ],
  convites: [{ id: 'cv1', igreja_id: IG, email: 'diacono.jose@email.com', nome: 'José Diácono', papel: 'obreiro' }],
  pessoas, contatos, cultos, presencas, lancamentos, agenda, contribuintes, contribuicoes, avisos,
}

// Versão particular: se a página trouxer membros reais (window.__SEED_PESSOAS__),
// usa só eles e começa o resto vazio, sem os dados de exemplo.
const seedReal = (globalThis as any).__SEED_PESSOAS__ as Linha[] | undefined
if (seedReal) {
  db.pessoas = seedReal
  db.equipe = [{ igreja_id: IG, user_id: EU, nome: 'Pastor', papel: 'admin', pessoa_id: null }]
  db.convites = []; db.contatos = []; db.cultos = []; db.presencas = []; db.lancamentos = []; db.agenda = []; db.contribuintes = []; db.contribuicoes = []
}

// "ver como": troca o cargo de quem está usando a demonstração
;(globalThis as any).__demoVerComo = (papel: string) => {
  const eu = db.equipe.find((e) => e.user_id === EU)
  if (eu) { eu.papel = papel; if (papel === 'membro' && !eu.pessoa_id) eu.pessoa_id = db.pessoas[1]?.id ?? null }
}

const PADROES: Record<string, Linha> = {
  pessoas: { ativo: true, tipo: 'visitante' },
  agenda: { feito: false },
  lancamentos: { forma: 'pix' },
  cultos: { titulo: 'Culto' },
  contatos: { meio: 'whatsapp' },
  despesas_fixas: { ativa: true, fundo: 'geral', dia: 5 },
}

// ---------- Query builder ----------
class Consulta {
  private filtros: ((l: Linha) => boolean)[] = []
  private ordens: { k: string; asc: boolean; nullsFirst: boolean }[] = []
  private limite = 0
  private umSo = false
  private op: 'select' | 'insert' | 'update' | 'delete' | null = null
  private dados: any = null
  private tabela: string
  constructor(tabela: string) { this.tabela = tabela }

  select() { if (!this.op) this.op = 'select'; return this }
  insert(d: any) { this.op = 'insert'; this.dados = d; return this }
  update(d: any) { this.op = 'update'; this.dados = d; return this }
  delete() { this.op = 'delete'; return this }
  eq(k: string, v: any) { this.filtros.push((l) => l[k] === v); return this }
  neq(k: string, v: any) { this.filtros.push((l) => l[k] !== v); return this }
  in(k: string, vs: any[]) { this.filtros.push((l) => vs.includes(l[k])); return this }
  gte(k: string, v: any) { this.filtros.push((l) => l[k] != null && l[k] >= v); return this }
  lte(k: string, v: any) { this.filtros.push((l) => l[k] != null && l[k] <= v); return this }
  not(k: string, _op: string, _v: any) { this.filtros.push((l) => l[k] != null); return this }
  order(k: string, o: { ascending?: boolean; nullsFirst?: boolean } = {}) {
    const asc = o.ascending ?? true
    this.ordens.push({ k, asc, nullsFirst: o.nullsFirst ?? !asc }); return this
  }
  limit(n: number) { this.limite = n; return this }
  private faixa: [number, number] | null = null
  range(de: number, ate: number) { this.faixa = [de, ate]; return this }
  single() { this.umSo = true; return this }

  private executar() {
    const t = (db[this.tabela] ??= [])
    const casa = (l: Linha) => this.filtros.every((f) => f(l))
    let res: Linha[] = []
    if (this.op === 'insert') {
      const lista = Array.isArray(this.dados) ? this.dados : [this.dados]
      res = lista.map((d: Linha) => ({ id: uid(), criado_em: agora(), ...PADROES[this.tabela], ...d }))
      t.push(...res)
    } else if (this.op === 'update') {
      res = t.filter(casa); res.forEach((l) => Object.assign(l, this.dados))
    } else if (this.op === 'delete') {
      res = t.filter(casa); db[this.tabela] = t.filter((l) => !casa(l))
    } else {
      res = t.filter(casa)
      // como a regra do banco real: só vê a igreja de que faz parte
      if (this.tabela === 'igrejas') res = res.filter((ig) => db.equipe.some((e) => e.igreja_id === ig.id && e.user_id === sessao?.user.id))
      for (const o of [...this.ordens].reverse()) {
        res = [...res].sort((a, b) => {
          const x = a[o.k], y = b[o.k]
          if (x == null && y == null) return 0
          if (x == null) return o.nullsFirst ? -1 : 1
          if (y == null) return o.nullsFirst ? 1 : -1
          const c = x < y ? -1 : x > y ? 1 : 0
          return o.asc ? c : -c
        })
      }
      if (this.limite) res = res.slice(0, this.limite)
      if (this.faixa) res = res.slice(this.faixa[0], this.faixa[1] + 1)
    }
    const copia = res.map((l) => ({ ...l }))
    return { data: this.umSo ? copia[0] ?? null : copia, error: null }
  }

  then(ok: (r: any) => any, erro?: (e: any) => any) {
    return new Promise((r) => setTimeout(r, 120)).then(() => this.executar()).then(ok, erro)
  }
}

// ---------- Convites (simula a função do banco) ----------
function aceitarConvitesDe(user: { id: string; email: string } | null) {
  if (!user) return 0
  const meus = db.convites.filter((c) => c.email === user.email.toLowerCase())
  meus.forEach((c) => db.equipe.push({ igreja_id: c.igreja_id, user_id: user.id, nome: c.nome, papel: c.papel, pessoa_id: c.pessoa_id ?? null }))
  db.convites = db.convites.filter((c) => !meus.includes(c))
  return meus.length
}

// ---------- Auth ----------
let sessao: any = { user: { id: EU, email: 'pastor@esperanca.com' } }
const ouvintes = new Set<(e: string, s: any) => void>()
const avisar = () => ouvintes.forEach((f) => f('SIGNED_IN', sessao))

export const supabase: any = {
  from: (t: string) => new Consulta(t),
  rpc: async (nome: string, args: any) => {
    if (nome === 'criar_igreja') {
      const id = uid()
      db.igrejas.push({ id, nome: args.p_nome, cidade: args.p_cidade, criado_em: agora() })
      db.equipe.push({ igreja_id: id, user_id: sessao?.user.id, nome: args.p_meu_nome, papel: 'admin' })
      return { data: id, error: null }
    }
    if (nome === 'aceitar_convites') return { data: aceitarConvitesDe(sessao?.user), error: null }
    if (nome === 'auto_cadastro') {
      const ja = db.equipe.find((e) => e.user_id === sessao?.user.id)
      if (ja?.pessoa_id) return { data: ja.igreja_id, error: null }
      const pid = uid()
      db.pessoas.push({ id: pid, igreja_id: IG, nome: args.p_nome, telefone: args.p_telefone, email: sessao?.user.email, nascimento: args.p_nascimento,
        endereco: args.p_endereco, cidade: args.p_cidade, naturalidade: args.p_naturalidade, tipo: args.p_tipo === 'visitante' ? 'visitante' : 'membro',
        ativo: true, criado_em: agora() })
      if (ja) ja.pessoa_id = pid
      else db.equipe.push({ igreja_id: IG, user_id: sessao?.user.id, nome: args.p_nome, papel: 'membro', pessoa_id: pid })
      return { data: IG, error: null }
    }
    return { data: 0, error: null }
  },
  auth: {
    getSession: async () => ({ data: { session: sessao } }),
    getUser: async () => ({ data: { user: sessao?.user ?? null }, error: null }),
    updateUser: async ({ data }: any) => { if (sessao) sessao.user.user_metadata = { ...(sessao.user.user_metadata ?? {}), ...data }; return { data: { user: sessao?.user }, error: null } },
    onAuthStateChange: (f: any) => { ouvintes.add(f); return { data: { subscription: { unsubscribe: () => ouvintes.delete(f) } } } },
    signInWithPassword: async () => { sessao = { user: { id: EU, email: 'pastor@esperanca.com' } }; avisar(); return { error: null } },
    signInWithOAuth: async () => { sessao = { user: { id: EU, email: 'pastor@esperanca.com' } }; avisar(); return { error: null } },
    signUp: async ({ email }: { email: string }) => { sessao = { user: { id: uid(), email } }; avisar(); return { error: null } },
    signOut: async () => { sessao = null; avisar(); return { error: null } },
  },
}

// Cliente descartável usado pra criar o login de outra pessoa
const contas = new Set<string>(['pastor@esperanca.com'])
export function criarClienteAvulso(): any {
  let minha: any = null
  return {
    auth: {
      signUp: async ({ email }: { email: string }) => {
        if (contas.has(email)) return { data: {}, error: { message: 'User already registered' } }
        contas.add(email)
        minha = { user: { id: uid(), email } }
        return { data: { session: minha, user: minha.user }, error: null }
      },
      signOut: async () => { minha = null; return { error: null } },
    },
    rpc: async () => ({ data: aceitarConvitesDe(minha?.user), error: null }),
  }
}
