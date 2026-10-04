// Isolated real-component fixtures. Never connects to a production service.
const params = new URLSearchParams(location.search);
const fixture = params.get('fixture') || sessionStorage.getItem('qa-fixture') || 'navigation';
sessionStorage.setItem('qa-fixture', fixture);
const fixtures = {
  navigation: () => import('./navigation-harness.jsx'),
  history: () => import('./game-history-harness.jsx'),
  store: () => import('./avatar-store-harness.jsx'),
  classes: () => import('./class-settings-harness.jsx'),
  admin: () => import('./admin-storage-harness.jsx'),
  dashboard: () => import('./login-only-harness.jsx'),
  rewards: () => import('./training-rewards-harness.jsx'),
  chat: () => import('./tournament-chat-harness.jsx'),
  achievements: () => import('./achievements-harness.jsx'),
  badges: () => import('./badge-list-harness.jsx'),
  studies: () => import('./studies-qa-harness.jsx'),
};
if (!fixtures[fixture]) throw new Error(`Unknown QA fixture: ${fixture}`);
fixtures[fixture]();
