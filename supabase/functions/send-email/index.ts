import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const TO_EMAIL = 'plantiernoe50@gmail.com';

interface EmailPayload {
  subject: string;
  staffName: string;
  eventTitle: string;
  missionDate: string;
  role: string;
  amount: number;
  action: 'confirmed' | 'rejected';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body: EmailPayload = await req.json();

    const isConfirmed = body.action === 'confirmed';
    const subject = isConfirmed
      ? `✅ Mission acceptée — ${body.staffName} pour ${body.eventTitle}`
      : `❌ Mission refusée — ${body.staffName}`;

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #050E1B; color: #FFFFFF; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #0C1A30, #050E1B); padding: 32px; border-bottom: 1px solid rgba(26,159,227,0.3);">
          <h1 style="margin: 0; font-size: 24px; color: #FFFFFF;">
            ${isConfirmed ? '✅ Mission Confirmée' : '❌ Mission Refusée'}
          </h1>
          <p style="margin: 8px 0 0; color: rgba(255,255,255,0.6); font-size: 14px;">Eventure — Gestion de Staff</p>
        </div>
        <div style="padding: 32px; gap: 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 10px 0; color: rgba(255,255,255,0.5); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Staff</td>
                <td style="padding: 10px 0; color: #FFFFFF; font-weight: 700;">${body.staffName}</td></tr>
            <tr><td style="padding: 10px 0; color: rgba(255,255,255,0.5); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Événement</td>
                <td style="padding: 10px 0; color: #FFFFFF; font-weight: 700;">${body.eventTitle}</td></tr>
            <tr><td style="padding: 10px 0; color: rgba(255,255,255,0.5); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Rôle</td>
                <td style="padding: 10px 0; color: #1A9FE3; font-weight: 600;">${body.role}</td></tr>
            <tr><td style="padding: 10px 0; color: rgba(255,255,255,0.5); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Date</td>
                <td style="padding: 10px 0; color: #FFFFFF;">${body.missionDate}</td></tr>
            ${isConfirmed ? `<tr><td style="padding: 10px 0; color: rgba(255,255,255,0.5); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">Rémunération</td>
                <td style="padding: 10px 0; color: #FFFFFF; font-weight: 700;">${body.amount}€</td></tr>` : ''}
          </table>
          <div style="margin-top: 24px; padding: 16px; background: rgba(26,159,227,0.08); border-radius: 12px; border: 1px solid rgba(26,159,227,0.2);">
            <p style="margin: 0; font-size: 13px; color: rgba(255,255,255,0.7);">
              ${isConfirmed
                ? 'Le membre du staff a été informé de sa mission. Retrouvez le détail dans votre espace Eventure.'
                : 'Le membre du staff a été informé du refus de sa candidature.'}
            </p>
          </div>
        </div>
      </div>
    `;

    if (!RESEND_API_KEY) {
      // Dev mode: log instead of sending
      console.log('[send-email] RESEND_API_KEY not set. Email would be:', { to: TO_EMAIL, subject });
      return new Response(JSON.stringify({ ok: true, mode: 'dev-noop' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({
        from: 'Eventure <notifications@eventure.app>',
        to: [TO_EMAIL],
        subject,
        html,
      }),
    });

    const data = await res.json();
    return new Response(JSON.stringify({ ok: res.ok, data }), {
      status: res.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
