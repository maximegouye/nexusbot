import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
  typescript: true,
});

export const COMMISSION_RATE = Number(process.env.COMMISSION_RATE ?? 0.10);

export function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function calculateFee(amount: number): { sellerAmount: number; fee: number } {
  const fee = Math.round(amount * COMMISSION_RATE);
  return { sellerAmount: amount - fee, fee };
}
