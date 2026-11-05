import Layout from './components/layout/Layout';
import PlaygroundPage from './pages/PlaygroundPage';
import StudentsPage from './pages/StudentsPage';

// Phase 3: two sections on one page. Phase 7 gives each one its own route.
export default function App() {
  return (
    <Layout appName="RedStarVibe">
      <StudentsPage />
      <PlaygroundPage />
    </Layout>
  );
}
