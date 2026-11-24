import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { APP_ICONE, APP_NOME, NOVAS_IGREJAS } from '../config'

// Primeiro acesso de quem ainda não está em nenhuma igreja.
// NOVAS_IGREJAS=false: completa o cadastro e entra como membro desta igreja.
export default function NovaIgreja() {
  return NOVAS_IGREJAS ? <CadastrarIgreja /> : <CompletarCadastro />
}

function Logo() {
  return <img className="entrada-logo" src={import.meta.env.BASE_URL + APP_ICONE} alt=""
    onError={(e) => { e.currentTarget.style.display = 'none' }} />
}

function CompletarCadastro() {
  const { recarregar, sair, session } = useSessao()
  const nomeGoogle = (session?.user.user_metadata?.full_name as string | undefined) ?? ''
  const [nome, setNome] = useState(nomeGoogle)
  const [telefone, setTelefone] = useState('')
  const [nascimento, setNascimento] = useState('')
  const [tipo, setTipo] = useState<'membro' | 'visitante'>('membro')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const { error } = await supabase.rpc('auto_cadastro', {
      p_nome: nome, p_telefone: telefone, p_nascimento: nascimento || null, p_tipo: tipo,
    })
    setEnviando(false)
    if (error) { setErro(/fechado/.test(error.message) ? 'O cadastro pelo site ainda não foi aberto. Fale com a secretaria.' : 'Não deu pra concluir. Tente de novo.'); return }
    await recarregar()
  }

  return (
    <div className="entrada">
      <div className="entrada-cartao">
        <Logo />
        <h1>Bem-vindo à {APP_NOME}</h1>
        <p className="suave">Só falta completar seu cadastro. Se você já preencheu a ficha da igreja, a gente encontra pelo seu e-mail ou celular.</p>
        <form className="form" onSubmit={enviar}>
          <div className="seg">
            <button type="button" className={tipo === 'membro' ? 'ativo' : ''} onClick={() => setTipo('membro')}>Sou membro</button>
            <button type="button" className={tipo === 'visitante' ? 'ativo' : ''} onClick={() => setTipo('visitante')}>Estou visitando</button>
          </div>
          <label>Nome completo<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Celular (WhatsApp)<input required inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(61) 99999-0000" /></label>
          <label>Data de nascimento<input type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} /></label>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Salvando…' : 'Concluir cadastro'}</button>
        </form>
        <p className="dica">Entrou como {session?.user.email}. <button className="link" onClick={sair}>Usar outra conta</button></p>
      </div>
    </div>
  )
}

function CadastrarIgreja() {
  const { recarregar, sair, session } = useSessao()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [meuNome, setMeuNome] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const { error } = await supabase.rpc('criar_igreja', { p_nome: nome, p_cidade: cidade, p_meu_nome: meuNome })
    setEnviando(false)
    if (error) { setErro('Não deu pra criar. Tente de novo.'); return }
    await recarregar()
  }

  return (
    <div className="entrada">
      <div className="entrada-cartao">
        <h1>Cadastre sua igreja</h1>
        <p className="suave">Se você foi convidado por alguém da equipe, peça pra liberarem o e-mail <b>{session?.user.email}</b> e entre de novo.</p>
        <form className="form" onSubmit={enviar}>
          <label>Nome da igreja<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
          <label>Cidade<input value={cidade} onChange={(e) => setCidade(e.target.value)} /></label>
          <label>Seu nome<input required value={meuNome} onChange={(e) => setMeuNome(e.target.value)} /></label>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Começar'}</button>
        </form>
        <button className="link" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
