import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Contribuicao, Contribuinte, Pessoa } from '../lib/tipos'
import { dinheiro, podeFinanceiro } from '../lib/util'
import Folha from '../componentes/Folha'
import TesAbas from '../componentes/TesAbas'

const MES3 = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
type Tipo = 'dizimo' | 'oferta'

// relação de dizimistas e ofertantes: quem contribuiu em cada mês (igual à aba "Relação" da planilha)
export default function TesRelacao() {
  const { igreja, papel } = useSessao()
  const [contribuintes, setContribuintes] = useState<Contribuinte[] | null>(null)
  const [valores, setValores] = useState<Contribuicao[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [ano, setAno] = useState(new Date().getFullYear())
  const [tipo, setTipo] = useState<Tipo>('dizimo')
  const [filtro, setFiltro] = useState<'todos' | 'fieis' | 'irregulares' | 'nunca'>('todos')
  const [busca, setBusca] = useState('')
  const [celula, setCelula] = useState<{ c: Contribuinte; mes: number } | null>(null)
  const [ficha, setFicha] = useState<Contribuinte | 'novo' | null>(null)

  async function carregar() {
    if (!igreja || !podeFinanceiro(papel)) return
    const [c, v] = await Promise.all([
      supabase.from('contribuintes').select('*').eq('igreja_id', igreja.id).order('codigo'),
      supabase.from('contribuicoes').select('*').eq('igreja_id', igreja.id),
    ])
    setContribuintes((c.data as Contribuinte[]) ?? [])
    setValores((v.data as Contribuicao[]) ?? [])
  }
  useEffect(() => { carregar() }, [igreja?.id, papel])
  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
  }, [igreja?.id])

  const anos = useMemo(() => [...new Set([...valores.map((v) => v.ano), new Date().getFullYear()])].sort(), [valores])

  const r = useMemo(() => {
    const doAno = valores.filter((v) => v.ano === ano && v.tipo === tipo)
    const mapa = new Map<string, (number | null)[]>()
    for (const v of doAno) {
      const linha = mapa.get(v.contribuinte_id) ?? Array(12).fill(null)
      linha[v.mes - 1] = (linha[v.mes - 1] ?? 0) + Number(v.valor)
      mapa.set(v.contribuinte_id, linha)
    }
    // meses que já têm algum valor no ano (pra medir quem é fiel)
    const mesesComDado = [...new Set(doAno.map((v) => v.mes))].sort((a, b) => a - b)
    const ultimoMes = mesesComDado[mesesComDado.length - 1] ?? 0
    // quem é desta relação: tem valor neste tipo em algum ano, ou ainda não tem valor nenhum
    const tiposDe = new Map<string, Set<string>>()
    for (const v of valores) tiposDe.set(v.contribuinte_id, (tiposDe.get(v.contribuinte_id) ?? new Set()).add(v.tipo))
    const daRelacao = (contribuintes ?? []).filter((c) => {
      const t = tiposDe.get(c.id)
      if (t) return t.has(tipo) // já contribuiu: aparece na relação do que deu
      if (/\(dízimos\)$/.test(c.codigo)) return tipo === 'dizimo'
      if (/\(ofertas\)$/.test(c.codigo)) return tipo === 'oferta'
      return true // sem valor nenhum ainda: aparece nas duas
    })
    const linhas = daRelacao.map((c) => {
      const vals = mapa.get(c.id) ?? Array(12).fill(null)
      const meses = vals.filter((x) => x).length
      const total = vals.reduce((s: number, x) => s + (x ?? 0), 0)
      const situacao = meses === 0 ? 'nunca' : ultimoMes && meses >= Math.ceil(ultimoMes * 0.75) ? 'fieis' : 'irregulares'
      return { c, vals, meses, total, situacao }
    })
    const totMes = Array.from({ length: 12 }, (_, k) => linhas.reduce((s, l) => s + (l.vals[k] ?? 0), 0))
    const conta = (s: string) => linhas.filter((l) => l.situacao === s).length
    return { linhas, totMes, total: totMes.reduce((s, x) => s + x, 0), ultimoMes, fieis: conta('fieis'), irregulares: conta('irregulares'), nunca: conta('nunca') }
  }, [contribuintes, valores, ano, tipo])

  if (!podeFinanceiro(papel)) return <p className="vazio">A tesouraria é visível só pra pastor, tesoureiro e administrador.</p>
  if (!contribuintes) return <div className="spinner" />

  const nomeDe = (c: Contribuinte) => pessoas.find((p) => p.id === c.pessoa_id)?.nome ?? c.nome ?? c.codigo
  const t = busca.trim().toLowerCase()
  const lista = r.linhas
    .filter((l) => filtro === 'todos' || l.situacao === filtro)
    .filter((l) => !t || [nomeDe(l.c), l.c.codigo].some((x) => x.toLowerCase().includes(t)))
    .sort((a, b) => b.total - a.total || nomeDe(a.c).localeCompare(nomeDe(b.c)))
  const maior = Math.max(1, ...r.totMes)
  const comValor = r.fieis + r.irregulares
  const valorCel = celula ? valores.find((v) => v.contribuinte_id === celula.c.id && v.ano === ano && v.mes === celula.mes && v.tipo === tipo) : undefined
  const pct = (n: number) => (r.linhas.length ? Math.round((n / r.linhas.length) * 100) : 0)

  return (
    <div className="tesouraria tes-relacao">
      <div className="cabecalho">
        <h1 className="titulo">Tesouraria</h1>
        <div className="acoes-topo sem-impressao">
          <select className="sel-ano" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button className="btn" onClick={() => window.print()}>Imprimir / PDF</button>
          <button className="btn btn-primario" onClick={() => setFicha('novo')}>+ Contribuinte</button>
        </div>
      </div>
      <TesAbas />
      <p className="so-impressao">{igreja?.nome} · Relação de {tipo === 'dizimo' ? 'dizimistas' : 'ofertantes'} · {ano}</p>

      <div className="seg sem-impressao">
        <button className={tipo === 'dizimo' ? 'ativo' : ''} onClick={() => setTipo('dizimo')}>Dizimistas</button>
        <button className={tipo === 'oferta' ? 'ativo' : ''} onClick={() => setTipo('oferta')}>Ofertantes</button>
      </div>

      {contribuintes.length === 0 ? (
        <section className="painel boas-vindas-tes">
          <h2>A relação vem da sua planilha</h2>
          <p className="suave">Se a planilha tem as abas "Relação Dizimista(s)" e "Relação Ofertante(s)", é só trazer ela de novo: o app monta a relação sozinho. Ou adicione os contribuintes à mão.</p>
          <Link className="btn btn-primario btn-grande" to="/financeiro/importar">Trazer planilha</Link>
        </section>
      ) : (
        <>
          <div className="numeros cinco">
            <div className="numero"><span>{tipo === 'dizimo' ? 'Dízimos' : 'Ofertas'} em {ano}</span><strong className="valor">{dinheiro(r.total)}</strong><small>{comValor} {tipo === 'dizimo' ? 'dizimistas' : 'ofertantes'} contribuíram</small></div>
            <button className={'numero' + (filtro === 'fieis' ? ' ativo' : '')} onClick={() => setFiltro(filtro === 'fieis' ? 'todos' : 'fieis')}>
              <span>Fiéis</span><strong>{r.fieis}</strong><small>{pct(r.fieis)}% · em 3 de cada 4 meses ou mais</small></button>
            <button className={'numero' + (filtro === 'irregulares' ? ' ativo' : '')} onClick={() => setFiltro(filtro === 'irregulares' ? 'todos' : 'irregulares')}>
              <span>Irregulares</span><strong>{r.irregulares}</strong><small>{pct(r.irregulares)}% · contribuíram às vezes</small></button>
            <button className={'numero' + (filtro === 'nunca' ? ' ativo' : '')} onClick={() => setFiltro(filtro === 'nunca' ? 'todos' : 'nunca')}>
              <span>Sem contribuição</span><strong>{r.nunca}</strong><small>{pct(r.nunca)}% · nada em {ano}</small></button>
            <div className="numero"><span>Média por mês</span><strong className="valor">{dinheiro(r.total / Math.max(1, r.ultimoMes))}</strong><small>até {r.ultimoMes ? MES3[r.ultimoMes - 1] : '–'}</small></div>
          </div>

          <section className="painel">
            <h2>{tipo === 'dizimo' ? 'Dízimos' : 'Ofertas'} por mês</h2>
            <div className="grafico-ano baixo">
              {r.totMes.map((v, i) => (
                <div key={i} className="ga-mes" title={`${MES3[i]}: ${dinheiro(v)}`}>
                  <div className="ga-barras"><i className={'ga-sozinha ' + (tipo === 'dizimo' ? 'ga-diz' : 'ga-ofe')} style={{ height: `${(v / maior) * 100}%` }} /></div>
                  <span>{MES3[i]}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="painel">
            <div className="lista-topo">
              <h2>Relação {filtro !== 'todos' && <small className="suave">· {filtro === 'fieis' ? 'fiéis' : filtro === 'nunca' ? 'sem contribuição' : 'irregulares'}</small>}</h2>
              <input className="busca sem-impressao" type="search" placeholder="Buscar nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <p className="dica sem-impressao">Toque num mês pra lançar, corrigir ou tirar um valor. Toque no nome pra ligar à ficha da pessoa.</p>
            <div className="tabela-rolar">
              <table className="tabela-ano tabela-relacao">
                <thead><tr><th>Contribuinte</th>{MES3.map((m) => <th key={m}>{m}</th>)}<th>Total</th></tr></thead>
                <tbody>
                  {lista.map((l) => (
                    <tr key={l.c.id}>
                      <th><button className="link-nome" onClick={() => setFicha(l.c)}>{nomeDe(l.c)}{l.c.pessoa_id || l.c.nome ? <small>{l.c.codigo}</small> : null}</button></th>
                      {l.vals.map((v, k) => (
                        <td key={k}><button className={'cel' + (v ? ' cheia' : '')} onClick={() => setCelula({ c: l.c, mes: k + 1 })}>{v ? numero(v) : '·'}</button></td>
                      ))}
                      <td className="tot">{l.total ? numero(l.total) : '–'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><th>Total</th>{r.totMes.map((v, k) => <td key={k}>{v ? numero(v) : '–'}</td>)}<td className="tot">{numero(r.total)}</td></tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}

      <Folha titulo={celula ? `${nomeDe(celula.c)} · ${MES3[celula.mes - 1]}/${ano}` : ''} aberta={!!celula} fechar={() => setCelula(null)}>
        {celula && <FormValor key={celula.c.id + celula.mes} atual={valorCel} tipo={tipo}
          salvar={async (valor) => {
            if (valorCel && valor) await supabase.from('contribuicoes').update({ valor }).eq('id', valorCel.id)
            else if (valorCel) await supabase.from('contribuicoes').delete().eq('id', valorCel.id)
            else if (valor) await supabase.from('contribuicoes').insert({ igreja_id: igreja!.id, contribuinte_id: celula.c.id, ano, mes: celula.mes, tipo, valor })
            setCelula(null); carregar()
          }} />}
      </Folha>

      <Folha titulo={ficha === 'novo' ? 'Novo contribuinte' : 'Contribuinte'} aberta={!!ficha} fechar={() => setFicha(null)}>
        {ficha && <FormContribuinte key={ficha === 'novo' ? 'novo' : ficha.id} inicial={ficha === 'novo' ? null : ficha} pessoas={pessoas}
          salvar={async (x) => {
            const { error } = ficha === 'novo'
              ? await supabase.from('contribuintes').insert({ igreja_id: igreja!.id, ...x })
              : await supabase.from('contribuintes').update(x).eq('id', ficha.id)
            if (error) return /unique|duplicate/.test(error.message) ? 'Já existe um contribuinte com esse código.' : 'Não deu pra salvar.'
            setFicha(null); carregar(); return null
          }}
          apagar={ficha === 'novo' ? undefined : async () => { await supabase.from('contribuintes').delete().eq('id', ficha.id); setFicha(null); carregar() }} />}
      </Folha>
    </div>
  )
}

function FormValor({ atual, tipo, salvar }: { atual?: Contribuicao; tipo: Tipo; salvar: (v: number | null) => Promise<void> }) {
  const [valor, setValor] = useState(atual ? String(atual.valor).replace('.', ',') : '')
  const [erro, setErro] = useState('')
  function enviar(e: FormEvent) {
    e.preventDefault()
    const v = valor.trim() ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
    if (v !== null && (!v || v < 0)) { setErro('Valor inválido.'); return }
    salvar(v || null)
  }
  return (
    <form className="form" onSubmit={enviar}>
      <label>{tipo === 'dizimo' ? 'Dízimo' : 'Oferta'} do mês (R$)
        <input inputMode="decimal" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
      </label>
      <p className="dica">Isto é só a relação de quem contribuiu. O caixa continua vindo dos lançamentos do mês.</p>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Salvar</button>
      {atual && <button type="button" className="btn btn-perigo" onClick={() => salvar(null)}>Tirar este valor</button>}
    </form>
  )
}

function FormContribuinte({ inicial, pessoas, salvar, apagar }: {
  inicial: Contribuinte | null; pessoas: Pessoa[]
  salvar: (x: { codigo: string; nome: string | null; pessoa_id: string | null }) => Promise<string | null>; apagar?: () => void
}) {
  const [codigo, setCodigo] = useState(inicial?.codigo ?? '')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [pessoaId, setPessoaId] = useState(inicial?.pessoa_id ?? '')
  const [erro, setErro] = useState('')
  const [confirmar, setConfirmar] = useState(false)
  async function enviar(e: FormEvent) {
    e.preventDefault()
    const pessoa = pessoas.find((p) => p.id === pessoaId)
    const cod = codigo.trim() || nome.trim() || pessoa?.nome || ''
    if (!cod) { setErro('Coloque um código ou um nome.'); return }
    setErro((await salvar({ codigo: cod, nome: nome.trim() || null, pessoa_id: pessoaId || null })) ?? '')
  }
  return (
    <form className="form" onSubmit={enviar}>
      <label>Código<input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Como está na planilha (pode ser anonimizado)" /></label>
      <label>Nome (opcional)<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label>Ficha da pessoa (opcional)
        <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">Não ligar a uma ficha</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Salvar</button>
      {apagar && (!confirmar
        ? <button type="button" className="btn btn-perigo" onClick={() => setConfirmar(true)}>Tirar da relação</button>
        : <div className="cartao"><span>Tirar este contribuinte e todos os valores dele? Não dá pra desfazer.</span>
          <div className="acoes"><button type="button" className="btn btn-perigo" onClick={apagar}>Sim, tirar</button>
            <button type="button" className="btn" onClick={() => setConfirmar(false)}>Cancelar</button></div></div>)}
    </form>
  )
}

const numero = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })
