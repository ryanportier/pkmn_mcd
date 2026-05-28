import { NextRequest, NextResponse } from "next/server";
import { verifyJwt } from "@/lib/auth";

// Routes that require authentication
const PROTECTED = ["/trainer"];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token =
    req.cookies.get("pkmn_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.redirect(new URL("/?auth=required", req.url));
  }

  const wallet = await verifyJwt(token);
  if (!wallet) {
    const res = NextResponse.redirect(new URL("/?auth=expired", req.url));
    res.cookies.delete("pkmn_token");
    return res;
  }

  // Inject wallet into header for server components
  const headers = new Headers(req.headers);
  headers.set("x-wallet", wallet);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/trainer/:path*"],
};
