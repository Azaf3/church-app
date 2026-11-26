import { Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './lib/sessao'
import { supabaseConfigurado } from './lib/supabase'
import Layout from './componentes/Layout'
import Login from './paginas/Login'
import NovaIgreja from './paginas/NovaIgreja'
import Hoje from './paginas/Hoje'
import Pessoas from './paginas/Pessoas'
import Ficha from './paginas/Ficha'
import Jornada from './paginas/Jornada'
import Financeiro from './paginas/Financeiro'
import Agenda from './paginas/Agenda'
import Aniversariantes from './paginas/Aniversariantes'
import Equipe from './paginas/Equipe'
import Mais from './paginas/Mais'
import Importar from './paginas/Importar'
import Configuracoes from './paginas/Configuracoes'
import Relatorios from './paginas/Relatorios'
import AreaMembro from './paginas/AreaMembro'
import MinhaFicha from './paginas/MinhaFicha'
import ImportarFinanceiro from './paginas/ImportarFinanceiro'
import Sete from './paginas/Sete'
import Secretaria from './paginas/Secretaria'
import TesAno from './paginas/TesAno'
import TesRelacao from './paginas/TesRelacao'
import TesCampanhas from './paginas/TesCampanhas'
import Pedidos from './paginas/Pedidos'

export default function App() {
  const { carregando, session, igreja, papel } = useSessao()

  if (!supabaseConfigurado) {
    return (
      <div className="entrada">
        <div className="entrada-cartao">
          <h1>Falta configurar o Supabase</h1>
          <p className="suave">
            Crie o arquivo <b>.env</b> na raiz do projeto (copie do <b>.env.example</b>) com
            VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e reinicie o <b>npm run dev</b>.
          </p>
        </div>
      </div>
    )
  }

  if (carregando) return <div className="tela-cheia"><div className="spinner" /></div>
  if (!session) return <Login />
  if (!igreja) return <NovaIgreja />
  if (!papel) return <div className="tela-cheia"><div className="spinner" /></div>
  if (papel === 'membro') return <AreaMembro />

  return (
    <Routes>
      <Route path="minha-ficha" element={<MinhaFicha />} />
      <Route element={<Layout />}>
        <Route index element={<Hoje />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="pessoas/:id" element={<Ficha />} />
        <Route path="jornada" element={<Jornada />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="financeiro/importar" element={<ImportarFinanceiro />} />
        <Route path="financeiro/ano" element={<TesAno />} />
        <Route path="financeiro/relacao" element={<TesRelacao />} />
        <Route path="financeiro/campanhas" element={<TesCampanhas />} />
        <Route path="sete" element={<Sete />} />
        <Route path="secretaria" element={<Secretaria />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="pedidos" element={<Pedidos />} />
        <Route path="aniversariantes" element={<Aniversariantes />} />
        <Route path="equipe" element={<Equipe />} />
        <Route path="mais" element={<Mais />} />
        <Route path="importar" element={<Importar />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="relatorios" element={<Relatorios />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
