import "server-only"
import { cookies } from "next/headers"

export const ACTIVE_BRAND_COOKIE = "unda-active-brand"

export async function rememberBrand(brandId: string) {
  const jar = await cookies()
  jar.set(ACTIVE_BRAND_COOKIE, brandId, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 365,
  })
}
