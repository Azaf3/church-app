import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Pessoa } from '../lib/tipos'
import { MESES, dataBR, dinheiro, hojeISO, podeFinanceiro } from '../lib/util'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'
import BotaoWhats from '../componentes/BotaoWhats'

interface Turma {
  id: string; nome: string; inicio: string; meses: number
  valor_matricula: number | null; valor_mensalidade: number | null; ativa: boolean
}
interface Aluno {
  id: string; turma_id: string; pessoa_id: string | null; nome: string; telefone: string | null
  situacao: 'ativo' | 'desistente' | 'concluiu'; observacoes: string | null
}
interface Pagamento {
  id: string; aluno_id: string; referencia: string; situacao: 'pago' | 'isento'
  valor: number | null; pago_em: string | null; lancamento_id: string | null
}

const MATRICULA = '0000-00'
const rotuloRef = (ref: string) => {
  if (ref === MATRICULA) return 'Matrícula'
  const [a, m] = ref.split('-').map(Number)
  return `${MESES[m - 1].slice(0, 3)}/${String(a).slice(2)}`
}
const mesesDaTurma = (t: Turma) => Array.from({ length: t.meses }, (_, i) => {
  const [a, m] = t.inicio.split('-').map(Number)
  const d = new Date(a, m - 1 + i, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})

export default function Sete() {
  const { igreja, papel, userId } = useSessao()
  const [turmas, setTurmas] = useState<Turma[] | null>(null)
  const [turmaId, setTurmaId] = useState('')
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([])
  const [celula, setCelula] = useState<{ aluno: Aluno; ref: string } | null>(null)
  const [novaTurma, setNovaTurma] = useState(false)
  const [novoAluno, setNovoAluno] = useState(false)
  const [editAluno, setEditAluno] = useState<Aluno | null>(null)

  useEffect(() => {
    if (!igreja || !podeFinanceiro(papel)) return
    supabase.from('sete_turmas').select('*').eq('igreja_id', igreja.id).order('inicio', { ascending: false })
      .then(({ data }) => {
        const ts = (data as Turma[]) ?? []
        setTurmas(ts)
        if (ts.length && !turmaId) setTurmaId((ts.find((t) => t.ativa) ?? ts[0]).id)
      })
  }, [igreja?.id, papel])

  useEffect(() => {
    if (!turmaId) return
    supabase.from('sete_alunos').select('*').eq('turma_id', turmaId).order('nome')
      .then(({ data }) => setAlunos((data as Aluno[]) ?? []))
  }, [turmaId])

  useEffect(() => {
    if (!alunos.length) { setPagamentos([]); return }
    supabase.from('sete_pagamentos').select('*').in('aluno_id', alunos.map((a) => a.id))
      .then(({ data }) => setPagamentos((data as Pagamento[]) ?? []))
  }, [alunos])

  const turma = turmas?.find((t) => t.id === turmaId) ?? null
  const refs = useMemo(() => (turma ? [MATRICULA, ...mesesDaTurma(turma)] : []), [turma])
  const mesAtual = hojeISO().slice(0, 7)
  const pg = (alunoId: string, ref: string) => pagamentos.find((p) => p.aluno_id === alunoId && p.referencia === ref)
  const ativos = alunos.filter((a) => a.situacao === 'ativo')
  const outros = alunos.filter((a) => a.situacao !== 'ativo')

  const resumo = useMemo(() => {
    const recebido = pagamentos.filter((p) => p.situacao === 'pago').reduce((s, p) => s + Number(p.valor ?? 0), 0)
    const vencidas = refs.filter((r) => r === MATRICULA || r <= mesAtual)
    const pendentes = ativos.flatMap((a) => vencidas.filter((r) => !pg(a.id, r)).map((r) => ({ a, r })))
    const porMes = Object.fromEntries(refs.map((r) => [r, pagamentos.filter((p) => p.referencia === r && p.situacao === 'pago').reduce((s, p) => s + Number(p.valor ?? 0), 0)]))
    // adimplência: matrícula + mensalidades de meses que já passaram
    const venceu = refs.filter((r) => r === MATRICULA || r < mesAtual)
    const situacao = ativos.map((a) => {
      const atraso = venceu.filter((r) => !pg(a.id, r))
      const devido = atraso.reduce((s, r) => s + Number((r === MATRICULA ? turma?.valor_matricula : turma?.valor_mensalidade) ?? 0), 0)
      return { a, atraso, devido }
    })
    const inadimplentes = situacao.filter((x) => x.atraso.length).sort((x, y) => y.atraso.length - x.atraso.length)
    return { recebido, pendentes, porMes, situacao, inadimplentes, adimplentes: situacao.length - inadimplentes.length, emAtraso: inadimplentes.reduce((s, x) => s + x.devido, 0) }
  }, [pagamentos, refs, ativos, mesAtual, turma])

  if (!podeFinanceiro(papel)) return <p className="vazio">O controle do SETE é visível só pra tesoureiro, pastor e administrador.</p>
  if (turmas === null) return <div className="spinner" />

  return (
    <div className="sete">
      <div className="cabecalho">
        <div>
          <Link className="voltar" to="/financeiro"><Icone nome="voltar" tam={18} /> Tesouraria</Link>
          <h1 className="titulo">Seminário SETE</h1>
        </div>
        <div className="acoes-topo">
          {turmas.length > 0 && <button className="btn" onClick={() => setNovaTurma(true)}>Nova turma</button>}
          {turma && <button className="btn btn-primario" onClick={() => setNovoAluno(true)}><Icone nome="mais_um" tam={18} /> Aluno</button>}
        </div>
      </div>

      {turmas.length === 0 ? (
        <section className="painel boas-vindas-tes">
          <h2>Crie a primeira turma</h2>
          <p className="suave">Cadastre a turma com o valor da matrícula e da mensalidade, depois os alunos. A grade mostra quem pagou cada mês, igual à planilha.</p>
          <button className="btn btn-primario btn-grande" onClick={() => setNovaTurma(true)}>Criar turma</button>
        </section>
      ) : (
        <>
          {turmas.length > 1 && (
            <div className="seg">
              {turmas.map((t) => <button key={t.id} className={t.id === turmaId ? 'ativo' : ''} onClick={() => setTurmaId(t.id)}>{t.nome}</button>)}
            </div>
          )}

          <div className="numeros">
            <div className="numero"><span>Recebido</span><strong className="valor pos">{dinheiro(resumo.recebido)}</strong><small>mensalidade {turma?.valor_mensalidade ? dinheiro(Number(turma.valor_mensalidade)) : '—'} · matrícula {turma?.valor_matricula ? dinheiro(Number(turma.valor_matricula)) : '—'}</small></div>
            <div className="numero"><span>Adimplentes</span><strong className="pos">{resumo.adimplentes}</strong><small>em dia, de {ativos.length} alunos ativos</small></div>
            <div className="numero"><span>Inadimplentes</span><strong className={resumo.inadimplentes.length ? 'neg' : ''}>{resumo.inadimplentes.length}</strong><small>com mensalidade vencida em aberto</small></div>
            <div className="numero"><span>Valor em atraso</span><strong className={'valor ' + (resumo.emAtraso ? 'neg' : '')}>{dinheiro(resumo.emAtraso)}</strong><small>{resumo.inadimplentes.reduce((s, x) => s + x.atraso.length, 0)} parcelas vencidas</small></div>
          </div>

          {resumo.inadimplentes.length > 0 && (
            <section className="painel">
              <h2>Inadimplentes</h2>
              <ul className="lista plana">
                {resumo.inadimplentes.map(({ a, atraso, devido }) => (
                  <li key={a.id} className="item">
                    <div className="item-texto">
                      <strong>{a.nome}</strong>
                      <span>{atraso.length} em aberto: {atraso.map(rotuloRef).join(', ')}</span>
                    </div>
                    {devido > 0 && <strong className="valor neg">{dinheiro(devido)}</strong>}
                    <BotaoWhats telefone={a.telefone}
                      texto={`Oi ${a.nome.split(' ')[0]}, tudo bem? Passando pra lembrar do SETE: consta em aberto ${atraso.map(rotuloRef).join(', ')}${devido ? ` (${dinheiro(devido)})` : ''}. Qualquer dúvida, me chama!`} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="painel">
            <h2>Pagamentos</h2>
            <p className="dica">Toque num quadradinho pra marcar pago, isento ou deixar em aberto. Pago entra sozinho no caixa do SETE.</p>
            {ativos.length === 0 ? <p className="vazio">Nenhum aluno ainda. Toque em “+ Aluno”.</p> : (
              <div className="grade-sete">
                <table>
                  <thead>
                    <tr>
                      <th className="fixa">Aluno</th>
                      {refs.map((r) => <th key={r} className={r === mesAtual ? 'agora' : ''}>{rotuloRef(r)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {ativos.map((a) => (
                      <tr key={a.id}>
                        <th className="fixa"><button className="aluno-nome" onClick={() => setEditAluno(a)}>{a.nome}
                          {(() => { const x = resumo.situacao.find((y) => y.a.id === a.id); return x?.atraso.length ? <small className="sit neg">{x.atraso.length} em atraso</small> : <small className="sit pos">em dia</small> })()}
                        </button></th>
                        {refs.map((r) => {
                          const p = pg(a.id, r)
                          const atrasado = !p && (r === MATRICULA || r < mesAtual)
                          return (
                            <td key={r}>
                              <button className={'cel ' + (p ? p.situacao : atrasado ? 'atrasado' : 'aberto')} onClick={() => setCelula({ aluno: a, ref: r })}
                                aria-label={`${a.nome}, ${rotuloRef(r)}`}>
                                {p?.situacao === 'pago' ? (p.valor ? Number(p.valor).toLocaleString('pt-BR') : 'pago') : p?.situacao === 'isento' ? 'isento' : atrasado ? '!' : ''}
                              </button>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th className="fixa">Recebido</th>
                      {refs.map((r) => <td key={r} className="total">{resumo.porMes[r] ? resumo.porMes[r].toLocaleString('pt-BR') : ''}</td>)}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <div className="legenda">
              <span><i className="lg pago" /> Pago</span><span><i className="lg isento" /> Isento</span>
              <span><i className="lg atrasado" /> Em aberto (já venceu)</span><span><i className="lg aberto" /> Ainda não venceu</span>
            </div>
          </section>

          {outros.length > 0 && (
            <section className="painel">
              <h2>Desistiram ou concluíram</h2>
              <ul className="lista plana">
                {outros.map((a) => (
                  <li key={a.id}>
                    <button className="item" onClick={() => setEditAluno(a)}>
                      <div className="item-texto"><strong>{a.nome}</strong><span>{a.situacao === 'desistente' ? 'Desistiu' : 'Concluiu'} · pagou {dinheiro(pagamentos.filter((p) => p.aluno_id === a.id && p.situacao === 'pago').reduce((s, p) => s + Number(p.valor ?? 0), 0))}</span></div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Folha titulo="Nova turma do SETE" aberta={novaTurma} fechar={() => setNovaTurma(false)}>
        <FormTurma igrejaId={igreja!.id} salvo={(t) => { setTurmas([t, ...(turmas ?? [])]); setTurmaId(t.id); setNovaTurma(false) }} />
      </Folha>
      <Folha titulo="Novo aluno" aberta={novoAluno} fechar={() => setNovoAluno(false)}>
        {turma && <FormAluno igrejaId={igreja!.id} turmaId={turma.id} salvo={(a) => { setAlunos([...alunos, a].sort((x, y) => x.nome.localeCompare(y.nome))); setNovoAluno(false) }} />}
      </Folha>
      <Folha titulo={editAluno?.nome ?? ''} aberta={!!editAluno} fechar={() => setEditAluno(null)}>
        {editAluno && <FormAluno igrejaId={igreja!.id} turmaId={editAluno.turma_id} inicial={editAluno}
          salvo={(a) => { setAlunos(alunos.map((x) => (x.id === a.id ? a : x))); setEditAluno(null) }} />}
      </Folha>
      <Folha titulo={celula ? `${celula.aluno.nome} · ${rotuloRef(celula.ref)}` : ''} aberta={!!celula} fechar={() => setCelula(null)}>
        {celula && turma && (
          <FormPagamento igrejaId={igreja!.id} userId={userId!} turma={turma} aluno={celula.aluno} referencia={celula.ref}
            atual={pg(celula.aluno.id, celula.ref)}
            pronto={(novo, removidoId) => {
              setPagamentos([...pagamentos.filter((p) => p.id !== removidoId && p.id !== novo?.id), ...(novo ? [novo] : [])])
              setCelula(null)
            }} />
        )}
      </Folha>
    </div>
  )
}

function FormTurma({ igrejaId, salvo }: { igrejaId: string; salvo: (t: Turma) => void }) {
  const ano = new Date().getFullYear()
  const [nome, setNome] = useState(`Turma SETE ${ano}`)
  const [inicio, setInicio] = useState(`${ano}-02`)
  const [meses, setMeses] = useState('10')
  const [matricula, setMatricula] = useState('')
  const [mensalidade, setMensalidade] = useState('')
  const [erro, setErro] = useState('')
  const num = (v: string) => (v.trim() ? Number(v.replace(/\./g, '').replace(',', '.')) : null)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('sete_turmas').insert({
      igreja_id: igrejaId, nome: nome.trim(), inicio: `${inicio}-01`, meses: Number(meses) || 10,
      valor_matricula: num(matricula), valor_mensalidade: num(mensalidade),
    }).select().single()
    if (error || !data) { setErro(/relation|exist/.test(error?.message ?? '') ? 'Falta rodar a migração 008 no Supabase.' : 'Não deu pra criar.'); return }
    salvo(data as Turma)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>Nome da turma<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <div className="linha-2">
        <label>Primeira mensalidade<input type="month" required value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label>Quantos meses<input type="number" min={1} max={48} value={meses} onChange={(e) => setMeses(e.target.value)} /></label>
      </div>
      <div className="linha-2">
        <label>Matrícula (R$)<input inputMode="decimal" value={matricula} onChange={(e) => setMatricula(e.target.value)} placeholder="100,00" /></label>
        <label>Mensalidade (R$)<input inputMode="decimal" value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} placeholder="300,00" /></label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Criar turma</button>
    </form>
  )
}

function FormAluno({ igrejaId, turmaId, inicial, salvo }: { igrejaId: string; turmaId: string; inicial?: Aluno; salvo: (a: Aluno) => void }) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [pessoaId, setPessoaId] = useState(inicial?.pessoa_id ?? '')
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '')
  const [situacao, setSituacao] = useState<Aluno['situacao']>(inicial?.situacao ?? 'ativo')
  const [obs, setObs] = useState(inicial?.observacoes ?? '')
  const [erro, setErro] = useState('')

  useEffect(() => {
    supabase.from('pessoas').select('id, nome, telefone').eq('igreja_id', igrejaId).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
  }, [igrejaId])

  function escolher(id: string) {
    setPessoaId(id)
    const p = pessoas.find((x) => x.id === id)
    if (p) { setNome(p.nome); if (p.telefone) setTelefone(p.telefone) }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const reg = { igreja_id: igrejaId, turma_id: turmaId, pessoa_id: pessoaId || null, nome: nome.trim(), telefone: telefone || null, situacao, observacoes: obs || null }
    const q = inicial
      ? supabase.from('sete_alunos').update(reg).eq('id', inicial.id).select().single()
      : supabase.from('sete_alunos').insert(reg).select().single()
    const { data, error } = await q
    if (error || !data) { setErro('Não deu pra salvar.'); return }
    salvo(data as Aluno)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>É membro da igreja?
        <select value={pessoaId} onChange={(e) => escolher(e.target.value)}>
          <option value="">Não / não cadastrado</option>
          {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <label>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label>WhatsApp<input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></label>
      {inicial && (
        <div className="seg">
          {(['ativo', 'desistente', 'concluiu'] as const).map((s) => (
            <button type="button" key={s} className={situacao === s ? 'ativo' : ''} onClick={() => setSituacao(s)}>
              {s === 'ativo' ? 'Cursando' : s === 'desistente' ? 'Desistiu' : 'Concluiu'}
            </button>
          ))}
        </div>
      )}
      <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">{inicial ? 'Salvar' : 'Adicionar aluno'}</button>
    </form>
  )
}

function FormPagamento({ igrejaId, userId, turma, aluno, referencia, atual, pronto }: {
  igrejaId: string; userId: string; turma: Turma; aluno: Aluno; referencia: string; atual?: Pagamento
  pronto: (novo: Pagamento | null, removidoId?: string) => void
}) {
  const padrao = referencia === MATRICULA ? turma.valor_matricula : turma.valor_mensalidade
  const [valor, setValor] = useState(atual?.valor != null ? String(atual.valor).replace('.', ',') : padrao != null ? String(padrao).replace('.', ',') : '')
  const [data, setData] = useState(atual?.pago_em ?? hojeISO())
  const [lancar, setLancar] = useState(atual ? !!atual.lancamento_id : true)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function limparLancamento() {
    if (atual?.lancamento_id) await supabase.from('lancamentos').delete().eq('id', atual.lancamento_id)
  }

  async function salvar(situacao: 'pago' | 'isento') {
    setSalvando(true); setErro('')
    const v = situacao === 'pago' ? Number(valor.replace(/\./g, '').replace(',', '.')) : null
    if (situacao === 'pago' && (!v || v <= 0)) { setErro('Coloque o valor pago.'); setSalvando(false); return }
    await limparLancamento()
    let lancamento_id: string | null = null
    if (situacao === 'pago' && lancar) {
      const { data: l, error } = await supabase.from('lancamentos').insert({
        igreja_id: igrejaId, tipo: 'outro', fundo: 'sete', valor: v, data, forma: 'pix', criado_por: userId,
        descricao: `SETE · ${rotuloRef(referencia)} · ${aluno.nome}`, pessoa_id: aluno.pessoa_id,
      }).select('id').single()
      if (error || !l) { setErro('Não deu pra lançar no caixa. Rodou a migração 008?'); setSalvando(false); return }
      lancamento_id = (l as { id: string }).id
    }
    const reg = { igreja_id: igrejaId, aluno_id: aluno.id, referencia, situacao, valor: v, pago_em: situacao === 'pago' ? data : null, lancamento_id }
    const q = atual
      ? supabase.from('sete_pagamentos').update(reg).eq('id', atual.id).select().single()
      : supabase.from('sete_pagamentos').insert(reg).select().single()
    const { data: p, error } = await q
    setSalvando(false)
    if (error || !p) { setErro('Não deu pra salvar.'); return }
    pronto(p as Pagamento)
  }

  async function deixarEmAberto() {
    if (!atual) { pronto(null); return }
    setSalvando(true)
    await limparLancamento()
    await supabase.from('sete_pagamentos').delete().eq('id', atual.id)
    pronto(null, atual.id)
  }

  return (
    <div className="form">
      {atual && <p className="suave">Hoje está: <b>{atual.situacao === 'pago' ? `pago ${atual.valor ? dinheiro(Number(atual.valor)) : ''}${atual.pago_em ? ` em ${dataBR(atual.pago_em)}` : ''}` : 'isento'}</b></p>}
      <div className="linha-2">
        <label>Valor pago (R$)<input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus /></label>
        <label>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      </div>
      <label className="check">
        <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
        <span>Lançar no caixa do SETE <small>(desmarque se esse valor já entrou no caixa por outro lançamento)</small></span>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" disabled={salvando} onClick={() => salvar('pago')}>Marcar como pago</button>
      <div className="acoes">
        <button className="btn" disabled={salvando} onClick={() => salvar('isento')}>Isento</button>
        <button className="btn" disabled={salvando} onClick={deixarEmAberto}>Deixar em aberto</button>
      </div>
    </div>
  )
}
