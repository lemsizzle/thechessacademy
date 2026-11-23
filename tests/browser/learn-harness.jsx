import { createRoot } from 'react-dom/client';
import { BeginnerLearn } from '../../components/training/BeginnerLearn';
import { StudentMenuNavigation } from '../../components/student/StudentMenuNavigation';
import { Sidebar } from '../../components/Sidebar';
import { StudentNavigation } from '../../components/student/StudentNavigation';
const wrapper = document.getElementById('root').parentElement;
if (wrapper.tagName === 'MAIN') {
  const replacement = document.createElement('div'); replacement.append(...wrapper.childNodes); wrapper.replaceWith(replacement);
}
const studentId = new URLSearchParams(location.search).get('student') || 'learn-fixture';
window.fetch = async () => Response.json({ incoming: [], outgoing: [], games: [], events: [], awards: [], quests: [] });
createRoot(document.getElementById('root')).render(<StudentMenuNavigation>
  <div className="student-portal-shell academy-grid min-h-screen"><div className="flex min-h-screen"><Sidebar variant="student" /><div className="min-w-0 flex-1">
    <StudentNavigation studentName="Puzzle Explorer" onLogout={() => {}} />
    <main className="mx-auto w-full max-w-7xl px-3 pb-28 pt-3 md:px-4 md:pb-6"><BeginnerLearn studentId={studentId} /></main>
  </div></div></div>
</StudentMenuNavigation>);
