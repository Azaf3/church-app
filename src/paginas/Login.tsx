import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { NOME_PRODUTO } from '../lib/util'

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'criar'>('entrar')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [msg, setMsg] = useState('')
  const [enviando, setEnviando] = useState(false)

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
      <div className="entrada-cartao">
        <span className="topo-marca grande" />
        <h1>{NOME_PRODUTO}</h1>
        <p className="suave">O cuidado com cada pessoa da sua igreja, num lugar só.</p>

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
          {modo === 'entrar' ? 'Primeira vez? Criar conta' : 'Já tenho conta'}
        </button>
      </div>
    </div>
  )
}
