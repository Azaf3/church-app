import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import {
  CAMPOS_FIN, acharCabecalho, chaveLancamento, lerArquivo, melhorAba, montarLinhas,
  type LinhaFin, type Mapa, type PessoaRef, type Tabela,
} from '../lib/importarFinanceiro'
import { ENTRADAS, NOMES_CATEGORIAS, somar } from '../lib/tesouraria'
import { dataBR, dinheiro, podeFinanceiro } from '../lib/util'
import Icone from '../componentes/Icone'

const letra = (i: number): string => (i >= 26 ? letra(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))
const ANO = new Date().getFullYear()

type Ajuste = Partial<LinhaFin> & { fora?: boolean }
type Linha = LinhaFin & Ajuste

export default function ImportarFinanceiro() {
  const { igreja, papel, userId } = useSessao()
  const [abas, setAbas] = useState<{ aba: string; tabela: Tabela }[]>([])
  const [abaAtual, setAbaAtual] = useState(0)
  const [arquivo, setArquivo] = useState('')
  const [linhaCab, setLinhaCab] = useState(0)
  const [mapa, setMapa] = useState<Mapa>({})
  const [pessoas, setPessoas] = useState<PessoaRef[]>([])
  const [existentes, setExistentes] = useState<Set<string>>(new Set())
  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>({})
  const [revisando, setRevisando] = useState(false)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState<'escolher' | 'conferir' | 'importando' | 'pronto'>('escolher')
  const [importados, setImportados] = useState({ n: 0 })

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as PessoaRef[]) ?? []))
  }, [igreja?.id])

  const tabela = abas[abaAtual]?.tabela ?? []
  const linhas: Linha[] = useMemo(
    () => montarLinhas(tabela, linhaCab, mapa, pessoas, { anoPadrao: ANO, tipoPadrao: 'auto', formaPadrao: 'dinheiro' })
      .map((l) => ({ ...l, ...ajustes[l.n] })),
    [tabela, linhaCab, mapa, pessoas, ajustes],
  )

  // o que já está lançado no período não entra de novo
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
      if (!lidas.length) { setErro('Essa planilha está vazia.'); return }
      setArquivo(f.name); setAbas(lidas)
      usarAba(lidas, melhorAba(lidas, ANO))
      setEstado('conferir')
    } catch (err) {
      setErro(err instanceof Error && err.message.includes('formato') ? err.message : 'Não consegui abrir esse arquivo. No Excel, use "Salvar como" .xlsx e tente de novo.')
    }
  }

  function usarAba(lista: typeof abas, i: number) {
    const c = acharCabecalho(lista[i].tabela)
    setAbaAtual(i); setLinhaCab(c.linha); setMapa(c.mapa); setAjustes({})
  }

  const chaveDe = (l: LinhaFin) => chaveLancamento(l.data!, l.valor!, l.pessoa?.id ?? (l.saida ? (l.descricao || l.nome) : l.nome))
  const ehDuplicado = (l: LinhaFin) => !!l.data && existentes.has(chaveDe(l))
  const vai = (l: Linha) => !!l.data && !l.fora && !(ehDuplicado(l) && l.fora !== false)
  const vao = linhas.filter(vai)
  const entradas = vao.filter((l) => !l.saida)
  const saidas = vao.filter((l) => l.saida)
  const duplicados = linhas.filter((l) => ehDuplicado(l) && l.fora !== false).length
  const semData = linhas.filter((l) => !l.data).length
  const entendeu = (mapa.valor !== undefined || mapa.entrada !== undefined) && mapa.data !== undefined && vao.length > 0

  async function importar() {
    setEstado('importando'); setErro('')
    const registros = vao.map((l) => ({
      igreja_id: igreja!.id, valor: l.valor, data: l.data, forma: l.forma, criado_por: userId,
      tipo: l.saida ? 'saida' : l.tipo,
      categoria: l.saida ? l.categoria : null,
      pessoa_id: l.saida ? null : l.pessoa?.id ?? null,
      nome: l.saida ? (l.nome || null) : l.pessoa ? null : (l.nome || null),
      descricao: l.descricao || null,
    }))
    for (let i = 0; i < registros.length; i += 200) {
      const { error } = await supabase.from('lancamentos').insert(registros.slice(i, i + 200)).select('id')
      if (error) {
        setErro(/check|tipo/.test(error.message) ? 'Falta rodar a migração 006 no Supabase pra aceitar saídas.' : 'A conexão falhou no meio. Mande a planilha de novo: o que já entrou é pulado.')
        setEstado('conferir'); return
      }
    }
    setImportados({ n: registros.length })
    setEstado('pronto')
  }

  const ajustar = (n: number, x: Ajuste) => setAjustes({ ...ajustes, [n]: { ...ajustes[n], ...x } })
  const recomecar = () => { setAbas([]); setRevisando(false); setEstado('escolher') }

  if (estado === 'pronto') {
    return (
      <div className="imp-fin">
        <div className="imp-ok">
          <span className="imp-ok-icone"><Icone nome="check" tam={30} /></span>
          <h1 className="titulo">Pronto!</h1>
          <p className="suave">{importados.n} lançamentos entraram na tesouraria.</p>
          <div className="acoes">
            <Link className="btn btn-primario" to="/financeiro">Ver a tesouraria</Link>
            <button className="btn" onClick={recomecar}>Mandar outra planilha</button>
          </div>
        </div>
      </div>
    )
  }

  if (estado === 'escolher') {
    return (
      <div className="imp-fin">
        <h1 className="titulo">Trazer planilha</h1>
        <p className="suave">Mande a planilha que você já usa (Excel ou Google Planilhas). O app entende sozinho as entradas e saídas e mostra o que encontrou antes de salvar.</p>
        <label className="soltar grande">
          <Icone nome="importar" tam={28} />
          <strong>Escolher planilha</strong>
          <span>Excel (.xlsx) ou .csv</span>
          <input type="file" accept=".xlsx,.csv,.txt,.xls,.ods" onChange={escolher} />
        </label>
        {erro && <p className="erro">{erro}</p>}
        <p className="dica">
          No Google Planilhas: Arquivo → Fazer download → Microsoft Excel (.xlsx).
          Ainda não tem planilha? <a className="link" href={import.meta.env.BASE_URL + 'modelos/modelo-tesouraria.xlsx'} download>Baixe o modelo</a>.
        </p>
      </div>
    )
  }

  return (
    <div className="imp-fin">
      <h1 className="titulo">Conferir e importar</h1>
      <p className="suave">{arquivo}{abas.length > 1 && ` · aba “${abas[abaAtual].aba}”`}</p>

      {entendeu ? (
        <section className="painel imp-resumo">
          <p className="imp-frase">Encontrei <b>{vao.length} lançamentos</b></p>
          <div className="imp-duplo">
            <div><span>Entradas</span><strong className="pos">{dinheiro(somar(entradas))}</strong><small>{entradas.length} lançamentos</small></div>
            <div><span>Saídas</span><strong className="neg">{dinheiro(somar(saidas))}</strong><small>{saidas.length} lançamentos</small></div>
          </div>
          {(duplicados > 0 || semData > 0) && (
            <ul className="imp-fora">
              {duplicados > 0 && <li>{duplicados} já estavam lançados e foram pulados</li>}
              {semData > 0 && <li>{semData} {semData === 1 ? 'linha sem data ficou' : 'linhas sem data ficaram'} de fora</li>}
            </ul>
          )}
          <button className="btn btn-primario btn-grande" onClick={importar} disabled={estado === 'importando'}>
            {estado === 'importando' ? 'Importando…' : `Importar ${vao.length} lançamentos`}
          </button>
          <button className="link" onClick={() => setRevisando(!revisando)}>{revisando ? 'Esconder a lista' : 'Ver a lista antes'}</button>
        </section>
      ) : (
        <section className="painel">
          <p><b>Não consegui entender essa planilha sozinho.</b> Me diga, abaixo, qual coluna tem a data e qual tem o valor.</p>
        </section>
      )}

      {erro && <p className="erro">{erro}</p>}

      {(revisando || !entendeu) && linhas.length > 0 && (
        <section className="painel">
          <h2>Lançamentos encontrados</h2>
          <p className="dica">Toque no quadradinho pra tirar algum. Dá pra trocar o tipo, a pessoa e a categoria.</p>
          <ul className="lista plana linhas-fin">
            {linhas.map((l) => {
              const marcado = vai(l)
              return (
                <li key={l.n} className={'linha-fin' + (marcado ? '' : ' desmarcada')}>
                  <button className={'caixa' + (marcado ? ' marcada' : '')} disabled={!l.data}
                    onClick={() => ajustar(l.n, { fora: marcado })} aria-label="Incluir lançamento">
                    {marcado && <Icone nome="check" tam={16} />}
                  </button>
                  <div className="linha-fin-info">
                    <div className="linha-fin-topo">
                      <span className="hora">{l.data ? dataBR(l.data) : 'sem data'}</span>
                      <strong className={'valor ' + (l.saida ? 'neg' : 'pos')}>{l.saida ? '−' : '+'} {dinheiro(l.valor!)}</strong>
                      {l.saida ? (
                        <select value={l.categoria ?? ''} onChange={(e) => ajustar(l.n, { categoria: e.target.value })}>
                          {NOMES_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <select value={l.tipo} onChange={(e) => ajustar(l.n, { tipo: e.target.value as LinhaFin['tipo'] })}>
                          {(Object.keys(ENTRADAS) as LinhaFin['tipo'][]).map((t) => <option key={t} value={t}>{ENTRADAS[t]}</option>)}
                        </select>
                      )}
                    </div>
                    <div className="linha-fin-quem">
                      {l.saida
                        ? <span>{l.descricao || l.nome || 'Sem descrição'}</span>
                        : (
                          <select value={l.pessoa?.id ?? ''} onChange={(e) => ajustar(l.n, { pessoa: pessoas.find((p) => p.id === e.target.value) ?? null })}>
                            <option value="">{l.nome ? `${l.nome} (sem ficha)` : l.descricao || 'Sem nome'}</option>
                            {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        )}
                      {ehDuplicado(l) && <span className="tag tag-alerta">já lançado</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <details className="painel colunas-imp" open={!entendeu}>
        <summary><h2>{entendeu ? 'Algo errado? Ajustar colunas' : 'Qual coluna é qual'}</h2></summary>
        <div className="config-imp">
          {abas.length > 1 && (
            <label>Aba
              <select value={abaAtual} onChange={(e) => usarAba(abas, +e.target.value)}>
                {abas.map((a, i) => <option key={a.aba + i} value={i}>{a.aba}</option>)}
              </select>
            </label>
          )}
          <label>Linha dos títulos
            <select value={linhaCab} onChange={(e) => { setLinhaCab(+e.target.value); setAjustes({}) }}>
              {tabela.slice(0, 15).map((r, i) => <option key={i} value={i}>{i + 1}: {r.filter((c) => c !== null && c !== '').slice(0, 3).map(String).join(' | ').slice(0, 45)}</option>)}
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
                {Array.from({ length: Math.max(0, ...tabela.slice(linhaCab, linhaCab + 20).map((r) => r.length)) }, (_, i) => (
                  <option key={i} value={i}>{letra(i)}{tabela[linhaCab]?.[i] ? ` · ${String(tabela[linhaCab][i]).trim()}` : ''}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>

      <button className="link" onClick={recomecar}>Escolher outra planilha</button>
    </div>
  )
}
