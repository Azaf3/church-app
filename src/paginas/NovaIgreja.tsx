import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { APP_ICONE, APP_NOME, CADASTRO_ABERTO } from '../config'

export default function NovaIgreja() {
  const { recarregar, sair, session } = useSessao()
  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [meuNome, setMeuNome] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  if (!CADASTRO_ABERTO) {
    return (
      <div className="entrada">
        <div className="entrada-cartao">
          <img className="entrada-logo" src={import.meta.env.BASE_URL + APP_ICONE} alt=""
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <h1>Você ainda não tem acesso</h1>
          <p className="suave">
            O app da {APP_NOME} é só pra equipe da igreja. Peça ao pastor ou à secretaria pra liberar
            o e-mail <b>{session?.user.email}</b> e depois entre de novo.
          </p>
          <button className="btn" onClick={() => recarregar()}>Já liberaram, tentar de novo</button>
          <button className="link" onClick={sair}>Entrar com outra conta</button>
        </div>
      </div>
    )
  }

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
        <p className="suave">
          Se você foi convidado por alguém da equipe, peça pra convidarem o e-mail <b>{session?.user.email}</b> e entre de novo.
        </p>
        <form className="form" onSubmit={enviar}>
          <label>Nome da igreja<input required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Igreja Cristã Esperança" /></label>
          <label>Cidade<input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Brasília - DF" /></label>
          <label>Seu nome<input required value={meuNome} onChange={(e) => setMeuNome(e.target.value)} /></label>
          {erro && <p className="erro">{erro}</p>}
          <button className="btn btn-primario" disabled={enviando}>{enviando ? 'Criando…' : 'Começar'}</button>
        </form>
        <button className="link" onClick={sair}>Sair</button>
      </div>
    </div>
  )
}
