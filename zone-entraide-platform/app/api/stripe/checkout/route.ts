import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { stripe } from '@/lib/stripe';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/connexion', req.url));
  }

  const plan = req.nextUrl.searchParams.get('plan') ?? 'premium_monthly';
  const isAnnual = plan === 'premium_annual';

  const priceId = isAnnual
    ? process.env.STRIPE_PREMIUM_ANNUAL_PRICE_ID!
    : process.env.STRIPE_PREMIUM_PRICE_ID!;

  // Récupère ou crée le customer Stripe
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  let customerId = user?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name:  session.user.name  ?? undefined,
      metadata: { userId: session.user.id },
    });
    customerId = customer.id;
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer:    customerId,
    mode:        'subscription',
    line_items:  [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/premium`,
    locale:      'fr',
    metadata:    { userId: session.user.id },
    subscription_data: {
      metadata: { userId: session.user.id },
    },
  });

  return NextResponse.redirect(checkoutSession.url!);
}
