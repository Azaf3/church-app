import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Lancamento, Pessoa } from '../lib/tipos'
import { MESES, dataBR, dinheiro, hojeISO, podeFinanceiro } from '../lib/util'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'

const TIPOS = { dizimo: 'Dízimo', oferta: 'Oferta', outro: 'Outra entrada' } as const
const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', cartao: 'Cartão', transferencia: 'Transferência' } as const

export default function Financeiro() {
  const { igreja, papel, userId } = useSessao()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [itens, setItens] = useState<Lancamento[]>([])
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [params] = useSearchParams()
  const [novo, setNovo] = useState(params.get('novo') === '1')

  useEffect(() => {
    if (!igreja || !podeFinanceiro(papel)) return
    const [a, m] = mes.split('-').map(Number)
    const fim = new Date(a, m, 0).getDate()
    supabase.from('lancamentos').select('*').eq('igreja_id', igreja.id)
      .gte('data', `${mes}-01`).lte('data', `${mes}-${fim}`).order('data', { ascending: false })
      .then(({ data }) => setItens(data ?? []))
  }, [igreja?.id, mes, papel])

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('id, nome').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
  }, [igreja?.id])

  const totais = useMemo(() => {
    const t = { dizimo: 0, oferta: 0, outro: 0, geral: 0 }
    itens.forEach((i) => { t[i.tipo] += Number(i.valor); t.geral += Number(i.valor) })
    return t
  }, [itens])

  if (!podeFinanceiro(papel)) {
    return <p className="vazio">O financeiro é visível só pra pastor, tesoureiro e administrador.</p>
  }

  const nomePessoa = (id: string | null) => pessoas.find((p) => p.id === id)?.nome
  const [a, m] = mes.split('-').map(Number)
  const mudarMes = (d: number) => {
    const n = new Date(a, m - 1 + d, 1)
    setMes(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
  }

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Dízimos e ofertas</h1>
        <div className="acoes-topo">
          <Link className="btn" to="/financeiro/importar"><Icone nome="importar" tam={18} /> Importar planilha</Link>
          <button className="btn btn-primario" onClick={() => setNovo(true)}><Icone nome="mais_um" tam={18} /> Lançar</button>
        </div>
      </div>

      <div className="mes">
        <button className="btn-icone" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
        <strong>{MESES[m - 1]} {a}</strong>
        <button className="btn-icone" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="seta" /></button>
      </div>

      <div className="placar tres">
        <div><strong>{dinheiro(totais.dizimo)}</strong><span>dízimos</span></div>
        <div><strong>{dinheiro(totais.oferta)}</strong><span>ofertas</span></div>
        <div className="total"><strong>{dinheiro(totais.geral)}</strong><span>total do mês</span></div>
      </div>

      {itens.length === 0 && <p className="vazio">Nada lançado neste mês.</p>}
      <ul className="lista">
        {itens.map((i) => (
          <li key={i.id} className="item">
            <span className="hora">{dataBR(i.data)}</span>
            <div className="item-texto">
              <strong>{nomePessoa(i.pessoa_id) ?? i.nome ?? 'Anônimo'}</strong>
              <span>{TIPOS[i.tipo]} · {FORMAS[i.forma]}</span>
            </div>
            <strong className="valor">{dinheiro(Number(i.valor))}</strong>
          </li>
        ))}
      </ul>

      <Folha titulo="Novo lançamento" aberta={novo} fechar={() => setNovo(false)}>
        <FormLancamento igrejaId={igreja!.id} userId={userId!} pessoas={pessoas}
          salvo={(l) => { if (l.data.startsWith(mes)) setItens([l, ...itens]); setNovo(false) }} />
      </Folha>
    </>
  )
}

function FormLancamento({ igrejaId, userId, pessoas, salvo }: {
  igrejaId: string; userId: string; pessoas: Pessoa[]; salvo: (l: Lancamento) => void
}) {
  const [tipo, setTipo] = useState<Lancamento['tipo']>('dizimo')
  const [valor, setValor] = useState('')
  const [data, setData] = useState(hojeISO())
  const [pessoaId, setPessoaId] = useState('')
  const [nome, setNome] = useState('')
  const [forma, setForma] = useState<Lancamento['forma']>('pix')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const v = Number(valor.replace(/\./g, '').replace(',', '.'))
    if (!v || v <= 0) { setErro('Valor inválido.'); return }
    const { data: l, error } = await supabase.from('lancamentos').insert({
      igreja_id: igrejaId, tipo, valor: v, data, forma, criado_por: userId,
      pessoa_id: pessoaId || null, nome: pessoaId ? null : nome || null,
    }).select().single()
    if (error || !l) { setErro('Não deu pra salvar.'); return }
    salvo(l)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="seg">
        {(Object.keys(TIPOS) as Lancamento['tipo'][]).map((t) => (
          <button type="button" key={t} className={tipo === t ? 'ativo' : ''} onClick={() => setTipo(t)}>{TIPOS[t]}</button>
        ))}
      </div>
      <div className="linha-2">
        <label>Valor (R$)<input inputMode="decimal" required value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" autoFocus /></label>
        <label>Data<input type="date" required value={data} onChange={(e) => setData(e.target.value)} /></label>
      </div>
      <label>Quem deu
        <select value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
          <option value="">Não cadastrado / anônimo</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      {!pessoaId && <label>Nome ou descrição (opcional)<input value={nome} onChange={(e) => setNome(e.target.value)} /></label>}
      <label>Forma
        <select value={forma} onChange={(e) => setForma(e.target.value as Lancamento['forma'])}>
          {(Object.keys(FORMAS) as Lancamento['forma'][]).map((f) => <option key={f} value={f}>{FORMAS[f]}</option>)}
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Salvar</button>
    </form>
  )
}
