import Layout from './components/layout/Layout';
import PlaygroundPage from './pages/PlaygroundPage';
import ContactsPage from './pages/ContactsPage';
import DirectoryPage from './pages/DirectoryPage';
import StudentsPage from './pages/StudentsPage';

// Phase 5: four sections on one page. Phase 7 gives each one its own route.
export default function App() {
  return (
    <Layout appName="RedStarVibe">
      <StudentsPage />
      <DirectoryPage />
      <ContactsPage />
      <PlaygroundPage />
    </Layout>
  );
}
