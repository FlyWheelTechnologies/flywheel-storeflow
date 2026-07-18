// supabase/functions/_shared/resend.ts
// Shared email helper used by all Edge Functions

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  bcc?: string | string[];
  fromName?: string;
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set in Supabase Secrets');
  }

  const senderName = payload.fromName || 'StoreFlow';
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${senderName} <team@ims.bookflywheel.com>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      bcc: payload.bcc,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API Error: ${err}`);
  }

  console.log(`✅ Email sent to ${payload.to}: ${payload.subject}`);
}
