import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Aviso, Pedido, Pessoa } from '../lib/tipos'
import { dataBR, diaDaSemana, hojeISO, primeiroNome, proximoDia, quandoBR } from '../lib/util'
import { CULTOS } from '../config'
import { ESCOLARIDADES, FAIXAS_RENDA, cpfValido, formatarCpf, lerSensiveis, salvarSensiveis, type Sensiveis } from '../lib/sensiveis'
import LogoIgreja from '../componentes/LogoIgreja'
import Icone from '../componentes/Icone'
import FaixaDemo from '../componentes/FaixaDemo'
import FundoVivo from '../componentes/FundoVivo'

type Aba = 'inicio' | 'oracao' | 'pastor' | 'ficha'
const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: 'inicio', nome: 'Início', icone: 'igreja' },
  { id: 'oracao', nome: 'Oração', icone: 'coracao' },
  { id: 'pastor', nome: 'Pastor', icone: 'conversa' },
  { id: 'ficha', nome: 'Minha ficha', icone: 'documento' },
]

type Contagem = Record<string, number>
const paraMapa = (linhas: { total: number; [k: string]: unknown }[] | null, chave: string): Contagem =>
  Object.fromEntries((linhas ?? []).map((l) => [String(l[chave]), Number(l.total)]))

// O que um membro sem cargo vê: a vida da igreja (cultos, eventos, avisos), pedidos de oração,
// pedido de visita ou conversa com o pastor e a própria ficha.
export default function AreaMembro() {
  const { igreja, equipe, userId, sair } = useSessao()
  const eu = equipe.find((e) => e.user_id === userId)
  const [aba, setAba] = useState<Aba>('inicio')
  const [p, setP] = useState<Pessoa | null>(null)
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const [vou, setVou] = useState<Set<string>>(new Set())
  const [confirmados, setConfirmados] = useState<Contagem>({})
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [orando, setOrando] = useState<Set<string>>(new Set())
  const [intercessores, setIntercessores] = useState<Contagem>({})
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    if (!eu?.pessoa_id) return
    supabase.from('pessoas').select('*').eq('id', eu.pessoa_id).single().then(({ data }) => setP(data))
  }, [eu?.pessoa_id])

  const carregar = useCallback(async () => {
    if (!igreja || !userId) return
    const id = igreja.id
    const [av, minhasConf, conf, ped, minhasInt, int] = await Promise.all([
      supabase.from('avisos').select('*').eq('igreja_id', id),
      supabase.from('confirmacoes').select('aviso_id').eq('user_id', userId),
      supabase.rpc('confirmados', { p_igreja: id }),
      supabase.from('pedidos').select('*').eq('igreja_id', id).order('criado_em', { ascending: false }),
      supabase.from('intercessoes').select('pedido_id').eq('user_id', userId),
      supabase.rpc('intercessores', { p_igreja: id }),
    ])
    setAvisos((av.data as Aviso[]) ?? [])
    setVou(new Set(((minhasConf.data as { aviso_id: string }[]) ?? []).map((c) => c.aviso_id)))
    setConfirmados(paraMapa(conf.data, 'aviso_id'))
    setPedidos((ped.data as Pedido[]) ?? [])
    setOrando(new Set(((minhasInt.data as { pedido_id: string }[]) ?? []).map((c) => c.pedido_id)))
    setIntercessores(paraMapa(int.data, 'pedido_id'))
    setPronto(true)
  }, [igreja?.id, userId])
  useEffect(() => { carregar() }, [carregar])

  // "Vou participar": muda na hora e confirma no banco
  async function alternarVou(a: Aviso) {
    const indo = vou.has(a.id)
    const novo = new Set(vou)
    if (indo) novo.delete(a.id); else novo.add(a.id)
    setVou(novo)
    setConfirmados({ ...confirmados, [a.id]: Math.max(0, (confirmados[a.id] ?? 0) + (indo ? -1 : 1)) })
    const { error } = indo
      ? await supabase.from('confirmacoes').delete().eq('aviso_id', a.id).eq('user_id', userId!)
      : await supabase.from('confirmacoes').insert({ aviso_id: a.id, igreja_id: igreja!.id, user_id: userId })
    if (error) carregar()
  }

  async function alternarOrando(ped: Pedido) {
    const ja = orando.has(ped.id)
    const novo = new Set(orando)
    if (ja) novo.delete(ped.id); else novo.add(ped.id)
    setOrando(novo)
    setIntercessores({ ...intercessores, [ped.id]: Math.max(0, (intercessores[ped.id] ?? 0) + (ja ? -1 : 1)) })
    const { error } = ja
      ? await supabase.from('intercessoes').delete().eq('pedido_id', ped.id).eq('user_id', userId!)
      : await supabase.from('intercessoes').insert({ pedido_id: ped.id, igreja_id: igreja!.id, user_id: userId })
    if (error) carregar()
  }

  const meus = pedidos.filter((x) => x.user_id === userId)
  const nome = p ? primeiroNome(p.nome) : eu ? primeiroNome(eu.nome) : ''

  return (
    <div className="area-membro">
      <FundoVivo modo="app" />
      <FaixaDemo />
      <header className="topo">
        <LogoIgreja igreja={igreja} tam={28} />
        <strong>{igreja?.nome}</strong>
        <button className="btn-icone" onClick={sair} aria-label="Sair" style={{ marginLeft: 'auto' }}><Icone nome="sair" tam={19} /></button>
      </header>

      <nav className="abas abas-membro" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} className={'aba' + (aba === a.id ? ' ativa' : '')} onClick={() => { setAba(a.id); window.scrollTo(0, 0) }}>
            <Icone nome={a.icone} tam={21} />
            <span>{a.nome}</span>
          </button>
        ))}
      </nav>

      <main className="conteudo">
        <div className="pagina" key={aba}>
          {aba === 'inicio' && (
            <Inicio nome={nome} avisos={avisos} vou={vou} confirmados={confirmados} alternarVou={alternarVou}
              meus={meus} pronto={pronto} irPara={setAba} intercessores={intercessores} />
          )}
          {aba === 'oracao' && (
            <Oracao pedidos={pedidos} userId={userId!} igrejaId={igreja!.id} mudou={carregar}
              orando={orando} intercessores={intercessores} alternarOrando={alternarOrando} />
          )}
          {aba === 'pastor' && <FalarComPastor meus={meus.filter((x) => x.tipo !== 'oracao')} igrejaId={igreja!.id} userId={userId!} mudou={carregar} />}
          {aba === 'ficha' && <FichaDoMembro p={p} pessoaId={eu?.pessoa_id ?? null} igrejaId={igreja!.id} mudou={setP} />}
        </div>
      </main>
    </div>
  )
}

