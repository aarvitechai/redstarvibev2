import Layout from './components/layout/Layout';
import StudentsPage from './pages/StudentsPage';

// Phase 2: App = Layout + one page. Phase 7 adds React Router here.
export default function App() {
  return (
    <Layout appName="RedStarVibe">
      <StudentsPage />
    </Layout>
  );
}
