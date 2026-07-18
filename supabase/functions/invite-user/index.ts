import { createClient } from "@supabase/supabase-js"
import { sendEmail } from "../_shared/resend.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, role, full_name, organization_id } = await req.json();
    console.log("Invite request received for:", email, "in org:", organization_id);
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing Supabase environment variables.");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Fetch organization details for branding
    let orgName = 'StoreFlow';
    let primaryColor = '#f97316';
    if (organization_id) {
      const { data: orgData, error: orgError } = await supabaseClient
        .from('organizations')
        .select('name, primary_color')
        .eq('id', organization_id)
        .single();
      
      if (orgError) {
        console.warn("Could not fetch org details, using fallback:", orgError.message);
      } else if (orgData) {
        orgName = orgData.name;
        primaryColor = orgData.primary_color || primaryColor;
      }
    }

    // 1. Create the user in Auth
    console.log("Creating auth user...");
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    });

    if (authError) {
      console.error("Auth error:", authError);
      throw authError;
    }

    // 2. Update the profile
    console.log("Updating profile for user:", authData.user.id);
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({ role, full_name, organization_id })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error("Profile error:", profileError);
      throw profileError;
    }

    // 3. Log the action
    await supabaseClient.from('logs').insert({
      user_email: 'system/admin',
      user_role: 'admin',
      action: 'USER_INVITE',
      details: `Created new user ${email} with role ${role}`,
      organization_id
    });

    // 4. Send Welcome Email
    console.log("Sending email via Resend...");
    const appUrl = Deno.env.get('APP_URL') || 'https://ims.bookflywheel.com';
    await sendEmail({
      to: email,
      fromName: orgName,
      subject: `Welcome to ${orgName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px;">
          <h1 style="color: ${primaryColor};">${orgName}</h1>
          <p>Hi ${full_name || 'there'},</p>
          <p>An account has been created for you on the <strong>${orgName}</strong> Stock Management System.</p>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Role:</strong> ${role}</p>
            <p style="margin: 8px 0 0;"><strong>Login Email:</strong> ${email}</p>
          </div>
          <p>You can now log in using your email and the password provided by your administrator.</p>
          <a href="${appUrl}" style="display: inline-block; background: #374151; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Log In Now</a>
          <p style="margin-top: 30px; font-size: 11px; color: #9ca3af; text-align: center;">Powered by StoreFlow by Flywheel</p>
        </div>
      `
    });

    return new Response(
      JSON.stringify({ message: 'User created successfully', user: authData.user }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error("Edge Function Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
