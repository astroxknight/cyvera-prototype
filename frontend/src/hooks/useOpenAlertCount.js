import { useEffect, useState } from 'react';
import { fetchAlerts, DATA_CHANGED_EVENT } from '../services/api';

// Number of alerts still in the "open" state. Refreshes on mount and whenever
// the api layer reports that data changed (log upload, alert status update).
export function useOpenAlertCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      fetchAlerts({ status: 'open' })
        .then((result) => active && setCount(result.total))
        .catch(() => active && setCount(0));
    };
    refresh();
    window.addEventListener(DATA_CHANGED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(DATA_CHANGED_EVENT, refresh);
    };
  }, []);

  return count;
}
