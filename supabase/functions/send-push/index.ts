import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Firebase service account JSON stored as a single env var
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(Deno.env.get('FIREBASE_SERVICE_ACCOUNT')!);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getFCMAccessToken(): Promise<string> {
    const sa = FIREBASE_SERVICE_ACCOUNT;
    const now = Math.floor(Date.now() / 1000);

    const key = await crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(sa.private_key),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const jwt = await create(
        { alg: 'RS256', typ: 'JWT' },
        {
            iss: sa.client_email,
            scope: 'https://www.googleapis.com/auth/firebase.messaging',
            aud: 'https://oauth2.googleapis.com/token',
            iat: getNumericDate(0),
            exp: getNumericDate(3600),
        },
        key
    );

    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const { access_token } = await res.json();
    return access_token;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\n/g, '');
    const binary = atob(b64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf.buffer;
}

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

        const accessToken = await getFCMAccessToken();
        const projectId = FIREBASE_SERVICE_ACCOUNT.project_id;

        const fcmResponse = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    message: {
                        token,
                        notification: { title, body },
                        android: {
                            notification: {
                                sound: 'default',
                                icon: 'ic_notification',
                                color: '#ffd700',
                            },
                            priority: 'high',
                        },
                        apns: {
                            payload: {
                                aps: { sound: 'default', badge: 1 },
                            },
                        },
                        data: Object.fromEntries(
                            Object.entries(data).map(([k, v]) => [k, String(v)])
                        ),
                    },
                }),
            }
        );

        const result = await fcmResponse.json();

        // Token no longer valid — clear it
        if (result.error?.details?.some((d: any) => d.errorCode === 'UNREGISTERED')) {
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
