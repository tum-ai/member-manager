// Setup type definitions for built-in Supabase Runtime APIs
// Delete this function after run. This function should not exist.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
console.info('server started');
Deno.serve(async (req)=>{
  // IMPORTANT SECURITY NOTE:
  // This Edge Function accesses your sensitive encryption key and service role key.
  // It should only be deployed temporarily for the migration and DELETED IMMEDIATELY AFTER USE.
  // Consider adding a simple authorization check (e.g., a secret header) if you trigger it via API.
  const encryptionKey = Deno.env.get('SEPA_ENCRYPTION_KEY');
  if (!encryptionKey) {
    return new Response(JSON.stringify({
      error: 'Migration key not found in environment variables.'
    }), {
      status: 500
    });
  }
  const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  try {
    // 1. Fetch unencrypted data from the 'sepa' table
    const { data: oldSepaRecords, error: fetchError } = await supabaseClient.from('sepa').select('sepa_id, created_at, iban, bic, mandate_agreed, privacy_agreed, user_id, bank_name');
    if (fetchError) {
      console.error('Error fetching old SEPA records:', fetchError.message);
      return new Response(JSON.stringify({
        error: 'Failed to fetch old data.',
        details: fetchError.message
      }), {
        status: 500
      });
    }
    if (!oldSepaRecords || oldSepaRecords.length === 0) {
      return new Response(JSON.stringify({
        message: 'No old SEPA records found to migrate.'
      }), {
        status: 200
      });
    }
    const migrationResults = [];
    let migratedCount = 0;
    let failedCount = 0;
    for (const record of oldSepaRecords){
      let encryptedIban = null; // Will store the bytea string or null
      if (record.iban !== null) {
        const { data: resultIban, error: encryptError } = await supabaseClient.rpc('encrypt_iban_db', {
          iban_to_encrypt: record.iban,
          encryption_key: encryptionKey
        });
        if (encryptError) {
          console.error(`Error encrypting IBAN for sepa_id ${record.sepa_id}:`, encryptError.message);
          migrationResults.push({
            sepa_id: record.sepa_id,
            status: 'failed_encryption',
            error: encryptError.message
          });
          failedCount++;
          continue; // Skip to next record if encryption fails
        }
        encryptedIban = resultIban; // This will be the bytea string from PostgreSQL
      }
      // 2. Insert into 'sepa_enc'
      // Assume sepa_id is the primary key in sepa_enc as well, for ON CONFLICT.
      // Adjust 'sepa_id' if your primary key in 'sepa_enc' is named 'id' or something else.
      const { error: insertError } = await supabaseClient.from('sepa_enc').insert({
        sepa_id: record.sepa_id,
        created_at: record.created_at,
        iban: encryptedIban,
        bic: record.bic,
        mandate_agreed: record.mandate_agreed,
        privacy_agreed: record.privacy_agreed,
        user_id: record.user_id,
        bank_name: record.bank_name
      }).select(); // Add .select() to get the inserted data, useful for debugging
      if (insertError) {
        console.error(`Error inserting record sepa_id ${record.sepa_id} into sepa_enc:`, insertError.message);
        migrationResults.push({
          sepa_id: record.sepa_id,
          status: 'failed_insertion',
          error: insertError.message
        });
        failedCount++;
      } else {
        migrationResults.push({
          sepa_id: record.sepa_id,
          status: 'success'
        });
        migratedCount++;
      }
    }
    return new Response(JSON.stringify({
      message: 'Migration attempt complete',
      totalRecords: oldSepaRecords.length,
      migratedCount: migratedCount,
      failedCount: failedCount,
      results: migrationResults // Provides detailed status for each record
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Unhandled error during migration Edge Function execution:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error during migration.'
    }), {
      status: 500
    });
  }
});
