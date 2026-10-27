import { lazy, Suspense } from 'react';
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './componentes/layout/Layout';
import { LimiteErro } from './componentes/LimiteErro';
import { CabecalhoPagina, Carregando } from './componentes/ui/Basicos';
import { BotaoLink } from './componentes/ui/Botao';

const Painel = lazy(() => import('./paginas/painel/Painel'));
const Empresa = lazy(() => import('./paginas/empresa/Empresa'));
const Backup = lazy(() => import('./paginas/backup/Backup'));
const ListaFuncionarios = lazy(() => import('./paginas/funcionarios/ListaFuncionarios'));
const FormFuncionario = lazy(() => import('./paginas/funcionarios/FormFuncionario'));
const ImportarFuncionarios = lazy(() => import('./paginas/funcionarios/ImportarFuncionarios'));
const SimuladorJornada = lazy(() => import('./paginas/jornada/SimuladorJornada'));
const MontadorEscala = lazy(() => import('./paginas/escala/MontadorEscala'));
const Cobertura = lazy(() => import('./paginas/escala/Cobertura'));
const PlanoAcao = lazy(() => import('./paginas/plano/PlanoAcao'));
const Entenda = lazy(() => import('./paginas/entenda/Entenda'));

function NaoEncontrada() {
  return (
    <>
      <CabecalhoPagina titulo="Página não encontrada" />
      <BotaoLink to="/">Voltar ao painel</BotaoLink>
    </>
  );
}

function Rotas() {
  const local = useLocation();
  return (
    <LimiteErro key={local.pathname}>
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route path="/" element={<Painel />} />
          <Route path="/empresa" element={<Empresa />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/funcionarios" element={<ListaFuncionarios />} />
          <Route path="/funcionarios/importar" element={<ImportarFuncionarios />} />
          <Route path="/funcionarios/:id" element={<FormFuncionario />} />
          <Route path="/jornada" element={<SimuladorJornada />} />
          <Route path="/escala" element={<MontadorEscala />} />
          <Route path="/escala/cobertura" element={<Cobertura />} />
          <Route path="/plano" element={<PlanoAcao />} />
          <Route path="/entenda" element={<Entenda />} />
          <Route path="*" element={<NaoEncontrada />} />
        </Routes>
      </Suspense>
    </LimiteErro>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Rotas />
      </Layout>
    </HashRouter>
  );
}
