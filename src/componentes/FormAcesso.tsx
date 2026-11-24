import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { criarAcesso, gerarSenha, linkDoApp } from '../lib/acesso'
import type { Papel, Pessoa } from '../lib/tipos'
import { primeiroNome } from '../lib/util'
import BotaoWhats from './BotaoWhats'

const FUNCOES: { id: Papel; nome: string; desc: string }[] = [
  { id: 'membro', nome: 'Membro', desc: 'Só vê e atualiza a própria ficha' },
  { id: 'obreiro', nome: 'Obreiro', desc: 'Cuida de pessoas, jornada, presença e agenda' },
  { id: 'tesoureiro', nome: 'Tesoureiro', desc: 'Tudo do obreiro + dízimos e ofertas' },
  { id: 'pastor', nome: 'Pastor', desc: 'Acesso total e gerencia a equipe' },
  { id: 'admin', nome: 'Administrador', desc: 'Acesso total (dono da conta da igreja)' },
]

export default function FormAcesso({ pessoa, pronto }: { pessoa?: Pessoa; pronto: () => void }) {
  const { igreja, equipe, recarregarEquipe } = useSessao()
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [pessoaId, setPessoaId] = useState(pessoa?.id ?? '')
  const [nome, setNome] = useState(pessoa?.nome ?? '')
  const [email, setEmail] = useState(pessoa?.email ?? '')
  const [senha, setSenha] = useState(gerarSenha)
  const [papel, setPapel] = useState<Papel>('obreiro')
  const [google, setGoogle] = useState(true)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<null | { pendente: boolean; jaTinhaConta: boolean; telefone: string | null; google: boolean }>(null)

  useEffect(() => {
    if (!igreja || pessoa) return
    supabase.from('pessoas').select('*').eq('igreja_id', igreja.id).eq('ativo', true).order('nome')
      .then(({ data }) => setPessoas(data ?? []))
  }, [igreja?.id, pessoa])

  const jaLigadas = new Set(equipe.map((e) => e.pessoa_id).filter(Boolean))
  const escolhida = pessoa ?? pessoas.find((p) => p.id === pessoaId)

  function escolher(id: string) {
    setPessoaId(id)
    const p = pessoas.find((x) => x.id === id)
    if (p) { setNome(p.nome); if (p.email) setEmail(p.email) }
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const r = await criarAcesso({ igrejaId: igreja!.id, nome, email, senha, papel, pessoaId: pessoaId || null, google })
    setEnviando(false)
    if (!r.ok) { setErro(r.erro); return }
    await recarregarEquipe()
    setFeito({ pendente: r.pendente, jaTinhaConta: r.jaTinhaConta, telefone: escolhida?.telefone ?? null, google })
  }

  if (feito) {
    const msg = feito.google
      ? `Oi ${primeiroNome(nome)}! Liberei seu acesso ao app da ${igreja!.nome}. Abra ${linkDoApp()} e toque em "Entrar com Google" usando a conta ${email}.`
      : feito.jaTinhaConta
      ? `Oi ${primeiroNome(nome)}! Você agora faz parte da equipe da ${igreja!.nome} no app. Entre em ${linkDoApp()} com o seu e-mail (${email}) e a senha que você já usa.`
      : `Oi ${primeiroNome(nome)}! Criei seu acesso ao app da ${igreja!.nome}.\n\nLink: ${linkDoApp()}\nE-mail: ${email}\nSenha: ${senha}\n\nDepois de entrar, guarde essa senha.`
    return (
      <div className="form">
        <div className="cartao destaque">
          <strong>{feito.google ? 'Acesso liberado' : feito.pendente ? 'Acesso registrado' : 'Login criado'}</strong>
          <span>
            {feito.google
              ? `Quando ${primeiroNome(nome)} entrar com a conta Google ${email}, já cai na equipe.`
              : feito.jaTinhaConta
              ? 'Esse e-mail já tinha conta. A pessoa entra com a senha dela e já cai na equipe.'
              : feito.pendente
                ? 'O Supabase está pedindo confirmação por e-mail: a pessoa confirma, entra e já cai na equipe.'
                : `${primeiroNome(nome)} já está na equipe como ${FUNCOES.find((f) => f.id === papel)?.nome.toLowerCase()}.`}
          </span>
        </div>
        {!feito.jaTinhaConta && !feito.google && (
          <dl className="dados">
            <div className="largo"><dt>E-mail</dt><dd>{email}</dd></div>
            <div className="largo"><dt>Senha</dt><dd className="senha">{senha}</dd></div>
          </dl>
        )}
        {feito.telefone
          ? <BotaoWhats telefone={feito.telefone} texto={msg} rotulo="Mandar acesso no WhatsApp" />
          : <p className="suave">Anote o e-mail e a senha pra passar pra pessoa.</p>}
        <button className="btn" onClick={pronto}>Concluir</button>
      </div>
    )
  }

  return (
    <form className="form" onSubmit={enviar}>
      {!pessoa && (
        <label>É alguém já cadastrado?
          <select value={pessoaId} onChange={(e) => escolher(e.target.value)}>
            <option value="">Não, só login (sem ficha de membro)</option>
            {pessoas.filter((p) => !jaLigadas.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </label>
      )}
      <label>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <div className="seg">
        <button type="button" className={google ? 'ativo' : ''} onClick={() => setGoogle(true)}>Entra com Google</button>
        <button type="button" className={!google ? 'ativo' : ''} onClick={() => setGoogle(false)}>E-mail e senha</button>
      </div>
      <label>{google ? 'E-mail da conta Google' : 'E-mail de login'}
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={google ? 'nome@gmail.com' : ''} />
      </label>
      {google
        ? <p className="dica">Sem senha: a pessoa toca em “Entrar com Google” com essa conta e já entra na equipe. Por segurança, o cargo só vale entrando pelo Google.</p>
        : (
          <label>Senha
            <div className="linha-acao">
              <input required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
              <button type="button" className="btn" onClick={() => setSenha(gerarSenha())}>Gerar outra</button>
            </div>
          </label>
        )}

      <fieldset className="funcoes">
        <legend>Função</legend>
        {FUNCOES.map((f) => (
          <label key={f.id} className={'funcao' + (papel === f.id ? ' ativa' : '')}>
            <input type="radio" name="papel" checked={papel === f.id} onChange={() => setPapel(f.id)} />
            <span><strong>{f.nome}</strong><small>{f.desc}</small></span>
          </label>
        ))}
      </fieldset>

      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Salvando…' : google ? 'Liberar acesso' : 'Criar login'}</button>
    </form>
  )
}

export { FUNCOES }
