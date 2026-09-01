import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enforceRateLimit } from "@/app/lib/security/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

export async function POST(request: NextRequest) {
  const rate = enforceRateLimit(request, "admin-farmer-create", 20, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many caretaker account requests." }, { status: 429 });
  if (supabaseUrl !== "https://dvidrbhfzzhgwyempgtu.supabase.co" || !anonKey || !serviceRoleKey) {
    return NextResponse.json(
      {
        error:
          "Admin farmer registration needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Do not expose this key in the browser.",
      },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: "Admin login is required." }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: adminProfile, error: adminProfileError } = await admin
    .from("profiles")
    .select("id,email,role,account_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminProfileError) {
    return NextResponse.json({ error: adminProfileError.message }, { status: 500 });
  }

  if (!adminProfile || normalizeRole(adminProfile.role) !== "ADMIN" || String(adminProfile.account_status || "").toUpperCase() !== "ACTIVE") {
    return NextResponse.json({ error: "Only active admin accounts can register caretakers." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").toLowerCase().trim();
  const mobile = String(body?.mobile || "").trim();
  const resumeUrl = String(body?.resumeUrl || "").trim();
  const status = String(body?.status || "ACTIVE").toUpperCase();

  if (!fullName || !email) {
    return NextResponse.json({ error: "Farmer name and email are required." }, { status: 400 });
  }

  if (!resumeUrl) {
    return NextResponse.json({ error: "Resume/CV photo is required for farmer registration." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid caretaker email." }, { status: 400 });
  if (!["PENDING", "ACTIVE", "APPROVED"].includes(status)) return NextResponse.json({ error: "Invalid caretaker account status." }, { status: 400 });

  if (resumeUrl.includes(":") || resumeUrl.includes("\\\\") || resumeUrl.split("/").some(part => !part || part === "." || part === ".."))
    return NextResponse.json({ error: "Upload a private resume first." }, { status: 400 });
  const resumeObject = await userClient.storage.from("farmer-resumes").info(resumeUrl);
  if (resumeObject.error || !resumeObject.data) return NextResponse.json({ error: "Private resume not found." }, { status: 400 });

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id,email,role")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  const existingRole = normalizeRole(existingProfile?.role);
  if (existingProfile && !["FARMER", "GARDENER", "CARETAKER"].includes(existingRole)) {
    return NextResponse.json(
      { error: `This email already belongs to a ${existingRole || "different"} account.` },
      { status: 409 }
    );
  }

  const { data: authUsers, error: listError } = await admin.auth.admin.listUsers();

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const existingAuthUser = authUsers.users.find((authUser) => authUser.email?.toLowerCase() === email);

  let authUserId = existingAuthUser?.id || null;

  if (existingAuthUser) {
    const role = normalizeRole(existingAuthUser.user_metadata?.role);
    if (role && !["FARMER", "GARDENER", "CARETAKER"].includes(role)) {
      return NextResponse.json({ error: "This login email already exists for another role." }, { status: 409 });
    }

    const { error: updateAuthError } = await admin.auth.admin.updateUserById(existingAuthUser.id, {
      user_metadata: { full_name: fullName, role: "FARMER" },
      email_confirm: true,
    });

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
    }
  } else {
    const { data: inviteData, error: createAuthError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${request.nextUrl.origin}/set-password`,
      data: { full_name: fullName, role: "FARMER" },
    });

    if (createAuthError && !createAuthError.message.toLowerCase().includes("already")) {
      return NextResponse.json({ error: createAuthError.message }, { status: 500 });
    }

    if (createAuthError) {
      const { data: fallbackCreateData, error: fallbackCreateError } = await admin.auth.admin.createUser({
        email,
        email_confirm: false,
        user_metadata: { full_name: fullName, role: "FARMER" },
      });

      if (fallbackCreateError) {
        return NextResponse.json({ error: fallbackCreateError.message }, { status: 500 });
      }

      authUserId = fallbackCreateData.user?.id || null;
    } else {
      authUserId = inviteData.user?.id || null;
    }
  }

  const profilePayload = {
      full_name: fullName,
      email,
      mobile: mobile || null,
      mobile_number: mobile || null,
      role: "FARMER",
      auth_user_id: authUserId,
      account_status: status,
      kyc_status: "APPROVED",
      membership_status: "ACTIVE",
    };

  const profileSave = existingProfile
    ? await admin.from("profiles").update(profilePayload).eq("id", existingProfile.id)
    : await admin.from("profiles").insert(profilePayload);

  if (profileSave.error) {
    return NextResponse.json({ error: profileSave.error.message }, { status: 500 });
  }

  const gardenerPayload = {
      full_name: fullName,
      email,
      mobile: mobile || null,
      resume_url: resumeUrl,
      status,
    };

  const { data: existingGardener, error: existingGardenerError } = await admin
    .from("gardeners")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (existingGardenerError) {
    return NextResponse.json({ error: existingGardenerError.message }, { status: 500 });
  }

  const gardenerSave = existingGardener
    ? await admin.from("gardeners").update(gardenerPayload).eq("id", existingGardener.id)
    : await admin.from("gardeners").insert(gardenerPayload);

  if (gardenerSave.error) {
    return NextResponse.json({ error: gardenerSave.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    farmer: { fullName, email, status },
    message: "Farmer invitation sent. The farmer can complete registration from their email link.",
  });
}

export async function PATCH(request: NextRequest) {
  const rate = enforceRateLimit(request, "admin-farmer-status", 60, 60 * 60 * 1000);
  if (!rate.allowed) return NextResponse.json({ error: "Too many caretaker status requests." }, { status: 429 });
  if (supabaseUrl !== "https://dvidrbhfzzhgwyempgtu.supabase.co" || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Admin farmer status service is not configured." }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") || "";
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return NextResponse.json({ error: "Admin login is required." }, { status: 401 });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: adminProfile, error: adminProfileError } = await admin
    .from("profiles")
    .select("id,role,account_status")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (adminProfileError) return NextResponse.json({ error: adminProfileError.message }, { status: 500 });
  if (!adminProfile || normalizeRole(adminProfile.role) !== "ADMIN" || String(adminProfile.account_status || "").toUpperCase() !== "ACTIVE") {
    return NextResponse.json({ error: "Only active admins can change caretaker status." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const gardenerId = String(body?.gardenerId || "").trim();
  const status = String(body?.status || "").toUpperCase();
  if (!gardenerId || !["ACTIVE", "SUSPENDED"].includes(status)) {
    return NextResponse.json({ error: "A valid caretaker and status are required." }, { status: 400 });
  }

  const { data: gardener, error: gardenerError } = await admin
    .from("gardeners")
    .select("id,email")
    .eq("id", gardenerId)
    .maybeSingle();
  if (gardenerError) return NextResponse.json({ error: gardenerError.message }, { status: 500 });
  if (!gardener) return NextResponse.json({ error: "Caretaker not found." }, { status: 404 });

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", String(gardener.email || "").toLowerCase())
    .in("role", ["FARMER", "GARDENER", "CARETAKER"])
    .maybeSingle();
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "Linked caretaker profile not found." }, { status: 409 });

  const [{ error: gardenerUpdateError }, { error: profileUpdateError }] = await Promise.all([
    admin.from("gardeners").update({ status }).eq("id", gardener.id),
    admin.from("profiles").update({ account_status: status }).eq("id", profile.id),
  ]);
  if (gardenerUpdateError || profileUpdateError) {
    return NextResponse.json({ error: gardenerUpdateError?.message || profileUpdateError?.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status, message: `Caretaker updated to ${status}.` });
}
