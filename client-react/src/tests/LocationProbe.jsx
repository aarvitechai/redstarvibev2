import { useLocation } from 'react-router';

// Shows the current URL, so tests can assert what navigation did
export default function LocationProbe() {
  const { pathname, search } = useLocation();
  // A <span>, not <output>: <output> has the ARIA role "status" and would clash with real status messages
  return <span data-testid="location">{pathname + search}</span>;
}
