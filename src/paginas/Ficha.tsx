import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Contato, Pessoa } from '../lib/tipos'
import { ETAPAS, PAPEIS, dataBR, iniciais, podeEquipe, primeiroNome, situacaoPrazo } from '../lib/util'
import FormAcesso from '../componentes/FormAcesso'
import Folha from '../componentes/Folha'
import FormPessoa from '../componentes/FormPessoa'
import BotaoWhats from '../componentes/BotaoWhats'
import Icone from '../componentes/Icone'

const MEIOS = { whatsapp: 'WhatsApp', ligacao: 'Ligação', visita: 'Visita', presencial: 'Na igreja' } as const

export default function Ficha() {
  const { id } = useParams()
  const navegar = useNavigate()
  const { igreja, userId, equipe, nomeDe, papel } = useSessao()
  const [p, setP] = useState<Pessoa | null>(null)
  const [contatos, setContatos] = useState<Contato[]>([])
  const [editando, setEditando] = useState(false)
  const [registrando, setRegistrando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [dandoAcesso, setDandoAcesso] = useState(false)

  useEffect(() => {
    supabase.from('pessoas').select('*').eq('id', id!).single().then(({ data }) => setP(data))
    supabase.from('contatos').select('*').eq('pessoa_id', id!).order('criado_em', { ascending: false })
      .then(({ data }) => setContatos(data ?? []))
  }, [id])

  if (!p) return <div className="spinner" />

  const etapa = ETAPAS.find((e) => e.id === p.etapa)
  const login = equipe.find((e) => e.pessoa_id === p.id)
  const prazo = situacaoPrazo(p.prazo)

  async function tornarMembro() {
    const { data } = await supabase.from('pessoas').update({ tipo: 'membro' }).eq('id', p!.id).select().single()
    if (data) setP(data)
  }

  async function arquivar() {
    await supabase.from('pessoas').update({ ativo: false }).eq('id', p!.id)
    navegar('/pessoas')
  }

  return (
    <>
      <button className="voltar" onClick={() => navegar(-1)}><Icone nome="voltar" tam={18} /> Voltar</button>

      <div className="ficha-topo">
        <span className="avatar grande">{iniciais(p.nome)}</span>
        <div>
          <h1 className="titulo">{p.nome}</h1>
          <p className="suave">{p.tipo === 'membro' ? 'Membro' : 'Visitante'}{etapa && ` · ${etapa.nome}`}</p>
          {login && <span className="tag">{PAPEIS[login.papel]} · acessa o app</span>}
        </div>
      </div>

      <div className="acoes">
        <BotaoWhats telefone={p.telefone} texto={`Oi ${primeiroNome(p.nome)}, tudo bem?`} rotulo="WhatsApp" />
        {p.telefone && <a className="btn" href={`tel:${p.telefone.replace(/\D/g, '')}`}><Icone nome="telefone" tam={18} /> Ligar</a>}
        <button className="btn" onClick={() => setRegistrando(true)}>Registrar contato</button>
      </div>

      {p.proximo_passo && (
        <div className="cartao destaque">
          <small>Próximo passo · com {nomeDe(p.responsavel_id)}</small>
          <strong>{p.proximo_passo}</strong>
          {p.prazo && <span>até {dataBR(p.prazo)} {prazo && <span className={prazo.classe}>{prazo.rotulo}</span>}</span>}
        </div>
      )}

      <dl className="dados">
        <div><dt>Telefone</dt><dd>{p.telefone || '—'}</dd></div>
        <div><dt>Endereço</dt><dd>{p.endereco || '—'}</dd></div>
        <div><dt>Nascimento</dt><dd>{p.nascimento ? dataBR(p.nascimento) : '—'}</dd></div>
        <div><dt>Desde</dt><dd>{dataBR(p.criado_em)}</dd></div>
        {p.email && <div><dt>E-mail</dt><dd>{p.email}</dd></div>}
        {p.telefone_fixo && <div><dt>Telefone fixo</dt><dd>{p.telefone_fixo}</dd></div>}
        {p.cidade && <div><dt>Cidade</dt><dd>{p.cidade}</dd></div>}
        {p.naturalidade && <div><dt>Naturalidade</dt><dd>{p.naturalidade}</dd></div>}
        {p.data_conversao && <div><dt>Conversão</dt><dd>{dataBR(p.data_conversao)}</dd></div>}
        {p.data_batismo && <div><dt>Batismo</dt><dd>{dataBR(p.data_batismo)}</dd></div>}
        {p.congregacao && <div><dt>Onde congrega</dt><dd>{p.congregacao}</dd></div>}
        {p.aluno_ebd != null && <div><dt>Aluno da EBD</dt><dd>{p.aluno_ebd ? 'Sim' : 'Não'}</dd></div>}
        {p.observacoes && <div className="largo"><dt>Observações</dt><dd>{p.observacoes}</dd></div>}
      </dl>

      <h2 className="secao">Histórico de cuidado</h2>
      {contatos.length === 0 && <p className="vazio">Nenhum contato registrado ainda.</p>}
      <ol className="linha-tempo">
        {contatos.map((c) => (
          <li key={c.id}>
            <small>{dataBR(c.criado_em)} · {MEIOS[c.meio]} · {c.autor_nome}</small>
            {c.nota && <p>{c.nota}</p>}
          </li>
        ))}
      </ol>

      <div className="acoes rodape">
        <button className="btn" onClick={() => setEditando(true)}>Editar dados</button>
        {p.tipo === 'visitante' && <button className="btn" onClick={tornarMembro}>Tornar membro</button>}
        {!login && podeEquipe(papel) && <button className="btn" onClick={() => setDandoAcesso(true)}>Dar acesso ao app</button>}
        <button className="btn btn-perigo" onClick={() => setConfirmando(true)}>Arquivar</button>
      </div>

      <Folha titulo={`Arquivar ${primeiroNome(p.nome)}?`} aberta={confirmando} fechar={() => setConfirmando(false)}>
        <p className="suave">A pessoa sai das listas, mas o histórico fica guardado.</p>
        <div className="acoes">
          <button className="btn btn-perigo" onClick={arquivar}>Sim, arquivar</button>
          <button className="btn" onClick={() => setConfirmando(false)}>Cancelar</button>
        </div>
      </Folha>

      <Folha titulo={`Acesso de ${primeiroNome(p.nome)} ao app`} aberta={dandoAcesso} fechar={() => setDandoAcesso(false)}>
        <FormAcesso pessoa={p} pronto={() => setDandoAcesso(false)} />
      </Folha>

      <Folha titulo="Editar" aberta={editando} fechar={() => setEditando(false)}>
        <FormPessoa inicial={p} salvo={(n) => { setP(n); setEditando(false) }} />
      </Folha>

      <Folha titulo={`Contato com ${primeiroNome(p.nome)}`} aberta={registrando} fechar={() => setRegistrando(false)}>
        <RegistrarContato pessoa={p} autorNome={equipe.find((e) => e.user_id === userId)?.nome ?? ''}
          igrejaId={igreja!.id} userId={userId!}
          feito={(c, nova) => { setContatos([c, ...contatos]); setP(nova); setRegistrando(false) }} />
      </Folha>
    </>
  )
}

function RegistrarContato({ pessoa, autorNome, igrejaId, userId, feito }: {
  pessoa: Pessoa; autorNome: string; igrejaId: string; userId: string
  feito: (c: Contato, p: Pessoa) => void
}) {
  const [meio, setMeio] = useState<Contato['meio']>('whatsapp')
  const [nota, setNota] = useState('')
  const [proximo, setProximo] = useState(pessoa.proximo_passo ?? '')
  const [prazo, setPrazo] = useState(pessoa.prazo ?? '')
  const [salvando, setSalvando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    const { data: c } = await supabase.from('contatos').insert({
      igreja_id: igrejaId, pessoa_id: pessoa.id, autor_id: userId, autor_nome: autorNome, meio, nota: nota || null,
    }).select().single()
    const { data: p } = await supabase.from('pessoas')
      .update({ proximo_passo: proximo || null, prazo: prazo || null }).eq('id', pessoa.id).select().single()
    setSalvando(false)
    if (c && p) feito(c, p)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <div className="seg">
        {(Object.keys(MEIOS) as Contato['meio'][]).map((m) => (
          <button type="button" key={m} className={meio === m ? 'ativo' : ''} onClick={() => setMeio(m)}>{MEIOS[m]}</button>
        ))}
      </div>
      <label>Como foi?<textarea rows={3} value={nota} onChange={(e) => setNota(e.target.value)}
        placeholder="Ex.: está bem, faltou porque viajou" /></label>
      <div className="linha-2">
        <label>Próximo passo<input value={proximo} onChange={(e) => setProximo(e.target.value)} /></label>
        <label>Prazo<input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} /></label>
      </div>
      <button className="btn btn-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Registrar'}</button>
    </form>
  )
}
