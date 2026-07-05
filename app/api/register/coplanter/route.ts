import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeReferralCode(fullName: string) {
  const base = fullName
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${base || "SUR"}${random}`;
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Registration service is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const fullName = String(body?.fullName || "").trim();
  const email = String(body?.email || "").toLowerCase().trim();
  const password = String(body?.password || "");
  const mobile = String(body?.mobile || "").trim();
  const address = String(body?.address || "").trim();
  const referredBy = String(body?.referredBy || "").trim();
  const referralCode = String(body?.referralCode || "").trim() || makeReferralCode(fullName);

  if (!fullName || !email || !mobile || !address) {
    return NextResponse.json({ error: "Please complete your personal information." }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingProfile, error: existingProfileError } = await admin
    .from("profiles")
    .select("id,email")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json({ error: existingProfileError.message }, { status: 500 });
  }

  if (existingProfile) {
    return NextResponse.json({ error: "Email already registered. Please login." }, { status: 409 });
  }

  const { data: authUsers, error: listUsersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (listUsersError) {
    return NextResponse.json({ error: listUsersError.message }, { status: 500 });
  }

  const existingAuthUser = authUsers.users.find((authUser) => authUser.email?.toLowerCase().trim() === email);
  let authUserId = existingAuthUser?.id;

  if (authUserId) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "COPLANTER",
      },
    });

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
    }
  } else {
    const { data: authCreateData, error: authCreateError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: "COPLANTER",
      },
    });

    if (authCreateError || !authCreateData.user?.id) {
      return NextResponse.json({ error: authCreateError?.message || "Unable to create login account." }, { status: 500 });
    }

    authUserId = authCreateData.user.id;
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .insert({
      full_name: fullName,
      email,
      mobile_number: mobile,
      mobile,
      address,
      role: "COPLANTER",
      auth_user_id: authUserId,
      kyc_status: "PENDING",
      account_status: "ACTIVE",
      membership_status: "PENDING",
      referral_code: referralCode,
      referred_by: referredBy || null,
    })
    .select("id, email, full_name, referral_code")
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: profileError?.message || "Unable to create profile." }, { status: 500 });
  }

  const { error: walletError } = await admin.from("wallets").insert({
    profile_id: profile.id,
    balance: 0,
  });

  if (walletError) {
    await admin.from("profiles").delete().eq("id", profile.id);
    return NextResponse.json({ error: walletError.message }, { status: 500 });
  }

  await admin.from("notifications").insert({
    profile_id: profile.id,
    title: "Registration complete",
    message: "Your co-planter account is ready. You can now login using your email and password.",
    is_read: false,
  });

  return NextResponse.json({
    ok: true,
    profile,
    referralCode,
    message: "Your co-planter account is ready.",
  });
}
