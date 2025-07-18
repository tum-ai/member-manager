# SECURITY.md - Secure IBAN Handling Architecture
> I voice recorded the entire text and asked Gemini to create this document. For me the text made sense, but there's a possibility that it might not make sense to some, that case, let me (Kesava Prasad Arul) know and I can explain.

## 1. Purpose & Core Principle

The primary goal of this architecture is to ensure that **plain text IBANs are never stored directly in the database** in a way that is easily accessible to database administrators or other privileged roles without explicit decryption via the established secure channels. This minimizes the risk of data breaches exposing sensitive financial information.

The core principle is **server-side, per-column encryption using PostgreSQL's `pgcrypto` extension**, accessed exclusively via secure Supabase Edge Functions. The encryption key is kept strictly confidential within the server environment.

## 2. Architecture Overview

### 2.1. Data at Rest (PostgreSQL Database)

* **Table:** `public.sepa_enc`
* **Encrypted Column:** `iban`
    * The `iban` column is stored as `bytea` (binary data). It contains the PGP-encrypted form of the IBAN, not the plain text.
* **Encryption Method:** PostgreSQL's `pgcrypto` extension, specifically `pgp_sym_encrypt` (for encryption) and `pgp_sym_decrypt` (for decryption). These functions use strong symmetric encryption (AES256 by default).

### 2.2. Encryption Key Management

* **Key Name:** `SEPA_ENCRYPTION_KEY`
* **Storage:** This symmetric encryption key is stored securely as an environment variable within **Supabase Secrets**.
* **Access Restriction:** The `SEPA_ENCRYPTION_KEY` is **never exposed to the client-side (React application)** and is only accessible by the Supabase Edge Functions. It is not directly accessible within the PostgreSQL database for general queries.

### 2.3. PostgreSQL Functions (Database Layer)

To interact with the encrypted `iban` data, specific PostgreSQL functions are used. These functions are designed to handle the cryptographic operations within the secure database context.

* `public.encrypt_iban_db(iban_to_encrypt text, encryption_key text) RETURNS bytea`:
    * **Purpose:** Takes a plain text IBAN and the encryption key.
    * **Function:** Calls `pgp_sym_encrypt` to encrypt the IBAN.
    * **Output:** Returns the encrypted `iban` as `bytea`.
    * **Security:** Defined as `SECURITY DEFINER`, meaning it runs with the privileges of the function's owner (typically `supabase_admin`), allowing it to bypass Row Level Security (RLS) for the specific encryption task.
* `public.decrypt_iban_db(encrypted_iban bytea, encryption_key text) RETURNS text`:
    * **Purpose:** Takes an encrypted `bytea` IBAN and the encryption key.
    * **Function:** Calls `pgp_sym_decrypt` to decrypt the IBAN.
    * **Output:** Returns the plain text IBAN.
    * **Security:** Also `SECURITY DEFINER` for the same reasons as `encrypt_iban_db`.
* `public.decrypt_ibans_batch_db(encrypted_ibans bytea[], encryption_key text) RETURNS TABLE (decrypted_iban text)`:
    * **Purpose:** Decrypts multiple IBANs efficiently in a single database call (primarily for admin views).
    * **Function:** Uses `unnest()` and `pgp_sym_decrypt()` on an array of `bytea` IBANs.
    * **Output:** Returns a table of plain text IBANs.
    * **Security:** `SECURITY DEFINER`.

### 2.4. Supabase Edge Functions (API Layer)

These Deno-based Edge Functions act as the secure gateway between the frontend and the cryptographic operations in the database. They manage the `SEPA_ENCRYPTION_KEY` and orchestrate the `rpc` calls to the PostgreSQL functions.

* `encrypt-iban`:
    * **Purpose:** Used by the frontend to encrypt a single IBAN before storage.
    * **Input:** Receives a plain text IBAN from the frontend.
    * **Process:** Retrieves `SEPA_ENCRYPTION_KEY`, calls `supabase.rpc('encrypt_iban_db')`.
    * **Output:** Returns the encrypted `bytea` IBAN to the frontend.
* `decrypt-iban`:
    * **Purpose:** Used by the frontend to decrypt a single IBAN for display.
    * **Input:** Receives an encrypted `bytea` IBAN from the frontend.
    * **Process:** Retrieves `SEPA_ENCRYPTION_KEY`, calls `supabase.rpc('decrypt_iban_db')`.
    * **Output:** Returns the plain text IBAN to the frontend.
