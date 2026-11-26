import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Compromisso, Pedido, Pessoa } from '../lib/tipos'
import { dataBR, podePedidos, primeiroNome, quandoBR } from '../lib/util'
import { FormCompromisso, TIPOS } from './Agenda'
import BotaoWhats from '../componentes/BotaoWhats'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'

type Aba = 'oracao' | 'visita'

// O que os membros pediram pelo app: oração e visita/conversa com o pastor.
// O banco só entrega o que cada um pode ver (oração "só pros pastores" vai só pra quem tem cargo de pastor).
export default function Pedidos() {
  const { igreja, userId, equipe, papel, nomeDe } = useSessao()
  const eu = equipe.find((e) => e.user_id === userId)
  const [aba, setAba] = useState<Aba>('oracao')
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [intercessores, setIntercessores] = useState<Record<string, number>>({})
  const [marcando, setMarcando] = useState<Pedido | null>(null)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    if (!igreja) return
    const [ped, pes, int] = await Promise.all([
      supabase.from('pedidos').select('*').eq('igreja_id', igreja.id).order('criado_em', { ascending: false }),
      supabase.from('pessoas').select('id, nome, telefone, endereco').eq('igreja_id', igreja.id).eq('ativo', true).order('nome'),
      supabase.rpc('intercessores', { p_igreja: igreja.id }),
    ])
    if (ped.error) setErro(/relation|schema cache|does not exist/.test(ped.error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não consegui carregar os pedidos.')
    setPedidos((ped.data as Pedido[]) ?? [])
    setPessoas((pes.data as Pessoa[]) ?? [])
    setIntercessores(Object.fromEntries(((int.data as { pedido_id: string; total: number }[]) ?? []).map((l) => [l.pedido_id, Number(l.total)])))
  }, [igreja?.id])
  useEffect(() => { carregar() }, [carregar])

  if (!podePedidos(papel)) return <p className="vazio">Os pedidos ficam com os pastores, obreiros e secretaria.</p>
  if (!pedidos) return <div className="spinner" />

  const pessoa = (x: Pedido) => pessoas.find((p) => p.id === x.pessoa_id)
  const oracoes = pedidos.filter((x) => x.tipo === 'oracao')
  const visitas = pedidos.filter((x) => x.tipo !== 'oracao')
  const novasOracoes = oracoes.filter((x) => x.status === 'aberto').length
  const novasVisitas = visitas.filter((x) => x.status === 'aberto').length

  async function mudar(x: Pedido, dados: Partial<Pedido>) {
    setErro('')
    const { data, error } = await supabase.from('pedidos').update(dados).eq('id', x.id).select()
    if (error || !data || (data as Pedido[]).length === 0) {
      setErro(x.tipo === 'oracao' ? 'Só quem tem cargo de pastor pode marcar isso.' : 'Não deu pra salvar.')
      return
    }
    carregar()
  }

  async function marcado(x: Pedido, c: Compromisso) {
    setMarcando(null)
    await mudar(x, { status: 'agendado', agenda_id: c.id, marcado_para: c.inicio, atendido_por: c.responsavel_id ? nomeDe(c.responsavel_id) : null })
  }

  const lista = (itens: Pedido[]) => (
    <ul className="lista plana pedidos-lista">
      {itens.map((x) => (
        <CartaoPedido key={x.id} x={x} pessoa={pessoa(x)} orandoJunto={intercessores[x.id] ?? 0} meuNome={eu?.nome ?? ''}
          mudar={(d) => mudar(x, d)} marcar={() => setMarcando(x)} />
      ))}
    </ul>
  )

  const secao = (titulo: string, itens: Pedido[], vazio?: string) => (itens.length > 0 || vazio) && (
    <section className="painel">
      <h2>{titulo}{itens.length > 0 && <small className="contagem">{itens.length}</small>}</h2>
      {itens.length === 0 ? <p className="vazio">{vazio}</p> : lista(itens)}
    </section>
  )

  const pessoaMarcando = marcando ? pessoa(marcando) : undefined
  return (
    <>
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Pedidos</h1>
          <p className="subtitulo">O que os membros pediram pelo app: oração, visita e conversa.</p>
        </div>
      </div>

      <div className="seg">
        <button className={aba === 'oracao' ? 'ativo' : ''} onClick={() => setAba('oracao')}>Oração{novasOracoes > 0 && ` (${novasOracoes})`}</button>
        <button className={aba === 'visita' ? 'ativo' : ''} onClick={() => setAba('visita')}>Visitas e conversas{novasVisitas > 0 && ` (${novasVisitas})`}</button>
      </div>
      {erro && <p className="erro">{erro}</p>}

      {aba === 'oracao' ? (
        <>
          {secao('Esperando oração', oracoes.filter((x) => x.status === 'aberto'), 'Nenhum pedido novo.')}
          {secao('Estamos orando', oracoes.filter((x) => x.status === 'orando'))}
          {oracoes.some((x) => x.status === 'respondido') && (
            <details className="painel">
              <summary><h2>Deus respondeu ({oracoes.filter((x) => x.status === 'respondido').length})</h2></summary>
              {lista(oracoes.filter((x) => x.status === 'respondido'))}
            </details>
          )}
          <p className="dica">Pedidos marcados como “só pros pastores” aparecem só pra quem tem cargo de pastor.</p>
        </>
      ) : (
        <>
          {secao('Esperando a gente combinar', visitas.filter((x) => x.status === 'aberto'), 'Nenhum pedido novo.')}
          {secao('Marcados', visitas.filter((x) => x.status === 'agendado'))}
          {visitas.some((x) => x.status === 'feito') && (
            <details className="painel">
              <summary><h2>Já aconteceram ({visitas.filter((x) => x.status === 'feito').length})</h2></summary>
              {lista(visitas.filter((x) => x.status === 'feito'))}
            </details>
          )}
        </>
      )}

      <Folha titulo="Marcar na agenda" aberta={!!marcando} fechar={() => setMarcando(null)}>
        {marcando && (
          <FormCompromisso igrejaId={igreja!.id} userId={userId!} equipe={equipe} pessoas={pessoas}
            inicial={{
              tipo: marcando.tipo === 'visita' ? 'visita' : 'aconselhamento',
              pessoaId: marcando.pessoa_id,
              titulo: `${TIPOS[marcando.tipo === 'visita' ? 'visita' : 'aconselhamento']} · ${marcando.nome ?? ''}`,
              local: marcando.tipo === 'visita' ? pessoaMarcando?.endereco ?? null : null,
            }}
            salvo={(c) => marcado(marcando, c)} />
        )}
      </Folha>
    </>
  )
}

