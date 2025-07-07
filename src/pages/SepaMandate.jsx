export default function SepaMandate() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: 'auto', color: 'white' }}>
      <h1>SEPA Mandate</h1>

      <section style={{ marginTop: '1.5rem' }}>
        <h2>Agreement</h2>
        <p>
          <strong>Issuance of a Direct Debit Authorization and a SEPA Direct Debit Mandate*</strong>
        </p>

        <p>
          <strong>Name of the Payee:</strong><br />
          TUM.ai e.V.
        </p>

        <p>
          <strong>Address of the Payee:</strong><br />
          TUM.ai e.V.<br />
          Arccisstraße 21<br />
          80333 Munich, Germany
        </p>

        <p>
          <strong>Creditor Identifier:</strong><br />
          DEXXXXXXXXXX
        </p>

        <p>
          <strong>Due Dates for Membership Fees:</strong><br />
          According to Section X No. X of our Contribution Rules, membership fees for active members are due on
          <em> XX.XX.XXXX</em> for the summer semester and on <em>XX.XX.XXXX</em> for the winter semester each year.
        </p>

        <p>
          <strong>Direct Debit Authorization:</strong><br />
          I authorize the payee TUM.ai, revocably, to collect payments due from me by direct debit from my account upon the due date.
        </p>

        <p>
          <strong>SEPA Direct Debit Mandate:</strong><br />
          (A) I authorize the payee to collect payments from my account via SEPA direct debit.<br />
          (B) At the same time, I instruct my bank to honor the SEPA direct debits drawn by the payee on my account.
        </p>

        <p>
          <strong>Note:</strong><br />
          I may request a refund of the debited amount within eight weeks, starting from the debit date. The conditions agreed upon with my bank apply.
        </p>

        <p>
          TUM.ai will inform me of the SEPA Core Direct Debit collection in this procedure at least 14 days before the debit takes place.
        </p>
      </section>
    </div>
  );
}
