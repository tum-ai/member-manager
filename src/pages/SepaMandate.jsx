import React, { useState, useEffect } from 'react';

export default function SepaMandate({ onCheckChange, sepaAgreed }) {
  const [checked, setChecked] = useState(!!sepaAgreed);

  useEffect(() => {
    setChecked(!!sepaAgreed); // Sync prop change
  }, [sepaAgreed]);

  useEffect(() => {
    onCheckChange?.(checked);
  }, [checked, onCheckChange]);

  return (
    <div>
      <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '1rem' }}>
        <h2>Agreement</h2>

        <h3>Issuance of a Direct Debit Authorization and a SEPA Direct Debit Mandate*</h3>

        <p><strong>Name of the Payee:</strong><br />TUM.ai e.V.</p>

        <p><strong>Address of the Payee:</strong><br />
          TUM.ai e.V.<br />
          Arcisstraße 21<br />
          80333 Munich, Germany
        </p>

        <p><strong>Creditor Identifier:</strong><br />DEXXXXXXXXXX</p>

        <p><strong>Due Dates for Membership Fees:</strong><br />
          According to Section X No. X of our Contribution Rules, membership fees for active members are due on <em>XX.XX.XXXX</em> for the summer semester and on <em>XX.XX.XXXX</em> for the winter semester each year.
        </p>

        <h3>Direct Debit Authorization:</h3>
        <p>
          I authorize the payee <strong>TUM.ai</strong>, revocably, to collect payments due from me by direct debit from my account upon the due date.
        </p>

        <h3>SEPA Direct Debit Mandate:</h3>
        <p>
          (A) I authorize the payee <strong>TUM.ai</strong> to collect payments from my account via SEPA direct debit.<br />
          (B) At the same time, I instruct my bank to honor the SEPA direct debits drawn by <strong>TUM.ai</strong> on my account.
        </p>

        <h3>Note:</h3>
        <p>
          I may request a refund of the debited amount within eight weeks, starting from the debit date. The conditions agreed upon with my bank apply.
        </p>

        <p>
          <strong>TUM.ai</strong> will inform me of the SEPA Core Direct Debit collection in this procedure at least 14 days before the debit takes place.
        </p>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <label>
          <input 
            type="checkbox" 
            checked={checked} 
            onChange={(e) => setChecked(e.target.checked)}
          />{' '}
          I have read and agree to the SEPA mandate.
        </label>
        {sepaAgreed && (
          <p style={{ fontSize: '0.9rem', color: 'gray', marginTop: '0.5rem' }}>
            You have already agreed to the SEPA mandate.
          </p>
        )}
      </div>
    </div>
  );
}
