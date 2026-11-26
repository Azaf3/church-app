import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import type { Convite, MembroEquipe, Papel } from '../lib/tipos'
import { iniciais, podeEquipe, rotuloCargo } from '../lib/util'
import Folha from '../componentes/Folha'
import FormAcesso from '../componentes/FormAcesso'
import { EditarConvite, EditarMembro } from '../componentes/EditarAcesso'
import Icone from '../componentes/Icone'

// ordem da lista: quem tem mais responsabilidade primeiro
const ORDEM: Record<Papel, number> = { admin: 0, pastor: 1, secretario: 2, tesoureiro: 3, obreiro: 4, membro: 5 }

type Linha = { tipo: 'membro'; m: MembroEquipe } | { tipo: 'convite'; c: Convite }

export default function Equipe() {
  const { igreja, equipe, papel, userId, recarregarEquipe } = useSessao()
  const [convites, setConvites] = useState<Convite[]>([])
  const [criando, setCriando] = useState(false)
  const [editando, setEditando] = useState<MembroEquipe | null>(null)
  const [editandoConvite, setEditandoConvite] = useState<Convite | null>(null)
  const gestor = podeEquipe(papel)
  const souAdmin = papel === 'admin'

  function carregarConvites() {
    if (!igreja || !gestor) return
    supabase.from('convites').select('*').eq('igreja_id', igreja.id).then(({ data }) => setConvites((data as Convite[]) ?? []))
  }
  useEffect(carregarConvites, [igreja?.id, gestor])

  // pastor não mexe em administrador; ninguém mexe em si mesmo
  const podeEditar = (m: MembroEquipe) => gestor && m.user_id !== userId && (souAdmin || m.papel !== 'admin')
  const podeEditarConvite = (c: Convite) => gestor && (souAdmin || c.papel !== 'admin')

  // quem ainda não entrou aparece junto, com o cargo que já vai ter
  const comCargo: Linha[] = [
    ...equipe.filter((m) => m.papel !== 'membro').map((m) => ({ tipo: 'membro' as const, m })),
    ...convites.filter((c) => c.papel !== 'membro').map((c) => ({ tipo: 'convite' as const, c })),
  ].sort((a, b) => {
    const pa = a.tipo === 'membro' ? a.m : a.c, pb = b.tipo === 'membro' ? b.m : b.c
    return ORDEM[pa.papel] - ORDEM[pb.papel] || pa.nome.localeCompare(pb.nome)
  })
  const membros: Linha[] = [
    ...equipe.filter((m) => m.papel === 'membro').map((m) => ({ tipo: 'membro' as const, m })),
    ...convites.filter((c) => c.papel === 'membro').map((c) => ({ tipo: 'convite' as const, c })),
  ]

  // função (não componente) pra lista não remontar a cada atualização
  function item(l: Linha) {
    if (l.tipo === 'membro') {
      const { m } = l
      return (
        <li key={m.user_id}>
          <button className="item" onClick={() => podeEditar(m) && setEditando(m)} disabled={!podeEditar(m)}>
            <span className="avatar">{iniciais(m.nome)}</span>
            <div className="item-texto">
              <strong>{m.nome}{m.user_id === userId && ' (você)'}</strong>
              <span>{rotuloCargo(m)}{m.papel !== 'membro' && m.pessoa_id && ' · com ficha de membro'}</span>
            </div>
            {podeEditar(m) && <Icone nome="seta" tam={18} />}
          </button>
        </li>
      )
    }
    const { c } = l
    return (
      <li key={c.id}>
        <button className="item" onClick={() => podeEditarConvite(c) && setEditandoConvite(c)} disabled={!podeEditarConvite(c)}>
          <span className="avatar">{iniciais(c.nome)}</span>
          <div className="item-texto">
            <strong>{c.nome}</strong>
            <span>{rotuloCargo(c)}{c.pessoa_id && ' · com ficha de membro'}<em className="tag tag-linha" title={`Entra com o Google: ${c.email}`}>ainda não entrou</em></span>
          </div>
          {podeEditarConvite(c) && <Icone nome="seta" tam={18} />}
        </button>
      </li>
    )
  }

  return (
    <>
      <div className="cabecalho">
        <h1 className="titulo">Equipe</h1>
        {gestor && <button className="btn btn-primario" onClick={() => setCriando(true)}><Icone nome="mais_um" tam={18} /> Criar login</button>}
      </div>
      <p className="suave">Quem se cadastra pelo link entra como membro. Toque na pessoa pra dar um cargo.</p>

      <h2 className="secao">Com cargo</h2>
      <ul className="lista">
        {comCargo.map(item)}
      </ul>

      {membros.length > 0 && (
        <>
          <h2 className="secao">Membros com acesso ({membros.length})</h2>
          <ul className="lista">
            {membros.map(item)}
          </ul>
        </>
      )}

      <Folha titulo="Criar login" aberta={criando} fechar={() => { setCriando(false); carregarConvites() }}>
        <FormAcesso pronto={() => { setCriando(false); carregarConvites() }} />
      </Folha>

      <Folha titulo={editando?.nome ?? ''} aberta={!!editando} fechar={() => setEditando(null)}>
        {editando && <EditarMembro m={editando} souAdmin={souAdmin}
          pronto={async () => { setEditando(null); await recarregarEquipe() }} />}
      </Folha>

      <Folha titulo={editandoConvite?.nome ?? ''} aberta={!!editandoConvite} fechar={() => setEditandoConvite(null)}>
        {editandoConvite && <EditarConvite c={editandoConvite} souAdmin={souAdmin}
          pronto={() => { setEditandoConvite(null); carregarConvites() }} />}
      </Folha>
    </>
  )
}
