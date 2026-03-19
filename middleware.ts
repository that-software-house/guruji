import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

function withSupabaseCookies(baseResponse: NextResponse, target: NextResponse) {
  baseResponse.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });

  return target;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isFeedRoute = pathname === "/feed" || pathname.startsWith("/feed/");
  const isEventsRoute = pathname === "/events" || pathname.startsWith("/events/");
  const isPublicRoute = pathname === "/" || isFeedRoute || isEventsRoute;
  const isAuthActionRoute = pathname.startsWith("/auth/");

  const { supabase, response, user } = await updateSession(request);

  if (!user && !isAuthRoute && !isPublicRoute && !isAuthActionRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return withSupabaseCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (user && isAuthRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return withSupabaseCookies(response, NextResponse.redirect(redirectUrl));
  }

  if (user && pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "";
      return withSupabaseCookies(response, NextResponse.redirect(redirectUrl));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
