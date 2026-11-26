import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Compromisso, Pessoa } from '../lib/tipos'
import { dataBR, hojeISO, horaBR, inicioDia } from '../lib/util'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'

export const TIPOS = {
  visita: 'Visita', culto_no_lar: 'Culto no lar', aconselhamento: 'Aconselhamento', reuniao: 'Reunião', outro: 'Outro',
} as const

export default function Agenda() {
  const { igreja, userId, equipe, nomeDe } = useSessao()
  const [itens, setItens] = useState<Compromisso[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [so, setSo] = useState<'minha' | 'todas'>('todas')
  const [params] = useSearchParams()
  const [novo, setNovo] = useState(params.get('novo') === '1')
  const [pedidosVisita, setPedidosVisita] = useState(0)

  useEffect(() => {
    if (!igreja) return
    supabase.from('agenda').select('*').eq('igreja_id', igreja.id)
      .gte('inicio', inicioDia()).order('inicio').limit(100)
      .then(({ data }) => setItens(data ?? []))
    supabase.from('pessoas').select('id, nome, endereco').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
    supabase.from('pedidos').select('id').eq('igreja_id', igreja.id).neq('tipo', 'oracao').eq('status', 'aberto')
      .then(({ data }) => setPedidosVisita(data?.length ?? 0))
  }, [igreja?.id])

  const porDia = useMemo(() => {
    const grupos = new Map<string, Compromisso[]>()
    itens.filter((i) => so === 'todas' || i.responsavel_id === userId).forEach((i) => {
      const dia = new Date(i.inicio).toLocaleDateString('sv-SE') // AAAA-MM-DD no fuso local
      grupos.set(dia, [...(grupos.get(dia) ?? []), i])
    })
    return [...grupos.entries()]
  }, [itens, so, userId])

  async function alternar(c: Compromisso) {
    const { data } = await supabase.from('agenda').update({ feito: !c.feito }).eq('id', c.id).select().single()
    if (data) setItens(itens.map((x) => (x.id === c.id ? data : x)))
  }

  const rotuloDia = (d: string) => {
    const amanha = new Date(); amanha.setDate(amanha.getDate() + 1)
    if (d === hojeISO()) return 'Hoje'
    if (d === amanha.toLocaleDateString('sv-SE')) return 'Amanhã'
    const sem = new Date(d + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long' })
    return `${sem[0].toUpperCase()}${sem.slice(1)}, ${dataBR(d)}`
  }

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Agenda pastoral</h1>
        <button className="btn btn-primario" onClick={() => setNovo(true)}><Icone nome="mais_um" tam={18} /> Marcar</button>
      </div>

      {pedidosVisita > 0 && (
        <Link to="/pedidos" className="cartao destaque aviso-pedidos">
          <Icone nome="conversa" tam={20} />
          <span><strong>{pedidosVisita === 1 ? '1 pedido de visita ou conversa' : `${pedidosVisita} pedidos de visita ou conversa`}</strong> esperando a equipe marcar</span>
          <Icone nome="seta" tam={18} />
        </Link>
      )}

      <div className="seg">
        <button className={so === 'todas' ? 'ativo' : ''} onClick={() => setSo('todas')}>Da equipe</button>
        <button className={so === 'minha' ? 'ativo' : ''} onClick={() => setSo('minha')}>Só minha</button>
      </div>

      {porDia.length === 0 && <p className="vazio">Nada marcado pros próximos dias.</p>}
      {porDia.map(([dia, lista]) => (
        <section key={dia}>
          <h2 className="secao">{rotuloDia(dia)}</h2>
          <ul className="lista">
            {lista.map((c) => (
              <li key={c.id} className={'item' + (c.feito ? ' feito' : '')}>
                <button className={'caixa' + (c.feito ? ' marcada' : '')} onClick={() => alternar(c)} aria-label="Marcar como feito">
                  {c.feito && <Icone nome="check" tam={16} />}
                </button>
                <span className="hora">{horaBR(c.inicio)}</span>
                <div className="item-texto">
                  <strong>{c.titulo}</strong>
                  <span>
                    {TIPOS[c.tipo]} · {nomeDe(c.responsavel_id)}{c.local && ` · ${c.local}`}
                  </span>
                </div>
                {c.pessoa_id && <Link className="btn-icone" to={`/pessoas/${c.pessoa_id}`} aria-label="Ver pessoa"><Icone nome="seta" /></Link>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      <Folha titulo="Marcar compromisso" aberta={novo} fechar={() => setNovo(false)}>
        <FormCompromisso igrejaId={igreja!.id} userId={userId!} equipe={equipe} pessoas={pessoas}
          salvo={(c) => { setItens([...itens, c].sort((a, b) => a.inicio.localeCompare(b.inicio))); setNovo(false) }} />
      </Folha>
    </>
  )
}

export interface InicialCompromisso { tipo: Compromisso['tipo']; pessoaId: string | null; titulo: string; local: string | null }

export function FormCompromisso({ igrejaId, userId, equipe, pessoas, salvo, inicial }: {
  igrejaId: string; userId: string; equipe: { user_id: string; nome: string }[]
  pessoas: Pessoa[]; salvo: (c: Compromisso) => void; inicial?: InicialCompromisso
}) {
  const [tipo, setTipo] = useState<Compromisso['tipo']>(inicial?.tipo ?? 'visita')
  const [pessoaId, setPessoaId] = useState(inicial?.pessoaId ?? '')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [data, setData] = useState(hojeISO())
  const [hora, setHora] = useState('19:30')
  const [local, setLocal] = useState(inicial?.local ?? '')
  const [resp, setResp] = useState(userId)

  function escolherPessoa(id: string) {
    setPessoaId(id)
    const p = pessoas.find((x) => x.id === id)
    if (p) {
      setTitulo(`${TIPOS[tipo]} · ${p.nome}`)
      if (p.endereco && !local) setLocal(p.endereco)
    }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const inicio = new Date(`${data}T${hora}`).toISOString()
    const { data: c } = await supabase.from('agenda').insert({
      igreja_id: igrejaId, tipo, titulo: titulo || TIPOS[tipo], inicio,
      local: local || null, pessoa_id: pessoaId || null, responsavel_id: resp || null,
    }).select().single()
    if (c) salvo(c)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Compromisso['tipo'])}>
          {(Object.keys(TIPOS) as Compromisso['tipo'][]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
        </select>
      </label>
      <label>Com quem (opcional)
        <select value={pessoaId} onChange={(e) => escolherPessoa(e.target.value)}>
          <option value="">—</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <label>Título<input required value={titulo} onChange={(e) => setTitulo(e.target.value)} /></label>
      <div className="linha-2">
        <label>Dia<input type="date" required value={data} onChange={(e) => setData(e.target.value)} /></label>
        <label>Hora<input type="time" required value={hora} onChange={(e) => setHora(e.target.value)} /></label>
      </div>
      <label>Local<input value={local} onChange={(e) => setLocal(e.target.value)} /></label>
      <label>Quem vai
        <select value={resp} onChange={(e) => setResp(e.target.value)}>
          {equipe.map((m) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}
        </select>
      </label>
      <button className="btn btn-primario">Marcar</button>
    </form>
  )
}
