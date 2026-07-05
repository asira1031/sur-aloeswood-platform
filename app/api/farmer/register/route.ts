import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function normalizeRole(role?: string | null) {
  return String(role || "").toUpperCase().replace("CO_PLANTER", "COPLANTER");
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Farmer registration needs SUPABASE_SERVICE_ROLE_KEY on the server." },
      { status: 500 }
    );
  }

  const body = await request.json();
  const fullName = String(body.fullName || "").trim();
  const email = String(body.email || "").toLowerCase().trim();
  const mobile = String(body.mobile || "").trim();
  const password = String(body.password || "");
  const resumeUrl = String(body.resumeUrl || "").trim();

  if (!fullName || !email || !password || !resumeUrl) {
    return NextResponse.json({ error: "Complete name, email, password, and resume photo." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "FARMER" },
    });

    if (updateAuthError) {
      return NextResponse.json({ error: updateAuthError.message }, { status: 500 });
    }
  } else {
    const { data: createAuthData, error: createAuthError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "FARMER" },
    });

    if (createAuthError) {
      return NextResponse.json({ error: createAuthError.message }, { status: 500 });
    }

    authUserId = createAuthData.user?.id || null;
  }

  const profilePayload = {
    full_name: fullName,
    email,
    mobile: mobile || null,
    mobile_number: mobile || null,
    role: "FARMER",
    auth_user_id: authUserId,
    account_status: "ACTIVE",
    kyc_status: "APPROVED",
    membership_status: "ACTIVE",
  };

  const profileSave = existingProfile
    ? await admin.from("profiles").update(profilePayload).eq("id", existingProfile.id)
    : await admin.from("profiles").insert(profilePayload);

  if (profileSave.error) {
    return NextResponse.json({ error: profileSave.error.message }, { status: 500 });
  }

  const { data: existingGardener, error: existingGardenerError } = await admin
    .from("gardeners")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (existingGardenerError) {
    return NextResponse.json({ error: existingGardenerError.message }, { status: 500 });
  }

  const gardenerPayload = {
    full_name: fullName,
    email,
    mobile: mobile || null,
    resume_url: resumeUrl,
    status: "ACTIVE",
  };

  const gardenerSave = existingGardener
    ? await admin.from("gardeners").update(gardenerPayload).eq("id", existingGardener.id)
    : await admin.from("gardeners").insert(gardenerPayload);

  if (gardenerSave.error) {
    return NextResponse.json({ error: gardenerSave.error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Farmer registration complete. You can now login from the main platform.",
  });
}
