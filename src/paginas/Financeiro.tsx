import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Lancamento, Pessoa } from '../lib/tipos'
import { MESES, dataBR, dinheiro, hojeISO, podeFinanceiro } from '../lib/util'
import { ENTRADAS, FORMAS, FUNDOS, NOMES_CATEGORIAS, OUTRAS, ehEntrada, ehSaida, ehSaldoInicial, mesCurto, mesesAte, somar, type Fundo } from '../lib/tesouraria'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'

type Filtro = 'tudo' | 'entradas' | 'saidas'
type Visao = 'tudo' | Fundo

export default function Financeiro() {
  const { igreja, papel, userId } = useSessao()
  const [params] = useSearchParams()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [todos, setTodos] = useState<Lancamento[] | null>(null)
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [filtro, setFiltro] = useState<Filtro>('tudo')
  const [visao, setVisao] = useState<Visao>('tudo')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState<null | 'entrada' | 'saida'>(params.get('novo') === '1' ? 'entrada' : null)
  const [editando, setEditando] = useState<Lancamento | null>(null)

  function carregar() {
    if (!igreja || !podeFinanceiro(papel)) return
    supabase.from('lancamentos').select('*').eq('igreja_id', igreja.id).order('data', { ascending: false })
      .then(({ data }) => setTodos((data as Lancamento[]) ?? []))
  }
  useEffect(carregar, [igreja?.id, papel])

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
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
    const porTipo = (['dizimo', 'oferta', 'outro'] as const).map((t) => ({ t, v: somar(ent.filter((l) => l.tipo === t)) }))
    const dizimistas = new Set(ent.filter((l) => l.tipo === 'dizimo').map((l) => l.pessoa_id ?? l.nome)).size
    return { doMes, ent, sai, saldo, meses, porCategoria, porTipo, dizimistas, totEnt: somar(ent), totSai: somar(sai) }
  }, [todos, mes, visao, saldos])

  if (!podeFinanceiro(papel)) {
    return <p className="vazio">A tesouraria é visível só pra pastor, tesoureiro e administrador.</p>
  }

  const [a, m] = mes.split('-').map(Number)
  const mudarMes = (d: number) => {
    const n = new Date(a, m - 1 + d, 1)
    setMes(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }
  const nomeDe = (l: Lancamento) => pessoas.find((p) => p.id === l.pessoa_id)?.nome ?? l.nome
  const resultado = contas.totEnt - contas.totSai
  const maiorMes = Math.max(1, ...contas.meses.flatMap((x) => [x.ent, x.sai]))
  const maiorCat = Math.max(1, ...contas.porCategoria.map((c) => c[1]))
  const t = busca.trim().toLowerCase()
  const lista = contas.doMes
    .filter((l) => filtro === 'tudo' || (filtro === 'saidas' ? ehSaida(l) : !ehSaida(l)))
    .filter((l) => !t || [nomeDe(l), l.descricao, l.categoria].some((x) => x?.toLowerCase().includes(t)))
  const vazio = todos !== null && todos.length === 0

  return (
    <div className="tesouraria">
      <div className="cabecalho">
        <h1 className="titulo">Tesouraria</h1>
        <div className="acoes-topo sem-impressao">
          <Link className="btn" to="/financeiro/importar"><Icone nome="importar" tam={18} /> Trazer planilha</Link>
          <button className="btn btn-saida" onClick={() => setNovo('saida')}>− Saída</button>
          <button className="btn btn-primario" onClick={() => setNovo('entrada')}>+ Entrada</button>
        </div>
      </div>

      {vazio ? (
        <section className="painel boas-vindas-tes">
          <h2>Comece trazendo a planilha que você já usa</h2>
          <p className="suave">O app lê sua planilha do Excel ou Google Planilhas, entende entradas e saídas, e monta tudo aqui: saldo do caixa, comparação mês a mês e pra onde vai o dinheiro.</p>
          <Link className="btn btn-primario btn-grande" to="/financeiro/importar"><Icone nome="importar" tam={18} /> Trazer minha planilha</Link>
          <button className="link" onClick={() => setNovo('entrada')}>Ou lançar à mão</button>
        </section>
      ) : (
        <>
          <div className="caixas sem-impressao">
            {(['tudo', 'geral', 'missoes', 'sete'] as Visao[]).map((v) => (
              <button key={v} className={'caixa-aba' + (visao === v ? ' ativa' : '')} onClick={() => setVisao(v)}>
                <span>{v === 'tudo' ? 'Tudo' : FUNDOS[v]}</span>
                <strong className={saldos[v] < 0 ? 'neg' : ''}>{dinheiro(saldos[v])}</strong>
              </button>
            ))}
          </div>
          {visao === 'sete' && (
            <Link className="atalho-sete sem-impressao" to="/sete"><Icone nome="pessoas" tam={18} /> Controle de alunos e mensalidades do SETE <Icone nome="seta" tam={16} /></Link>
          )}
          {visao !== 'tudo' && visao !== 'geral' && saldos[visao] < 0 && (
            <p className="aviso-caixa">{FUNDOS[visao]} gastou {dinheiro(-saldos[visao])} a mais do que arrecadou até aqui. Essa diferença foi coberta pelo caixa geral.</p>
          )}

          <div className="mes sem-impressao">
            <button className="btn-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
            <strong>{MESES[m - 1]} {a}</strong>
            <button className="btn-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="seta" /></button>
          </div>
          <p className="so-impressao">{igreja?.nome} · Tesouraria{visao !== 'tudo' ? ` · ${FUNDOS[visao]}` : ''} · {MESES[m - 1]} de {a}</p>

          <div className="numeros">
            <div className="numero saldo-caixa">
              <span>{visao === 'tudo' ? 'Saldo em caixa' : `Saldo · ${FUNDOS[visao]}`}</span>
              <strong className="valor">{dinheiro(contas.saldo)}</strong>
              <small>tudo que entrou menos tudo que saiu até {MESES[m - 1].toLowerCase()}</small>
            </div>
            <div className="numero">
              <span>Entradas do mês</span>
              <strong className="valor pos">{dinheiro(contas.totEnt)}</strong>
              <small>{contas.ent.length} lançamentos · {contas.dizimistas} dizimistas</small>
            </div>
            <div className="numero">
              <span>Saídas do mês</span>
              <strong className="valor neg">{dinheiro(contas.totSai)}</strong>
              <small>{contas.sai.length} lançamentos</small>
            </div>
            <div className="numero">
              <span>Resultado do mês</span>
              <strong className={'valor ' + (resultado >= 0 ? 'pos' : 'neg')}>{resultado >= 0 ? '+' : '−'} {dinheiro(Math.abs(resultado))}</strong>
              <small>{resultado >= 0 ? 'sobrou' : 'gastou mais do que entrou'}</small>
            </div>
          </div>

          <div className="colunas">
            <section className="painel">
              <h2>Últimos 6 meses</h2>
              <div className="grafico-meses">
                {contas.meses.map((x) => (
                  <button key={x.m} className={'gm-mes' + (x.m === mes ? ' atual' : '')} onClick={() => setMes(x.m)} title={`${mesCurto(x.m)}: entradas ${dinheiro(x.ent)}, saídas ${dinheiro(x.sai)}`}>
                    <div className="gm-barras">
                      <i className="gm-ent" style={{ height: `${(x.ent / maiorMes) * 100}%` }} />
                      <i className="gm-sai" style={{ height: `${(x.sai / maiorMes) * 100}%` }} />
                    </div>
                    <span>{mesCurto(x.m)}</span>
                  </button>
                ))}
              </div>
              <div className="legenda"><span><i className="gm-ent" /> Entradas</span><span><i className="gm-sai" /> Saídas</span></div>
            </section>

            <section className="painel">
              <h2>De onde veio</h2>
              <div className="barras">
                {contas.porTipo.filter(({ v }) => v > 0).map(({ t, v }) => (
                  <div key={t} className="barra-linha">
                    <span>{ENTRADAS[t]}</span>
                    <i><b style={{ width: `${contas.totEnt ? (v / contas.totEnt) * 100 : 0}%` }} /></i>
                    <strong className="valor-curto">{dinheiro(v)}</strong>
                  </div>
                ))}
              </div>
              <h2 className="sub">Pra onde foi</h2>
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

          <section className="painel">
            <div className="lista-topo">
              <h2>Lançamentos de {MESES[m - 1].toLowerCase()}</h2>
              <button className="btn btn-mini sem-impressao" onClick={() => window.print()}>Imprimir / PDF</button>
            </div>
            <div className="lista-filtros sem-impressao">
              <div className="seg">
                {([['tudo', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas']] as [Filtro, string][]).map(([f, n]) => (
                  <button key={f} className={filtro === f ? 'ativo' : ''} onClick={() => setFiltro(f)}>{n}</button>
                ))}
              </div>
              <input className="busca" type="search" placeholder="Buscar nome ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            {lista.length === 0 && <p className="vazio">Nada por aqui.</p>}
            <ul className="lista plana">
              {lista.map((l) => (
                <li key={l.id}>
                  <button className="item" onClick={() => setEditando(l)}>
                    <span className="hora">{dataBR(l.data)}</span>
                    <div className="item-texto">
                      <strong>{ehSaldoInicial(l) ? (l.descricao || 'Saldo inicial') : ehSaida(l) ? (l.descricao || l.nome || l.categoria || 'Saída') : (nomeDe(l) || l.descricao || 'Anônimo')}</strong>
                      <span>
                        {ehSaldoInicial(l) ? 'Saldo inicial' : ehSaida(l) ? (l.categoria || OUTRAS) : ENTRADAS[l.tipo as keyof typeof ENTRADAS]}
                        {!ehSaldoInicial(l) && ` · ${FORMAS[l.forma]}`}
                        {visao === 'tudo' && (l.fundo ?? 'geral') !== 'geral' && <em className="tag-fundo"> · {FUNDOS[l.fundo]}</em>}
                      </span>
                    </div>
                    <strong className={'valor ' + (ehSaida(l) ? 'neg' : 'pos')}>{ehSaida(l) ? '−' : '+'} {dinheiro(Number(l.valor))}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Folha titulo={novo === 'saida' ? 'Nova saída' : 'Nova entrada'} aberta={!!novo} fechar={() => setNovo(null)}>
        {novo && <FormLancamento modo={novo} fundoPadrao={visao === 'tudo' ? 'geral' : visao} igrejaId={igreja!.id} userId={userId!} pessoas={pessoas}
          salvo={(l) => { setTodos([l, ...(todos ?? [])]); setMes(l.data.slice(0, 7)); setNovo(null) }} />}
      </Folha>
      <Folha titulo="Lançamento" aberta={!!editando} fechar={() => setEditando(null)}>
        {editando && <FormLancamento modo={ehSaida(editando) ? 'saida' : 'entrada'} inicial={editando} igrejaId={igreja!.id} userId={userId!} pessoas={pessoas}
          salvo={(l) => { setTodos((todos ?? []).map((x) => (x.id === l.id ? l : x))); setEditando(null) }}
          apagado={(id) => { setTodos((todos ?? []).filter((x) => x.id !== id)); setEditando(null) }} />}
      </Folha>
    </div>
  )
}

function FormLancamento({ modo, inicial, fundoPadrao = 'geral', igrejaId, userId, pessoas, salvo, apagado }: {
  modo: 'entrada' | 'saida'; inicial?: Lancamento; fundoPadrao?: Fundo; igrejaId: string; userId: string; pessoas: Pessoa[]
  salvo: (l: Lancamento) => void; apagado?: (id: string) => void
}) {
  const saida = modo === 'saida'
  const [tipo, setTipo] = useState<Lancamento['tipo']>(inicial?.tipo ?? (saida ? 'saida' : 'dizimo'))
  const [valor, setValor] = useState(inicial ? String(inicial.valor).replace('.', ',') : '')
  const [data, setData] = useState(inicial?.data ?? hojeISO())
  const [pessoaId, setPessoaId] = useState(inicial?.pessoa_id ?? '')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [categoria, setCategoria] = useState(inicial?.categoria ?? NOMES_CATEGORIAS[0])
  const [forma, setForma] = useState<Lancamento['forma']>(inicial?.forma ?? 'pix')
  const [fundo, setFundo] = useState<Fundo>(inicial?.fundo ?? fundoPadrao)
  const saldoIni = inicial?.tipo === 'saldo_inicial'
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor inválido.'); return }
    const reg = {
      igreja_id: igrejaId, tipo: saldoIni ? 'saldo_inicial' : saida ? 'saida' : tipo, valor: v, data, forma, criado_por: userId, fundo,
      pessoa_id: saida ? null : pessoaId || null,
      nome: saida ? null : pessoaId ? null : nome || null,
      descricao: descricao || null,
      categoria: saida ? categoria : null,
    }
    const q = inicial
      ? supabase.from('lancamentos').update(reg).eq('id', inicial.id).select().single()
      : supabase.from('lancamentos').insert(reg).select().single()
    const { data: l, error } = await q
    if (error || !l) { setErro(saida && /check/.test(error?.message ?? '') ? 'Falta rodar a migração 006 no Supabase.' : 'Não deu pra salvar.'); return }
    salvo(l)
  }

  async function apagar() {
    const { error } = await supabase.from('lancamentos').delete().eq('id', inicial!.id)
    if (!error) apagado?.(inicial!.id)
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
          <label>Quem deu
            <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
              <option value="">Não cadastrado / anônimo</option>
              {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </label>
          {!pessoaId && <label>Nome (opcional)<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>}
          <label>Observação (opcional)<input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></label>
        </>
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
