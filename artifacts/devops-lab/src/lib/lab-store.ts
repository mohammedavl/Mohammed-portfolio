import { useCallback, useEffect, useState } from 'react';

const KEY = 'devops-lab:progress:v1';
type Progress = { bookmarks: string[]; completed: string[] };

function read(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { bookmarks: [], completed: [], ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt storage */
  }
  return { bookmarks: [], completed: [] };
}

const listeners = new Set<(p: Progress) => void>();

export function useProgress() {
  const [p, setP] = useState<Progress>(read);
  useEffect(() => {
    listeners.add(setP);
    return () => {
      listeners.delete(setP);
    };
  }, []);
  const toggle = useCallback((field: keyof Progress, slug: string) => {
    const cur = read();
    const list = cur[field].includes(slug) ? cur[field].filter((s) => s !== slug) : [...cur[field], slug];
    const next = { ...cur, [field]: list };
    localStorage.setItem(KEY, JSON.stringify(next));
    listeners.forEach((l) => l(next));
  }, []);
  return {
    bookmarks: p.bookmarks,
    completed: p.completed,
    toggleBookmark: (s: string) => toggle('bookmarks', s),
    toggleCompleted: (s: string) => toggle('completed', s),
  };
}

export function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop() || filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement('meta');
      m.setAttribute('name', 'description');
      document.head.appendChild(m);
    }
    m.setAttribute('content', description);
  }, [title, description]);
}
