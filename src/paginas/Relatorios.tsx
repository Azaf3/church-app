import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Culto, Lancamento, Pessoa } from '../lib/tipos'
import { ETAPAS, MESES, dataBR, dinheiro, hojeISO, podeFinanceiro } from '../lib/util'
import Icone from '../componentes/Icone'

interface Dados {
  pessoas: Pessoa[]
  cultos: (Culto & { presentes: number })[]
  lancamentos: Lancamento[]
  lancAnterior: number
  contatos: number
  visitas: number
}

export default function Relatorios() {
  const { igreja, papel } = useSessao()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [d, setD] = useState<Dados | null>(null)
  const fin = podeFinanceiro(papel)

  const [a, m] = mes.split('-').map(Number)
  const ini = `${mes}-01`
  const fim = `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`
  const ant = new Date(a, m - 2, 1)
  const mesAnt = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    if (!igreja) return
    setD(null)
    const id = igreja.id
    const iniTs = new Date(`${ini}T00:00:00`).toISOString()
    const fimTs = new Date(`${fim}T23:59:59`).toISOString()
    ;(async () => {
      const [p, c, l, la, k, ag] = await Promise.all([
        supabase.from('pessoas').select('*').eq('igreja_id', id),
        supabase.from('cultos').select('*').eq('igreja_id', id).gte('data', ini).lte('data', fim).order('data'),
        fin ? supabase.from('lancamentos').select('*').eq('igreja_id', id).gte('data', ini).lte('data', fim) : Promise.resolve({ data: [] }),
        fin ? supabase.from('lancamentos').select('valor').eq('igreja_id', id).in('tipo', ['dizimo', 'oferta', 'outro']).gte('data', `${mesAnt}-01`).lte('data', `${mesAnt}-31`) : Promise.resolve({ data: [] }),
        supabase.from('contatos').select('id').eq('igreja_id', id).gte('criado_em', iniTs).lte('criado_em', fimTs),
        supabase.from('agenda').select('id').eq('igreja_id', id).eq('feito', true).gte('inicio', iniTs).lte('inicio', fimTs),
      ])
      const cultos = (c.data ?? []) as Culto[]
      const comPresenca = await Promise.all(cultos.map(async (cu) => {
        const { data } = await supabase.from('presencas').select('pessoa_id').eq('culto_id', cu.id)
        return { ...cu, presentes: (data ?? []).length }
      }))
      setD({
        pessoas: (p.data ?? []) as Pessoa[],
        cultos: comPresenca,
        lancamentos: (l.data ?? []) as Lancamento[],
        lancAnterior: ((la.data ?? []) as { valor: number }[]).reduce((s, x) => s + Number(x.valor), 0),
        contatos: (k.data ?? []).length,
        visitas: (ag.data ?? []).length,
      })
    })()
  }, [igreja?.id, mes, fin])

  const mudarMes = (n: number) => {
    const x = new Date(a, m - 1 + n, 1)
    setMes(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`)
  }

  const cabecalho = (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Relatório do mês</h1>
        <button className="btn sem-impressao" onClick={() => window.print()}><Icone nome="importar" tam={18} /> Imprimir / PDF</button>
      </div>
      <div className="mes sem-impressao">
        <button className="btn-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
        <strong>{MESES[m - 1]} {a}</strong>
        <button className="btn-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês" disabled={mes >= hojeISO().slice(0, 7)}><Icone nome="seta" /></button>
      </div>
      <p className="so-impressao">{igreja?.nome} · {MESES[m - 1]} de {a}</p>
    </>
  )

  if (!d) return <>{cabecalho}<div className="spinner" /></>

  const ativos = d.pessoas.filter((p) => p.ativo)
  const membros = ativos.filter((p) => p.tipo === 'membro')
  const novos = d.pessoas.filter((p) => p.criado_em.slice(0, 10) >= ini && p.criado_em.slice(0, 10) <= fim)
  const novosVisitantes = novos.filter((p) => p.tipo === 'visitante')
  const batismos = d.pessoas.filter((p) => p.data_batismo && p.data_batismo >= ini && p.data_batismo <= fim)
  const aniversariantes = ativos.filter((p) => p.nascimento && Number(p.nascimento.slice(5, 7)) === m)
  const mediaPresenca = d.cultos.length ? Math.round(d.cultos.reduce((s, c) => s + c.presentes, 0) / d.cultos.length) : 0
  const maiorCulto = Math.max(1, ...d.cultos.map((c) => c.presentes))
  const porEtapa = ETAPAS.map((e) => ({ ...e, n: ativos.filter((p) => p.etapa === e.id).length }))
  const maiorEtapa = Math.max(1, ...porEtapa.map((e) => e.n))

  const soma = (t: Lancamento['tipo']) => d.lancamentos.filter((l) => l.tipo === t).reduce((s, l) => s + Number(l.valor), 0)
  const totalMes = d.lancamentos.filter((l) => l.tipo !== 'saida' && l.tipo !== 'saldo_inicial').reduce((s, l) => s + Number(l.valor), 0)
  const saidasMes = d.lancamentos.filter((l) => l.tipo === 'saida').reduce((s, l) => s + Number(l.valor), 0)
  const variacao = d.lancAnterior ? Math.round(((totalMes - d.lancAnterior) / d.lancAnterior) * 100) : null
  const dizimistas = new Set(d.lancamentos.filter((l) => l.tipo === 'dizimo' && l.pessoa_id).map((l) => l.pessoa_id)).size

  return (
    <div className="relatorio">
      {cabecalho}

      <div className="numeros">
        <div className="numero"><span>Membros ativos</span><strong>{membros.length}</strong><small>{novos.filter((p) => p.tipo === 'membro').length} cadastrados no mês</small></div>
        <div className="numero"><span>Visitantes novos</span><strong>{novosVisitantes.length}</strong><small>{ativos.filter((p) => p.tipo === 'visitante').length} em acompanhamento</small></div>
        <div className="numero"><span>Média por culto</span><strong>{d.cultos.length ? mediaPresenca : '—'}</strong><small>{d.cultos.length} {d.cultos.length === 1 ? 'culto' : 'cultos'} com chamada</small></div>
        <div className="numero"><span>Cuidado pastoral</span><strong>{d.contatos + d.visitas}</strong><small>{d.contatos} contatos · {d.visitas} visitas feitas</small></div>
      </div>

      <div className="colunas">
        <section className="painel">
          <h2>Presença nos cultos</h2>
          {d.cultos.length === 0 && <p className="vazio">Nenhuma chamada feita neste mês.</p>}
          <div className="barras">
            {d.cultos.map((c) => (
              <div key={c.id} className="barra-linha">
                <span>{dataBR(c.data)}<small>{c.titulo}</small></span>
                <i><b style={{ width: `${(c.presentes / maiorCulto) * 100}%` }} /></i>
                <strong>{c.presentes}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="painel">
          <h2>Jornada dos visitantes</h2>
          <div className="barras">
            {porEtapa.map((e) => (
              <div key={e.id} className="barra-linha">
                <span>{e.nome}</span>
                <i><b style={{ width: `${(e.n / maiorEtapa) * 100}%` }} /></i>
                <strong>{e.n}</strong>
              </div>
            ))}
          </div>
        </section>

        {fin && (
          <section className="painel">
            <h2>Tesouraria</h2>
            <div className="fin-total">
              <strong>{dinheiro(totalMes)}</strong>
              {variacao !== null && (
                <span className={'tag ' + (variacao >= 0 ? '' : 'tag-alerta')}>
                  {variacao >= 0 ? '+' : ''}{variacao}% vs. {MESES[ant.getMonth()].toLowerCase()}
                </span>
              )}
            </div>
            <dl className="dados">
              <div><dt>Dízimos</dt><dd>{dinheiro(soma('dizimo'))}</dd></div>
              <div><dt>Ofertas</dt><dd>{dinheiro(soma('oferta'))}</dd></div>
              <div><dt>Outras entradas</dt><dd>{dinheiro(soma('outro'))}</dd></div>
              <div><dt>Dizimistas</dt><dd>{dizimistas}</dd></div>
              <div><dt>Saídas</dt><dd>{dinheiro(saidasMes)}</dd></div>
              <div><dt>Resultado</dt><dd>{dinheiro(totalMes - saidasMes)}</dd></div>
            </dl>
          </section>
        )}

        <section className="painel">
          <h2>Marcos do mês</h2>
          <ul className="marcos">
            <li><strong>{batismos.length}</strong> {batismos.length === 1 ? 'batismo' : 'batismos'}{batismos.length > 0 && `: ${batismos.map((p) => p.nome.split(' ')[0]).join(', ')}`}</li>
            <li><strong>{novosVisitantes.length}</strong> {novosVisitantes.length === 1 ? 'visitante novo' : 'visitantes novos'}{novosVisitantes.length > 0 && `: ${novosVisitantes.slice(0, 6).map((p) => p.nome.split(' ')[0]).join(', ')}${novosVisitantes.length > 6 ? '…' : ''}`}</li>
            <li><strong>{aniversariantes.length}</strong> {aniversariantes.length === 1 ? 'aniversariante' : 'aniversariantes'}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
