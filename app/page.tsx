import { redirect } from 'next/navigation';

// Ce composant est la "Page d'accueil" (/)
// Il ne fait rien d'autre que rediriger immédiatement vers /dashboard
export default function Home() {
  redirect('/dashboard');
}