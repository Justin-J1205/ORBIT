import { NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

import { storage } from "./storage";

type AuthSuccess = {
  ok: true;
  token: string;
  user: User;
};

type ActiveAuthSuccess = AuthSuccess & {
  userRecord: Awaited<ReturnType<typeof storage.getUser>> | null;
};

type AdminAuthSuccess = ActiveAuthSuccess;

type AuthFailure = {
  ok: false;
  response: NextResponse;
};

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
  );
}

const ADMIN_ROLES = ["admin", "authorize_selga", "authorize_bonifacio"] as const;

export function isAdminRole(role: string | null | undefined): boolean {
  return ADMIN_ROLES.includes(role as any);
}

export function getCampusForRole(role: string | null | undefined): "selga" | "bonifacio" | null {
  if (role === "authorize_selga") return "selga";
  if (role === "authorize_bonifacio") return "bonifacio";
  return null;
}

export async function requireAdminUser(headers: Headers): Promise<AdminAuthSuccess | AuthFailure> {
  const base = await requireActiveUser(headers);
  if (!base.ok) {
    return base;
  }

  const role = base.userRecord?.role;
  if (!isAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Admin access required." }, { status: 403 }),
    };
  }

  return base;
}

function getAuthorizationToken(headers: Headers): string | null {
  const header = headers.get("authorization") || headers.get("Authorization");
  if (!header) return null;
  if (header.startsWith("Bearer ")) return header.slice("Bearer ".length);
  return header;
}

export async function requireUser(headers: Headers): Promise<AuthSuccess | AuthFailure> {
  const token = getAuthorizationToken(headers);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Unauthorized: Missing token" }, { status: 401 }),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (error) {
      console.error("❌ [auth] Supabase getUser error:", error.message || error);
      try {
        const snippet = token.substring(0, 6) + "..." + token.substring(token.length - 6);
        console.error(`[auth] Token snippet: ${snippet}`);
      } catch (_) {
        // ignore
      }
      if (error.message && error.message.includes("JWT expired")) {
        console.error("🚨 [auth] JWT token has expired!");
      }
    }

    const detail = error?.message || (user ? undefined : "No user returned");
    const payload: Record<string, unknown> = { message: "Unauthorized: Invalid token" };
    if (process.env.NODE_ENV !== "production" && detail) {
      payload.detail = detail;
    }

    return {
      ok: false,
      response: NextResponse.json(payload, { status: 401 }),
    };
  }

  return {
    ok: true,
    token,
    user,
  };
}

export async function requireActiveUser(headers: Headers): Promise<ActiveAuthSuccess | AuthFailure> {
  const base = await requireUser(headers);
  if (!base.ok) {
    return base;
  }

  try {
    const userRecord = await storage.getUser(base.user.id);

    if (userRecord && userRecord.status === "banned") {
      return {
        ok: false,
        response: NextResponse.json({ message: "Access denied: User is banned" }, { status: 403 }),
      };
    }

    if (userRecord && userRecord.status === "suspended") {
      return {
        ok: false,
        response: NextResponse.json({ message: "Access denied: User is suspended" }, { status: 403 }),
      };
    }

    return {
      ok: true,
      token: base.token,
      user: base.user,
      userRecord: userRecord ?? null,
    };
  } catch (error) {
    console.error("[auth] Error checking user status (falling back to Supabase user only):", error);
    return {
      ok: true,
      token: base.token,
      user: base.user,
      userRecord: null,
    };
  }
}
