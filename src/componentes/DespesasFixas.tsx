import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizar } from '../lib/importar'
import type { DespesaFixa, Lancamento } from '../lib/tipos'
import { FUNDOS, NOMES_CATEGORIAS, OUTRAS, adivinharCategoria, ehSaida, type Fundo } from '../lib/tesouraria'
import { dataBR, dinheiro, MESES } from '../lib/util'

// "Prebenda pastoral (parcial)" e "Prebenda pastoral (total)" são a mesma despesa
const PARCIAL = /\b(parcial|total|restante|final)\b/gi
const limpar = (d: string) => d.replace(PARCIAL, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim()
const chave = (d: string | null) => normalizar(limpar(d ?? '').replace(/[()]/g, ' ').replace(/[\d/]+/g, '')).replace(/\s+/g, ' ').trim()
// parcelas ("2 de 4") não são despesa fixa
const ehParcela = (d: string | null) => /\d+\s*de\s*\d+/i.test(d ?? '')
const ultimoDia = (mes: string) => { const [a, m] = mes.split('-').map(Number); return new Date(a, m, 0).getDate() }
const lerValor = (t: string) => Number(t.replace(/\./g, '').replace(',', '.'))
const mostrar = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// despesas que se repetem todo mês: confere os valores e lança todas de uma vez
export default function DespesasFixas({ mes, igrejaId, userId, todos, lancadas }: {
  mes: string; igrejaId: string; userId: string; todos: Lancamento[]; lancadas: (ls: Lancamento[]) => void
}) {
  const [fixas, setFixas] = useState<DespesaFixa[] | null>(null)
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [valores, setValores] = useState<Record<string, string>>({})
  const [editando, setEditando] = useState<DespesaFixa | 'nova' | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [a, m] = mes.split('-').map(Number)

  async function carregar() {
    const { data, error } = await supabase.from('despesas_fixas').select('*').eq('igreja_id', igrejaId).order('dia').order('descricao')
    if (error) { setErro(/relation|schema cache|does not exist/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não consegui carregar as despesas fixas.'); setFixas([]); return }
    setFixas((data as DespesaFixa[]) ?? [])
  }
  useEffect(() => { carregar() }, [igrejaId])

  const jaLancada = (f: DespesaFixa) => todos.find((l) => l.fixa_id === f.id && l.data.startsWith(mes))
  const ativas = (fixas ?? []).filter((f) => f.ativa)

  useEffect(() => {
    const mk: Record<string, boolean> = {}, vs: Record<string, string> = {}
    for (const f of ativas) { mk[f.id] = !jaLancada(f); vs[f.id] = mostrar(Number(f.valor)) }
    setMarcadas(mk); setValores(vs)
  }, [fixas, mes])

  // sugestões: saídas que aparecem em 3 ou mais dos últimos 6 meses
  const sugestoes = useMemo(() => {
    const desde = new Date(a, m - 7, 1).toISOString().slice(0, 7)
    const grupos = new Map<string, Lancamento[]>()
    for (const l of todos) {
      if (!ehSaida(l) || l.data.slice(0, 7) < desde || l.data.slice(0, 7) >= mes || ehParcela(l.descricao)) continue
      const k = chave(l.descricao || l.categoria)
      if (k.length < 3) continue
      grupos.set(k, [...(grupos.get(k) ?? []), l])
    }
    const existentes = new Set((fixas ?? []).map((f) => chave(f.descricao)))
    return [...grupos.entries()]
      .filter(([k, ls]) => !existentes.has(k) && new Set(ls.map((l) => l.data.slice(0, 7))).size >= 3)
      .map(([, ls]) => {
        const ultimoMes = ls.map((l) => l.data.slice(0, 7)).sort().pop()!
        const doMes = ls.filter((l) => l.data.startsWith(ultimoMes)).sort((x, y) => x.data.localeCompare(y.data))
        const ref = doMes[0]
        return {
          descricao: limpar(ref.descricao ?? ref.categoria ?? 'Despesa'),
          categoria: ref.categoria, fundo: ref.fundo ?? 'geral', dia: Number(ref.data.slice(8, 10)),
          valor: Math.round(doMes.reduce((s, l) => s + Number(l.valor), 0) * 100) / 100,
        }
      }).sort((x, y) => x.dia - y.dia)
  }, [todos, fixas, mes])

  async function adicionarSugestoes() {
    setSalvando(true)
    const { error } = await supabase.from('despesas_fixas').insert(sugestoes.map((s) => ({ igreja_id: igrejaId, ...s })))
    setSalvando(false)
    if (error) { setErro('Não consegui salvar as sugestões.'); return }
    carregar()
  }

  async function lancar() {
    const escolhidas = ativas.filter((f) => marcadas[f.id] && !jaLancada(f))
    if (escolhidas.some((f) => !(lerValor(valores[f.id] ?? '') > 0))) { setErro('Tem valor vazio ou inválido.'); return }
    setSalvando(true); setErro('')
    const regs = escolhidas.map((f) => ({
      igreja_id: igrejaId, tipo: 'saida', valor: lerValor(valores[f.id]), forma: 'pix', criado_por: userId,
      data: `${mes}-${String(Math.min(f.dia, ultimoDia(mes))).padStart(2, '0')}`,
      descricao: f.descricao, categoria: f.categoria || adivinharCategoria(f.descricao) || OUTRAS, fundo: f.fundo,
      pessoa_id: null, nome: null, fixa_id: f.id,
    }))
    const { data, error } = await supabase.from('lancamentos').insert(regs).select()
    setSalvando(false)
    if (error) { setErro(/mes fechado/.test(error.message) ? 'Esse mês está fechado.' : 'Não consegui lançar. Tente de novo.'); return }
    lancadas((data as Lancamento[]) ?? [])
  }

  if (fixas === null) return <div className="spinner" />
  if (editando) {
    return <FormFixa inicial={editando === 'nova' ? null : editando} igrejaId={igrejaId}
      pronto={() => { setEditando(null); carregar() }} />
  }

  const aLancar = ativas.filter((f) => marcadas[f.id] && !jaLancada(f))
  const total = aLancar.reduce((s, f) => s + (lerValor(valores[f.id] ?? '') || 0), 0)

  return (
    <div className="fixas">
      {erro && <p className="erro">{erro}</p>}
      {ativas.length === 0 && (
        <p className="suave">Cadastre as despesas que se repetem todo mês (aluguel, prebenda, luz...). Depois, a cada mês, é só conferir os valores e lançar todas de uma vez.</p>
      )}

      {ativas.length > 0 && (
        <>
          <p className="suave">Confira os valores de {MESES[m - 1].toLowerCase()} e lance. O que já foi lançado neste mês aparece marcado.</p>
          <ul className="fixas-lista">
            {ativas.map((f) => {
              const feita = jaLancada(f)
              return (
                <li key={f.id} className={feita ? 'feita' : ''}>
                  <input type="checkbox" checked={!!feita || !!marcadas[f.id]} disabled={!!feita}
                    onChange={(e) => setMarcadas({ ...marcadas, [f.id]: e.target.checked })} aria-label={`Lançar ${f.descricao}`} />
                  <button type="button" className="fixa-nome" onClick={() => setEditando(f)}>
                    <strong>{f.descricao}</strong>
                    <small>dia {f.dia}{f.fundo !== 'geral' ? ` · ${FUNDOS[f.fundo]}` : ''}{feita ? ` · lançada em ${dataBR(feita.data)}` : ''}</small>
                  </button>
                  {feita
                    ? <span className="fixa-valor">{dinheiro(Number(feita.valor))}</span>
                    : <input className="fixa-valor" inputMode="decimal" value={valores[f.id] ?? ''} onChange={(e) => setValores({ ...valores, [f.id]: e.target.value })} aria-label={`Valor de ${f.descricao}`} />}
                </li>
              )
            })}
          </ul>
          <button className="btn btn-saida-cheio btn-grande" onClick={lancar} disabled={salvando || aLancar.length === 0}>
            {salvando ? 'Lançando…' : aLancar.length ? `Lançar ${aLancar.length} ${aLancar.length === 1 ? 'despesa' : 'despesas'} · ${dinheiro(total)}` : `Tudo de ${MESES[m - 1].toLowerCase()} já foi lançado`}
          </button>
        </>
      )}

      {sugestoes.length > 0 && (
        <div className="fixas-sugestao">
          <strong>Encontrei {sugestoes.length} despesas que se repetem nos seus lançamentos</strong>
          <ul>{sugestoes.map((s) => <li key={s.descricao}>{s.descricao} <span>dia {s.dia} · {dinheiro(s.valor)}</span></li>)}</ul>
          <button className="btn" onClick={adicionarSugestoes} disabled={salvando}>Adicionar como despesas fixas</button>
        </div>
      )}
      <button className="link" onClick={() => setEditando('nova')}>+ Nova despesa fixa</button>
    </div>
  )
}

function FormFixa({ inicial, igrejaId, pronto }: { inicial: DespesaFixa | null; igrejaId: string; pronto: () => void }) {
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '')
  const [valor, setValor] = useState(inicial ? mostrar(Number(inicial.valor)) : '')
  const [dia, setDia] = useState(String(inicial?.dia ?? 5))
  const [categoria, setCategoria] = useState(inicial?.categoria ?? '')
  const [fundo, setFundo] = useState<Fundo>(inicial?.fundo ?? 'geral')
  const [erro, setErro] = useState('')

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    const v = lerValor(valor), d = Number(dia)
    if (!descricao.trim()) { setErro('Coloque a descrição.'); return }
    if (!(v > 0)) { setErro('Valor inválido.'); return }
    if (!(d >= 1 && d <= 31)) { setErro('O dia vai de 1 a 31.'); return }
    const reg = { descricao: descricao.trim(), valor: v, dia: d, categoria: categoria || null, fundo }
    const { error } = inicial
      ? await supabase.from('despesas_fixas').update(reg).eq('id', inicial.id)
      : await supabase.from('despesas_fixas').insert({ igreja_id: igrejaId, ...reg })
    if (error) { setErro('Não deu pra salvar.'); return }
    pronto()
  }
  async function tirar() {
    await supabase.from('despesas_fixas').update({ ativa: false }).eq('id', inicial!.id)
    pronto()
  }

  return (
    <form className="form" onSubmit={salvar}>
      <label>Descrição<input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Aluguel das salas" autoFocus={!inicial} /></label>
      <div className="linha-2">
        <label>Valor de sempre (R$)<input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} /></label>
        <label>Dia do mês<input inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} /></label>
      </div>
      <label>Categoria
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Automática pela descrição</option>
          {NOMES_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      <label>Caixa
        <select value={fundo} onChange={(e) => setFundo(e.target.value as Fundo)}>
          {(Object.keys(FUNDOS) as Fundo[]).map((f) => <option key={f} value={f}>{FUNDOS[f]}</option>)}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Salvar</button>
      {inicial && <button type="button" className="btn btn-perigo" onClick={tirar}>Não repetir mais</button>}
      <button type="button" className="link" onClick={pronto}>Voltar</button>
    </form>
  )
}
