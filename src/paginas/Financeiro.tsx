import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buscarTudo } from '../lib/buscarTudo'
import { useSessao } from '../lib/sessao'
import type { Contribuinte, Fechamento, Lancamento, Pessoa } from '../lib/tipos'
import { MESES, dataBR, dinheiro, hojeISO, podeFinanceiro } from '../lib/util'
import { ENTRADAS, ORIGENS, origemDe, type Origem, FORMAS, FUNDOS, NOMES_CATEGORIAS, OUTRAS, adivinharCategoria, ehEntrada, ehSaida, ehSaldoInicial, mesCurto, mesesAte, somar, type Fundo } from '../lib/tesouraria'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'
import TesAbas from '../componentes/TesAbas'
import DespesasFixas from '../componentes/DespesasFixas'
import { resolverContribuinte, rotuloContribuinte } from '../lib/contribuintes'

// fechamento do mês: pronto, mas desligado até o tesoureiro pedir
const FECHAMENTO_ATIVO = false

type Filtro = 'tudo' | 'entradas' | 'saidas'
type Visao = 'tudo' | Fundo

// saldo separado por caixa (Tudo / Caixa geral / Missões / SETE): o tesoureiro pediu pra esconder
const MOSTRAR_CAIXAS = false

export default function Financeiro() {
  const { igreja, papel, userId, equipe } = useSessao()
  const [params] = useSearchParams()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [todos, setTodos] = useState<Lancamento[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [contribuintes, setContribuintes] = useState<Contribuinte[]>([])
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [visao, setVisao] = useState<Visao>('tudo')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState<null | 'entrada' | 'saida'>(params.get('novo') === '1' ? 'entrada' : null)
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const [fixasAberta, setFixasAberta] = useState(false)
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [fechando, setFechando] = useState<'fechar' | 'reabrir' | null>(null)

  function carregar() {
    if (!igreja || !podeFinanceiro(papel)) return
    buscarTudo<Lancamento>((de, ate) => supabase.from('lancamentos').select('*').eq('igreja_id', igreja.id).order('data', { ascending: false }).order('id').range(de, ate))
      .then(({ data }) => setTodos((data as Lancamento[]) ?? []))
  }
  useEffect(carregar, [igreja?.id, papel])
  function carregarFechamentos() {
    if (!igreja || !podeFinanceiro(papel)) return
    supabase.from('fechamentos').select('*').eq('igreja_id', igreja.id).then(({ data }) => setFechamentos((data as Fechamento[]) ?? []))
  }
  useEffect(carregarFechamentos, [igreja?.id, papel])

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
    buscarTudo<Contribuinte>((de, ate) => supabase.from('contribuintes').select('*').eq('igreja_id', igreja.id).order('codigo').order('id').range(de, ate))
      .then(({ data }) => setContribuintes(data ?? []))
  }, [igreja?.id])

  // saldo de cada caixa até o fim do mês escolhido
  const saldos = useMemo(() => {
    const ate = (todos ?? []).filter((l) => l.data.slice(0, 7) <= mes)
    const de = (f?: Fundo) => {
      const x = f ? ate.filter((l) => (l.fundo ?? 'geral') === f) : ate
      return somar(x.filter((l) => !ehSaida(l))) - somar(x.filter(ehSaida))
    }
    return { tudo: de(), geral: de('geral'), missoes: de('missoes'), sete: de('sete') } as Record<Visao, number>
  }, [todos, mes])

  const contas = useMemo(() => {
    const ls = (todos ?? []).filter((l) => visao === 'tudo' || (l.fundo ?? 'geral') === visao)
    const doMes = ls.filter((l) => l.data.startsWith(mes))
    const ent = doMes.filter(ehEntrada), sai = doMes.filter(ehSaida)
    const saldo = saldos[visao]
    const meses = mesesAte(mes, 6).map((m) => {
      const x = ls.filter((l) => l.data.startsWith(m))
      return { m, ent: somar(x.filter(ehEntrada)), sai: somar(x.filter(ehSaida)) }
    })
    const porCategoria = Object.entries(sai.reduce<Record<string, number>>((acc, l) => {
      const c = l.categoria || OUTRAS; acc[c] = (acc[c] ?? 0) + Number(l.valor); return acc
    }, {})).sort((a, b) => b[1] - a[1])
    const porTipo = (Object.keys(ORIGENS) as Origem[]).map((t) => ({ t, v: somar(ent.filter((l) => origemDe(l) === t)) }))
    const dizimistas = new Set(ent.filter((l) => l.tipo === 'dizimo').map((l) => l.contribuinte_id ?? l.pessoa_id ?? l.nome)).size
    return { doMes, ent, sai, saldo, meses, porCategoria, porTipo, dizimistas, totEnt: somar(ent), totSai: somar(sai) }
  }, [todos, mes, visao, saldos])

  if (!podeFinanceiro(papel)) {
    return <p className="vazio">A tesouraria é visível só pra pastor, tesoureiro e administrador.</p>
  }

  const [a, m] = mes.split('-').map(Number)
  const nomeDe = (l: Lancamento) => {
    const c = l.contribuinte_id ? contribuintes.find((x) => x.id === l.contribuinte_id) : null
    return c ? rotuloContribuinte(c, pessoas) : pessoas.find((p) => p.id === l.pessoa_id)?.nome ?? l.nome
  }
  const novoContribuinte = (c: Contribuinte) => setContribuintes((xs) => (xs.some((x) => x.id === c.id) ? xs : [...xs, c]))
  const resultado = contas.totEnt - contas.totSai
  const maiorMes = Math.max(1, ...contas.meses.flatMap((x) => [x.ent, x.sai]))
  // topo do eixo: número "redondo" acima do maior mês
  const passo = Math.pow(10, Math.floor(Math.log10(maiorMes / 5)))
  const escala = Math.ceil(maiorMes / 5 / passo) * passo * 5
  const maiorCat = Math.max(1, ...contas.porCategoria.map((c) => c[1]))
  const t = busca.trim().toLowerCase()
  const lista = contas.doMes
    .filter((l) => filtro === 'tudo' || (filtro === 'saidas' ? ehSaida(l) : !ehSaida(l)))
    .filter((l) => !t || [nomeDe(l), l.descricao, l.categoria].some((x) => x?.toLowerCase().includes(t)))
  // livro-caixa: em ordem de data, com saldo correndo a partir do saldo anterior
  const doCaixa = (todos ?? []).filter((l) => visao === 'tudo' || (l.fundo ?? 'geral') === visao)
  const antes = doCaixa.filter((l) => l.data < `${mes}-01`)
  const saldoAnterior = somar(antes.filter((l) => !ehSaida(l))) - somar(antes.filter(ehSaida))
  const livroFiltrado = filtro !== 'tudo' || !!t
  let corre = saldoAnterior
  const livro = [...contas.doMes].sort((x, y) => x.data.localeCompare(y.data))
    .map((l) => { corre += ehSaida(l) ? -Number(l.valor) : Number(l.valor); return { l, saldo: corre } })
    .filter(({ l }) => lista.includes(l))
  const vazio = todos !== null && todos.length === 0
  const fechMes = fechamentos.find((f) => f.mes === mes)
  const fechado = FECHAMENTO_ATIVO && fechMes?.situacao === 'fechado'
  // saldo de todos os caixas no fim do mês (é o que bate com o banco)
  const saldoFimMes = (() => { const x = (todos ?? []).filter((l) => l.data.slice(0, 7) <= mes); return somar(x.filter((l) => !ehSaida(l))) - somar(x.filter(ehSaida)) })()
  const meuNome = equipe.find((e) => e.user_id === userId)?.nome ?? null
  const campanhas = [...new Set((todos ?? []).map((l) => l.campanha?.trim()).filter(Boolean) as string[])].sort()

  return (
    <div className="tesouraria">
      <div className="cabecalho">
        <div>
          <h1 className="titulo">Tesouraria</h1>
          <p className="subtitulo">Gestão financeira da igreja com entradas, saídas e relatórios.</p>
        </div>
        <div className="acoes-topo sem-impressao">
          <Link className="btn" to="/financeiro/importar"><Icone nome="importar" tam={18} /> Trazer planilha</Link>
          <button className="btn btn-saida" onClick={() => setNovo('saida')}><Icone nome="menos" tam={18} /> Saída</button>
          <button className="btn btn-primario" onClick={() => setNovo('entrada')}><Icone nome="mais_um" tam={18} /> Entrada</button>
        </div>
      </div>
      <TesAbas />

      {vazio ? (
        <section className="painel boas-vindas-tes">
          <h2>Comece trazendo a planilha que você já usa</h2>
          <p className="suave">O app lê sua planilha do Excel ou Google Planilhas, entende entradas e saídas, e monta tudo aqui: saldo do caixa, comparação mês a mês e pra onde vai o dinheiro.</p>
          <Link className="btn btn-primario btn-grande" to="/financeiro/importar"><Icone nome="importar" tam={18} /> Trazer minha planilha</Link>
          <button className="link" onClick={() => setNovo('entrada')}>Ou lançar à mão</button>
        </section>
      ) : (
        <>
          {MOSTRAR_CAIXAS && <div className="caixas sem-impressao">
            {(['tudo', 'geral', 'missoes', 'sete'] as Visao[]).map((v) => (
              <button key={v} className={'caixa-aba' + (visao === v ? ' ativa' : '')} onClick={() => setVisao(v)}>
                <i className="ic-redondo"><Icone nome={({ tudo: 'carteira', geral: 'moedas', missoes: 'missao', sete: 'capelo' } as const)[v]} tam={20} /></i>
                <div>
                  <span>{v === 'tudo' ? 'Tudo' : FUNDOS[v]}</span>
                  <strong className={saldos[v] < 0 ? 'neg' : ''}>{dinheiro(saldos[v])}</strong>
                </div>
              </button>
            ))}
          </div>}
          {visao === 'sete' && (
            <Link className="atalho-sete sem-impressao" to="/sete"><Icone nome="pessoas" tam={18} /> Controle de alunos e mensalidades do SETE <Icone nome="seta" tam={16} /></Link>
          )}
          {visao !== 'tudo' && visao !== 'geral' && saldos[visao] < 0 && (
            <p className="aviso-caixa">{FUNDOS[visao]} gastou {dinheiro(-saldos[visao])} a mais do que arrecadou até aqui. Essa diferença foi coberta pelo caixa geral.</p>
          )}

          <div className="meses-ano sem-impressao">
            <div className="ano-nav">
              <button className="btn-icone" onClick={() => setMes(`${a - 1}-${String(m).padStart(2, '0')}`)} aria-label="Ano anterior"><Icone nome="voltar" /></button>
              <strong>{a}</strong>
              <button className="btn-icone" onClick={() => setMes(`${a + 1}-${String(m).padStart(2, '0')}`)} aria-label="Próximo ano"><Icone nome="seta" /></button>
            </div>
            <div className="meses-chips">
              {MESES.map((nome, i) => {
                const ym = `${a}-${String(i + 1).padStart(2, '0')}`
                const tem = (todos ?? []).some((l) => l.data.startsWith(ym))
                const trancado = FECHAMENTO_ATIVO && fechamentos.some((f) => f.mes === ym && f.situacao === 'fechado')
                return (
                  <button key={ym} className={(ym === mes ? 'ativo ' : '') + (tem ? 'tem ' : '') + (trancado ? 'fechado' : '')} onClick={() => setMes(ym)}
                    title={trancado ? 'Mês fechado' : undefined}>
                    {nome.slice(0, 3)}
                  </button>
                )
              })}
            </div>
          </div>
          {FECHAMENTO_ATIVO && <div className={'fechamento sem-impressao' + (fechado ? ' fechado' : '')}>
            {fechado && fechMes ? (
              <>
                <div>
                  <strong>{MESES[m - 1]} fechado</strong>
                  <span>
                    em {dataBR(fechMes.fechado_em.slice(0, 10))}{fechMes.fechado_por_nome ? ` por ${fechMes.fechado_por_nome}` : ''}
                    {fechMes.saldo_banco !== null && <> · banco {dinheiro(Number(fechMes.saldo_banco))} · livro {dinheiro(Number(fechMes.saldo_livro))}
                      {Math.abs(Number(fechMes.saldo_banco) - Number(fechMes.saldo_livro)) < 0.005
                        ? <b className="pos"> · conferido</b>
                        : <b className="neg"> · diferença de {dinheiro(Math.abs(Number(fechMes.saldo_banco) - Number(fechMes.saldo_livro)))}</b>}</>}
                  </span>
                </div>
                <button className="btn btn-mini" onClick={() => setFechando('reabrir')}>Reabrir</button>
              </>
            ) : (
              <>
                <div>
                  <strong>{MESES[m - 1]} aberto</strong>
                  <span>{fechMes?.situacao === 'reaberto' ? `reaberto${fechMes.reaberto_por_nome ? ` por ${fechMes.reaberto_por_nome}` : ''}: ${fechMes.motivo_reabertura ?? ''}` : 'confira com o extrato do banco e feche quando terminar o mês'}</span>
                </div>
                {mes <= hojeISO().slice(0, 7) && <button className="btn btn-mini btn-primario" onClick={() => setFechando('fechar')}>Fechar o mês</button>}
              </>
            )}
          </div>}
          <p className="so-impressao">{igreja?.nome} · Tesouraria{visao !== 'tudo' ? ` · ${FUNDOS[visao]}` : ''} · {MESES[m - 1]} de {a}</p>

          <div className="numeros">
            <div className="numero saldo-caixa com-icone">
              <i className="ic-redondo"><Icone nome="carteira" tam={22} /></i>
              <span>{visao === 'tudo' ? 'Saldo em caixa' : `Saldo · ${FUNDOS[visao]}`}</span>
              <strong className="valor">{dinheiro(contas.saldo)}</strong>
              <small>tudo que entrou menos tudo que saiu até {MESES[m - 1].toLowerCase()}</small>
            </div>
            <div className="numero com-icone">
              <i className="ic-redondo"><Icone nome="seta_cima" tam={20} /></i>
              <span>Entradas do mês</span>
              <strong className="valor pos">{dinheiro(contas.totEnt)}</strong>
              <small>dízimos {dinheiro(contas.porTipo[0].v)} · ofertas {dinheiro(contas.porTipo[1].v)}{contas.porTipo[3].v > 0 ? ` · SETE ${dinheiro(contas.porTipo[3].v)}` : ''}{contas.porTipo[2].v > 0 ? ` · outras ${dinheiro(contas.porTipo[2].v)}` : ''}</small>
            </div>
            <div className="numero com-icone">
              <i className="ic-redondo neg"><Icone nome="seta_baixo" tam={20} /></i>
              <span>Saídas do mês</span>
              <strong className="valor neg">{dinheiro(contas.totSai)}</strong>
              <small>{contas.sai.length} {contas.sai.length === 1 ? "lançamento" : "lançamentos"}</small>
            </div>
            <div className="numero com-icone">
              <i className="ic-redondo"><Icone nome="calculadora" tam={20} /></i>
              <span>Resultado do mês</span>
              <strong className={'valor ' + (resultado >= 0 ? 'pos' : 'neg')}>{(resultado >= 0 ? '+' : '−') + '\u00a0' + dinheiro(Math.abs(resultado))}</strong>
              <small>{resultado >= 0 ? 'sobrou' : 'gastou mais do que entrou'}</small>
            </div>
          </div>

          <div className="cartoes-par">
            <section className="painel">
              <h2><Icone nome="barras" tam={20} /> Últimos 6 meses</h2>
              <div className="grafico-eixo">
              <div className="eixo-y">{[5, 4, 3, 2, 1, 0].map((k) => <span key={k}>{(Math.round(escala * k / 5)).toLocaleString('pt-BR')}</span>)}</div>
              <div className="grafico-meses">
                {contas.meses.map((x) => (
                  <button key={x.m} className={'gm-mes' + (x.m === mes ? ' atual' : '')} onClick={() => setMes(x.m)} title={`${mesCurto(x.m)}: entradas ${dinheiro(x.ent)}, saídas ${dinheiro(x.sai)}`}>
                    <div className="gm-barras">
                      <i className="gm-ent" style={{ height: `${(x.ent / escala) * 100}%` }} />
                      <i className="gm-sai" style={{ height: `${(x.sai / escala) * 100}%` }} />
                    </div>
                    <span>{mesCurto(x.m)}</span>
                  </button>
                ))}
              </div>
              </div>
              <div className="legenda"><span><i className="gm-ent" /> Entradas</span><span><i className="gm-sai" /> Saídas</span></div>
            </section>

            <section className="painel">
              <h2><Icone nome="pizza" tam={20} /> De onde veio</h2>
              {contas.totEnt === 0 && <p className="vazio">Nenhuma entrada neste mês.</p>}
              <div className="barras">
                {contas.porTipo.filter(({ v }) => v > 0).map(({ t, v }) => (
                  <div key={t} className="barra-linha">
                    <span>{ORIGENS[t]}</span>
                    <i><b style={{ width: `${contas.totEnt ? (v / contas.totEnt) * 100 : 0}%` }} /></i>
                    <strong className="valor-curto">{dinheiro(v)}</strong>
                  </div>
                ))}
              </div>
              <h2 className="sub"><Icone nome="etiqueta" tam={20} /> Pra onde foi</h2>
              {contas.porCategoria.length === 0 && <p className="vazio">Nenhuma saída neste mês.</p>}
              <div className="barras saidas">
                {contas.porCategoria.map(([c, v]) => (
                  <div key={c} className="barra-linha">
                    <span>{c}</span>
                    <i><b style={{ width: `${(v / maiorCat) * 100}%` }} /></i>
                    <strong className="valor-curto">{dinheiro(v)}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="painel livro">
            <div className="lista-topo">
              <h2><Icone nome="livro" tam={22} /> Livro-caixa de {MESES[m - 1].toLowerCase()}{visao !== 'tudo' ? ` · ${FUNDOS[visao]}` : ''}</h2>
              <div className="acoes-livro sem-impressao">
                {!fechado && <button className="btn btn-mini" onClick={() => setFixasAberta(true)}><Icone nome="agenda" tam={16} /> Despesas fixas</button>}
                <button className="btn btn-mini" onClick={() => window.print()}><Icone nome="imprimir" tam={16} /> Imprimir / PDF</button>
              </div>
            </div>
            <div className="lista-filtros sem-impressao">
              <div className="seg">
                {([['tudo', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas']] as [Filtro, string][]).map(([f, n]) => (
                  <button key={f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>{n}</button>
                ))}
              </div>
              <input className="busca" type="search" placeholder="Buscar nome ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <div className="tabela-rolar">
              <table className="tabela-livro">
                <thead>
                  <tr><th>Data</th><th className="esq">Descrição</th><th className="esq col-tipo">Tipo</th><th>Entrada</th><th>Saída</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  <tr className="linha-saldo"><td /><td className="esq" colSpan={2}>Saldo anterior</td><td /><td /><td>{num(saldoAnterior)}</td></tr>
                  {livro.map(({ l, saldo }) => (
                    <tr key={l.id} onClick={() => (fechado ? setFechando('reabrir') : setEditando(l))} className="clicavel">
                      <td>{dataBR(l.data).slice(0, 5)}</td>
                      <td className="esq desc">
                        {ehSaldoInicial(l) ? (l.descricao || 'Saldo inicial') : ehSaida(l) ? (l.descricao || l.nome || l.categoria || 'Saída') : (nomeDe(l) || l.descricao || 'Entrada')}
                        {l.campanha && <em className="tag-fundo"> · {l.campanha}</em>}
                        <small className="tipo-cel">{ehSaldoInicial(l) ? 'Saldo inicial' : ehSaida(l) ? (l.categoria || OUTRAS) : ORIGENS[origemDe(l)]}</small>
                      </td>
                      <td className="esq tipo col-tipo">
                        {ehSaldoInicial(l) ? 'Saldo inicial' : ehSaida(l) ? (l.categoria || OUTRAS) : ORIGENS[origemDe(l)]}
                        {visao === 'tudo' && (l.fundo ?? 'geral') !== 'geral' && <em className="tag-fundo"> · {FUNDOS[l.fundo]}</em>}
                      </td>
                      <td className="pos">{ehSaida(l) ? '' : num(Number(l.valor))}</td>
                      <td className="neg">{ehSaida(l) ? num(Number(l.valor)) : ''}</td>
                      <td className={saldo < 0 ? 'neg' : ''}>{livroFiltrado ? '' : num(saldo)}</td>
                    </tr>
                  ))}
                  {livro.length === 0 && <tr><td colSpan={6} className="vazio">Nenhum lançamento neste mês ainda.</td></tr>}
                </tbody>
                <tfoot>
                  <tr><td /><td className="esq" colSpan={2}>Total do mês</td><td className="pos">{num(contas.totEnt)}</td><td className="neg">{num(contas.totSai)}</td><td>{num(contas.saldo)}</td></tr>
                </tfoot>
              </table>
            </div>
            {!fechado && <LinhaRapida mes={mes} visao={visao} igrejaId={igreja!.id} userId={userId!} pessoas={pessoas} contribuintes={contribuintes} novoContribuinte={novoContribuinte}
              salvo={(l) => setTodos([...(todos ?? []), l])} />}
            <p className="dica sem-impressao">{fechado ? 'Mês fechado: pra corrigir algo, reabra o mês.' : 'Toque numa linha pra corrigir ou apagar.'}</p>
          </section>
        </>
      )}

      <Folha titulo={novo === 'saida' ? 'Nova saída' : 'Nova entrada'} aberta={!!novo} fechar={() => setNovo(null)}>
        {novo && <FormLancamento modo={novo} fundoPadrao={visao === 'tudo' ? 'geral' : visao} igrejaId={igreja!.id} userId={userId!} pessoas={pessoas} campanhas={campanhas} contribuintes={contribuintes} novoContribuinte={novoContribuinte}
          salvo={(l) => { setTodos([l, ...(todos ?? [])]); setMes(l.data.slice(0, 7)); setNovo(null) }} />}
      </Folha>
      <Folha titulo={fechando === 'reabrir' ? `Reabrir ${MESES[m - 1].toLowerCase()}` : `Fechar ${MESES[m - 1].toLowerCase()}`} aberta={!!fechando} fechar={() => setFechando(null)}>
        {fechando && <FormFechamento modo={fechando} mes={mes} saldoLivro={saldoFimMes} atual={fechMes} igrejaId={igreja!.id} userId={userId!} nome={meuNome}
          pronto={() => { setFechando(null); carregarFechamentos() }} />}
      </Folha>
      <Folha titulo={`Despesas fixas · ${MESES[Number(mes.slice(5)) - 1]}`} aberta={fixasAberta} fechar={() => setFixasAberta(false)}>
        {fixasAberta && <DespesasFixas mes={mes} igrejaId={igreja!.id} userId={userId!} todos={todos ?? []}
          lancadas={(ls) => { setTodos([...(todos ?? []), ...ls]); setFixasAberta(false) }} />}
      </Folha>
      <Folha titulo="Lançamento" aberta={!!editando} fechar={() => setEditando(null)}>
        {editando && <FormLancamento modo={ehSaida(editando) ? 'saida' : 'entrada'} inicial={editando} igrejaId={igreja!.id} userId={userId!} pessoas={pessoas} campanhas={campanhas} contribuintes={contribuintes} novoContribuinte={novoContribuinte}
          salvo={(l) => { setTodos((todos ?? []).map((x) => (x.id === l.id ? l : x))); setEditando(null) }}
          apagado={(id) => { setTodos((todos ?? []).filter((x) => x.id !== id)); setEditando(null) }} />}
      </Folha>
    </div>
  )
}

function FormLancamento({ modo, inicial, fundoPadrao = 'geral', igrejaId, userId, pessoas, campanhas, contribuintes, novoContribuinte, salvo, apagado }: {
  modo: 'entrada' | 'saida'; inicial?: Lancamento; fundoPadrao?: Fundo; igrejaId: string; userId: string; pessoas: Pessoa[]; campanhas: string[]
  contribuintes: Contribuinte[]; novoContribuinte: (c: Contribuinte) => void
  salvo: (l: Lancamento) => void; apagado?: (id: string) => void
}) {
  const saida = modo === 'saida'
  const [tipo, setTipo] = useState<Lancamento['tipo']>(inicial?.tipo ?? (saida ? 'saida' : 'dizimo'))
  const [valor, setValor] = useState(inicial ? String(inicial.valor).replace('.', ',') : '')
  const [data, setData] = useState(inicial?.data ?? hojeISO())
  const contribIni = inicial?.contribuinte_id ? contribuintes.find((c) => c.id === inicial.contribuinte_id) : null
  const [quem, setQuem] = useState(contribIni ? rotuloContribuinte(contribIni, pessoas) : pessoas.find((p) => p.id === inicial?.pessoa_id)?.nome ?? inicial?.nome ?? '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? NOMES_CATEGORIAS[0])
  const [forma, setForma] = useState<Lancamento['forma']>(inicial?.forma ?? 'pix')
  const [fundo, setFundo] = useState<Fundo>(inicial?.fundo ?? fundoPadrao)
  const [campanha, setCampanha] = useState(inicial?.campanha ?? '')
  const saldoIni = inicial?.tipo === 'saldo_inicial'
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor inválido.'); return }
    // dízimo e oferta com nome: liga ao contribuinte da relação (cria se for novo)
    const relacao = !saida && !saldoIni && (tipo === 'dizimo' || tipo === 'oferta')
    const contrib = relacao ? await resolverContribuinte(igrejaId, quem, contribuintes, pessoas) : null
    if (contrib) novoContribuinte(contrib)
    const pessoaQuem = !saida ? pessoas.find((p) => p.nome.toLowerCase() === quem.trim().toLowerCase()) : undefined
    const reg = {
      igreja_id: igrejaId, tipo: saldoIni ? 'saldo_inicial' : saida ? 'saida' : tipo, valor: v, data, forma, criado_por: userId, fundo,
      pessoa_id: saida ? null : contrib?.pessoa_id ?? pessoaQuem?.id ?? null,
      nome: saida || contrib || pessoaQuem ? null : quem.trim() || null,
      ...(relacao || inicial?.contribuinte_id ? { contribuinte_id: contrib?.id ?? null } : {}),
      descricao: descricao || null,
      categoria: saida ? categoria : null,
      ...(campanha.trim() || inicial?.campanha ? { campanha: campanha.trim() || null } : {}),
    }
    const q = inicial
      ? supabase.from('lancamentos').update(reg).eq('id', inicial.id).select().single()
      : supabase.from('lancamentos').insert(reg).select().single()
    const { data: l, error } = await q
    if (error || !l) { setErro(/mes fechado/.test(error?.message ?? '') ? 'Esse mês está fechado. Reabra o mês pra lançar ou mudar algo nele.' : /check|campanha|schema cache/.test(error?.message ?? '') ? 'Falta rodar a migração mais nova no Supabase.' : 'Não deu pra salvar.'); return }
    salvo(l)
  }

  async function apagar() {
    const { error } = await supabase.from('lancamentos').delete().eq('id', inicial!.id)
    if (error) { setErro(/mes fechado/.test(error.message) ? 'Esse mês está fechado. Reabra o mês pra apagar.' : 'Não deu pra apagar.'); setConfirmar(false); return }
    apagado?.(inicial!.id)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>Caixa
        <select value={fundo} onChange={(e) => setFundo(e.target.value as Fundo)}>
          {(Object.keys(FUNDOS) as Fundo[]).map((f) => <option key={f} value={f}>{FUNDOS[f]}</option>)}
        </select>
      </label>
      {!saida && !saldoIni && (
        <div className="seg">
          {(Object.keys(ENTRADAS) as (keyof typeof ENTRADAS)[]).map((t) => (
            <button type="button" key={t} className={tipo === t ? 'ativo' : ''} onClick={() => setTipo(t)}>{ENTRADAS[t]}</button>
          ))}
        </div>
      )}
      <div className="linha-2">
        <label>Valor (R$)<input inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus={!inicial} /></label>
        <label>Data<input type="date" required value={data} onChange={(e) => setData(e.target.value)} /></label>
      </div>
      {saida ? (
        <>
          <label>Categoria
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {NOMES_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Descrição<input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: conta de luz de novembro" /></label>
        </>
      ) : (
        <>
          <label>Quem deu (opcional)
            <input list="quem-deu" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Nome ou código da relação" />
            <datalist id="quem-deu">
              {contribuintes.map((c) => <option key={c.id} value={rotuloContribuinte(c, pessoas)} />)}
              {pessoas.filter((p) => !contribuintes.some((c) => c.pessoa_id === p.id)).map((p) => <option key={p.id} value={p.nome} />)}
            </datalist>
          </label>
          {(tipo === 'dizimo' || tipo === 'oferta') && quem.trim() && <p className="dica">Entra também na relação de {tipo === 'dizimo' ? 'dizimistas' : 'ofertantes'}.</p>}
          <label>Observação (opcional)<input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        </>
      )}
      {!saldoIni && (
        <label>Campanha (opcional)
          <input list="campanhas" value={campanha} onChange={(e) => setCampanha(e.target.value)} placeholder="Ex.: Reforma do templo" />
          <datalist id="campanhas">{campanhas.map((c) => <option key={c} value={c} />)}</datalist>
        </label>
      )}
      <label>Forma
        <select value={forma} onChange={(e) => setForma(e.target.value as Lancamento['forma'])}>
          {(Object.keys(FORMAS) as Lancamento['forma'][]).map((f) => <option key={f} value={f}>{FORMAS[f]}</option>)}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className={'btn ' + (saida ? 'btn-saida-cheio' : 'btn-primario')}>{inicial ? 'Salvar' : saida ? 'Lançar saída' : 'Lançar entrada'}</button>
      {inicial && (!confirmar
        ? <button type="button" className="btn btn-perigo" onClick={() => setConfirmar(true)}>Apagar lançamento</button>
        : (
          <div className="cartao">
            <span>Apagar este lançamento de {dinheiro(Number(inicial.valor))}? Não dá pra desfazer.</span>
            <div className="acoes"><button type="button" className="btn btn-perigo" onClick={apagar}>Sim, apagar</button>
              <button type="button" className="btn" onClick={() => setConfirmar(false)}>Cancelar</button></div>
          </div>
        ))}
    </form>
  )
}

const num = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// linha de lançamento rápido, como digitar uma linha nova na planilha
function LinhaRapida({ mes, visao, igrejaId, userId, pessoas, contribuintes, novoContribuinte, salvo }: {
  mes: string; visao: 'tudo' | Fundo; igrejaId: string; userId: string; salvo: (l: Lancamento) => void
  pessoas: Pessoa[]; contribuintes: Contribuinte[]; novoContribuinte: (c: Contribuinte) => void
}) {
  const [quem, setQuem] = useState('')
  const hoje = hojeISO()
  const padraoData = hoje.startsWith(mes) ? hoje : `${mes}-01`
  const [data, setData] = useState(padraoData)
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<'dizimo' | 'oferta' | 'outro' | 'saida'>('dizimo')
  const [categoria, setCategoria] = useState('')
  const [valor, setValor] = useState('')
  const [fundo, setFundo] = useState<Fundo>(visao === 'tudo' ? 'geral' : visao)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  useEffect(() => { setData(hoje.startsWith(mes) ? hoje : `${mes}-01`) }, [mes])
  useEffect(() => { if (visao !== 'tudo') setFundo(visao) }, [visao])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor inválido.'); return }
    setSalvando(true); setErro('')
    const saida = tipo === 'saida'
    const desc = descricao.trim() || (tipo === 'dizimo' ? 'Dízimo(s)' : tipo === 'oferta' ? 'Oferta(s)' : null)
    const contrib = (tipo === 'dizimo' || tipo === 'oferta') ? await resolverContribuinte(igrejaId, quem, contribuintes, pessoas) : null
    if (contrib) novoContribuinte(contrib)
    const { data: l, error } = await supabase.from('lancamentos').insert({
      igreja_id: igrejaId, tipo, valor: v, data, forma: 'dinheiro', criado_por: userId, fundo,
      descricao: desc, categoria: saida ? (categoria || adivinharCategoria(desc) || OUTRAS) : null,
      pessoa_id: contrib?.pessoa_id ?? null, nome: !contrib && tipo === 'outro' ? quem.trim() || null : null,
      ...(contrib ? { contribuinte_id: contrib.id } : {}),
    }).select().single()
    setSalvando(false)
    if (error || !l) { setErro(/mes fechado/.test(error?.message ?? '') ? 'Esse mês está fechado.' : 'Não deu pra salvar.'); return }
    salvo(l as Lancamento)
    setDescricao(''); setValor(''); setQuem('')
  }

  return (
    <form className="linha-rapida sem-impressao" onSubmit={enviar}>
      <input type="date" value={data} onChange={(e) => setData(e.target.value)} required aria-label="Data" />
      <input className="lr-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição (ex.: Dízimo(s), Neoenergia)" aria-label="Descrição" />
      <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} aria-label="Tipo">
        <option value="dizimo">Dízimo</option>
        <option value="oferta">Oferta</option>
        <option value="outro">Outra entrada</option>
        <option value="saida">Saída</option>
      </select>
      {tipo !== 'saida' && (
        <>
          <input className="lr-quem" list="quem-rapido" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Quem deu (opcional)" aria-label="Quem deu" />
          <datalist id="quem-rapido">
            {contribuintes.map((c) => <option key={c.id} value={rotuloContribuinte(c, pessoas)} />)}
            {pessoas.filter((p) => !contribuintes.some((c) => c.pessoa_id === p.id)).map((p) => <option key={p.id} value={p.nome} />)}
          </datalist>
        </>
      )}
      {tipo === 'saida' && (
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoria">
          <option value="">Categoria (automática)</option>
          {NOMES_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {visao === 'tudo' && (
        <select value={fundo} onChange={(e) => setFundo(e.target.value as Fundo)} aria-label="Caixa">
          {(Object.keys(FUNDOS) as Fundo[]).map((f) => <option key={f} value={f}>{FUNDOS[f]}</option>)}
        </select>
      )}
      <input className="lr-valor" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Valor" aria-label="Valor" required />
      <button className={'btn ' + (tipo === 'saida' ? 'btn-saida-cheio' : 'btn-primario')} disabled={salvando}>{salvando ? '…' : '+ Lançar'}</button>
      {erro && <p className="erro">{erro}</p>}
    </form>
  )
}

function FormFechamento({ modo, mes, saldoLivro, atual, igrejaId, userId, nome, pronto }: {
  modo: 'fechar' | 'reabrir'; mes: string; saldoLivro: number; atual?: Fechamento; igrejaId: string; userId: string; nome: string | null; pronto: () => void
}) {
  const [banco, setBanco] = useState('')
  const [obs, setObs] = useState('')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const v = banco.trim() ? Number(banco.replace(/\./g, '').replace(',', '.')) : null
  const dif = v === null || Number.isNaN(v) ? null : Math.round((v - saldoLivro) * 100) / 100

  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro('')
    if (modo === 'reabrir') {
      if (!motivo.trim()) { setErro('Conte o motivo da reabertura (fica registrado).'); return }
      setSalvando(true)
      const { error } = await supabase.from('fechamentos').update({
        situacao: 'reaberto', reaberto_por_nome: nome, reaberto_em: new Date().toISOString(), motivo_reabertura: motivo.trim(),
      }).eq('id', atual!.id)
      setSalvando(false)
      if (error) { setErro('Não deu pra reabrir.'); return }
      pronto(); return
    }
    if (v !== null && Number.isNaN(v)) { setErro('Saldo do banco inválido.'); return }
    setSalvando(true)
    const reg = {
      situacao: 'fechado', saldo_livro: Math.round(saldoLivro * 100) / 100, saldo_banco: v, observacao: obs.trim() || null,
      fechado_por: userId, fechado_por_nome: nome, fechado_em: new Date().toISOString(),
    }
    const { error } = atual
      ? await supabase.from('fechamentos').update(reg).eq('id', atual.id)
      : await supabase.from('fechamentos').insert({ igreja_id: igrejaId, mes, ...reg })
    setSalvando(false)
    if (error) { setErro(/relation|schema cache|does not exist/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não deu pra fechar o mês.'); return }
    pronto()
  }

  if (modo === 'reabrir') {
    return (
      <form className="form" onSubmit={enviar}>
        <p className="suave">Com o mês reaberto dá pra lançar, corrigir e apagar de novo. A reabertura fica registrada com o seu nome e o motivo.</p>
        <label>Motivo<input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: faltou lançar a conta de luz" autoFocus /></label>
        {erro && <p className="erro">{erro}</p>}
        <button className="btn btn-primario" disabled={salvando}>Reabrir o mês</button>
      </form>
    )
  }
  return (
    <form className="form" onSubmit={enviar}>
      <div className="fech-saldo"><span>Saldo do livro-caixa no fim do mês</span><strong>{dinheiro(saldoLivro)}</strong><small>todos os caixas juntos</small></div>
      <label>Saldo no extrato do banco (R$)
        <input inputMode="decimal" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ex.: 3.912,96" autoFocus />
      </label>
      {dif !== null && (dif === 0
        ? <p className="fech-ok">Bateu certinho com o banco.</p>
        : <p className="fech-dif">Diferença de {dinheiro(Math.abs(dif))} ({dif > 0 ? 'o banco tem mais' : 'o banco tem menos'} que o livro). Dá pra fechar assim e explicar na observação, ou corrigir os lançamentos antes.</p>)}
      <label>Observação (opcional)<input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: R$ 50 em espécie ainda não depositado" /></label>
      <p className="dica">Depois de fechado, ninguém lança nem muda nada neste mês sem reabrir.</p>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Fechando…' : 'Fechar o mês'}</button>
    </form>
  )
}
