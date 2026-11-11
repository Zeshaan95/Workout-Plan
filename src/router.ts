import { useEffect, useState } from 'react';

export interface Route {
  path: string;
  params: URLSearchParams;
}

function parse(): Route {
  const h = window.location.hash.replace(/^#/, '') || '/today';
  const [path, q] = h.split('?');
  return { path: path || '/today', params: new URLSearchParams(q ?? '') };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string, params?: Record<string, string | undefined>) {
  const q = params
    ? new URLSearchParams(Object.entries(params).filter(([, v]) => v != null) as [string, string][]).toString()
    : '';
  window.location.hash = q ? `${path}?${q}` : path;
}
