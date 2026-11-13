import { randomUUID } from "crypto";

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { requireActiveUser } from "@/server/core";
import { storage } from "@/server/core";
import { isStrongPassword } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authResult = await requireActiveUser(request.headers);
  if (!authResult.ok) {
    return authResult.response;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { message: "Server configuration error." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const password = String(body?.password || "");
    const confirmPassword = String(body?.confirmPassword || "");

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { message: "Password and confirm password are required." },
        { status: 400 },
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { message: "Passwords do not match." },
        { status: 400 },
      );
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json(
        {
          message:
            "Password must be at least 8 characters and include one lowercase letter, one uppercase letter, one number, and one symbol.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      authResult.user.id,
      {
        password,
        user_metadata: {
          ...(authResult.user.user_metadata ?? {}),
          has_password: true,
          password_setup_completed_at: new Date().toISOString(),
        },
      },
    );
    if (error) {
      return NextResponse.json(
        { message: `Failed to set password: ${error.message}` },
        { status: 400 },
      );
    }

    // Create notification for password change
    const now = new Date();
    const formattedDate = now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    await storage.createSystemAlert({
      id: randomUUID(),
      type: "security",
      severity: "low",
      title: "Password Updated",
      message: `Your password was successfully updated on ${formattedDate}.`,
      userId: authResult.user.id,
      isRead: false,
      createdAt: now,
      updatedAt: now,
    }).catch((err) => {
      console.warn("[auth/password/setup] Failed to create password update notification", err);
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[auth/password/setup] Unexpected error:", error);
    return NextResponse.json(
      { message: "Failed to set password." },
      { status: 500 },
    );
  }
}
