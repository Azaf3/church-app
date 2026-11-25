import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buscarTudo } from '../lib/buscarTudo'
import { useSessao } from '../lib/sessao'
import type { Lancamento } from '../lib/tipos'
import { dinheiro, podeFinanceiro } from '../lib/util'
import { FUNDOS, OUTRAS, ehSaida, somar, type Fundo } from '../lib/tesouraria'
import TesAbas from '../componentes/TesAbas'

type Visao = 'tudo' | Fundo
const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// visão do ano: igual ao resumo da planilha (dízimos, ofertas, despesas, saldo), mês a mês e em gráfico
export default function TesAno() {
  const { igreja, papel } = useSessao()
  const [todos, setTodos] = useState<Lancamento[] | null>(null)
  const [ano, setAno] = useState(new Date().getFullYear())
  const [visao, setVisao] = useState<Visao>('tudo')

  useEffect(() => {
    if (!igreja || !podeFinanceiro(papel)) return
    buscarTudo<Lancamento>((de, ate) => supabase.from('lancamentos').select('*').eq('igreja_id', igreja.id).order('data').order('id').range(de, ate))
      .then(({ data }) => setTodos((data as Lancamento[]) ?? []))
  }, [igreja?.id, papel])

  const anos = useMemo(() => {
    const s = new Set((todos ?? []).map((l) => Number(l.data.slice(0, 4))))
    s.add(new Date().getFullYear())
    return [...s].sort()
  }, [todos])

  const r = useMemo(() => {
    const ls = (todos ?? []).filter((l) => visao === 'tudo' || (l.fundo ?? 'geral') === visao)
    const saldoAntes = (ym: string) => {
      const x = ls.filter((l) => l.data.slice(0, 7) < ym)
      return somar(x.filter((l) => !ehSaida(l))) - somar(x.filter(ehSaida))
    }
    const meses = MES3.map((_, i) => {
      const ym = `${ano}-${String(i + 1).padStart(2, '0')}`
      const x = ls.filter((l) => l.data.startsWith(ym))
      const diz = somar(x.filter((l) => l.tipo === 'dizimo'))
      const ofe = somar(x.filter((l) => l.tipo === 'oferta'))
      const out = somar(x.filter((l) => l.tipo === 'outro'))
      const sai = somar(x.filter(ehSaida))
      const ini = somar(x.filter((l) => l.tipo === 'saldo_inicial'))
      return { ym, diz, ofe, out, arr: diz + ofe, ent: diz + ofe + out, sai, res: diz + ofe + out - sai, fim: saldoAntes(ym) + ini + diz + ofe + out - sai, tem: x.length > 0 }
    })
    const comDado = meses.filter((m) => m.tem)
    const tot = (k: 'diz' | 'ofe' | 'out' | 'arr' | 'ent' | 'sai' | 'res') => meses.reduce((s, m) => s + m[k], 0)
    const doAno = ls.filter((l) => l.data.startsWith(String(ano)))
    const porCategoria = Object.entries(doAno.filter(ehSaida).reduce<Record<string, number>>((acc, l) => {
      const c = l.categoria || OUTRAS; acc[c] = (acc[c] ?? 0) + Number(l.valor); return acc
    }, {})).sort((a, b) => b[1] - a[1])
    return { meses, n: Math.max(1, comDado.length), tot, porCategoria, ultimo: comDado[comDado.length - 1] }
  }, [todos, ano, visao])

  if (!podeFinanceiro(papel)) return <p className="vazio">A tesouraria é visível só pra pastor, tesoureiro e administrador.</p>
  if (!todos) return <div className="spinner" />

  const maior = Math.max(1, ...r.meses.flatMap((m) => [m.ent, m.sai]))
  const maiorCat = Math.max(1, ...r.porCategoria.map((c) => c[1]))
  const linhasTabela: [string, (m: (typeof r.meses)[number]) => number, string?][] = [
    ['Dízimos', (m) => m.diz],
    ['Ofertas', (m) => m.ofe],
    ['Arrecadação (dízimos + ofertas)', (m) => m.arr, 'forte'],
    ['Outras entradas', (m) => m.out],
    ['Total de entradas', (m) => m.ent, 'forte'],
    ['Despesas', (m) => m.sai, 'neg'],
    ['Resultado do mês', (m) => m.res, 'res'],
    ['Saldo no fim do mês', (m) => m.fim, 'forte'],
  ]

  return (
    <div className="tesouraria tes-ano">
      <div className="cabecalho">
        <h1 className="titulo">Tesouraria</h1>
        <div className="acoes-topo sem-impressao">
          <select className="sel-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>
      <TesAbas />
      <p className="so-impressao">{igreja?.nome} · Tesouraria · Resumo de {ano}{visao !== 'tudo' ? ` · ${FUNDOS[visao]}` : ''}</p>

      <div className="seg sem-impressao">
        {(['tudo', 'geral', 'missoes', 'sete'] as Visao[]).map((v) => (
          <button key={v} className={visao === v ? 'ativo' : ''} onClick={() => setVisao(v)}>{v === 'tudo' ? 'Todos os caixas' : FUNDOS[v]}</button>
        ))}
      </div>

      <div className="numeros cinco">
        <div className="numero"><span>Dízimos em {ano}</span><strong className="valor">{dinheiro(r.tot('diz'))}</strong><small>média {dinheiro(r.tot('diz') / r.n)}/mês</small></div>
        <div className="numero"><span>Ofertas</span><strong className="valor">{dinheiro(r.tot('ofe'))}</strong><small>média {dinheiro(r.tot('ofe') / r.n)}/mês</small></div>
        <div className="numero"><span>Outras entradas</span><strong className="valor">{dinheiro(r.tot('out'))}</strong><small>SETE, devoluções, etc.</small></div>
        <div className="numero"><span>Despesas</span><strong className="valor neg">{dinheiro(r.tot('sai'))}</strong><small>média {dinheiro(r.tot('sai') / r.n)}/mês</small></div>
        <div className="numero saldo-caixa"><span>Saldo atual</span><strong className="valor">{dinheiro(r.ultimo?.fim ?? 0)}</strong><small>{r.ultimo ? `no fim de ${MES3[Number(r.ultimo.ym.slice(5)) - 1]}` : 'sem lançamentos'}</small></div>
      </div>

      <section className="painel">
        <h2>Mês a mês</h2>
        <div className="grafico-ano">
          {r.meses.map((m, i) => (
            <div key={m.ym} className="ga-mes" title={`${MES3[i]}: dízimos ${dinheiro(m.diz)}, ofertas ${dinheiro(m.ofe)}, outras ${dinheiro(m.out)}, despesas ${dinheiro(m.sai)}`}>
              <div className="ga-barras">
                <div className="ga-pilha" style={{ height: `${(m.ent / maior) * 100}%` }}>
                  <i className="ga-out" style={{ flexGrow: m.out }} />
                  <i className="ga-ofe" style={{ flexGrow: m.ofe }} />
                  <i className="ga-diz" style={{ flexGrow: m.diz }} />
                </div>
                <i className="ga-sai" style={{ height: `${(m.sai / maior) * 100}%` }} />
              </div>
              <span>{MES3[i]}</span>
            </div>
          ))}
        </div>
        <div className="legenda">
          <span><i className="ga-diz" /> Dízimos</span><span><i className="ga-ofe" /> Ofertas</span>
          <span><i className="ga-out" /> Outras entradas</span><span><i className="ga-sai" /> Despesas</span>
        </div>
      </section>

      <section className="painel">
        <h2>Resumo de {ano}</h2>
        <div className="tabela-rolar">
          <table className="tabela-ano">
            <thead>
              <tr><th /> {MES3.map((m) => <th key={m}>{m}</th>)}<th>Total</th><th>Média</th></tr>
            </thead>
            <tbody>
              {linhasTabela.map(([nome, f, cls]) => {
                const total = nome.startsWith('Saldo') ? (r.ultimo?.fim ?? 0) : r.meses.reduce((s, m) => s + f(m), 0)
                return (
                  <tr key={nome} className={cls}>
                    <th>{nome}</th>
                    {r.meses.map((m) => {
                      const v = f(m)
                      return <td key={m.ym} className={cls === 'res' ? (v < 0 ? 'neg' : 'pos') : ''}>{m.tem ? numero(v) : '–'}</td>
                    })}
                    <td className="tot">{numero(total)}</td>
                    <td className="tot">{nome.startsWith('Saldo') ? '' : numero(total / r.n)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="painel">
        <h2>Pra onde foram as despesas em {ano}</h2>
        {r.porCategoria.length === 0 && <p className="vazio">Nenhuma despesa no ano.</p>}
        <div className="barras saidas">
          {r.porCategoria.map(([c, v]) => (
            <div key={c} className="barra-linha">
              <span>{c}<small>{Math.round((v / Math.max(1, r.tot('sai'))) * 100)}% das despesas</small></span>
              <i><b style={{ width: `${(v / maiorCat) * 100}%` }} /></i>
              <strong className="valor-curto">{dinheiro(v)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const numero = (v: number) => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
