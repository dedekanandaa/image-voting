import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((request) => {
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/" ||
    pathname === "/guest" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (!isPublic && !request.auth) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const url = new URL("/", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
