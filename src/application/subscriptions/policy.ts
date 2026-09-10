export const SUBSCRIPTION_PLANS = {
  solo: {
    name: "Single",
    brandLimit: 1,
    monthlyPriceGel: 249,
    annualPriceGel: 2490,
    visualCredits: 20,
  },
  studio: {
    name: "Manager",
    brandLimit: 3,
    monthlyPriceGel: 599,
    annualPriceGel: 5990,
    visualCredits: 60,
  },
  agency: {
    name: "Agency",
    brandLimit: 10,
    monthlyPriceGel: 1590,
    annualPriceGel: 15900,
    visualCredits: 200,
  },
} as const

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS | "custom"
export type BillingPeriod = "monthly" | "annual"
export type Subscription = {
  plan: SubscriptionPlan
  brandLimit: number
  paidAt: string
  expiresAt: string
  paymentMode: "simulated"
}

export function subscriptionActive(subscription: Subscription | null, now = new Date()) {
  return !!subscription && Date.parse(subscription.paidAt) <= now.getTime() && Date.parse(subscription.expiresAt) > now.getTime()
}

/** One or twelve calendar months, clamped at month end; renewal retains paid time. */
export function nextSubscriptionPeriod(
  previous: Subscription | null,
  plan: SubscriptionPlan,
  brandLimit: number,
  billingPeriod: BillingPeriod = "monthly",
  now = new Date(),
): Subscription {
  if (
    !Number.isSafeInteger(brandLimit) ||
    (plan === "custom" ? brandLimit <= 10 : SUBSCRIPTION_PLANS[plan]?.brandLimit !== brandLimit)
  ) throw Error("ტარიფი არასწორია.")

  if (subscriptionActive(previous, now) && brandLimit < previous!.brandLimit) {
    throw Error("მოქმედი გამოწერის შემცირება ჯერ არ არის ხელმისაწვდომი.")
  }

  const active = subscriptionActive(previous, now)
  const upgrade = active && brandLimit > previous!.brandLimit
  const end = new Date(active ? previous!.expiresAt : now)

  if (!upgrade) {
    const day = end.getUTCDate()
    end.setUTCDate(1)
    end.setUTCMonth(end.getUTCMonth() + (billingPeriod === "annual" ? 12 : 1))
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate()
    end.setUTCDate(Math.min(day, last))
  }

  return {
    plan,
    brandLimit,
    paidAt: now.toISOString(),
    expiresAt: end.toISOString(),
    paymentMode: "simulated",
  }
}
