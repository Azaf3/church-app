import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buscarTudo } from '../lib/buscarTudo'
import { useSessao } from '../lib/sessao'
import type { Lancamento } from '../lib/tipos'
import { dataBR, dinheiro, podeFinanceiro } from '../lib/util'
import { ehEntrada, ehSaida, somar } from '../lib/tesouraria'
import TesAbas from '../componentes/TesAbas'

// campanhas: lançamentos marcados com o nome de uma campanha (reforma, evento, ação social...)
export default function TesCampanhas() {
  const { igreja, papel } = useSessao()
  const [todos, setTodos] = useState<Lancamento[] | null>(null)
  const [aberta, setAberta] = useState<string | null>(null)
  const [confirmar, setConfirmar] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  async function excluir(l: Lancamento) {
    setErro('')
    const { error } = await supabase.from('lancamentos').delete().eq('id', l.id)
    if (error) return setErro('Não deu pra excluir: ' + error.message)
    setTodos((t) => (t ?? []).filter((x) => x.id !== l.id)); setConfirmar(null)
  }
  async function tirarDaCampanha(l: Lancamento) {
    setErro('')
    const { error } = await supabase.from('lancamentos').update({ campanha: null }).eq('id', l.id)
    if (error) return setErro('Não deu pra tirar da campanha: ' + error.message)
    setTodos((t) => (t ?? []).map((x) => (x.id === l.id ? { ...x, campanha: null } : x)))
  }

  useEffect(() => {
    if (!igreja || !podeFinanceiro(papel)) return
    buscarTudo<Lancamento>((de, ate) => supabase.from('lancamentos').select('*').eq('igreja_id', igreja.id).order('data', { ascending: false }).order('id').range(de, ate))
      .then(({ data }) => setTodos((data as Lancamento[]) ?? []))
  }, [igreja?.id, papel])

  const campanhas = useMemo(() => {
    const grupos = new Map<string, Lancamento[]>()
    for (const l of todos ?? []) {
      const c = l.campanha?.trim()
      if (c) grupos.set(c, [...(grupos.get(c) ?? []), l])
    }
    return [...grupos.entries()].map(([nome, ls]) => {
      const ent = somar(ls.filter(ehEntrada)), sai = somar(ls.filter(ehSaida))
      const datas = ls.map((l) => l.data).sort()
      return { nome, ls, ent, sai, saldo: ent - sai, de: datas[0], ate: datas[datas.length - 1] }
    }).sort((a, b) => b.ate.localeCompare(a.ate))
  }, [todos])

  if (!podeFinanceiro(papel)) return <p className="vazio">A tesouraria é visível só pra pastor, tesoureiro e administrador.</p>
  if (!todos) return <div className="spinner" />

  const maior = Math.max(1, ...campanhas.map((c) => Math.max(c.ent, c.sai)))
  const atual = campanhas.find((c) => c.nome === aberta)

  return (
    <div className="tesouraria">
      <div className="cabecalho">
        <h1 className="titulo">Tesouraria</h1>
        <div className="acoes-topo sem-impressao">
          <Link className="btn btn-primario" to="/financeiro?novo=1">+ Lançar com campanha</Link>
        </div>
      </div>
      <TesAbas />

      {campanhas.length === 0 ? (
        <section className="painel boas-vindas-tes">
          <h2>Nenhuma campanha ainda</h2>
          <p className="suave">Ao lançar uma entrada ou saída, escreva o nome da campanha no campo <b>Campanha</b> (ex.: Reforma do templo, Congresso de jovens, Cestas básicas). Ela aparece aqui com quanto arrecadou, quanto gastou e o saldo.</p>
          <p className="suave">Lançamentos que já existem também podem ser marcados: abra o lançamento na aba Mês e preencha a campanha.</p>
        </section>
      ) : (
        <div className="cartoes-hoje">
          {campanhas.map((c) => (
            <button key={c.nome} className={'painel campanha' + (aberta === c.nome ? ' aberta' : '')} onClick={() => setAberta(aberta === c.nome ? null : c.nome)}>
              <div className="campanha-topo">
                <h2>{c.nome}</h2>
                <span className="suave">{dataBR(c.de)}{c.de !== c.ate && ` a ${dataBR(c.ate)}`} · {c.ls.length} {c.ls.length === 1 ? "lançamento" : "lançamentos"}</span>
              </div>
              <div className="barra-linha"><span>Arrecadou</span><i><b style={{ width: `${(c.ent / maior) * 100}%` }} /></i><strong className="valor-curto pos">{dinheiro(c.ent)}</strong></div>
              <div className="barra-linha saida"><span>Gastou</span><i><b style={{ width: `${(c.sai / maior) * 100}%` }} /></i><strong className="valor-curto neg">{dinheiro(c.sai)}</strong></div>
              <p className="campanha-saldo">Saldo <strong className={c.saldo < 0 ? 'neg' : 'pos'}>{c.saldo < 0 ? '−' : ''} {dinheiro(Math.abs(c.saldo))}</strong></p>
            </button>
          ))}
        </div>
      )}

      {atual && (
        <section className="painel">
          <h2>Lançamentos · {atual.nome}</h2>
          {erro && <p className="erro">{erro}</p>}
          <ul className="lista plana">
            {atual.ls.map((l) => (
              <li key={l.id} className="item">
                <span className="hora">{dataBR(l.data)}</span>
                <div className="item-texto"><strong>{l.descricao || l.nome || (ehSaida(l) ? l.categoria : 'Entrada') || '—'}</strong></div>
                <strong className={'valor ' + (ehSaida(l) ? 'neg' : 'pos')}>{ehSaida(l) ? '−' : '+'} {dinheiro(Number(l.valor))}</strong>
                <div className="acoes-campanha sem-impressao">
                  {confirmar === l.id ? (
                    <>
                      <span className="suave">Excluir de vez?</span>
                      <button className="btn btn-mini btn-perigo" onClick={() => excluir(l)}>Sim, excluir</button>
                      <button className="btn btn-mini" onClick={() => setConfirmar(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="btn btn-mini" onClick={() => tirarDaCampanha(l)} title="O lançamento continua no caixa, só sai desta campanha">Tirar da campanha</button>
                      <button className="btn btn-mini btn-saida" onClick={() => setConfirmar(l.id)}>Excluir</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