function CartaoPedido({ x, pessoa, orandoJunto, meuNome, mudar, marcar }: {
  x: Pedido; pessoa?: Pessoa; orandoJunto: number; meuNome: string
  mudar: (d: Partial<Pedido>) => void; marcar: () => void
}) {
  const nome = x.nome ?? pessoa?.nome ?? 'Membro'
  const zap = x.tipo === 'oracao'
    ? `Oi ${primeiroNome(nome)}! Recebi seu pedido de oração. Estamos orando por você.`
    : `Oi ${primeiroNome(nome)}! Recebi seu pedido de ${x.tipo === 'visita' ? 'visita' : 'conversa'}. Vamos combinar o melhor dia?`
  const etiqueta = x.tipo === 'oracao' ? (x.publico ? 'Mural da igreja' : 'Só pros pastores') : x.tipo === 'visita' ? 'Visita' : 'Conversa'

  return (
    <li className="pedido">
      <div className="pedido-quem">
        <span>
          {x.pessoa_id ? <Link className="link-nome" to={`/pessoas/${x.pessoa_id}`}>{nome}</Link> : <strong>{nome}</strong>}
          <em className={'tag tag-linha' + (x.tipo === 'oracao' && !x.publico ? ' tag-privada' : '')}>{etiqueta}</em>
        </span>
        <small className="suave">{dataBR(x.criado_em)}</small>
      </div>
      {x.texto && <p className="pedido-texto">{x.texto}</p>}
      {x.quando && <p className="pedido-texto suave">Melhor horário: {x.quando}</p>}
      {x.status === 'respondido' && x.resposta && <p className="testemunho">“{x.resposta}”</p>}

      <div className="pedido-rodape">
        <span className="pedido-situacao">
          {x.status === 'orando' && <span className="etiqueta-status s-orando">{x.atendido_por ? `${primeiroNome(x.atendido_por)} está orando` : 'Orando'}</span>}
          {x.status === 'respondido' && <span className="etiqueta-status s-respondido">Deus respondeu</span>}
          {x.status === 'agendado' && x.marcado_para && <span className="etiqueta-status s-agendado">Marcado: {quandoBR(x.marcado_para)}{x.atendido_por && ` · ${x.atendido_por}`}</span>}
          {x.status === 'feito' && <span className="etiqueta-status">Aconteceu</span>}
          {x.tipo === 'oracao' && x.publico && orandoJunto > 0 && <small className="confirmados">{orandoJunto === 1 ? '1 pessoa orando junto' : `${orandoJunto} pessoas orando junto`}</small>}
        </span>
        <span className="acoes">
          {x.tipo === 'oracao' && x.status === 'aberto' && (
            <button className="btn btn-mini btn-primario" onClick={() => mudar({ status: 'orando', atendido_por: meuNome || null })}><Icone nome="coracao" tam={15} /> Estou orando</button>
          )}
          {x.tipo !== 'oracao' && x.status === 'aberto' && (
            <button className="btn btn-mini btn-primario" onClick={marcar}><Icone nome="calendario_mais" tam={15} /> Marcar na agenda</button>
          )}
          {x.tipo !== 'oracao' && x.status === 'agendado' && (
            <button className="btn btn-mini" onClick={() => mudar({ status: 'feito' })}><Icone nome="check" tam={15} /> Aconteceu</button>
          )}
          {x.tipo === 'oracao' && x.publico && x.status !== 'respondido' && (
            <button className="btn btn-mini" onClick={() => mudar({ publico: false })} title="O pedido continua com os pastores">Tirar do mural</button>
          )}
          {x.status !== 'respondido' && x.status !== 'feito' && <BotaoWhats telefone={pessoa?.telefone ?? null} texto={zap} />}
        </span>
      </div>
    </li>
  )
}
