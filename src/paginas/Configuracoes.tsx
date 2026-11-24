import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { aplicarTema, corDoLogo, prepararLogo, tonsDaCor } from '../lib/tema'
import { podeEquipe } from '../lib/util'

const SUGESTOES = ['#1f5c4c', '#1e4fa3', '#6b2fa0', '#a3292f', '#b8641c', '#0f6e7a', '#2b2d42', '#7a5230']

export default function Configuracoes() {
  const { igreja, papel, recarregar } = useSessao()
  const [nome, setNome] = useState(igreja?.nome ?? '')
  const [cidade, setCidade] = useState(igreja?.cidade ?? '')
  const [cor, setCor] = useState(igreja?.cor ?? '#1f5c4c')
  const [logo, setLogo] = useState<string | null>(igreja?.logo ?? null)
  const [sugerida, setSugerida] = useState<string | null>(null)
  const [estado, setEstado] = useState<'' | 'salvando' | 'salvo' | 'erro'>('')

  // se sair sem salvar, volta pra cor salva
  useEffect(() => () => aplicarTema(igreja?.cor ?? '#1f5c4c'), [igreja?.cor])

  if (!podeEquipe(papel)) return <p className="vazio">Só pastor e administrador mudam as configurações da igreja.</p>

  function mudarCor(c: string) { setCor(c); aplicarTema(c); setEstado('') }

  async function escolherLogo(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const dados = await prepararLogo(f)
    setLogo(dados); setEstado('')
    const c = await corDoLogo(dados)
    if (c) setSugerida(tonsDaCor(c).cor)
  }

  async function salvar() {
    setEstado('salvando')
    const { error } = await supabase.from('igrejas')
      .update({ nome: nome.trim(), cidade: cidade.trim() || null, cor: tonsDaCor(cor).cor, logo }).eq('id', igreja!.id)
    if (error) { setEstado('erro'); return }
    await recarregar()
    setEstado('salvo')
  }

  return (
    <>
      <h1 className="titulo">Configurações da igreja</h1>
      <p className="suave">Nome, logo e cor aparecem pra toda a equipe.</p>

      <div className="config">
        <section className="painel">
          <h2>Logo</h2>
          <div className="logo-linha">
            <div className="logo-previa">{logo ? <img src={logo} alt="" /> : <span>{nome.slice(0, 1)}</span>}</div>
            <div className="logo-acoes">
              <label className="btn">Escolher imagem<input type="file" accept="image/*" hidden onChange={escolherLogo} /></label>
              {logo && <button className="btn" onClick={() => { setLogo(null); setSugerida(null) }}>Remover</button>}
              <small className="suave">PNG ou JPG, de preferência quadrado.</small>
            </div>
          </div>
          {sugerida && sugerida !== tonsDaCor(cor).cor && (
            <button className="sugestao" onClick={() => mudarCor(sugerida)}>
              <span style={{ background: sugerida }} /> Usar a cor do logo
            </button>
          )}
        </section>

        <section className="painel">
          <h2>Cor principal</h2>
          <div className="cores">
            {[...new Set([tonsDaCor(igreja?.cor ?? SUGESTOES[0]).cor, ...SUGESTOES])].map((c) => (
              <button key={c} className={'cor' + (tonsDaCor(cor).cor === c ? ' ativa' : '')} style={{ background: c }}
                onClick={() => mudarCor(c)} aria-label={`Cor ${c}`} />
            ))}
            <label className="cor cor-livre" aria-label="Outra cor">
              <input type="color" value={cor} onChange={(e) => mudarCor(e.target.value)} />+
            </label>
          </div>
          <div className="previa-tema">
            <span className="btn btn-primario">Botão</span>
            <span className="tag">Etiqueta</span>
            <span className="previa-link">Link</span>
          </div>
        </section>

        <section className="painel form">
          <h2>Dados</h2>
          <label>Nome da igreja<input value={nome} onChange={(e) => { setNome(e.target.value); setEstado('') }} /></label>
          <label>Cidade<input value={cidade} onChange={(e) => { setCidade(e.target.value); setEstado('') }} /></label>
        </section>
      </div>

      <div className="barra-fixa">
        {estado === 'salvo' && <span className="ok">Salvo</span>}
        {estado === 'erro' && <span className="erro">Não salvou. Rodou a migração 003?</span>}
        <button className="btn btn-primario" onClick={salvar} disabled={estado === 'salvando' || !nome.trim()}>
          {estado === 'salvando' ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </>
  )
}