* `decrypt-ibans-batch`:
    * **Purpose:** Used by admin views to efficiently decrypt multiple IBANs at once.
    * **Input:** Receives an array of encrypted `bytea` IBANs from the frontend.
    * **Process:** Retrieves `SEPA_ENCRYPTION_KEY`, calls `supabase.rpc('decrypt_ibans_batch_db')`.
    * **Output:** Returns an array of plain text IBANs to the frontend.
* **General Edge Function Security:**
    * Deployed with `--no-verify-jwt`: This means the Edge Function itself doesn't strictly enforce JWT validation at its own endpoint. User authentication to the application should happen *before* sensitive calls to these functions.
    * Internal `supabaseClient` uses `SUPABASE_SERVICE_ROLE_KEY`: This key grants the Edge Function `supabase_admin` privileges for database operations, allowing it to call the `SECURITY DEFINER` functions without RLS restrictions. This is why the Edge Function code must be carefully reviewed and kept minimal.
    * CORS headers are configured to allow access from the frontend.

### 2.5. Frontend (React Application)

* **No Direct Key Access:** The React application never has direct access to the `SEPA_ENCRYPTION_KEY` or the `SUPABASE_SERVICE_ROLE_KEY`.
* **Encryption Flow:** When saving an IBAN, the frontend sends the plain text IBAN to the `encrypt-iban` Edge Function. It then receives the encrypted `bytea` and inserts that into `public.sepa_enc` via the standard Supabase client.
* **Decryption Flow:** When retrieving an IBAN for display, the frontend fetches the `bytea` IBAN from `public.sepa_enc` and sends it to either `decrypt-iban` (single) or `decrypt-ibans-batch` (multiple) Edge Functions. It then receives and displays the plain text IBAN.
* **Row Level Security (RLS):** RLS policies on `public.sepa_enc` are in place to restrict normal users to only viewing their own encrypted IBAN records. The RLS is applied *before* any data leaves the database.

## 3. Key Security Considerations & Developer Responsibilities

* **`SEPA_ENCRYPTION_KEY` Management:**
    * This key is paramount. It must be a strong, randomly generated string.
    * **Never hardcode, log, or expose this key anywhere outside of Supabase Secrets.**
    * Consider a key rotation strategy for long-term maintenance.
* **Edge Function Code Review:**
    * Given that Edge Functions operate with elevated `SERVICE_ROLE_KEY` privileges internally, any changes to `encrypt-iban`, `decrypt-iban`, or `decrypt-ibans-batch` **must be thoroughly reviewed** by a senior developer or security lead.
    * These functions should only perform their intended encryption/decryption RPC calls and minimal input validation. They should **not** contain complex business logic or perform arbitrary database operations.
* **Temporary Edge Functions:** Any Edge Functions created for one-time tasks (e.g., data migrations like `migrate-sepa-data`) that use the `SERVICE_ROLE_KEY` **must be deleted immediately after their successful execution**.
* **PostgreSQL `SECURITY DEFINER` Functions:** Understand that these functions elevate privileges. Ensure their SQL logic is precise and safe.
* **Frontend Data Handling:**
    * Developers must **never attempt to decrypt IBANs directly in the client-side code.** All decryption must go through the dedicated Edge Functions.
    * Ensure any plain text IBANs handled in the frontend (briefly, before sending to `encrypt-iban` or after receiving from `decrypt-iban`) are treated with extreme care and not stored in browser storage or logs.
* **Row Level Security (RLS):** Developers must ensure that RLS policies on `public.sepa_enc` (and any other sensitive tables) are correctly configured and remain active to prevent unauthorized access to the *encrypted* data by unprivileged users.
* **Data in Transit:** Supabase handles HTTPS/TLS encryption for all traffic between the client, Edge Functions, and the database. Ensure all API calls use `https`.

## 4. TODO:
There are few things needed to be considered:

* There is no scripts for key rotation present, SQL or Deno. Both needs to be made. A good thumb rule is once in every 180 days, keys needs to be rotated and migrated.
* Right now CORS is basically *. But this needs to be restricted during deployment. 

## 5. Contact

For any questions regarding the security architecture, key management, or to report a potential vulnerability, please do not contact Kesava Prasad Arul :)