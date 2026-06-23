import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { userId, title, body, data = {} } = await req.json();

        if (!userId || !title || !body) {
            return new Response(
                JSON.stringify({ error: 'userId, title y body son requeridos' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Fetch push token for the target user
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('push_token')
            .eq('id', userId)
            .maybeSingle();

        const token = profile?.push_token;
        if (!token) {
            return new Response(
                JSON.stringify({ skipped: true, reason: 'no push token registered' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Send via FCM Legacy HTTP API
        const fcmResponse = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `key=${FCM_SERVER_KEY}`,
            },
            body: JSON.stringify({
                to: token,
                notification: {
                    title,
                    body,
                    sound: 'default',
                    icon: 'ic_notification',
                    color: '#ffd700',
                },
                data,
                priority: 'high',
                content_available: true,
            }),
        });

        const result = await fcmResponse.json();

        // If the token is no longer valid, clear it from the DB
        if (result.results?.[0]?.error === 'NotRegistered' ||
            result.results?.[0]?.error === 'InvalidRegistration') {
            await supabaseAdmin
                .from('profiles')
                .update({ push_token: null })
                .eq('id', userId);
        }

        return new Response(
            JSON.stringify(result),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (e) {
        console.error('[send-push] Error:', e);
        return new Response(
            JSON.stringify({ error: String(e) }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
