import { useEffect, useState } from 'react';
import { db, seedIfEmpty } from './db';
import { useSettings } from './hooks';
import { go, useRoute } from './router';
import CatchUp from './screens/CatchUp';
import CheckIn from './screens/CheckIn';
import FoodAudit from './screens/FoodAudit';
import Habits from './screens/Habits';
import Logger from './screens/Logger';
import More from './screens/More';
import PlanView from './screens/PlanView';
import Progress from './screens/Progress';
import SettingsScreen from './screens/Settings';
import Today from './screens/Today';
import WeighIns from './screens/WeighIns';

const TABS = [
  { path: '/today', label: 'Today', icon: '◉' },
  { path: '/weigh', label: 'Weight', icon: '⚖' },
  { path: '/log', label: 'Workout', icon: '◆' },
  { path: '/progress', label: 'Progress', icon: '↗' },
  { path: '/more', label: 'More', icon: '≡' },
];

const MORE_PATHS = ['/more', '/checkin', '/habits', '/audit', '/settings', '/plan', '/catchup'];

function useTheme() {
  const { theme } = useSettings();
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}

export default function App() {
  const route = useRoute();
  const [ready, setReady] = useState(false);
  useTheme();

  useEffect(() => {
    (async () => {
      const firstRun = await seedIfEmpty(db);
      if (navigator.storage?.persist) {
        try {
          const granted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
          await db.settings.update('app', { persistGranted: granted });
        } catch {
          /* not supported */
        }
      }
      setReady(true);
      if (firstRun) go('/catchup', { first: '1' });
    })();
  }, []);

  if (!ready) return null;

  const dateOverride = route.params.get('date');
  let screen;
  switch (route.path) {
    case '/weigh':
      screen = <WeighIns />;
      break;
    case '/log':
      screen = <Logger date={dateOverride} session={route.params.get('session')} />;
      break;
    case '/progress':
      screen = <Progress />;
      break;
    case '/more':
      screen = <More />;
      break;
    case '/checkin':
      screen = <CheckIn date={dateOverride} />;
      break;
    case '/habits':
      screen = <Habits date={dateOverride} />;
      break;
    case '/audit':
      screen = <FoodAudit />;
      break;
    case '/settings':
      screen = <SettingsScreen />;
      break;
    case '/plan':
      screen = <PlanView week={route.params.get('week')} />;
      break;
    case '/catchup':
      screen = <CatchUp first={route.params.get('first') === '1'} />;
      break;
    default:
      screen = <Today dateOverride={dateOverride} />;
  }

  const active = MORE_PATHS.includes(route.path) ? '/more' : TABS.some((t) => t.path === route.path) ? route.path : '/today';

  return (
    <>
      <main>{screen}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <ul className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <li key={t.path} className="flex-1">
              <a
                href={`#${t.path}`}
                className={`flex h-14 flex-col items-center justify-center text-xs font-medium ${active === t.path ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
              >
                <span className="text-xl leading-none">{t.icon}</span>
                <span className="mt-1">{t.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
