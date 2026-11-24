import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSessao } from '../lib/sessao'
import { importar, normalizar, type PessoaImportada } from '../lib/importar'
import { dataBR, podeEquipe } from '../lib/util'
import Icone from '../componentes/Icone'

type Resultado = ReturnType<typeof importar>

export default function Importar() {
  const { igreja, papel } = useSessao()
  const [arquivo, setArquivo] = useState('')
  const [res, setRes] = useState<Resultado | null>(null)
  const [existentes, setExistentes] = useState<Set<string>>(new Set())
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [estado, setEstado] = useState<'escolher' | 'revisar' | 'importando' | 'pronto'>('escolher')
  const [importados, setImportados] = useState(0)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!igreja) return
    supabase.from('pessoas').select('nome').eq('igreja_id', igreja.id)
      .then(({ data }) => setExistentes(new Set((data ?? []).map((p: { nome: string }) => normalizar(p.nome)))))
  }, [igreja?.id, estado])

  if (!podeEquipe(papel)) return <p className="vazio">Só pastor e administrador podem importar.</p>

  async function escolher(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setErro('')
    const r = importar(await f.text())
    if (!r.pessoas.length) { setErro('Não achei nenhuma coluna de nome nesse arquivo. É o CSV das respostas?'); return }
    setArquivo(f.name)
    setRes(r)
    setMarcados(new Set(r.pessoas.filter((p) => !existentes.has(normalizar(p.nome))).map((p) => p.nome)))
    setEstado('revisar')
  }

  function alternar(nome: string) {
    const n = new Set(marcados)
    if (n.has(nome)) n.delete(nome); else n.add(nome)
    setMarcados(n)
  }

  async function confirmar() {
    if (!res) return
    setEstado('importando')
    const lote = res.pessoas.filter((p) => marcados.has(p.nome)).map((p) => ({
      igreja_id: igreja!.id, tipo: 'membro', nome: p.nome, telefone: p.telefone, telefone_fixo: p.telefone_fixo,
      email: p.email, nascimento: p.nascimento, naturalidade: p.naturalidade, cidade: p.cidade,
      endereco: p.endereco, data_conversao: p.data_conversao, data_batismo: p.data_batismo,
      aluno_ebd: p.aluno_ebd, congregacao: p.congregacao, observacoes: p.observacoes,
    }))
    const { error } = await supabase.from('pessoas').insert(lote).select()
    if (error) { setErro('Deu erro ao importar. Nada foi salvo, tente de novo.'); setEstado('revisar'); return }
    setImportados(lote.length)
    setEstado('pronto')
  }

  if (estado === 'pronto') {
    return (
      <>
        <h1 className="titulo">Importação concluída</h1>
        <p className="suave">{importados} {importados === 1 ? 'pessoa entrou' : 'pessoas entraram'} como membros.</p>
        <div className="acoes">
          <Link className="btn btn-primario" to="/pessoas">Ver pessoas</Link>
          <button className="btn" onClick={() => { setRes(null); setEstado('escolher') }}>Importar outro arquivo</button>
        </div>
      </>
    )
  }

  return (
    <>
      <h1 className="titulo">Importar fichas</h1>

      {estado === 'escolher' && (
        <>
          <p className="suave">
            Traga os membros que já preencheram a ficha no Google Forms ou numa planilha.
            Respostas repetidas da mesma pessoa viram um cadastro só.
          </p>
          <ol className="passos">
            <li>No Google Forms, abra a aba <b>Respostas</b></li>
            <li>Toque nos três pontinhos e em <b>Baixar respostas (.csv)</b></li>
            <li>Se vier um .zip, abra ele e escolha o .csv aqui embaixo</li>
          </ol>
          <label className="soltar">
            <Icone nome="mais_um" />
            <strong>Escolher arquivo .csv</strong>
            <span>Google Forms, Planilhas ou Excel salvo como CSV</span>
            <input type="file" accept=".csv,text/csv" onChange={escolher} />
          </label>
          {erro && <p className="erro">{erro}</p>}
        </>
      )}

      {res && estado !== 'escolher' && (
        <>
          <p className="suave">
            {arquivo}: {res.linhas} respostas viraram <b>{res.pessoas.length} pessoas</b>.
            Desmarque quem não deve entrar.
          </p>

          <ul className="lista">
            {res.pessoas.map((p) => <LinhaRevisao key={p.nome} p={p} jaExiste={existentes.has(normalizar(p.nome))}
              marcado={marcados.has(p.nome)} alternar={() => alternar(p.nome)} />)}
          </ul>

          <details className="detalhes">
            <summary>Como as colunas foram lidas</summary>
            <ul>{res.colunas.map((c) => <li key={c}>{c}</li>)}</ul>
            {res.ignoradas.length > 0 && <p>Ignoradas: {res.ignoradas.join(', ')}</p>}
          </details>

          {erro && <p className="erro">{erro}</p>}
          <div className="barra-fixa">
            <button className="btn" onClick={() => { setRes(null); setEstado('escolher') }}>Trocar arquivo</button>
            <button className="btn btn-primario" disabled={!marcados.size || estado === 'importando'} onClick={confirmar}>
              {estado === 'importando' ? 'Importando…' : `Importar ${marcados.size} ${marcados.size === 1 ? 'pessoa' : 'pessoas'}`}
            </button>
          </div>
        </>
      )}
    </>
  )
}

function LinhaRevisao({ p, jaExiste, marcado, alternar }: {
  p: PessoaImportada; jaExiste: boolean; marcado: boolean; alternar: () => void
}) {
  const detalhes = [
    p.telefone,
    p.nascimento && `nasc. ${dataBR(p.nascimento)}`,
    p.data_batismo && `batismo ${dataBR(p.data_batismo)}`,
    p.cidade,
  ].filter(Boolean).join(' · ')

  return (
    <li>
      <button className={'item chamada revisao' + (marcado ? ' presente' : '')} onClick={alternar}>
        <span className="caixa">{marcado && <Icone nome="check" tam={16} />}</span>
        <div className="item-texto">
          <strong>{p.nome}</strong>
          <span>{detalhes || 'sem outros dados'}</span>
          {(jaExiste || p.respostas > 1 || p.avisos.length > 0) && (
            <span className="avisos">
              {jaExiste && <span className="tag tag-alerta">Já cadastrado</span>}
              {p.respostas > 1 && <span className="tag">{p.respostas} respostas juntadas</span>}
              {p.avisos.map((a) => <span key={a} className="tag tag-hoje">{a}</span>)}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}
