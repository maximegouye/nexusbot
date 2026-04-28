import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

// Nécessite le raw body — désactive le bodyParser Next.js
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Invalid signature:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId  = session.metadata?.userId;
        if (!userId) break;

        // Active le premium
        await prisma.user.update({
          where: { id: userId },
          data: {
            isPremium:    true,
            premiumUntil: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000),
          },
        });
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await prisma.subscription.upsert({
          where:  { stripeSubscriptionId: sub.id },
          update: {
            status:             sub.status,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd:   new Date(sub.current_period_end   * 1000),
          },
          create: {
            stripeSubscriptionId: sub.id,
            stripePriceId:        sub.items.data[0]?.price.id ?? '',
            status:               sub.status,
            currentPeriodStart:   new Date(sub.current_period_start * 1000),
            currentPeriodEnd:     new Date(sub.current_period_end   * 1000),
            userId,
          },
        });

        const isActive = sub.status === 'active' || sub.status === 'trialing';
        await prisma.user.update({
          where: { id: userId },
          data: {
            isPremium:    isActive,
            premiumUntil: isActive ? new Date(sub.current_period_end * 1000) : null,
          },
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (!userId) break;

        await prisma.user.update({
          where: { id: userId },
          data: { isPremium: false, premiumUntil: null },
        });
        break;
      }

      case 'payment_intent.succeeded': {
        // Paiement marketplace
        const pi     = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (!orderId) break;

        await prisma.order.update({
          where: { id: orderId },
          data:  { status: 'PAID', stripePaymentId: pi.id },
        });
        break;
      }
    }
  } catch (err: any) {
    console.error('[STRIPE WEBHOOK] Handler error:', err.message);
    return NextResponse.json({ error: 'Handler error' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
