import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Aviso, Pessoa } from '../lib/tipos'
import { ETAPAS, dataBR, hojeISO, podeSecretaria, primeiroNome } from '../lib/util'
import { CULTOS } from '../config'
import BotaoWhats from '../componentes/BotaoWhats'
import Folha from '../componentes/Folha'
import FormPessoa from '../componentes/FormPessoa'
import Icone from '../componentes/Icone'
import LogoIgreja from '../componentes/LogoIgreja'

type Aba = 'visitantes' | 'fichas' | 'documentos' | 'avisos'
const COMO = ['Convite de alguém', 'Família', 'Redes sociais', 'Passou na frente', 'Evento da igreja', 'Outro']
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

// data do último culto (domingo ou sexta), hoje se for dia de culto
function ultimoCulto() {
  const d = new Date()
  for (let i = 0; i < 7; i++) {
    const x = new Date(d); x.setDate(d.getDate() - i)
    if (CULTOS.some((c) => c.dia === x.getDay())) return iso(x)
  }
  return hojeISO()
}
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
const diaSemana = (d: string) => SEMANA[new Date(`${d}T12:00:00`).getDay()]

export default function Secretaria() {
  const { igreja, papel } = useSessao()
  const [aba, setAba] = useState<Aba>('visitantes')
  const [pessoas, setPessoas] = useState<Pessoa[] | null>(null)

  function carregar() {
    if (!igreja) return
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas((data as Pessoa[]) ?? []))
  }
  useEffect(carregar, [igreja?.id])

  if (!podeSecretaria(papel)) return <p className="vazio">A secretaria é pra secretário(a), pastor e administrador.</p>
  if (!pessoas) return <div className="spinner" />

  const abas: [Aba, string][] = [['visitantes', 'Visitantes'], ['fichas', 'Fichas'], ['documentos', 'Documentos'], ['avisos', 'Avisos e eventos']]
  return (
    <div className="secretaria">
      <div className="cabecalho sem-impressao"><h1 className="titulo">Secretaria</h1></div>
      <nav className="tes-abas sem-impressao">
        {abas.map(([id, nome]) => <button key={id} className={aba === id ? 'ativa' : ''} onClick={() => setAba(id)}>{nome}</button>)}
      </nav>
      {aba === 'visitantes' && <Visitantes pessoas={pessoas} mudou={carregar} />}
      {aba === 'fichas' && <Fichas pessoas={pessoas} mudou={carregar} />}
      {aba === 'documentos' && <Documentos pessoas={pessoas} />}
      {aba === 'avisos' && <Avisos />}
    </div>
  )
}