// ---------- Início ----------
function Inicio({ nome, avisos, vou, confirmados, alternarVou, meus, pronto, irPara, intercessores }: {
  nome: string; avisos: Aviso[]; vou: Set<string>; confirmados: Contagem; alternarVou: (a: Aviso) => void
  meus: Pedido[]; pronto: boolean; irPara: (a: Aba) => void; intercessores: Contagem
}) {
  const hoje = hojeISO()
  const eventos = avisos.filter((a) => a.tipo === 'evento' && (!a.data || a.data >= hoje))
    .sort((x, y) => (x.data ?? '9').localeCompare(y.data ?? '9'))
  const recados = avisos.filter((a) => a.tipo === 'aviso' && (!a.ate || a.ate >= hoje))
  const cultos = CULTOS.map((c) => ({ ...c, data: proximoDia(c.dia) })).sort((a, b) => a.data.localeCompare(b.data))
  const abertos = meus.filter((x) => x.status !== 'respondido' && x.status !== 'feito').slice(0, 3)
  const hojeExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <p className="data-hoje">{hojeExtenso[0].toUpperCase() + hojeExtenso.slice(1)}</p>
      <h1 className="titulo">Olá{nome ? `, ${nome}` : ''}!</h1>
      <p className="suave">Que bom ter você com a gente. Aqui você acompanha a igreja, pede oração e fala com o pastor.</p>

      <div className="atalhos-membro">
        <button className="atalho-membro" onClick={() => irPara('oracao')}>
          <span className="ic-redondo"><Icone nome="coracao" tam={20} /></span>
          <span><strong>Pedir oração</strong><small>Só pros pastores ou pra igreja orar junto</small></span>
        </button>
        <button className="atalho-membro" onClick={() => irPara('pastor')}>
          <span className="ic-redondo"><Icone nome="conversa" tam={20} /></span>
          <span><strong>Falar com o pastor</strong><small>Pedir uma visita ou uma conversa</small></span>
        </button>
      </div>

      {abertos.length > 0 && (
        <section className="painel">
          <h2><Icone nome="check" tam={18} /> Seus pedidos</h2>
          <ul className="lista plana">
            {abertos.map((x) => (
              <li key={x.id}>
                <button className="item" onClick={() => irPara(x.tipo === 'oracao' ? 'oracao' : 'pastor')}>
                  <div className="item-texto">
                    <strong>{x.tipo === 'oracao' ? 'Pedido de oração' : x.tipo === 'visita' ? 'Pedido de visita' : 'Pedido de conversa'}</strong>
                    <span>{situacaoDoPedido(x, intercessores[x.id] ?? 0)}</span>
                  </div>
                  <Icone nome="seta" tam={18} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel">
        <h2><Icone nome="igreja" tam={18} /> Cultos</h2>
        <ul className="lista plana">
          {cultos.map((c) => (
            <li key={c.titulo} className="item">
              <span className="hora">{c.data === hoje ? 'Hoje' : dataBR(c.data)}<small className="dia-sem">{diaDaSemana(c.data)}</small></span>
              <div className="item-texto"><strong>{c.titulo}</strong><span>{c.horario}</span></div>
            </li>
          ))}
        </ul>
      </section>

      <section className="painel">
        <h2><Icone nome="agenda" tam={18} /> Próximos eventos</h2>
        {!pronto && <div className="spinner" />}
        {pronto && eventos.length === 0 && <p className="vazio">Nenhum evento marcado por enquanto.</p>}
        <ul className="lista plana">
          {eventos.map((a) => {
            const indo = vou.has(a.id)
            const total = confirmados[a.id] ?? 0
            return (
              <li key={a.id} className="item evento-membro">
                <span className="hora">{a.data ? <>{dataBR(a.data)}<small className="dia-sem">{diaDaSemana(a.data)}</small></> : <Icone nome="agenda" tam={18} />}</span>
                <div className="item-texto">
                  <strong>{a.titulo}</strong>
                  <span>{[a.hora, a.local].filter(Boolean).join(' · ')}</span>
                  {a.texto && <span className="texto-evento">{a.texto}</span>}
                  {total > 0 && <small className="confirmados">{total === 1 ? '1 pessoa vai' : `${total} pessoas vão`}</small>}
                </div>
                <button className={'btn btn-mini ' + (indo ? 'btn-vou' : '')} onClick={() => alternarVou(a)} aria-pressed={indo}>
                  {indo ? <><Icone nome="check" tam={15} /> Vou</> : 'Vou participar'}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {recados.length > 0 && (
        <section className="painel">
          <h2><Icone nome="megafone" tam={18} /> Avisos</h2>
          <ul className="lista plana">
            {recados.map((a) => (
              <li key={a.id} className="item">
                <div className="item-texto"><strong>{a.titulo}</strong>{a.texto && <span>{a.texto}</span>}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function situacaoDoPedido(x: Pedido, orandoJunto: number) {
  if (x.tipo === 'oracao') {
    if (x.status === 'respondido') return 'Deus respondeu'
    const junto = x.publico && orandoJunto > 0 ? ` · ${orandoJunto === 1 ? '1 pessoa orando' : `${orandoJunto} pessoas orando`}` : ''
    if (x.status === 'orando') return `${x.atendido_por ? `Pr. ${primeiroNome(x.atendido_por)}` : 'O pastor'} está orando por você${junto}`
    return (x.publico ? 'No mural da igreja' : 'Enviado aos pastores') + junto
  }
  if (x.status === 'agendado' && x.marcado_para) return `Marcado: ${quandoBR(x.marcado_para)}${x.atendido_por ? ` · com ${x.atendido_por}` : ''}`
  if (x.status === 'feito') return 'Aconteceu'
  return 'Recebido · a equipe vai combinar com você'
}

// ---------- Oração ----------
function Oracao({ pedidos, userId, igrejaId, mudou, orando, intercessores, alternarOrando }: {
  pedidos: Pedido[]; userId: string; igrejaId: string; mudou: () => void
  orando: Set<string>; intercessores: Contagem; alternarOrando: (p: Pedido) => void
}) {
  const [texto, setTexto] = useState('')
  const [publico, setPublico] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [respondendo, setRespondendo] = useState<string | null>(null)
  const [testemunho, setTestemunho] = useState('')
  const [apagando, setApagando] = useState<string | null>(null)

  const oracoes = pedidos.filter((x) => x.tipo === 'oracao')
  const meus = oracoes.filter((x) => x.user_id === userId)
  const mural = oracoes.filter((x) => x.publico && x.user_id !== userId && x.status !== 'respondido')
  const respondidas = oracoes.filter((x) => x.publico && x.status === 'respondido').slice(0, 8)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (!texto.trim()) return
    setEnviando(true); setErro('')
    const { error } = await supabase.from('pedidos').insert({ igreja_id: igrejaId, user_id: userId, tipo: 'oracao', texto: texto.trim(), publico })
    setEnviando(false)
    if (error) { setErro('Não deu pra enviar. Tente de novo.'); return }
    setTexto(''); setEnviado(true); setTimeout(() => setEnviado(false), 4000)
    mudou()
  }

  async function responder(x: Pedido) {
    await supabase.from('pedidos').update({ status: 'respondido', resposta: testemunho.trim() || null }).eq('id', x.id)
    setRespondendo(null); setTestemunho(''); mudou()
  }

  async function apagar(x: Pedido) {
    await supabase.from('pedidos').delete().eq('id', x.id)
    setApagando(null); mudou()
  }

  return (
    <>
      <h1 className="titulo">Oração</h1>
      <p className="suave">Mande seu pedido. Você escolhe se vai só pros pastores ou pro mural, pra igreja orar junto.</p>

      <form className="painel form" onSubmit={enviar}>
        <label>Pelo que você quer que a gente ore?
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escreva do seu jeito" required />
        </label>
        <fieldset className="pergunta">
          <legend>Quem pode ver</legend>
          <div className="seg">
            <button type="button" className={!publico ? 'ativo' : ''} onClick={() => setPublico(false)}>Só os pastores</button>
            <button type="button" className={publico ? 'ativo' : ''} onClick={() => setPublico(true)}>Mural da igreja</button>
          </div>
        </fieldset>
        <p className="dica">{publico ? 'No mural, a igreja vê o pedido com o seu nome e pode orar junto.' : 'Só os pastores veem. Fica entre você e eles.'}</p>
        {erro && <p className="erro">{erro}</p>}
        {enviado && <p className="ok">Pedido enviado. Estamos orando com você!</p>}
        <button className="btn btn-primario" disabled={enviando || !texto.trim()}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
      </form>

      {meus.length > 0 && (
        <section className="painel">
          <h2>Meus pedidos</h2>
          <ul className="lista plana pedidos-lista">
            {meus.map((x) => (
              <li key={x.id} className="pedido">
                <p className="pedido-texto">{x.texto}</p>
                <div className="pedido-rodape">
                  <span className={'etiqueta-status s-' + x.status}>{situacaoDoPedido(x, intercessores[x.id] ?? 0)}</span>
                  <small className="suave">{dataBR(x.criado_em)}</small>
                </div>
                {x.status === 'respondido' && x.resposta && <p className="testemunho">“{x.resposta}”</p>}
                {respondendo === x.id ? (
                  <div className="form responder">
                    <label>Quer contar o que aconteceu?
                      <textarea rows={2} value={testemunho} onChange={(e) => setTestemunho(e.target.value)} placeholder={x.publico ? 'Opcional. Vai aparecer no mural pra igreja agradecer junto.' : 'Opcional. Os pastores vão ler.'} />
                    </label>
                    <div className="acoes">
                      <button className="btn btn-primario" onClick={() => responder(x)}>Deus respondeu!</button>
                      <button className="btn" onClick={() => setRespondendo(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : apagando === x.id ? (
                  <div className="acoes">
                    <span className="suave">Apagar esse pedido?</span>
                    <button className="btn btn-mini btn-perigo" onClick={() => apagar(x)}>Sim, apagar</button>
                    <button className="btn btn-mini" onClick={() => setApagando(null)}>Cancelar</button>
                  </div>
                ) : (
                  <div className="acoes">
                    {x.status !== 'respondido' && <button className="btn btn-mini" onClick={() => { setRespondendo(x.id); setTestemunho('') }}>Deus respondeu</button>}
                    <button className="btn btn-mini" onClick={() => setApagando(x.id)}>Apagar</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="painel">
        <h2><Icone nome="coracao" tam={18} /> Mural de oração da igreja</h2>
        {mural.length === 0 && <p className="vazio">Nenhum pedido no mural agora.</p>}
        <ul className="lista plana pedidos-lista">
          {mural.map((x) => {
            const ja = orando.has(x.id)
            const total = intercessores[x.id] ?? 0
            return (
              <li key={x.id} className="pedido">
                <div className="pedido-quem"><strong>{x.nome ? primeiroNome(x.nome) : 'Irmão(ã)'}</strong><small className="suave">{dataBR(x.criado_em)}</small></div>
                <p className="pedido-texto">{x.texto}</p>
                <div className="pedido-rodape">
                  <button className={'btn btn-mini ' + (ja ? 'btn-vou' : '')} onClick={() => alternarOrando(x)} aria-pressed={ja}>
                    <Icone nome="coracao" tam={15} /> {ja ? 'Estou orando' : 'Vou orar'}
                  </button>
                  {total > 0 && <small className="confirmados">{total === 1 ? '1 pessoa orando' : `${total} pessoas orando`}</small>}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {respondidas.length > 0 && (
        <section className="painel">
          <h2>Deus respondeu</h2>
          <ul className="lista plana pedidos-lista">
            {respondidas.map((x) => (
              <li key={x.id} className="pedido">
                <div className="pedido-quem"><strong>{x.nome ? primeiroNome(x.nome) : 'Irmão(ã)'}</strong><small className="suave">{dataBR(x.atualizado_em)}</small></div>
                <p className="pedido-texto">{x.texto}</p>
                {x.resposta && <p className="testemunho">“{x.resposta}”</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ---------- Falar com o pastor ----------
function FalarComPastor({ meus, igrejaId, userId, mudou }: { meus: Pedido[]; igrejaId: string; userId: string; mudou: () => void }) {
  const [tipo, setTipo] = useState<'visita' | 'conversa'>('visita')
  const [quando, setQuando] = useState('')
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')
  const [cancelando, setCancelando] = useState<string | null>(null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const { error } = await supabase.from('pedidos').insert({
      igreja_id: igrejaId, user_id: userId, tipo, quando: quando.trim() || null, texto: texto.trim() || null,
    })
    setEnviando(false)
    if (error) { setErro('Não deu pra enviar. Tente de novo.'); return }
    setQuando(''); setTexto(''); setEnviado(true); setTimeout(() => setEnviado(false), 4000)
    mudou()
  }

  async function cancelar(x: Pedido) {
    await supabase.from('pedidos').delete().eq('id', x.id)
    setCancelando(null); mudou()
  }

  return (
    <>
      <h1 className="titulo">Falar com o pastor</h1>
      <p className="suave">Peça uma visita ou uma conversa. A equipe pastoral recebe e combina o dia com você.</p>

      <form className="painel form" onSubmit={enviar}>
        <fieldset className="pergunta">
          <legend>Do que você precisa?</legend>
          <div className="seg">
            <button type="button" className={tipo === 'visita' ? 'ativo' : ''} onClick={() => setTipo('visita')}>Visita em casa</button>
            <button type="button" className={tipo === 'conversa' ? 'ativo' : ''} onClick={() => setTipo('conversa')}>Conversa ou aconselhamento</button>
          </div>
        </fieldset>
        <label>Melhor dia e horário
          <input value={quando} onChange={(e) => setQuando(e.target.value)} placeholder="Opcional. Ex.: sábado de manhã, depois das 18h" />
        </label>
        <label>Quer adiantar o assunto?
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Opcional. Dá pra conversar tudo pessoalmente." />
        </label>
        {erro && <p className="erro">{erro}</p>}
        {enviado && <p className="ok">Pedido enviado. A equipe vai combinar com você.</p>}
        <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar pedido'}</button>
      </form>

      {meus.length > 0 && (
        <section className="painel">
          <h2>Meus pedidos</h2>
          <ul className="lista plana pedidos-lista">
            {meus.map((x) => (
              <li key={x.id} className="pedido">
                <div className="pedido-quem"><strong>{x.tipo === 'visita' ? 'Visita' : 'Conversa'}</strong><small className="suave">pedido em {dataBR(x.criado_em)}</small></div>
                {(x.quando || x.texto) && <p className="pedido-texto">{[x.quando && `Melhor horário: ${x.quando}`, x.texto].filter(Boolean).join(' · ')}</p>}
                <div className="pedido-rodape">
                  <span className={'etiqueta-status s-' + x.status}>{situacaoDoPedido(x, 0)}</span>
                </div>
                {x.status === 'aberto' && (cancelando === x.id ? (
                  <div className="acoes">
                    <span className="suave">Cancelar esse pedido?</span>
                    <button className="btn btn-mini btn-perigo" onClick={() => cancelar(x)}>Sim, cancelar</button>
                    <button className="btn btn-mini" onClick={() => setCancelando(null)}>Não</button>
                  </div>
                ) : (
                  <div className="acoes"><button className="btn btn-mini" onClick={() => setCancelando(x.id)}>Cancelar pedido</button></div>
                ))}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

// ---------- Minha ficha ----------
function FichaDoMembro({ p, pessoaId, igrejaId, mudou }: { p: Pessoa | null; pessoaId: string | null; igrejaId: string; mudou: (p: Pessoa) => void }) {
  const [sens, setSens] = useState<Sensiveis | null>(null)
  const [editando, setEditando] = useState(false)
  useEffect(() => { if (pessoaId) lerSensiveis(pessoaId).then(setSens) }, [pessoaId])

  return (
    <>
      <h1 className="titulo">Minha ficha</h1>
      <p className="suave">Mantenha seus dados em dia pra igreja conseguir cuidar de você. Se você servir em algum ministério, o pastor libera as outras funções do app.</p>
      {!p ? <div className="spinner" /> : editando
        ? <EditarFicha p={p} sens={sens} igrejaId={igrejaId} pronto={(n, s) => { mudou(n); setSens(s); setEditando(false) }} cancelar={() => setEditando(false)} />
        : (
          <section className="painel">
            <dl className="dados">
              <div className="largo"><dt>Nome</dt><dd>{p.nome}</dd></div>
              <div><dt>Celular</dt><dd>{p.telefone || '—'}</dd></div>
              <div><dt>E-mail</dt><dd>{p.email || '—'}</dd></div>
              <div><dt>Nascimento</dt><dd>{p.nascimento ? dataBR(p.nascimento) : '—'}</dd></div>
              <div><dt>Cidade</dt><dd>{p.cidade || '—'}</dd></div>
              <div className="largo"><dt>Endereço</dt><dd>{p.endereco || '—'}</dd></div>
              <div><dt>Conversão</dt><dd>{p.data_conversao ? dataBR(p.data_conversao) : '—'}</dd></div>
              <div><dt>Batismo</dt><dd>{p.data_batismo ? dataBR(p.data_batismo) : '—'}</dd></div>
              <div><dt>Naturalidade</dt><dd>{p.naturalidade || '—'}</dd></div>
              <div><dt>Telefone residencial</dt><dd>{p.telefone_fixo || '—'}</dd></div>
              <div><dt>Escolaridade</dt><dd>{p.escolaridade || '—'}</dd></div>
              <div><dt>Profissão</dt><dd>{p.profissao || '—'}</dd></div>
              <div><dt>CPF</dt><dd>{sens?.cpf ? formatarCpf(sens.cpf) : '—'}</dd></div>
              <div><dt>Renda mensal</dt><dd>{sens?.renda_faixa || '—'}</dd></div>
              <div><dt>Onde congrega</dt><dd>{p.congregacao || '—'}</dd></div>
              <div><dt>Aluno da EBD</dt><dd>{p.aluno_ebd == null ? '—' : p.aluno_ebd ? 'Sim' : 'Não'}</dd></div>
            </dl>
            <div className="acoes" style={{ marginTop: 16 }}>
              <button className="btn btn-primario" onClick={() => setEditando(true)}>Atualizar meus dados</button>
            </div>
          </section>
        )}
    </>
  )
}

function EditarFicha({ p, sens, igrejaId, pronto, cancelar }: {
  p: Pessoa; sens: Sensiveis | null; igrejaId: string; pronto: (n: Pessoa, s: Sensiveis | null) => void; cancelar: () => void
}) {
  const [d, setD] = useState({
    telefone: p.telefone ?? '', nascimento: p.nascimento ?? '', cidade: p.cidade ?? '',
    endereco: p.endereco ?? '', naturalidade: p.naturalidade ?? '', data_conversao: p.data_conversao ?? '', data_batismo: p.data_batismo ?? '',
    telefone_fixo: p.telefone_fixo ?? '', congregacao: p.congregacao ?? '',
    escolaridade: p.escolaridade ?? '', profissao: p.profissao ?? '',
  })
  const [cpf, setCpf] = useState(sens?.cpf ? formatarCpf(sens.cpf) : '')
  const [renda, setRenda] = useState(sens?.renda_faixa ?? '')
  const [ebd, setEbd] = useState<boolean | null>(p.aluno_ebd)
  const [erro, setErro] = useState('')
  const campo = (k: keyof typeof d) => ({ value: d[k], onChange: (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value }) })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (cpf.trim() && !cpfValido(cpf)) { setErro('Esse CPF não é válido.'); return }
    const limpo = { ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v.trim() || null])), aluno_ebd: ebd }
    const { data, error } = await supabase.from('pessoas').update(limpo).eq('id', p.id).select().single()
    if (error || !data) { setErro('Não deu pra salvar.'); return }
    const s = { cpf: cpf.trim() || null, renda_faixa: renda || null }
    if (s.cpf || s.renda_faixa || sens) await salvarSensiveis(igrejaId, p.id, s)
    pronto(data, s)
  }

  return (
    <form className="painel form" onSubmit={enviar}>
      <h2>Atualizar meus dados</h2>
      <div className="linha-2">
        <label>Celular<input inputMode="tel" {...campo('telefone')} /></label>
        <label>Telefone residencial<input inputMode="tel" {...campo('telefone_fixo')} /></label>
      </div>
      <div className="linha-2">
        <label>Nascimento<input type="date" {...campo('nascimento')} /></label>
        <label>Cidade<input {...campo('cidade')} /></label>
      </div>
      <label>Endereço<input {...campo('endereco')} /></label>
      <label>Naturalidade<input {...campo('naturalidade')} /></label>
      <div className="linha-2">
        <label>Escolaridade
          <select {...campo('escolaridade')}>
            <option value="">—</option>
            {ESCOLARIDADES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>Profissão<input {...campo('profissao')} /></label>
      </div>
      <div className="linha-2">
        <label>CPF<input inputMode="numeric" value={cpf} onChange={(e) => setCpf(e.target.value)} /></label>
        <label>Renda mensal
          <select value={renda} onChange={(e) => setRenda(e.target.value)}>
            <option value="">—</option>
            {FAIXAS_RENDA.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <div className="linha-2">
        <label>Conversão<input type="date" {...campo('data_conversao')} /></label>
        <label>Batismo<input type="date" {...campo('data_batismo')} /></label>
      </div>
      <label>Onde congrega<input {...campo('congregacao')} /></label>
      <fieldset className="pergunta">
        <legend>Aluno da EBD?</legend>
        <div className="seg">
          <button type="button" className={ebd === true ? 'ativo' : ''} onClick={() => setEbd(true)}>Sim</button>
          <button type="button" className={ebd === false ? 'ativo' : ''} onClick={() => setEbd(false)}>Não</button>
        </div>
      </fieldset>
      {erro && <p className="erro">{erro}</p>}
      <div className="acoes">
        <button className="btn btn-primario">Salvar</button>
        <button type="button" className="btn" onClick={cancelar}>Cancelar</button>
      </div>
    </form>
  )
}
