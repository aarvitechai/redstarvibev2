import { useNetworkActivity } from '../../hooks/useNetworkActivity';
import styles from './Layout.module.css';

// A global loading indicator fed by the Axios interceptors. No component has to report its own requests.
export default function ActivityBar() {
  const pending = useNetworkActivity();
  if (pending === 0) return null;
  return <div className={styles.activity} role="progressbar" aria-label={`${pending} request${pending === 1 ? '' : 's'} in progress`} />;
}
