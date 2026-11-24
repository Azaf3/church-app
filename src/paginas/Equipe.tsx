import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Papel } from '../lib/tipos'
import { PAPEIS, iniciais, podeEquipe } from '../lib/util'
import Folha from '../componentes/Folha'
import Icone from '../componentes/Icone'

interface Convite { id: string; email: string; nome: string; papel: Papel }

export default function Equipe() {
  const { igreja, equipe, papel, userId } = useSessao()
  const [convites, setConvites] = useState<Convite[]>([])
  const [aberto, setAberto] = useState(false)
  const gestor = podeEquipe(papel)

  useEffect(() => {
    if (!igreja || !gestor) return
    supabase.from('convites').select('*').eq('igreja_id', igreja.id).then(({ data }) => setConvites(data ?? []))
  }, [igreja?.id, gestor])

  async function cancelar(id: string) {
    await supabase.from('convites').delete().eq('id', id)
    setConvites(convites.filter((c) => c.id !== id))
  }

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Equipe</h1>
        {gestor && <button className="btn btn-primario" onClick={() => setAberto(true)}><Icone nome="mais_um" tam={18} /> Convidar</button>}
      </div>

      <ul className="lista">
        {equipe.map((m) => (
          <li key={m.user_id} className="item">
            <span className="avatar">{iniciais(m.nome)}</span>
            <div className="item-texto">
              <strong>{m.nome}{m.user_id === userId && ' (você)'}</strong>
              <span>{PAPEIS[m.papel]}</span>
            </div>
          </li>
        ))}
      </ul>

      {convites.length > 0 && (
        <>
          <h2 className="secao">Convites pendentes</h2>
          <ul className="lista">
            {convites.map((c) => (
              <li key={c.id} className="item">
                <div className="item-texto"><strong>{c.nome}</strong><span>{c.email} · {PAPEIS[c.papel]}</span></div>
                <button className="btn btn-mini" onClick={() => cancelar(c.id)}>Cancelar</button>
              </li>
            ))}
          </ul>
          <p className="suave">A pessoa cria a conta com esse e-mail e já entra na igreja.</p>
        </>
      )}

      <Folha titulo="Convidar pra equipe" aberta={aberto} fechar={() => setAberto(false)}>
        <FormConvite igrejaId={igreja!.id} salvo={(c) => { setConvites([...convites, c]); setAberto(false) }} />
      </Folha>
    </>
  )
}

function FormConvite({ igrejaId, salvo }: { igrejaId: string; salvo: (c: Convite) => void }) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [papel, setPapel] = useState<Papel>('obreiro')
  const [erro, setErro] = useState('')

  async function enviar(e: FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('convites')
      .insert({ igreja_id: igrejaId, nome, email: email.trim().toLowerCase(), papel }).select().single()
    if (error || !data) { setErro('Esse e-mail já foi convidado ou deu erro.'); return }
    salvo(data)
  }

  return (
    <form className="form" onSubmit={enviar}>
      <label>Nome<input required value={nome} onChange={(e) => setNome(e.target.value)} /></label>
      <label>E-mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>Função
        <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
          <option value="obreiro">Obreiro — cuida de pessoas, presença e agenda</option>
          <option value="tesoureiro">Tesoureiro — tudo acima + financeiro</option>
          <option value="pastor">Pastor — acesso total e gerencia a equipe</option>
        </select>
      </label>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario">Enviar convite</button>
    </form>
  )
}
