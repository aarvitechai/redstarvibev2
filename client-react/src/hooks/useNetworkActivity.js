import { useSyncExternalStore } from 'react';
import { networkActivity } from '../services/networkActivity';

// useSyncExternalStore: the SAFE way to read a store that lives outside React.
// React subscribes, re-renders when it changes, and never shows a torn (half-updated) value.
// (Redux's useSelector is built on this same hook.)
export const useNetworkActivity = () =>
  useSyncExternalStore(networkActivity.subscribe, networkActivity.getSnapshot, () => 0);
