import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import {
  CAMPOS_FIN, acharCabecalho, chaveLancamento, lerArquivo, montarLinhas,
  type LinhaFin, type Mapa, type PessoaRef, type Tabela,
} from '../lib/importarFinanceiro'
import { dataBR, dinheiro, podeFinanceiro } from '../lib/util'
import Icone from '../componentes/Icone'

const TIPOS = { dizimo: 'Dízimo', oferta: 'Oferta', outro: 'Outra entrada' } as const
const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência' } as const
const letra = (i: number): string => (i >= 26 ? letra(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))

export default function ImportarFinanceiro() {
  const { igreja, papel, userId } = useSessao()
  const [abas, setAbas] = useState<{ aba: string; tabela: Tabela }[]>([])
  const [abaAtual, setAbaAtual] = useState(0)
  const [arquivo, setArquivo] = useState('')
  const [linhaCab, setLinhaCab] = useState(0)
  const [mapa, setMapa] = useState<Mapa>({})
  const [anoPadrao, setAnoPadrao] = useState(new Date().getFullYear())
  const [tipoPadrao, setTipoPadrao] = useState<LinhaFin['tipo']>('dizimo')
  const [formaPadrao, setFormaPadrao] = useState<LinhaFin['forma']>('dinheiro')
  const [pessoas, setPessoas] = useState<PessoaRef[]>([])
  const [existentes, setExistentes] = useState<Set<string>>(new Set())
  const [ajustes, setAjustes] = useState<Record<number, Partial<LinhaFin> & { fora?: boolean }>>({})
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState<'escolher' | 'revisar' | 'importando' | 'pronto'>('escolher')
  const [importados, setImportados] = useState({ n: 0, total: 0 })

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as PessoaRef[]) ?? []))
  }, [igreja?.id])

  const tabela = abas[abaAtual]?.tabela ?? []

  const linhas = useMemo(
    () => montarLinhas(tabela, linhaCab, mapa, pessoas, { anoPadrao, tipoPadrao, formaPadrao })
      .map((l) => ({ ...l, ...ajustes[l.n] })),
    [tabela, linhaCab, mapa, pessoas, anoPadrao, tipoPadrao, formaPadrao, ajustes],
  )

  // procura lançamentos que já existem no período, pra não importar duas vezes
  const periodo = useMemo(() => {
    const ds = linhas.map((l) => l.data).filter(Boolean).sort() as string[]
    return ds.length ? [ds[0], ds[ds.length - 1]] : null
  }, [linhas])
  useEffect(() => {
    if (!igreja || !periodo) { setExistentes(new Set()); return }
    supabase.from('lancamentos').select('data, valor, pessoa_id, nome').eq('igreja_id', igreja.id)
      .gte('data', periodo[0]).lte('data', periodo[1])
      .then(({ data }) => setExistentes(new Set((data ?? []).map((l: { data: string; valor: number; pessoa_id: string | null; nome: string | null }) =>
        chaveLancamento(l.data, l.valor, l.pessoa_id ?? l.nome ?? '')))))
  }, [igreja?.id, periodo?.[0], periodo?.[1]])

  if (!podeFinanceiro(papel)) return <p className="vazio">Só tesoureiro, pastor e administrador importam lançamentos.</p>

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setErro('')
    try {
      const lidas = (await lerArquivo(f)).filter((a) => a.tabela.length > 1)
      if (!lidas.length) { setErro('O arquivo está vazio.'); return }
      setArquivo(f.name); setAbas(lidas); setAjustes({})
      usarAba(lidas, 0)
      setEstado('revisar')
    } catch (err) {
      setErro(err instanceof Error && err.message.includes('formato') ? err.message : 'Não consegui ler esse arquivo. Tente salvar como .xlsx ou .csv.')
    }
  }

  function usarAba(lista: typeof abas, i: number) {
    setAbaAtual(i)
    const c = acharCabecalho(lista[i].tabela)
    setLinhaCab(c.linha); setMapa(c.mapa); setAjustes({})
  }

  const cabecalho = tabela[linhaCab] ?? []
  const nCols = Math.max(0, ...tabela.slice(linhaCab, linhaCab + 20).map((r) => r.length))
  const nomeColuna = (i: number) => `${letra(i)}${cabecalho[i] ? ` · ${String(cabecalho[i]).trim()}` : ''}`

  const ehDuplicado = (l: LinhaFin) => !!l.data && existentes.has(chaveLancamento(l.data, l.valor!, l.pessoa?.id ?? l.nome))
  const entradas = linhas.filter((l) => !l.saida)
  const saidas = linhas.filter((l) => l.saida)
  const vai = (l: LinhaFin & { fora?: boolean }) => !l.saida && !!l.data && !l.fora && !(ehDuplicado(l) && l.fora !== false)
  const selecionadas = entradas.filter(vai)
  const total = selecionadas.reduce((s, l) => s + l.valor!, 0)
  const temValor = mapa.valor !== undefined || mapa.entrada !== undefined

  async function importar() {
    setEstado('importando'); setErro('')
    const registros = selecionadas.map((l) => ({
      igreja_id: igreja!.id, tipo: l.tipo, valor: l.valor, data: l.data, forma: l.forma, criado_por: userId,
      pessoa_id: l.pessoa?.id ?? null,
      nome: l.pessoa ? null : ([l.nome, l.descricao].filter(Boolean).join(' · ') || null),
    }))
    for (let i = 0; i < registros.length; i += 200) {
      const { error } = await supabase.from('lancamentos').insert(registros.slice(i, i + 200)).select('id')
      if (error) { setErro(`Parou no lançamento ${i + 1}. Os anteriores foram salvos; importe de novo que os repetidos vêm desmarcados.`); setEstado('revisar'); return }
    }
    setImportados({ n: registros.length, total })
    setEstado('pronto')
  }

  const ajustar = (n: number, x: Partial<LinhaFin> & { fora?: boolean }) => setAjustes({ ...ajustes, [n]: { ...ajustes[n], ...x } })

  if (estado === 'pronto') {
    return (
      <>
        <h1 className="titulo">Importação concluída</h1>
        <p className="suave">{importados.n} lançamentos entraram, somando {dinheiro(importados.total)}.</p>
        <div className="acoes">
          <Link className="btn btn-primario" to="/financeiro">Ver dízimos e ofertas</Link>
          <button className="btn" onClick={() => { setAbas([]); setEstado('escolher') }}>Importar outro arquivo</button>
        </div>
      </>
    )
  }

  return (
    <div className="imp-fin">
      <div className="cabecalho">
        <h1 className="titulo">Importar planilha da tesouraria</h1>
      </div>

      {estado === 'escolher' && (
        <>
          <p className="suave">
            Traga os dízimos e ofertas que já estão em planilha. Funciona com Excel (.xlsx), CSV e Google Planilhas
            (Arquivo → Fazer download → .xlsx). Nada é salvo antes de você conferir.
          </p>
          <label className="soltar">
            <Icone nome="importar" />
            <strong>Escolher planilha</strong>
            <span>.xlsx ou .csv</span>
            <input type="file" accept=".xlsx,.csv,.txt,.xls,.ods" onChange={escolher} />
          </label>
          {erro && <p className="erro">{erro}</p>}
          <p className="dica">
            Não tem planilha ainda? <a className="link" href={import.meta.env.BASE_URL + 'modelos/modelo-tesouraria.xlsx'} download>Baixe o modelo</a>,
            preencha no Excel ou Google Planilhas e traga aqui.
          </p>
        </>
      )}

      {estado !== 'escolher' && (
        <>
          <p className="suave">{arquivo}{abas.length > 1 && ` · ${abas.length} abas`}</p>

          <details className="painel colunas-imp" open={!temValor || mapa.data === undefined}>
            <summary>
              <h2>1. Colunas da planilha</h2>
              <span className="suave">
                {[mapa.data !== undefined && 'data', temValor && 'valor', mapa.nome !== undefined && 'nome', mapa.tipo !== undefined && 'tipo', mapa.forma !== undefined && 'forma']
                  .filter(Boolean).join(', ') || 'nada reconhecido'} · toque pra ajustar
              </span>
            </summary>
            <div className="config-imp">
              {abas.length > 1 && (
                <label>Aba
                  <select value={abaAtual} onChange={(e) => usarAba(abas, +e.target.value)}>
                    {abas.map((a, i) => <option key={a.aba + i} value={i}>{a.aba}</option>)}
                  </select>
                </label>
              )}
              <label>Linha do cabeçalho
                <select value={linhaCab} onChange={(e) => { const n = +e.target.value; setLinhaCab(n); setAjustes({}) }}>
                  {tabela.slice(0, 15).map((r, i) => <option key={i} value={i}>{i + 1}: {r.filter((c) => c !== null && c !== '').slice(0, 3).map(String).join(' | ').slice(0, 50)}</option>)}
                </select>
              </label>
              {CAMPOS_FIN.map((c) => (
                <label key={c.id}>{c.nome} <small>{c.dica}</small>
                  <select value={mapa[c.id] ?? ''} onChange={(e) => {
                    const v = e.target.value === '' ? undefined : +e.target.value
                    const novo = { ...mapa, [c.id]: v } as Mapa
                    if (c.id === 'valor' && v !== undefined) { delete novo.entrada; delete novo.saida }
                    if ((c.id === 'entrada' || c.id === 'saida') && v !== undefined) delete novo.valor
                    setMapa(novo); setAjustes({})
                  }}>
                    <option value="">— não tem —</option>
                    {Array.from({ length: nCols }, (_, i) => <option key={i} value={i}>{nomeColuna(i)}</option>)}
                  </select>
                </label>
              ))}
              <label>Tipo quando a planilha não diz
                <select value={tipoPadrao} onChange={(e) => setTipoPadrao(e.target.value as LinhaFin['tipo'])}>
                  {(Object.keys(TIPOS) as LinhaFin['tipo'][]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
                </select>
              </label>
              <label>Forma quando a planilha não diz
                <select value={formaPadrao} onChange={(e) => setFormaPadrao(e.target.value as LinhaFin['forma'])}>
                  {(Object.keys(FORMAS) as LinhaFin['forma'][]).map((t) => <option key={t} value={t}>{FORMAS[t]}</option>)}
                </select>
              </label>
              <label>Ano das datas sem ano
                <input type="number" value={anoPadrao} onChange={(e) => setAnoPadrao(+e.target.value || new Date().getFullYear())} />
              </label>
            </div>
            {!temValor && <p className="erro">Escolha qual coluna tem o valor (ou as colunas de entrada e saída).</p>}
            {mapa.data === undefined && <p className="erro">Escolha qual coluna tem a data.</p>}
          </details>

          {temValor && (
            <section className="painel">
              <h2>2. Conferir lançamentos</h2>
              <div className="resumo-imp">
                <span><strong>{selecionadas.length}</strong> de {entradas.length} entradas marcadas</span>
                <span><strong>{dinheiro(total)}</strong> no total</span>
                {saidas.length > 0 && <span className="tag tag-hoje">{saidas.length} saídas ficam de fora</span>}
              </div>
              {entradas.length === 0 && <p className="vazio">Nenhum lançamento encontrado com essas colunas.</p>}
              <ul className="lista plana linhas-fin">
                {entradas.map((l) => {
                  const dup = ehDuplicado(l)
                  const marcado = vai(l)
                  return (
                    <li key={l.n} className={'linha-fin' + (marcado ? '' : ' desmarcada')}>
                      <button className={'caixa' + (marcado ? ' marcada' : '')} disabled={!l.data}
                        onClick={() => ajustar(l.n, { fora: marcado })} aria-label="Incluir lançamento">
                        {marcado && <Icone nome="check" tam={16} />}
                      </button>
                      <div className="linha-fin-info">
                        <div className="linha-fin-topo">
                          <span className="hora">{l.data ? dataBR(l.data) : '??'}</span>
                          <strong className="valor">{dinheiro(l.valor!)}</strong>
                          <select value={l.tipo} onChange={(e) => ajustar(l.n, { tipo: e.target.value as LinhaFin['tipo'] })}>
                            {(Object.keys(TIPOS) as LinhaFin['tipo'][]).map((t) => <option key={t} value={t}>{TIPOS[t]}</option>)}
                          </select>
                          <small>{FORMAS[l.forma]}</small>
                        </div>
                        <div className="linha-fin-quem">
                          {l.nome && <span className="nome-planilha">“{l.nome}”</span>}
                          <select value={l.pessoa?.id ?? ''} onChange={(e) => ajustar(l.n, { pessoa: pessoas.find((p) => p.id === e.target.value) ?? null })}>
                            <option value="">{l.nome ? 'Sem ficha (fica só o nome)' : 'Sem pessoa'}</option>
                            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                          {l.descricao && <small>{l.descricao}</small>}
                        </div>
                        <div className="avisos">
                          <small>linha {l.n}</small>
                          {dup && <span className="tag tag-alerta">Parece já lançado</span>}
                          {l.problemas.map((p) => <span key={p} className="tag tag-alerta">{p}</span>)}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>

              {saidas.length > 0 && (
                <details className="detalhes">
                  <summary>Ver as {saidas.length} saídas que ficaram de fora</summary>
                  <p>O app ainda controla só entradas. Estas linhas não serão importadas:</p>
                  <ul>{saidas.map((l) => <li key={l.n}>{l.data ? dataBR(l.data) : '??'} · {dinheiro(l.valor!)} · {l.descricao || l.nome || 'sem descrição'}</li>)}</ul>
                </details>
              )}
            </section>
          )}

          {erro && <p className="erro">{erro}</p>}
          <div className="barra-fixa">
            <button className="btn" onClick={() => { setAbas([]); setEstado('escolher') }}>Trocar arquivo</button>
            <button className="btn btn-primario" disabled={!selecionadas.length || estado === 'importando'} onClick={importar}>
              {estado === 'importando' ? 'Importando…' : `Importar ${selecionadas.length} lançamentos`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
