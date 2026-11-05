import { useLocation } from 'react-router';

// Shows the current URL, so tests can assert what navigation did
export default function LocationProbe() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{pathname + search}</output>;
}
