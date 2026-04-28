'use client';
import { Metadata } from 'next';
import { useState } from 'react';
import { Send, Mail, MessageSquare, AlertCircle } from 'lucide-react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // En prod, envoyer vers une API route
    setSent(true);
  }

  return (
    <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-14">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-zinc-100">Nous contacter</h1>
        <p className="mt-2 text-zinc-400">Une question, un signalement ou une suggestion ? On vous répond sous 48h.</p>
      </div>

      {sent ? (
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
              <Send className="h-6 w-6 text-green-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Message envoyé !</h2>
          <p className="text-zinc-400">Nous vous répondrons dans les plus brefs délais à l'adresse indiquée.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Nom</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-surface-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="Votre nom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full rounded-lg border border-white/10 bg-surface-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                placeholder="vous@exemple.fr"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Sujet</label>
            <select
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              required
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-4 py-2.5 text-zinc-100 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">Choisir un sujet</option>
              <option value="question">Question générale</option>
              <option value="signalement">Signalement de contenu</option>
              <option value="bug">Rapport de bug</option>
              <option value="premium">Abonnement Premium</option>
              <option value="partenariat">Partenariat</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Message</label>
            <textarea
              rows={5}
              required
              value={form.message}
              onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
              className="w-full rounded-lg border border-white/10 bg-surface-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-600 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              placeholder="Décrivez votre demande..."
            />
          </div>

          <button type="submit" className="btn-primary w-full justify-center gap-2">
            <Send className="h-4 w-4" />
            Envoyer le message
          </button>
        </form>
      )}

      {/* Contact direct */}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {[
          { icon: Mail,          label: 'Email',   value: 'contact@zone-entraide.fr', href: 'mailto:contact@zone-entraide.fr' },
          { icon: MessageSquare, label: 'Discord', value: 'discord.gg/zone-entraide', href: 'https://discord.gg/zone-entraide' },
        ].map(({ icon: Icon, label, value, href }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-800 p-4 hover:border-white/20 transition-colors"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600/20">
              <Icon className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <div className="text-xs text-zinc-500">{label}</div>
              <div className="text-sm text-zinc-200">{value}</div>
            </div>
          </a>
        ))}
      </div>
    </main>
  );
}
