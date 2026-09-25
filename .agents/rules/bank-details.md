---
paths: ["shared/src/iban.ts", "shared/src/sepa.ts", "shared/src/reimbursements.ts", "client/src/features/profile/**", "client/src/features/sepa/**", "client/src/features/reimbursements/**", "client/src/hooks/useSepaData.ts", "server/src/routes/sepa.ts", "server/src/routes/reimbursements.ts", "server/src/lib/reimbursement*.ts", "server/src/lib/receiptProcessing.ts", "server/src/lib/sensitiveData*.ts", "server/test/routes/sepa.test.ts", "server/test/routes/reimbursement*.test.ts", "e2e/sepa.spec.ts", "e2e/*reimbursement*.spec.ts"]
---

# Bank details: SEPA, IBANs, reimbursement payments

This area has regressed repeatedly (#96, #110, #267, #276). Read the existing tests before
changing behaviour, and add a regression test for every fix.

- **Two separate accounts.**
  - A member's **SEPA mandate** (`sepa` table: `iban`, `bic`, `bank_name`) is the account TUM.ai
    debits. Schema: `sepaSchema` in `shared/src/sepa.ts`.
  - A **reimbursement request's** `payment_iban` / `payment_bic` is where TUM.ai pays out. It is
    required for reimbursement and invoice requests and forbidden for Vivid requests
    (`server/src/routes/reimbursements.ts`).
  Never copy one into the other implicitly. Compare accounts on normalized values
  (`isSamePaymentAccount`).
- **One IBAN implementation.** Validate and normalize with `ibanSchema` / `normalizeIban` /
  `isValidIban` from `shared/src/iban.ts` (NFKC, strip spaces and hyphens, uppercase, `ibantools`
  checksum). No hand-written IBAN regexes on either side.
- **Receipt extraction only suggests.** Values parsed from a receipt (`lib/receiptProcessing.ts`)
  prefill the form for the member to review. Parsed IBAN/BIC apply only if the submission type is
  still the one the parse started with, and never to a Vivid request (#267).
- **Consent is not optional.** Saving SEPA details requires all three agreements: SEPA mandate,
  Privacy Policy, and Data Privacy Notice (`sepaSchema`). Never loosen a consent requirement as a
  side effect of another change; if a product change needs it, ask first.
- **Encrypted at rest.** `iban`, `bic`, `bank_name` (`SENSITIVE_SEPA_FIELDS`) and
  `payment_iban`, `payment_bic` (`SENSITIVE_REIMBURSEMENT_FIELDS`) are `enc-v1:` ciphertext. Decrypt
  only for callers allowed to see them; never log them, and seed only ciphertext.
