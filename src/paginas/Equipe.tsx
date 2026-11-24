import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { MembroEquipe, Papel } from '../lib/tipos'
import { PAPEIS, iniciais, podeEquipe } from '../lib/util'
import Folha from '../componentes/Folha'
import FormAcesso, { FUNCOES } from '../componentes/FormAcesso'
import Icone from '../componentes/Icone'

interface Convite { id: string; email: string; nome: string; papel: Papel }

export default function Equipe() {
  const { igreja, equipe, papel, userId, recarregarEquipe } = useSessao()
  const [convites, setConvites] = useState<Convite[]>([])
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<MembroEquipe | null>(null)
  const gestor = podeEquipe(papel)

  function carregarConvites() {
    if (!igreja || !gestor) return
    supabase.from('convites').select('*').eq('igreja_id', igreja.id).then(({ data }) => setConvites(data ?? []))
  }
  useEffect(carregarConvites, [igreja?.id, gestor])

  async function cancelar(id: string) {
    await supabase.from('convites').delete().eq('id', id)
    setConvites(convites.filter((c) => c.id !== id))
  }

  // pastor não mexe em administrador; ninguém mexe em si mesmo
  const podeEditar = (m: MembroEquipe) => gestor && m.user_id !== userId && (papel === 'admin' || m.papel !== 'admin')

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Equipe</h1>
        {gestor && <button className="btn btn-primario" onClick={() => setCriando(true)}><Icone nome="mais_um" tam={18} /> Criar login</button>}
      </div>
      <p className="suave">Quem se cadastra pelo link entra como membro. Toque na pessoa pra dar um cargo.</p>

      <h2 className="secao">Com cargo</h2>
      <ul className="lista">
        {equipe.filter((m) => m.papel !== 'membro').map((m) => (
          <li key={m.user_id}>
            <button className="item" onClick={() => podeEditar(m) && setEditando(m)} disabled={!podeEditar(m)}>
              <span className="avatar">{iniciais(m.nome)}</span>
              <div className="item-texto">
                <strong>{m.nome}{m.user_id === userId && ' (você)'}</strong>
                <span>{PAPEIS[m.papel]}{m.papel !== 'membro' && m.pessoa_id && ' · com ficha de membro'}</span>
              </div>
              {podeEditar(m) && <Icone nome="seta" tam={18} />}
            </button>
          </li>
        ))}
      </ul>

      {equipe.some((m) => m.papel === 'membro') && (
        <>
          <h2 className="secao">Membros com acesso ({equipe.filter((m) => m.papel === 'membro').length})</h2>
      <ul className="lista">
            {equipe.filter((m) => m.papel === 'membro').map((m) => (
              <li key={m.user_id}>
                <button className="item" onClick={() => podeEditar(m) && setEditando(m)} disabled={!podeEditar(m)}>
                  <span className="avatar">{iniciais(m.nome)}</span>
                  <div className="item-texto">
                    <strong>{m.nome}{m.user_id === userId && ' (você)'}</strong>
                    <span>{PAPEIS[m.papel]}{m.papel !== 'membro' && m.pessoa_id && ' · com ficha de membro'}</span>
                  </div>
                  {podeEditar(m) && <Icone nome="seta" tam={18} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {convites.length > 0 && (
        <>
          <h2 className="secao">Aguardando primeiro acesso</h2>
          <ul className="lista">
            {convites.map((c) => (
              <li key={c.id} className="item">
                <div className="item-texto"><strong>{c.nome}</strong><span>{c.email} · {PAPEIS[c.papel]}</span></div>
                <button className="btn btn-mini" onClick={() => cancelar(c.id)}>Cancelar</button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Folha titulo="Criar login" aberta={criando} fechar={() => { setCriando(false); carregarConvites() }}>
        <FormAcesso pronto={() => { setCriando(false); carregarConvites() }} />
      </Folha>

      <Folha titulo={editando?.nome ?? ''} aberta={!!editando} fechar={() => setEditando(null)}>
        {editando && <EditarMembro m={editando} souAdmin={papel === 'admin'}
          pronto={async () => { setEditando(null); await recarregarEquipe() }} />}
      </Folha>
    </>
  )
}

function EditarMembro({ m, souAdmin, pronto }: { m: MembroEquipe; souAdmin: boolean; pronto: () => void }) {
  const [papel, setPapel] = useState<Papel>(m.papel)
  const [confirmar, setConfirmar] = useState(false)
  const [erro, setErro] = useState('')

  async function salvar() {
    const { error } = await supabase.from('equipe').update({ papel })
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
      <fieldset className="funcoes">
        <legend>Função</legend>
        {FUNCOES.filter((f) => souAdmin || f.id !== 'admin').map((f) => (
          <label key={f.id} className={'funcao' + (papel === f.id ? ' ativa' : '')}>
            <input type="radio" name="papel-edit" checked={papel === f.id} onChange={() => setPapel(f.id)} />
            <span><strong>{f.nome}</strong><small>{f.desc}</small></span>
          </label>
        ))}
      </fieldset>
      {erro && <p className="erro">{erro}</p>}
      <button className="btn btn-primario" onClick={salvar} disabled={papel === m.papel}>Salvar função</button>
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
