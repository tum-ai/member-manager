// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
    const { encryptedIbanArray } = await req.json(); // Expecting an array of encrypted IBANs
    // Input validation: Ensure it's an array
    if (!Array.isArray(encryptedIbanArray)) {
      return new Response(JSON.stringify({
        error: 'Invalid input: encryptedIbanArray must be an array.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const encryptionKey = Deno.env.get('SEPA_ENCRYPTION_KEY');
    if (!encryptionKey) {
      console.error('SEPA_ENCRYPTION_KEY environment variable not set.');
      return new Response(JSON.stringify({
        error: 'Server configuration error: Encryption key missing.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    // Call the PostgreSQL batch decryption function
    const { data: decryptedDataArray, error } = await supabaseClient.rpc('decrypt_ibans_batch_db', {
      encrypted_ibans: encryptedIbanArray,
      encryption_key: encryptionKey
    });
    if (error) {
      console.error('Error calling decrypt_ibans_batch_db:', error.message);
      return new Response(JSON.stringify({
        error: 'Failed to decrypt IBANs in batch.',
        details: error.message
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // The RPC call will return an array of objects like [{ decrypted_iban: 'IBAN1' }, { decrypted_iban: 'IBAN2' }]
    // We can map this to a simpler array of strings if preferred for the frontend.
    const simplifiedDecryptedIbans = decryptedDataArray.map((row)=>row.decrypted_iban);
    return new Response(JSON.stringify({
      decryptedIbans: simplifiedDecryptedIbans
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Edge Function unhandled error during batch IBAN decryption:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error during batch decryption.'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
