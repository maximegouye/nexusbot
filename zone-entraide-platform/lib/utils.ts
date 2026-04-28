import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function timeAgo(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return 'à l\'instant';
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `il y a ${Math.floor(diff / 86400)}j`;
  if (diff < 31536000) return `il y a ${Math.floor(diff / 2592000)} mois`;
  return `il y a ${Math.floor(diff / 31536000)} an${diff > 63072000 ? 's' : ''}`;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length).trim() + '…';
}

export function levelFromReputation(rep: number): number {
  if (rep < 50) return 1;
  if (rep < 150) return 2;
  if (rep < 350) return 3;
  if (rep < 750) return 4;
  if (rep < 1500) return 5;
  if (rep < 3000) return 6;
  if (rep < 6000) return 7;
  if (rep < 12000) return 8;
  if (rep < 25000) return 9;
  return 10;
}

export function levelLabel(level: number): string {
  const labels: Record<number, string> = {
    1: 'Débutant', 2: 'Apprenti', 3: 'Contributeur', 4: 'Habitué',
    5: 'Expert', 6: 'Vétéran', 7: 'Maître', 8: 'Légende',
    9: 'Champion', 10: 'Gourou',
  };
  return labels[level] ?? 'Membre';
}
