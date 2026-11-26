import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Convite, MembroEquipe, Papel } from '../lib/tipos'
import { primeiroNome } from '../lib/util'
import { FUNCOES } from './FormAcesso'

// função (nível de acesso) + cargo na igreja; serve pra quem já entra e pra quem ainda vai entrar
function CamposAcesso({ papel, setPapel, titulo, setTitulo, souAdmin, nomeRadio }: {
  papel: Papel; setPapel: (p: Papel) => void; titulo: string; setTitulo: (t: string) => void; souAdmin: boolean; nomeRadio: string
}) {
  return (
    <>
      <label>Cargo na igreja
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Opcional. Ex.: Pastor, Diácono, Missionária" />
      </label>
      <fieldset className="funcoes">
        <legend>Acesso no app</legend>
        {FUNCOES.filter((f) => souAdmin || f.id !== 'admin').map((f) => (
          <label key={f.id} className={'funcao' + (papel === f.id ? ' ativa' : '')}>
            <input type="radio" name={nomeRadio} checked={papel === f.id} onChange={() => setPapel(f.id)} />
            <span><strong>{f.nome}</strong><small>{f.desc}</small></span>
          </label>
        ))}
      </fieldset>
    </>
  )
}

export function EditarMembro({ m, souAdmin, pronto }: { m: MembroEquipe; souAdmin: boolean; pronto: () => void }) {
  const [papel, setPapel] = useState<Papel>(m.papel)
  const [titulo, setTitulo] = useState(m.titulo ?? '')
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const mudou = papel !== m.papel || titulo.trim() !== (m.titulo ?? '')

  async function salvar() {
    const { error } = await supabase.from('equipe').update({ papel, titulo: titulo.trim() || null })
      .eq('igreja_id', m.igreja_id).eq('user_id', m.user_id)
    if (error) { setErro('Não deu pra salvar.'); return }
    pronto()
  }

  async function remover() {
    const { error } = await supabase.from('equipe').delete().eq('igreja_id', m.igreja_id).eq('user_id', m.user_id)
    if (error) { setErro('Não deu pra remover.'); return }
    pronto()
  }

  return (
    <div className="form">
      <CamposAcesso papel={papel} setPapel={setPapel} titulo={titulo} setTitulo={setTitulo} souAdmin={souAdmin} nomeRadio="papel-edit" />
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" onClick={salvar} disabled={!mudou}>Salvar</button>
      {m.pessoa_id && <Link className="btn" to={`/pessoas/${m.pessoa_id}`}>Ver ficha de membro</Link>}
      {!confirmar
        ? <button className="btn btn-perigo" onClick={() => setConfirmar(true)}>Tirar acesso ao app</button>
        : (
          <div className="cartao">
            <span>{m.nome} não vai mais conseguir entrar nesta igreja. A ficha de membro continua.</span>
            <div className="acoes">
              <button className="btn btn-perigo" onClick={remover}>Sim, tirar acesso</button>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          </div>
        )}
    </div>
  )
}

// acesso liberado pra quem ainda não entrou: o cargo já vale no primeiro login com esse e-mail
export function EditarConvite({ c, souAdmin, pronto, comLinkFicha = true }: { c: Convite; souAdmin: boolean; pronto: () => void; comLinkFicha?: boolean }) {
  const [papel, setPapel] = useState<Papel>(c.papel)
  const [titulo, setTitulo] = useState(c.titulo ?? '')
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')
  const mudou = papel !== c.papel || titulo.trim() !== (c.titulo ?? '')

  async function salvar() {
    const { error } = await supabase.from('convites').update({ papel, titulo: titulo.trim() || null }).eq('id', c.id)
    if (error) { setErro('Não deu pra salvar.'); return }
    pronto()
  }

  async function remover() {
    const { error } = await supabase.from('convites').delete().eq('id', c.id)
    if (error) { setErro('Não deu pra tirar o acesso.'); return }
    pronto()
  }

  return (
    <div className="form">
      <p className="dica">
        Quando {primeiroNome(c.nome)} tocar em “Entrar com Google” com a conta <strong>{c.email}</strong>, já entra com esse acesso
        {c.pessoa_id ? ', ligado à ficha de membro.' : '.'}
      </p>
      <CamposAcesso papel={papel} setPapel={setPapel} titulo={titulo} setTitulo={setTitulo} souAdmin={souAdmin} nomeRadio="papel-convite" />
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" onClick={salvar} disabled={!mudou}>Salvar</button>
      {comLinkFicha && c.pessoa_id && <Link className="btn" to={`/pessoas/${c.pessoa_id}`}>Ver ficha de membro</Link>}
      {!confirmar
        ? <button className="btn btn-perigo" onClick={() => setConfirmar(true)}>Tirar acesso ao app</button>
        : (
          <div className="cartao">
            <span>{c.nome} não vai entrar com esse acesso. A ficha de membro continua.</span>
            <div className="acoes">
              <button className="btn btn-perigo" onClick={remover}>Sim, tirar acesso</button>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
            </div>
          </div>
        )}
    </div>
  )
}
