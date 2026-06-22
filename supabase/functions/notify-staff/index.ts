import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { phone, message, staffName, type = 'general' } = await req.json()

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')
    const from       = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? 'whatsapp:+14155238886'

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({
        ok: false,
        configured: false,
        error: 'Configurez TWILIO_ACCOUNT_SID et TWILIO_AUTH_TOKEN dans Supabase → Settings → Secrets'
      }), { headers: { ...CORS, 'Content-Type': 'application/json' }, status: 200 })
    }

    const templates: Record<string, string> = {
      shift_assigned  : `Put.in Coffee 🌴\nBonjour ${staffName} ! Vous avez été assigné à un nouveau shift. Consultez l'app Eventure pour les détails.`,
      shift_reminder  : `Put.in Coffee 🌴\nRappel : votre shift commence dans 2h, ${staffName}. À tout à l'heure !`,
      availability_ask: `Put.in Coffee 🌴\nBonjour ${staffName}, merci de confirmer vos disponibilités pour cette semaine sur Eventure.`,
      general         : message ?? `Put.in Coffee 🌴\nBonjour ${staffName}, vous avez un message de votre gérant.`,
    }

    const body = new URLSearchParams({
      From: from,
      To  : `whatsapp:${phone}`,
      Body: templates[type] ?? message ?? templates.general,
    })

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method : 'POST',
        headers: {
          'Authorization' : `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type'  : 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    )

    const data = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, configured: true, data }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
      status : res.ok ? 200 : 400,
    })

  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
