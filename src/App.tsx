import { Navigate, Route, Routes } from 'react-router-dom'
import { useSessao } from './lib/sessao'
import Layout from './componentes/Layout'
import Login from './paginas/Login'
import NovaIgreja from './paginas/NovaIgreja'
import Hoje from './paginas/Hoje'
import Pessoas from './paginas/Pessoas'
import Ficha from './paginas/Ficha'
import Jornada from './paginas/Jornada'
import Presenca from './paginas/Presenca'
import Financeiro from './paginas/Financeiro'
import Agenda from './paginas/Agenda'
import Aniversariantes from './paginas/Aniversariantes'
import Equipe from './paginas/Equipe'
import Mais from './paginas/Mais'
import Importar from './paginas/Importar'

export default function App() {
  const { carregando, session, igreja } = useSessao()

  if (carregando) return <div className="tela-cheia"><div className="spinner" /></div>
  if (!session) return <Login />
  if (!igreja) return <NovaIgreja />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Hoje />} />
        <Route path="pessoas" element={<Pessoas />} />
        <Route path="pessoas/:id" element={<Ficha />} />
        <Route path="jornada" element={<Jornada />} />
        <Route path="presenca" element={<Presenca />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="aniversariantes" element={<Aniversariantes />} />
        <Route path="equipe" element={<Equipe />} />
        <Route path="mais" element={<Mais />} />
        <Route path="importar" element={<Importar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
