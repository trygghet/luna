import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { History } from './pages/history/history';
import { Settings } from './pages/settings/settings';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'history',
    component: History,
  },
  {
    path: 'settings',
    component: Settings,
  },
];
