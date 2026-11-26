import FundoVivo from '../componentes/FundoVivo'
import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { APP_ICONE, APP_NOME, APP_SIGLA } from '../config'
import { linkDoApp } from '../lib/acesso'

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrarGoogle() {
    setMsg('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: linkDoApp(), queryParams: { prompt: 'select_account' } },
    })
    if (error) setMsg(/not enabled|provider/i.test(error.message)
      ? 'O login com Google ainda não foi ligado no Supabase.' : error.message)
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setEnviando(true); setMsg('')
    const { error } = modo === 'entrar'
      ? await supabase.auth.signInWithPassword({ email, password: senha })
      : await supabase.auth.signUp({ email, password: senha })
    setEnviando(false)
    if (error) {
      setMsg(error.message.includes('Invalid login') ? 'E-mail ou senha errados.' : error.message)
    } else if (modo === 'criar') {
      setMsg('Conta criada. Se pedir confirmação, olhe seu e-mail.')
    }
  }

  return (
    <div className="entrada">
      <FundoVivo modo="login" />
      <div className="entrada-cartao">
        <img className="entrada-logo" src={import.meta.env.BASE_URL + APP_ICONE} alt=""
          onError={(e) => { e.currentTarget.style.display = 'none' }} />
        <p className="entrada-sigla">{APP_SIGLA}</p>
        <h1>{APP_NOME}</h1>
        <p className="suave">Cuidado com cada pessoa da igreja: membros, visitantes, agenda e dízimos num lugar só.</p>

        <button className="btn btn-google" onClick={entrarGoogle} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
          </svg>
          Entrar com Google
        </button>

        <div className="ou"><span>ou com e-mail e senha</span></div>

        <form className="form" onSubmit={enviar}>
          <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></label>
          <label>Senha<input type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)}
            autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'} /></label>
          {msg && <p className="erro">{msg}</p>}
          <button className="btn btn-primario" disabled={enviando}>
            {enviando ? 'Aguarde…' : modo === 'entrar' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button className="link" onClick={() => { setModo(modo === 'entrar' ? 'criar' : 'entrar'); setMsg('') }}>
            {modo === 'entrar' ? 'Primeira vez? Cadastre-se' : 'Já tenho conta'}
          </button>
        <a className="link-privacidade" href={import.meta.env.BASE_URL + 'privacidade.html'}>Política de privacidade</a>
      </div>
    </div>
  )
}
