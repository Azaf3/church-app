import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buscarTudo } from '../lib/buscarTudo'
import { useSessao } from '../lib/sessao'
import {
  CAMPOS_FIN, acharCabecalho, chaveLancamento, lerArquivo, lerRelacoes, lerTodasAbas, montarLinhas,
  type LinhaFin, type Mapa, type PessoaRef, type Tabela,
} from '../lib/importarFinanceiro'
import { ENTRADAS, FUNDOS, NOMES_CATEGORIAS, mesCurto, somar, type Fundo } from '../lib/tesouraria'
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
  const [jaLancados, setJaLancados] = useState(0)
  const [mesesFechados, setMesesFechados] = useState<string[]>([])
  const [existentes, setExistentes] = useState<Set<string>>(new Set())
  const [ajustes, setAjustes] = useState<Record<number, Ajuste>>({})
  const [revisando, setRevisando] = useState(false)
  const [erro, setErro] = useState('')
  const [estado, setEstado] = useState<'escolher' | 'conferir' | 'importando' | 'pronto'>('escolher')
  const [importados, setImportados] = useState({ n: 0, rel: 0 })
  const [modo, setModo] = useState<'todas' | 'uma'>('todas')
  const [temSaldoInicial, setTemSaldoInicial] = useState(false)

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as PessoaRef[]) ?? []))
  }, [igreja?.id])

  useEffect(() => {
    if (!igreja) return
    supabase.from('fechamentos').select('mes, situacao').eq('igreja_id', igreja.id)
      .then(({ data }) => setMesesFechados(((data ?? []) as { mes: string; situacao: string }[]).filter((f) => f.situacao === 'fechado').map((f) => f.mes)))
  }, [igreja?.id])
  useEffect(() => {
    if (!igreja) return
    supabase.from('lancamentos').select('id').eq('igreja_id', igreja.id).eq('tipo', 'saldo_inicial').limit(1)
      .then(({ data }) => setTemSaldoInicial(!!data?.length))
  }, [igreja?.id, estado])

  const tabela = abas[abaAtual]?.tabela ?? []
  // modo "todas": lê todas as abas de livro-caixa (um mês por aba) de uma vez
  const todas = useMemo(() => lerTodasAbas(abas, pessoas, ANO), [abas, pessoas])
  const linhas: Linha[] = useMemo(
    () => (modo === 'todas'
      ? todas.linhas
      : montarLinhas(tabela, linhaCab, mapa, pessoas, { anoPadrao: ANO, tipoPadrao: 'auto', formaPadrao: 'dinheiro' }))
      .map((l) => ({ ...l, ...ajustes[l.n] }))
      .filter((l) => !l.data || !mesesFechados.includes(l.data.slice(0, 7))),
    [modo, todas, tabela, linhaCab, mapa, pessoas, ajustes, mesesFechados],
  )
  const saldoInicial = modo === 'todas' && !temSaldoInicial && todas.saldoInicial && todas.saldoInicial.valor > 0 ? todas.saldoInicial : null

  // meses que a planilha traz: o que já estiver lançado neles é trocado pelo da planilha
  // (mês com 1 ou 2 linhas "perdidas" numa aba de outro mês não é trocado: só não duplica)
  const contaMes = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of linhas) if (l.data && !l.fora) c[l.data.slice(0, 7)] = (c[l.data.slice(0, 7)] ?? 0) + 1
    return c
  }, [linhas])
  const mesesDaPlanilha = Object.keys(contaMes).filter((m) => contaMes[m] >= 3).sort()
  const mesesSoltos = Object.keys(contaMes).filter((m) => contaMes[m] < 3).sort()
  useEffect(() => {
    if (!igreja || !mesesSoltos.length) { setExistentes(new Set()); return }
    supabase.from('lancamentos').select('data, valor, pessoa_id, nome, descricao').eq('igreja_id', igreja.id)
      .gte('data', mesesSoltos[0] + '-01').lte('data', mesesSoltos[mesesSoltos.length - 1] + '-31')
      .then(({ data }) => setExistentes(new Set((data ?? []).flatMap((l: { data: string; valor: number; pessoa_id: string | null; nome: string | null; descricao: string | null }) =>
        [chaveLancamento(l.data, l.valor, l.pessoa_id ?? l.nome ?? ''), chaveLancamento(l.data, l.valor, l.descricao ?? '')]))))
  }, [igreja?.id, mesesSoltos.join()])
  useEffect(() => {
    if (!igreja || !mesesDaPlanilha.length) { setJaLancados(0); return }
    supabase.from('lancamentos').select('id, data').eq('igreja_id', igreja.id).neq('tipo', 'saldo_inicial')
      .gte('data', mesesDaPlanilha[0] + '-01').lte('data', mesesDaPlanilha[mesesDaPlanilha.length - 1] + '-31')
      .then(({ data }) => setJaLancados((data ?? []).filter((l: { data: string }) => mesesDaPlanilha.includes(l.data.slice(0, 7))).length))
  }, [igreja?.id, mesesDaPlanilha.join()])

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
      const auto = lerTodasAbas(lidas, pessoas, ANO)
      setModo(auto.linhas.some((l) => l.data) ? 'todas' : 'uma')
      usarAba(lidas, 0)
      setEstado('conferir')
    } catch (err) {
      setErro(err instanceof Error && err.message.includes('formato') ? err.message : 'Não consegui abrir esse arquivo. No Excel, use "Salvar como" .xlsx e tente de novo.')
    }
  }

  function usarAba(lista: typeof abas, i: number) {
    const c = acharCabecalho(lista[i].tabela)
    setAbaAtual(i); setLinhaCab(c.linha); setMapa(c.mapa); setAjustes({})
  }

  const ehRepetido = (l: LinhaFin) => !!l.data && mesesSoltos.includes(l.data.slice(0, 7))
    && (existentes.has(chaveLancamento(l.data, l.valor!, l.pessoa?.id ?? l.nome)) || existentes.has(chaveLancamento(l.data, l.valor!, l.descricao)))
  const vai = (l: Linha) => !!l.data && !l.fora && !ehRepetido(l)
  const vao = linhas.filter(vai)
  const entradas = vao.filter((l) => !l.saida)
  const saidas = vao.filter((l) => l.saida)
  const semData = linhas.filter((l) => !l.data).length
  // relação de dizimistas/ofertantes (abas "Relação ...")
  const relacoes = useMemo(() => (modo === 'todas' ? lerRelacoes(abas) : []), [abas, modo])
  const anoArquivo = useMemo(() => {
    const c: Record<string, number> = {}
    for (const l of linhas) if (l.data) c[l.data.slice(0, 4)] = (c[l.data.slice(0, 4)] ?? 0) + 1
    const melhor = Object.entries(c).sort((x, y) => y[1] - x[1])[0]
    return melhor ? Number(melhor[0]) : ANO
  }, [linhas])
  const entendeu = modo === 'todas'
    ? vao.length > 0 || relacoes.length > 0
    : (mapa.valor !== undefined || mapa.entrada !== undefined) && mapa.data !== undefined && vao.length > 0
  const porFundo = (f: Fundo) => vao.filter((l) => l.fundo === f)
  const meses = modo === 'todas' ? todas.abas : []

  async function importar() {
    setEstado('importando'); setErro('')
    const registros = vao.map((l) => ({
      igreja_id: igreja!.id, valor: l.valor, data: l.data, forma: l.forma, criado_por: userId,
      tipo: l.saida ? 'saida' : l.tipo,
      categoria: l.saida ? l.categoria : null,
      pessoa_id: l.saida ? null : l.pessoa?.id ?? null,
      nome: l.saida ? (l.nome || null) : l.pessoa ? null : (l.nome || null),
      descricao: l.descricao || null,
      fundo: l.fundo,
    }))
    if (saldoInicial) {
      registros.unshift({
        igreja_id: igreja!.id, valor: Math.round(saldoInicial.valor * 100) / 100, data: saldoInicial.data, forma: 'dinheiro',
        criado_por: userId, tipo: 'saldo_inicial', categoria: null, pessoa_id: null, nome: null,
        descricao: `Saldo anterior (${saldoInicial.aba.trim()})`, fundo: 'geral',
      } as (typeof registros)[number])
    }
    // planilha sobreposta: apaga o que já havia nesses meses antes de gravar
    for (const m of mesesDaPlanilha) {
      const { error } = await supabase.from('lancamentos').delete().eq('igreja_id', igreja!.id).neq('tipo', 'saldo_inicial')
        .gte('data', m + '-01').lte('data', m + '-31')
      if (error) { setErro('Não consegui trocar os lançamentos antigos. Tente de novo.'); setEstado('conferir'); return }
    }
    for (let i = 0; i < registros.length; i += 200) {
      const { error } = await supabase.from('lancamentos').insert(registros.slice(i, i + 200)).select('id')
      if (error) {
        setErro(/check|tipo|fundo/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'A conexão falhou no meio. Mande a planilha de novo: os meses dela são trocados por inteiro.')
        setEstado('conferir'); return
      }
    }
    // relação: o ano/tipo da planilha substitui o que havia
    let nRel = 0
    if (relacoes.length) {
      const { data: jaTem } = await buscarTudo<{ id: string; codigo: string }>((de, ate) => supabase.from('contribuintes').select('id, codigo').eq('igreja_id', igreja!.id).order('id').range(de, ate))
      const ids = new Map(((jaTem ?? []) as { id: string; codigo: string }[]).map((c) => [c.codigo, c.id]))
      const novos = [...new Set(relacoes.flatMap((r) => r.linhas.map((l) => l.codigo)))].filter((c) => !ids.has(c))
      if (novos.length) {
        const { data: criados, error } = await supabase.from('contribuintes')
          .insert(novos.map((codigo) => ({ igreja_id: igreja!.id, codigo }))).select('id, codigo')
        if (error) { setErro(/relation|does not exist|schema cache/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não consegui gravar a relação de dizimistas.'); setEstado('conferir'); return }
        for (const c of (criados ?? []) as { id: string; codigo: string }[]) ids.set(c.codigo, c.id)
      }
      for (const r of relacoes) {
        await supabase.from('contribuicoes').delete().eq('igreja_id', igreja!.id).eq('ano', anoArquivo).eq('tipo', r.tipo)
        const regs = r.linhas.flatMap((l) => l.valores.map((v, k) => (v ? {
          igreja_id: igreja!.id, contribuinte_id: ids.get(l.codigo)!, ano: anoArquivo, mes: k + 1, tipo: r.tipo, valor: v,
        } : null)).filter(Boolean))
        // a mesma pessoa pode aparecer em duas linhas: soma
        const soma = new Map<string, { contribuinte_id: string; mes: number; valor: number } & Record<string, unknown>>()
        for (const x of regs as { contribuinte_id: string; mes: number; valor: number }[]) {
          const k = x.contribuinte_id + '|' + x.mes
          const j = soma.get(k); if (j) j.valor = Math.round((j.valor + x.valor) * 100) / 100; else soma.set(k, { ...x })
        }
        const lista = [...soma.values()]
        for (let i = 0; i < lista.length; i += 200) await supabase.from('contribuicoes').insert(lista.slice(i, i + 200))
        nRel += new Set(lista.map((x) => x.contribuinte_id)).size
      }
    }
    setImportados({ n: registros.length, rel: nRel })
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
          <p className="suave">{importados.n} lançamentos entraram na tesouraria{importados.rel > 0 && <>, e a relação de dizimistas e ofertantes foi atualizada</>}.</p>
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
          <p className="imp-frase">
            Encontrei <b>{vao.length} lançamentos</b>
            {meses.length > 1 && <> em <b>{meses.length} meses</b> ({meses[0].trim()} a {meses[meses.length - 1].trim()})</>}
          </p>
          <div className="imp-duplo">
            <div><span>Entradas</span><strong className="pos">{dinheiro(somar(entradas))}</strong><small>{entradas.length} lançamentos</small></div>
            <div><span>Saídas</span><strong className="neg">{dinheiro(somar(saidas))}</strong><small>{saidas.length} lançamentos</small></div>
          </div>
          <div className="imp-chips">
            {(Object.keys(FUNDOS) as Fundo[]).filter((f) => porFundo(f).length).map((f) => (
              <span key={f} className="tag">{FUNDOS[f]}: {porFundo(f).length}</span>
            ))}
          </div>
          {relacoes.length > 0 && (
            <p className="imp-saldo">
              {relacoes.map((r) => `${r.tipo === 'dizimo' ? 'Dizimistas' : 'Ofertantes'}: ${r.linhas.filter((l) => l.valores.some(Boolean)).length} com contribuição em ${anoArquivo}`).join(' · ')}
              {' '}(da aba de relação, sem mexer no caixa)
            </p>
          )}
          {saldoInicial && (
            <p className="imp-saldo">Saldo anterior de {saldoInicial.aba.trim()}: <b>{dinheiro(saldoInicial.valor)}</b> (entra como saldo inicial do caixa)</p>
          )}
          {mesesFechados.length > 0 && (
            <p className="imp-troca">Meses fechados não mudam: {mesesFechados.sort().map(mesCurto).join(', ')} ficam de fora desta importação.</p>
          )}
          {jaLancados > 0 && (
            <p className="imp-troca">
              <b>Já existem {jaLancados} lançamentos</b> em {mesesDaPlanilha.length === 1 ? mesCurto(mesesDaPlanilha[0]) : `${mesCurto(mesesDaPlanilha[0])} a ${mesCurto(mesesDaPlanilha[mesesDaPlanilha.length - 1])}`}.
              Eles vão ser <b>trocados</b> pelos desta planilha, sem duplicar.
            </p>
          )}
          {semData > 0 && (
            <ul className="imp-fora">
              {semData > 0 && <li>{semData} {semData === 1 ? 'linha sem data ficou' : 'linhas sem data ficaram'} de fora (anotações de rodapé, como a lista de ofertas de missões)</li>}
            </ul>
          )}
          <button className="btn btn-primario btn-grande" onClick={importar} disabled={estado === 'importando'}>
            {estado === 'importando' ? 'Importando…' : vao.length ? `Importar ${vao.length + (saldoInicial ? 1 : 0)} lançamentos${relacoes.length ? ' e a relação' : ''}` : 'Importar a relação'}
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
                      {l.problemas.length > 0 && <small className="aviso-linha">{l.problemas.join(' · ')}</small>}
                      <select className="sel-fundo" value={l.fundo} onChange={(e) => ajustar(l.n, { fundo: e.target.value as Fundo })}>
                        {(Object.keys(FUNDOS) as Fundo[]).map((f) => <option key={f} value={f}>{FUNDOS[f]}</option>)}
                      </select>
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
                      {ehRepetido(l) && <span className="tag tag-alerta">já lançado</span>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <details className="painel colunas-imp" open={!entendeu} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setModo('uma') }}>
        <summary><h2>{entendeu ? 'Algo errado? Ajustar colunas (uma aba por vez)' : 'Qual coluna é qual'}</h2></summary>
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
