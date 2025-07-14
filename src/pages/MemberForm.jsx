import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import Modal from './Modal'
import SepaMandate from './SepaMandate'
import PrivacyPolicy from './PrivacyPolicy'

export default function MemberForm({ user }) {
  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState({
    active: true,
    salutation: '',
    title: '',
    surname: '',
    given_name: '',
    email: '',
    date_of_birth: '',
    street: '',
    number: '',
    postal_code: '',
    city: '',
    country: '',
    user_id: user.id,
  })
  const [statusRequestMessage, setStatusRequestMessage] = useState('')


  const [sepa, setSepa] = useState({
    iban: '',
    bic: '',
    bank_name: '',
    mandate_agreed: false,
    privacy_agreed: false,
    user_id: user.id,
  })

  const [originalMember, setOriginalMember] = useState(null)
  const [originalSepa, setOriginalSepa] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [message, setMessage] = useState('')
  const [requestedStatus, setRequestedStatus] = useState(member.active ? 'inactive' : 'active');
  const [showSepaModal, setShowSepaModal] = useState(false)
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [pendingSepaCheck, setPendingSepaCheck] = useState(false)
  const [pendingPrivacyCheck, setPendingPrivacyCheck] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  // Listen for modal state changes
  useEffect(() => {
    const handleSepaUpdate = (event) => {
      if (event.detail && typeof event.detail.mandate_agreed === 'boolean') {
        setSepa(prev => ({ ...prev, mandate_agreed: event.detail.mandate_agreed }))
      }
    }

    const handlePrivacyUpdate = (event) => {
      if (event.detail && typeof event.detail.privacy_agreed === 'boolean') {
        setSepa(prev => ({ ...prev, privacy_agreed: event.detail.privacy_agreed }))
      }
    }

    window.addEventListener('sepa-updated', handleSepaUpdate)
    window.addEventListener('privacy-updated', handlePrivacyUpdate)

    return () => {
      window.removeEventListener('sepa-updated', handleSepaUpdate)
      window.removeEventListener('privacy-updated', handlePrivacyUpdate)
    }
  }, [])

  async function fetchData() {
    setLoading(true)
    const { data: memberData } = await supabase
      .from('members')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (memberData) {
      setMember(memberData)
      setOriginalMember(memberData)
      setRequestedStatus(memberData.active ? 'inactive' : 'active');
    }

    const { data: sepaData } = await supabase
      .from('sepa')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (sepaData) {
      setSepa(sepaData)
      setOriginalSepa(sepaData)
    }

    setLoading(false)
  }

  async function updateData(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error: memberError } = await supabase
      .from('members')
      .upsert(member, { onConflict: ['user_id'] })

    if (memberError) {
      setMessage(`Member error: ${memberError.message}`)
      setLoading(false)
      return
    }

    const { error: sepaError } = await supabase
      .from('sepa')
      .upsert(sepa, { onConflict: ['user_id'] })

    if (sepaError) {
      setMessage(`SEPA error: ${sepaError.message}`)
      setLoading(false)
      return
    }

    setOriginalMember(member)
    setOriginalSepa(sepa)
    setIsEditing(false)
    setMessage('Data saved successfully!')
    setLoading(false)
  }

  function handleMemberChange(e) {
    const { name, value, type, checked } = e.target
    setMember(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  function handleSepaChange(e) {
    const { name, type, checked, value } = e.target
    const newValue = type === 'checkbox' ? checked : value
    
    setSepa(prev => ({
      ...prev,
      [name]: newValue,
    }))

    // Dispatch events to keep modals synchronized
    if (name === 'mandate_agreed') {
      window.dispatchEvent(new CustomEvent('sepa-updated', { 
        detail: { mandate_agreed: newValue } 
      }))
    } else if (name === 'privacy_agreed') {
      window.dispatchEvent(new CustomEvent('privacy-updated', { 
        detail: { privacy_agreed: newValue } 
      }))
    }
  }

  // Custom handler for SEPA checkbox
  function handleSepaCheckbox(e) {
    if (loading) return;
    const checked = e.target.checked;
    if (!sepa.mandate_agreed && checked) {
      // Not agreed, trying to check: show modal
      e.preventDefault();
      setPendingSepaCheck(true);
      setShowSepaModal(true);
    } else if (sepa.mandate_agreed && !checked) {
      // Already agreed, allow unchecking directly
      setSepa(prev => ({ ...prev, mandate_agreed: false }));
      window.dispatchEvent(new CustomEvent('sepa-updated', { detail: { mandate_agreed: false } }));
    } else if (!sepa.mandate_agreed && !checked) {
      // Not agreed, unchecking (shouldn't happen, but just in case)
      setSepa(prev => ({ ...prev, mandate_agreed: false }));
      window.dispatchEvent(new CustomEvent('sepa-updated', { detail: { mandate_agreed: false } }));
    } else if (sepa.mandate_agreed && checked) {
      // Already agreed, re-checking (shouldn't happen)
      // Do nothing
    }
  }

  // Custom handler for Privacy Policy checkbox
  function handlePrivacyCheckbox(e) {
    if (loading) return;
    const checked = e.target.checked;
    if (!sepa.privacy_agreed && checked) {
      // Not agreed, trying to check: show modal
      e.preventDefault();
      setPendingPrivacyCheck(true);
      setShowPrivacyModal(true);
    } else if (sepa.privacy_agreed && !checked) {
      // Already agreed, cannot uncheck
      e.preventDefault();
    }
  }

  function handleCancel() {
    if (originalMember) setMember(originalMember)
    if (originalSepa) setSepa(originalSepa)
    setIsEditing(false)
    setMessage('Changes canceled.')
  }
  function handleStatusChangeRequest() {
    const confirmed = window.confirm(
      `Are you sure you want to request a status change to ${requestedStatus}?\n\nThis will be a legally binding request and will be sent to finance@tum-ai.com.`
    );
    if (confirmed) {
      setStatusRequestMessage(
        `A request to change your membership status to "${requestedStatus}" has been sent to finance@tum-ai.com. You will receive a confirmation email once the request is processed.`
      );
    }
  }




  const personalFields = [
    { label: 'Active member', name: 'active' },
    { label: 'Salutation', name: 'salutation' },
    { label: 'Title', name: 'title' },
    { label: 'Surname', name: 'surname' },
    { label: 'Given Name', name: 'given_name' },
    { label: 'Email', name: 'email', type: 'email' },
    { label: 'Date of Birth', name: 'date_of_birth', type: 'date' },
    { label: 'Street', name: 'street' },
    { label: 'Number', name: 'number' },
    { label: 'Postal Code', name: 'postal_code' },
    { label: 'City', name: 'city' },
    { label: 'Country', name: 'country' },
  ]

  if (loading) return <div>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: '700px', margin: 'auto', color: 'white' }}>
      {!isEditing ? (
        <>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2>Personal Data</h2>
              {personalFields.map(field => (
                <p key={field.name}>
                  <strong>{field.label}:</strong>{' '}
                  {field.name === 'active'
                    ? member[field.name] ? 'Yes' : 'No'
                    : member[field.name] || '-'}
                </p>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2>Banking Details</h2>
              <p><strong>IBAN:</strong> {sepa.iban || '-'}</p>
              <p><strong>BIC:</strong> {sepa.bic || '-'}</p>
              <p><strong>Bank name:</strong> {sepa.bank_name || '-'}</p>
              <p><strong>SEPA Mandate:</strong> {sepa.mandate_agreed ? 'Accepted' : 'Not Accepted'}</p>
              <p><strong>Privacy Policy:</strong> {sepa.privacy_agreed ? 'Accepted' : 'Not Accepted'}</p>
            </div>
          </div>

          <button onClick={() => setIsEditing(true)} style={{ marginTop: '2rem' }}>
            Change
          </button>
        </>
      ) : (
        <form onSubmit={updateData}>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2>Personal Data</h2>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                Salutation: *<br />
                <select
                  name="salutation"
                  value={member.salutation}
                  onChange={handleMemberChange}
                  disabled={loading}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                >
                  <option value="">-- Please choose --</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Mx.">Mx.</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                Title:<br />
                <select
                  name="title"
                  value={member.title}
                  onChange={handleMemberChange}
                  disabled={loading}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                >
                  <option value="">-- Please choose --</option>
                  <option value="Dr.">Dr.</option>
                  <option value="Prof.">Prof.</option>
                </select>
              </label>

              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                Active member: <strong>{member.active ? 'Yes' : 'No'}</strong>
                <br />
                <button
                  type="button"
                  onClick={handleStatusChangeRequest}
                  disabled={loading}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    backgroundColor: '#4EA1D3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Request Status Change to {requestedStatus.charAt(0).toUpperCase() + requestedStatus.slice(1)}
                </button>

                {statusRequestMessage && (
                  <p style={{ marginTop: '0.5rem', color: 'lightgreen' }}>
                    {statusRequestMessage}
                  </p>
                )}
              </label>



              {personalFields.filter(f => !['title', 'salutation', 'active'].includes(f.name)).map(({ label, name, type }) => (
                <label key={name} style={{ display: 'block', marginBottom: '0.75rem' }}>
                  {label}: *<br />
                  <input
                    type={type || 'text'}
                    name={name}
                    value={member[name]}
                    onChange={handleMemberChange}
                    disabled={loading}
                    required
                    style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                  />
                </label>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h2>Banking Details</h2>
              <label>
                IBAN: *<br />
                <input
                  name="iban"
                  value={sepa.iban}
                  onChange={handleSepaChange}
                  disabled={loading}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}
                />
              </label>
              <label>
                BIC: <br />
                <input
                  name="bic"
                  value={sepa.bic}
                  onChange={handleSepaChange}
                  disabled={loading}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}
                />
              </label>
              <label>
                Bank name: *<br />
                <input
                  name="bank_name"
                  value={sepa.bank_name}
                  onChange={handleSepaChange}
                  disabled={loading}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', marginBottom: '0.75rem' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  name="mandate_agreed"
                  checked={sepa.mandate_agreed}
                  onChange={handleSepaCheckbox}
                  disabled={loading}
                />{' '}
                I agree to the{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setShowSepaModal(true); }} style={{ color: '#4EA1D3', textDecoration: 'underline' }}>
                  SEPA mandate
                </a>
              </label>

              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                <input
                  type="checkbox"
                  name="privacy_agreed"
                  checked={sepa.privacy_agreed}
                  onChange={handlePrivacyCheckbox}
                  disabled={loading || sepa.privacy_agreed}
                />{' '}
                I agree to the{' '}
                <a href="#" onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }} style={{ color: '#4EA1D3', textDecoration: 'underline' }}>
                  Privacy Policy *
                </a>
              </label>

              <div style={{ marginTop: '1rem' }}>
                <small style={{ color: 'lightgray' }}>* Required fields</small>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <button type="submit" disabled={loading} style={{ marginRight: '1rem' }}>
              {loading ? 'Saving...' : 'Save Data'}
            </button>
            <button type="button" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>
          </div>
        </form>
      )}
      {message && <p style={{ marginTop: '1rem', color: 'lightgreen' }}>{message}</p>}
      {showSepaModal && (
        <Modal
          title="SEPA Mandate Agreement"
          onClose={() => { setShowSepaModal(false); setPendingSepaCheck(false); }}
          onConfirm={() => {
            setSepa(prev => ({ ...prev, mandate_agreed: true }));
            window.dispatchEvent(new CustomEvent('sepa-updated', { detail: { mandate_agreed: true } }));
            setShowSepaModal(false);
            setPendingSepaCheck(false);
          }}
        >
          <SepaMandate sepaAgreed={sepa.mandate_agreed} />
        </Modal>
      )}
      {showPrivacyModal && (
        <Modal
          title="Privacy Policy Agreement"
          onClose={() => { setShowPrivacyModal(false); setPendingPrivacyCheck(false); }}
          onConfirm={() => {
            setSepa(prev => ({ ...prev, privacy_agreed: true }));
            window.dispatchEvent(new CustomEvent('privacy-updated', { detail: { privacy_agreed: true } }));
            setShowPrivacyModal(false);
            setPendingPrivacyCheck(false);
          }}
        >
          <PrivacyPolicy privacyAgreed={sepa.privacy_agreed} />
        </Modal>
      )}
    </div>
  )
}