// ---------- Visitantes ----------
function Visitantes({ pessoas, mudou }: { pessoas: Pessoa[]; mudou: () => void }) {
  const { igreja, userId } = useSessao()
  const [nome, setNome] = useState('')
  const [tel, setTel] = useState('')
  const [visita, setVisita] = useState(ultimoCulto())
  const [como, setComo] = useState('')
  const [quem, setQuem] = useState('')
  const [obs, setObs] = useState('')
  const [ok, setOk] = useState('')
  const [erro, setErro] = useState('')

  async function registrar(e: FormEvent) {
    e.preventDefault(); setErro(''); setOk('')
    if (!nome.trim()) { setErro('Coloque o nome.'); return }
    const prazo = new Date(); prazo.setDate(prazo.getDate() + 2)
    const { error } = await supabase.from('pessoas').insert({
      igreja_id: igreja!.id, nome: nome.trim(), telefone: tel.trim() || null, tipo: 'visitante',
      etapa: 'novo', proximo_passo: 'Fazer o primeiro contato', prazo: iso(prazo),
      primeira_visita: visita || null, como_conheceu: como || null, convidado_por: quem.trim() || null,
      observacoes: obs.trim() || null, responsavel_id: null, ativo: true,
    })
    if (error) { setErro(/column|schema cache/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não deu pra salvar.'); return }
    setOk(`${primeiroNome(nome)} foi registrado(a) e já está na Jornada.`)
    setNome(''); setTel(''); setComo(''); setQuem(''); setObs('')
    mudou()
    void userId
  }

  const visitantes = pessoas.filter((p) => p.tipo === 'visitante')
    .sort((a, b) => (b.primeira_visita ?? b.criado_em).localeCompare(a.primeira_visita ?? a.criado_em))

  return (
    <div className="quadro-hoje sec-quadro">
      <section className="painel">
        <h2>Registrar visitante</h2>
        <form className="form" onSubmit={registrar}>
          <label>Nome *<input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" /></label>
          <div className="linha-2">
            <label>Celular (WhatsApp)<input inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(61) 99999-0000" /></label>
            <label>Primeira visita<input type="date" value={visita} onChange={(e) => setVisita(e.target.value)} /></label>
          </div>
          <label>Como conheceu a igreja
            <select value={como} onChange={(e) => setComo(e.target.value)}>
              <option value="">Escolha</option>
              {COMO.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {(como === 'Convite de alguém' || como === 'Família') && (
            <label>Quem convidou
              <input list="sec-pessoas" value={quem} onChange={(e) => setQuem(e.target.value)} placeholder="Nome de quem trouxe" />
              <datalist id="sec-pessoas">{pessoas.filter((p) => p.tipo === 'membro').map((p) => <option key={p.id} value={p.nome} />)}</datalist>
            </label>
          )}
          <label>Observação<input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: veio com a esposa e 2 filhos" /></label>
          {erro && <p className="erro">{erro}</p>}
          {ok && <p className="fech-ok">{ok}</p>}
          <button className="btn btn-primario">Registrar visitante</button>
        </form>
      </section>
      <section className="painel">
        <h2>Visitantes registrados</h2>
        {visitantes.length === 0 && <p className="vazio">Nenhum visitante ainda.</p>}
        <ul className="lista plana">
          {visitantes.slice(0, 30).map((p) => (
            <li key={p.id}>
              <Link to={`/pessoas/${p.id}`} className="item">
                <span className="hora">{p.primeira_visita ? dataBR(p.primeira_visita) : dataBR(p.criado_em)}</span>
                <div className="item-texto">
                  <strong>{p.nome}</strong>
                  <span>
                    {[p.como_conheceu, p.convidado_por && `por ${p.convidado_por}`].filter(Boolean).join(' ') || 'sem detalhes'}
                    {p.etapa && <em className="tag tag-linha">{ETAPAS.find((e) => e.id === p.etapa)?.nome}</em>}
                  </span>
                </div>
                <BotaoWhats telefone={p.telefone} texto={`Oi ${primeiroNome(p.nome)}! Que alegria ter você com a gente na ${igreja?.nome ?? 'igreja'}. Volte sempre, conte com a gente!`} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

// ---------- Fichas ----------
const CAMPOS: [keyof Pessoa, string][] = [['telefone', 'celular'], ['nascimento', 'nascimento'], ['endereco', 'endereço'], ['email', 'e-mail'], ['data_batismo', 'batismo']]

function Fichas({ pessoas, mudou }: { pessoas: Pessoa[]; mudou: () => void }) {
  const { igreja } = useSessao()
  const [falta, setFalta] = useState<string>('')
  const [busca, setBusca] = useState('')
  const [novo, setNovo] = useState(false)
  const membros = pessoas.filter((p) => p.tipo === 'membro')
  const comFalta = membros.map((p) => ({ p, faltam: CAMPOS.filter(([k]) => !p[k]).map(([, n]) => n) })).filter((x) => x.faltam.length)
  const t = busca.trim().toLowerCase()
  const lista = comFalta.filter((x) => (!falta || x.faltam.includes(falta)) && (!t || x.p.nome.toLowerCase().includes(t)))
  const link = `${window.location.origin}${import.meta.env.BASE_URL}`

  return (
    <>
      <div className="numeros">
        <div className="numero"><span>Membros</span><strong>{membros.length}</strong><small>fichas ativas</small></div>
        <div className="numero"><span>Fichas completas</span><strong className="pos">{membros.length - comFalta.length}</strong><small>com celular, nascimento, endereço, e-mail e batismo</small></div>
        <div className="numero"><span>Faltando dados</span><strong className={comFalta.length ? 'ambar' : ''}>{comFalta.length}</strong><small>toque na pessoa pra completar</small></div>
      </div>
      <section className="painel">
        <div className="lista-topo">
          <h2>Fichas incompletas</h2>
          <button className="btn btn-mini btn-primario" onClick={() => setNovo(true)}><Icone nome="mais_um" tam={16} /> Cadastrar membro</button>
        </div>
        <div className="lista-filtros">
          <div className="seg">
            <button className={!falta ? 'ativo' : ''} onClick={() => setFalta('')}>Todas</button>
            {CAMPOS.map(([, n]) => <button key={n} className={falta === n ? 'ativo' : ''} onClick={() => setFalta(n)}>Sem {n} <small>{comFalta.filter((x) => x.faltam.includes(n)).length}</small></button>)}
          </div>
          <input className="busca" type="search" placeholder="Buscar nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {lista.length === 0 && <p className="vazio">Nenhuma ficha faltando dados aqui.</p>}
        <ul className="lista plana">
          {lista.map(({ p, faltam }) => (
            <li key={p.id}>
              <Link to={`/pessoas/${p.id}`} className="item">
                <div className="item-texto"><strong>{p.nome}</strong><span>falta: {faltam.join(', ')}</span></div>
                <BotaoWhats telefone={p.telefone}
                  texto={`Oi ${primeiroNome(p.nome)}! A secretaria da ${igreja?.nome ?? 'igreja'} está atualizando as fichas dos membros. Pode completar a sua (${faltam.join(', ')}) pelo link? ${link}`} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <Folha titulo="Novo membro" aberta={novo} fechar={() => setNovo(false)}>
        {novo && <FormPessoa tipoPadrao="membro" salvo={() => { setNovo(false); mudou() }} />}
      </Folha>
    </>
  )
}

// ---------- Documentos ----------
type TipoDoc = 'declaracao' | 'recomendacao' | 'transferencia'
const DOCS: Record<TipoDoc, string> = { declaracao: 'Declaração de membro', recomendacao: 'Carta de recomendação', transferencia: 'Carta de transferência' }

function Documentos({ pessoas }: { pessoas: Pessoa[] }) {
  const { igreja, equipe } = useSessao()
  const pastor = equipe.find((e) => /pastor/i.test(e.titulo ?? '')) ?? equipe.find((e) => e.papel === 'pastor')
    ?? equipe.find((e) => e.papel === 'admin' && !e.titulo)
  const [tipo, setTipo] = useState<TipoDoc>('declaracao')
  const [pessoaId, setPessoaId] = useState('')
  const [destino, setDestino] = useState('')
  const [finalidade, setFinalidade] = useState('')
  const [assina, setAssina] = useState(pastor?.nome ?? '')
  const [cargo, setCargo] = useState(pastor?.titulo?.trim() || 'Pastor')
  const [texto, setTexto] = useState('')
  const [editado, setEditado] = useState(false)
  const membros = pessoas.filter((p) => p.tipo === 'membro')
  const p = membros.find((x) => x.id === pessoaId)
  const nomeIgreja = igreja?.nome ?? 'nossa igreja'

  const gerado = useMemo(() => {
    if (!p) return ''
    const batismo = p.data_batismo ? `, batizado(a) em ${dataExtenso(p.data_batismo)}` : ''
    const desde = p.data_conversao ? `, convertido(a) em ${dataExtenso(p.data_conversao)}` : ''
    if (tipo === 'declaracao') {
      return `Declaramos, para os devidos fins${finalidade.trim() ? `, ${finalidade.trim()}` : ''}, que ${p.nome} é membro da ${nomeIgreja}${batismo}${desde}, encontrando-se em plena comunhão com esta igreja.\n\nPor ser verdade, firmamos a presente declaração.`
    }
    if (tipo === 'recomendacao') {
      return `${destino.trim() ? `À ${destino.trim()}.\n\n` : ''}A ${nomeIgreja} recomenda o(a) irmão(ã) ${p.nome}, membro desta igreja${batismo}, que se encontra em plena comunhão conosco, para que seja recebido(a) com o amor de Cristo.\n\nQue o Senhor abençoe sua vida e seu serviço.`
    }
    return `${destino.trim() ? `À ${destino.trim()}.\n\n` : ''}Atendendo ao pedido do(a) irmão(ã) ${p.nome}, membro da ${nomeIgreja}${batismo}, concedemos a presente carta de transferência, para que seja recebido(a) como membro dessa igreja.\n\nDeclaramos que se encontra em plena comunhão conosco. Que Deus abençoe essa nova etapa.`
  }, [p, tipo, destino, finalidade, nomeIgreja])
  useEffect(() => { if (!editado) setTexto(gerado) }, [gerado, editado])

  return (
    <div className="docs">
      <section className="painel sem-impressao">
        <h2>Gerar documento</h2>
        <div className="form">
          <div className="seg">
            {(Object.keys(DOCS) as TipoDoc[]).map((t) => <button key={t} type="button" className={tipo === t ? 'ativo' : ''} onClick={() => { setTipo(t); setEditado(false) }}>{DOCS[t]}</button>)}
          </div>
          <label>Membro
            <select value={pessoaId} onChange={(e) => { setPessoaId(e.target.value); setEditado(false) }}>
              <option value="">Escolha o membro</option>
              {membros.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
            </select>
          </label>
          {tipo === 'declaracao'
            ? <label>Finalidade (opcional)<input value={finalidade} onChange={(e) => { setFinalidade(e.target.value); setEditado(false) }} placeholder="Ex.: junto ao empregador" /></label>
            : <label>Igreja de destino<input value={destino} onChange={(e) => { setDestino(e.target.value); setEditado(false) }} placeholder="Ex.: Igreja Batista Central de Taguatinga" /></label>}
          <div className="linha-2">
            <label>Quem assina<input value={assina} onChange={(e) => setAssina(e.target.value)} /></label>
            <label>Cargo<input value={cargo} onChange={(e) => setCargo(e.target.value)} /></label>
          </div>
          {p && (
            <label>Texto (dá pra ajustar)
              <textarea rows={6} value={texto} onChange={(e) => { setTexto(e.target.value); setEditado(true) }} />
            </label>
          )}
          {p && <button type="button" className="btn btn-primario" onClick={() => window.print()}><Icone nome="documento" tam={18} /> Imprimir / salvar PDF</button>}
        </div>
      </section>

      {p ? (
        <article className="documento">
          <header>
            <LogoIgreja igreja={igreja} tam={64} />
            <div><strong>{nomeIgreja}</strong>{igreja?.cidade && <span>{igreja.cidade}</span>}</div>
          </header>
          <h1>{DOCS[tipo]}</h1>
          {texto.split('\n').filter((l, i, a) => l.trim() || (i > 0 && a[i - 1].trim())).map((l, i) => (l.trim() ? <p key={i}>{l}</p> : null))}
          <p className="doc-data">{igreja?.cidade ? `${igreja.cidade}, ` : ''}{dataExtenso(hojeISO())}.</p>
          <div className="assinatura"><span /><strong>{assina || ' '}</strong><small>{cargo}</small></div>
        </article>
      ) : <p className="vazio sem-impressao">Escolha o membro pra ver o documento.</p>}
    </div>
  )
}

const MESES_EXT = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const dataExtenso = (d: string) => { const [a, m, dd] = d.slice(0, 10).split('-').map(Number); return `${dd} de ${MESES_EXT[m - 1]} de ${a}` }

// ---------- Avisos e eventos ----------
function Avisos() {
  const { igreja, userId } = useSessao()
  const [avisos, setAvisos] = useState<Aviso[] | null>(null)
  const [editando, setEditando] = useState<Aviso | 'novo' | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState('')

  function carregar() {
    if (!igreja) return
    supabase.from('avisos').select('*').eq('igreja_id', igreja.id).order('data', { nullsFirst: true })
      .then(({ data, error }) => {
        if (error) setErro(/relation|schema cache|does not exist/.test(error.message) ? 'Falta rodar a migração mais nova no Supabase.' : 'Não consegui carregar.')
        setAvisos((data as Aviso[]) ?? [])
      })
  }
  useEffect(carregar, [igreja?.id])

  const hoje = hojeISO()
  const vigente = (a: Aviso) => (a.tipo === 'evento' ? !a.data || a.data >= hoje : !a.ate || a.ate >= hoje)
  const atuais = (avisos ?? []).filter(vigente).sort((x, y) => (x.data ?? '0').localeCompare(y.data ?? '0'))
  const passados = (avisos ?? []).filter((a) => !vigente(a)).sort((x, y) => (y.data ?? '').localeCompare(x.data ?? ''))

  const textoZap = useMemo(() => {
    const linhas = atuais.map((a) => {
      const quando = a.data ? `${diaSemana(a.data)} ${dataBR(a.data)}${a.hora ? ` · ${a.hora}` : ''} — ` : ''
      return `• ${quando}*${a.titulo}*${a.local ? ` (${a.local})` : ''}${a.texto ? `\n  ${a.texto}` : ''}`
    })
    return `*Avisos da ${igreja?.nome ?? 'igreja'}*\n\n${linhas.join('\n\n')}\n\nDeus abençoe!`
  }, [atuais, igreja?.nome])

  async function copiar() {
    try { await navigator.clipboard.writeText(textoZap); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sem permissão: usa o link */ }
  }

  if (!avisos) return <div className="spinner" />
  return (
    <>
      <div className="acoes-topo avisos-acoes">
        <button className="btn btn-primario" onClick={() => setEditando('novo')}><Icone nome="mais_um" tam={18} /> Novo aviso ou evento</button>
        {atuais.length > 0 && <button className="btn" onClick={copiar}>{copiado ? 'Copiado!' : 'Copiar pro WhatsApp'}</button>}
        {atuais.length > 0 && <a className="btn btn-whats" href={`https://wa.me/?text=${encodeURIComponent(textoZap)}`} target="_blank" rel="noreferrer">Enviar no WhatsApp</a>}
      </div>
      {erro && <p className="erro">{erro}</p>}
      <section className="painel">
        <h2>Próximos</h2>
        {atuais.length === 0 && <p className="vazio">Nenhum aviso ou evento. Cadastre a Santa Ceia, um congresso, um aviso pro boletim...</p>}
        <ul className="lista plana">
          {atuais.map((a) => <LinhaAviso key={a.id} a={a} abrir={() => setEditando(a)} />)}
        </ul>
      </section>
      {passados.length > 0 && (
        <details className="painel">
          <summary><h2>Já passaram ({passados.length})</h2></summary>
          <ul className="lista plana">{passados.map((a) => <LinhaAviso key={a.id} a={a} abrir={() => setEditando(a)} />)}</ul>
        </details>
      )}
      <Folha titulo={editando === 'novo' ? 'Novo aviso ou evento' : 'Aviso ou evento'} aberta={!!editando} fechar={() => setEditando(null)}>
        {editando && <FormAviso inicial={editando === 'novo' ? null : editando} igrejaId={igreja!.id} userId={userId!}
          pronto={() => { setEditando(null); carregar() }} />}
      </Folha>
    </>
  )
}

function LinhaAviso({ a, abrir }: { a: Aviso; abrir: () => void }) {
  return (
    <li>
      <button className="item" onClick={abrir}>
        <span className="hora">{a.data ? <>{dataBR(a.data)}<small className="dia-sem">{diaSemana(a.data)}</small></> : <Icone nome="megafone" tam={18} />}</span>
        <div className="item-texto">
          <strong>{a.titulo}</strong>
          <span>{[a.tipo === 'aviso' ? 'Aviso' : 'Evento', a.hora, a.local, a.texto].filter(Boolean).join(' · ')}</span>
        </div>
      </button>
    </li>
  )
}

function FormAviso({ inicial, igrejaId, userId, pronto }: { inicial: Aviso | null; igrejaId: string; userId: string; pronto: () => void }) {
  const [tipo, setTipo] = useState<'evento' | 'aviso'>(inicial?.tipo ?? 'evento')
  const [titulo, setTitulo] = useState(inicial?.titulo ?? '')
  const [data, setData] = useState(inicial?.data ?? '')
  const [hora, setHora] = useState(inicial?.hora ?? '')
  const [local, setLocal] = useState(inicial?.local ?? '')
  const [texto, setTexto] = useState(inicial?.texto ?? '')
  const [ate, setAte] = useState(inicial?.ate ?? '')
  const [erro, setErro] = useState('')

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setErro('Coloque o título.'); return }
    if (tipo === 'evento' && !data) { setErro('Evento precisa de data.'); return }
    const reg = { tipo, titulo: titulo.trim(), data: data || null, hora: hora.trim() || null, local: local.trim() || null, texto: texto.trim() || null, ate: tipo === 'aviso' ? ate || null : null }
    const { error } = inicial
      ? await supabase.from('avisos').update(reg).eq('id', inicial.id)
      : await supabase.from('avisos').insert({ igreja_id: igrejaId, criado_por: userId, ...reg })
    if (error) { setErro('Não deu pra salvar.'); return }
    pronto()
  }
  async function apagar() {
    await supabase.from('avisos').delete().eq('id', inicial!.id)
    pronto()
  }
  return (
    <form className="form" onSubmit={salvar}>
      <div className="seg">
        <button type="button" className={tipo === 'evento' ? 'ativo' : ''} onClick={() => setTipo('evento')}>Evento</button>
        <button type="button" className={tipo === 'aviso' ? 'ativo' : ''} onClick={() => setTipo('aviso')}>Aviso</button>
      </div>
      <label>Título<input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === 'evento' ? 'Ex.: Culto de Santa Ceia' : 'Ex.: Inscrições abertas pro retiro'} autoFocus={!inicial} /></label>
      {tipo === 'evento' ? (
        <div className="linha-2">
          <label>Data<input type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
          <label>Horário<input value={hora} onChange={(e) => setHora(e.target.value)} placeholder="Ex.: 19h" /></label>
        </div>
      ) : (
        <label>Mostrar até (opcional)<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
      )}
      {tipo === 'evento' && <label>Local<input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Ex.: Templo" /></label>}
      <label>Detalhes (opcional)<textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} /></label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Salvar</button>
      {inicial && <button type="button" className="btn btn-perigo" onClick={apagar}>Apagar</button>}
    </form>
  )
}
