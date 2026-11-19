import { Link } from 'wouter';
import { usePageMeta } from '@/lib/lab-store';

export default function NotFound() {
  usePageMeta('404 - DevOps Engineering Lab', 'This route does not exist.');
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-3xl flex-col justify-center px-4 py-20">
      <pre className="code-surface border border-foreground p-5 text-xs shadow-[4px_4px_0_hsl(var(--primary))]">{`$ kubectl get route ${typeof window !== 'undefined' ? window.location.pathname : ''}\nError from server (NotFound): routes not found`}</pre>
      <h1 className="mt-8 font-display text-5xl font-extrabold tracking-tight">404. Nothing scheduled here.</h1>
      <Link href="/" className="btn btn-primary mt-6 w-fit" data-testid="link-404-home">Back to the labs</Link>
    </div>
  );
}
