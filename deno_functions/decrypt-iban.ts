// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: corsHeaders
      });
    }
    const { encryptedIban } = await req.json(); // Expecting 'encryptedIban'
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
    // Call the PostgreSQL decryption function for IBAN
    const { data: decryptedData, error } = await supabaseClient.rpc('decrypt_iban_db', {
      encrypted_iban: encryptedIban,
      encryption_key: encryptionKey
    });
    if (error) {
      console.error('Error calling decrypt_iban_db:', error.message);
      return new Response(JSON.stringify({
        error: 'Failed to decrypt IBAN.',
        details: error.message
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
    return new Response(JSON.stringify({
      decryptedData
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge Function unhandled error during IBAN decryption:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error during decryption.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
