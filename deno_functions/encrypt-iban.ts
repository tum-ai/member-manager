// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Add these CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
console.info('server started');
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { iban } = await req.json(); // Expecting 'iban' in the request body
    const encryptionKey = Deno.env.get('SEPA_ENCRYPTION_KEY'); // Use the new secret name
    if (!encryptionKey) {
      console.error('SEPA_ENCRYPTION_KEY environment variable not set.');
      return new Response(JSON.stringify({
        error: 'Server configuration error: Encryption key missing.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    // Call the PostgreSQL encryption function for IBAN
    const { data: encryptedData, error } = await supabaseClient.rpc('encrypt_iban_db', {
      iban_to_encrypt: iban,
      encryption_key: encryptionKey
    });
    if (error) {
      console.error('Error calling encrypt_iban_db:', error.message);
      return new Response(JSON.stringify({
        error: 'Failed to encrypt IBAN.',
        details: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      encryptedData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge Function unhandled error during IBAN encryption:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error during encryption.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
