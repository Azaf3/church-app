import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Culto, Pessoa } from '../lib/tipos'
import { dataBR, hojeISO, primeiroNome } from '../lib/util'
import BotaoWhats from '../componentes/BotaoWhats'
import Icone from '../componentes/Icone'
import Folha from '../componentes/Folha'
import { CULTOS } from '../config'

// última data (hoje ou antes) que cai no dia da semana do culto
const ultimoDia = (dia: number) => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - dia + 7) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

export default function Presenca() {
  const { igreja } = useSessao()
  const [cultos, setCultos] = useState<Culto[]>([])
  const [cultoId, setCultoId] = useState<string>('')
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [vieram, setVieram] = useState<Set<string>>(new Set())
  const [aba, setAba] = useState<'chamada' | 'faltaram'>('chamada')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    if (!igreja) return
    supabase.from('cultos').select('*').eq('igreja_id', igreja.id).order('data', { ascending: false }).limit(20)
      .then(({ data }) => { setCultos(data ?? []); if (data?.[0]) setCultoId(data[0].id) })
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas(data ?? []))
  }, [igreja?.id])

  useEffect(() => {
    if (!cultoId) { setVieram(new Set()); return }
    supabase.from('presencas').select('pessoa_id').eq('culto_id', cultoId)
      .then(({ data }) => setVieram(new Set((data ?? []).map((x) => x.pessoa_id))))
  }, [cultoId])

  const [criando, setCriando] = useState(false)
  const [novaData, setNovaData] = useState(hojeISO())
  const [novoTitulo, setNovoTitulo] = useState('Culto especial')
  const [outroDia, setOutroDia] = useState(false)

  // abre a chamada do culto; se ainda não existe, cria
  async function abrirCulto(titulo: string, data: string) {
    const ja = cultos.find((c) => c.data === data && c.titulo === titulo)
    if (ja) { setCultoId(ja.id); setAba('chamada'); setCriando(false); return }
    const { data: c } = await supabase.from('cultos').insert({ igreja_id: igreja!.id, data, titulo: titulo || 'Culto' }).select().single()
    if (c) { setCultos([c, ...cultos].sort((a, b) => b.data.localeCompare(a.data))); setCultoId(c.id); setAba('chamada'); setCriando(false); setOutroDia(false) }
  }
  async function criarCulto(e: FormEvent) {
    e.preventDefault()
    await abrirCulto(novoTitulo, novaData)
  }

  async function marcar(p: Pessoa) {
    const novo = new Set(vieram)
    if (vieram.has(p.id)) {
      novo.delete(p.id); setVieram(novo)
      await supabase.from('presencas').delete().eq('culto_id', cultoId).eq('pessoa_id', p.id)
    } else {
      novo.add(p.id); setVieram(novo)
      await supabase.from('presencas').insert({ culto_id: cultoId, pessoa_id: p.id, igreja_id: igreja!.id })
    }
  }

  const membros = pessoas.filter((p) => p.tipo === 'membro')
  const faltaram = membros.filter((p) => !vieram.has(p.id))
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return pessoas.filter((p) => !t || p.nome.toLowerCase().includes(t))
  }, [pessoas, busca])
  const culto = cultos.find((c) => c.id === cultoId)

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Presença</h1>
        <button className="btn btn-primario" onClick={() => setCriando(true)}><Icone nome="mais_um" tam={18} /> Fazer chamada</button>
      </div>

      {cultos.length === 0 ? (
        <p className="vazio">Crie o primeiro culto pra fazer a chamada.</p>
      ) : (
        <>
          <select className="busca" value={cultoId} onChange={(e) => setCultoId(e.target.value)}>
            {cultos.map((c) => <option key={c.id} value={c.id}>{c.titulo} · {dataBR(c.data)}</option>)}
          </select>

          <div className="placar">
            <div><strong>{vieram.size}</strong><span>presentes</span></div>
            <div><strong>{faltaram.length}</strong><span>membros faltaram</span></div>
          </div>

          <div className="seg">
            <button className={aba === 'chamada' ? 'ativo' : ''} onClick={() => setAba('chamada')}>Chamada</button>
            <button className={aba === 'faltaram' ? 'ativo' : ''} onClick={() => setAba('faltaram')}>
              Faltaram <small>{faltaram.length}</small>
            </button>
          </div>

          {aba === 'chamada' ? (
            <>
              <input className="busca" type="search" placeholder="Buscar nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
              <ul className="lista">
                {lista.map((p) => (
                  <li key={p.id}>
                    <button className={'item chamada' + (vieram.has(p.id) ? ' presente' : '')} onClick={() => marcar(p)}>
                      <span className="caixa">{vieram.has(p.id) && <Icone nome="check" tam={16} />}</span>
                      <div className="item-texto"><strong>{p.nome}</strong><span>{p.tipo === 'membro' ? 'Membro' : 'Visitante'}</span></div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <ul className="lista">
              {faltaram.length === 0 && <p className="vazio">Todos os membros vieram. Glória!</p>}
              {faltaram.map((p) => (
                <li key={p.id} className="item">
                  <div className="item-texto"><strong>{p.nome}</strong><span>{p.telefone}</span></div>
                  <BotaoWhats telefone={p.telefone} rotulo="Mensagem"
                    texto={`Oi ${primeiroNome(p.nome)}! Sentimos sua falta no ${culto?.titulo.toLowerCase() ?? 'culto'}. Está tudo bem?`} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Folha titulo="Qual culto?" aberta={criando} fechar={() => setCriando(false)}>
        <div className="escolha-culto">
          {CULTOS.map((c) => {
            const data = ultimoDia(c.dia)
            const ja = cultos.find((x) => x.data === data && x.titulo === c.titulo)
            return (
              <button key={c.titulo} className="opcao-culto" onClick={() => abrirCulto(c.titulo, data)}>
                <strong>{c.titulo}</strong>
                <span>{dataBR(data)}{data === hojeISO() ? ' (hoje)' : ''} · {c.horario}</span>
                <em>{ja ? 'Abrir a chamada' : 'Fazer a chamada'}</em>
              </button>
            )
          })}
        </div>
        {!outroDia
          ? <button className="link" onClick={() => setOutroDia(true)}>Outro dia (evento especial)</button>
          : (
            <form className="form" onSubmit={criarCulto}>
              <label>Nome<input value={novoTitulo} onChange={(e) => setNovoTitulo(e.target.value)} /></label>
              <label>Data<input type="date" required value={novaData} onChange={(e) => setNovaData(e.target.value)} /></label>
              <button className="btn btn-primario">Criar e fazer chamada</button>
            </form>
          )}
      </Folha>
    </>
  )
}
