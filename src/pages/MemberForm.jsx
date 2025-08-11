import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { countries } from '../lib/countries'
import Modal from './Modal'
import SepaMandate from './SepaMandate'
import PrivacyPolicy from './PrivacyPolicy'

export default function MemberForm({ user, onProfileComplete }) {
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

  // Utility: Check if profile is complete (to notify parent)
  function isProfileComplete(dataMember, dataSepa) {
    const requiredMemberFields = [
      'salutation',
      'surname',
      'given_name',
      'email',
      'date_of_birth',
      'street',
      'number',
      'postal_code',
      'city',
      'country',
    ]
    // All required member fields must be non-empty
    for (const field of requiredMemberFields) {
      if (!dataMember[field] || dataMember[field].toString().trim() === '') {
        return false
      }
    }
    // SEPA fields required (IBAN and bank name)
    if (
      !dataSepa.iban ||
      dataSepa.iban.trim() === '' ||
      !dataSepa.bank_name ||
      dataSepa.bank_name.trim() === ''
    ) {
      return false
    }
    // Only privacy policy agreement is required, SEPA mandate is optional
    if (!dataSepa.privacy_agreed) {
      return false
    }
    return true
  }

  // Notify parent on load or changes if profile complete
  useEffect(() => {
    if (originalMember && originalSepa) {
      if (isProfileComplete(originalMember, originalSepa)) {
        onProfileComplete?.()
      }
    }
  }, [originalMember, originalSepa, onProfileComplete])

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
      // Ensure boolean fields have proper default values
      const sepaWithDefaults = {
        ...sepaData,
        mandate_agreed: sepaData.mandate_agreed ?? false, // Default to false if undefined/null
        privacy_agreed: sepaData.privacy_agreed ?? false, // Default to false if undefined/null
      }
      setSepa(sepaWithDefaults)
      setOriginalSepa(sepaWithDefaults)
    }
    // Auto-open edit mode if profile is incomplete or data is missing
    const hasMember = !!memberData
    const hasSepa = !!sepaData
    const profileIsComplete = hasMember && hasSepa && isProfileComplete(memberData, sepaData)
    if (!profileIsComplete) {
      setIsEditing(true)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Save user data
  async function updateData(e) {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    // Validate before upsert
    if (!isProfileComplete(member, sepa)) {
      setMessage('Please fill all required fields and accept the Privacy Policy.')
      setLoading(false)
      return
    }

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

    // Notify parent if profile is now complete
    if (isProfileComplete(member, sepa)) {
      onProfileComplete?.()
    }
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
  async function handleStatusChangeRequest() {
    const confirmed = window.confirm(
      `Are you sure you want to request a status change to ${requestedStatus}?\n\nThis will be a legally binding request and will be sent to finance@tum-ai.com.`
    );
    
    if (confirmed) {
      setStatusRequestMessage('Sending request...');
      
      console.log('Testing Edge Function accessibility...');
      try {
        const testResponse = await supabase.functions.invoke('status-change-email', {
          method: 'GET',
        });
        console.log('Edge Function test response:', testResponse);
      } catch (testErr) {
        console.log('Edge Function test failed (this might be expected):', testErr);
      }
      
      try {
        const requestBody = {
          to: 'finance@tum-ai.com',
          subject: `Membership Status Change Request - ${member.given_name} ${member.surname}`,
          html: `
            <p><strong>Membership Status Change Request</strong></p>
            <p><strong>Member:</strong> ${member.salutation} ${member.given_name} ${member.surname}</p>
            <p><strong>Email:</strong> ${member.email}</p>
            <p><strong>Current Status:</strong> ${member.active ? 'Active' : 'Inactive'}</p>
            <p><strong>Requested Status:</strong> ${requestedStatus.charAt(0).toUpperCase() + requestedStatus.slice(1)}</p>
            <p><strong>Request Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p>This is an automated request from the member portal.</p>
          `,
        };
        
        console.log('Attempting to send email with request body:', JSON.stringify(requestBody, null, 2));
        
        const { data, error } = await supabase.functions.invoke('status-change-email', {
          method: 'POST',
          body: requestBody,
        });

        if (error) {
          console.error('Error sending status change request:', error);
          console.error('Error details:', {
            message: error.message,
            status: error.status,
            statusText: error.statusText,
            details: error.details
          });
          
          // Try a fallback approach with a different format
          console.log('Trying fallback approach...');
          try {
            const fallbackBody = {
              to: 'finance@tum-ai.com',
              subject: `Status Change Request - ${member.given_name} ${member.surname}`,
              html: `<p>Status change request from ${member.email}</p>`,
              attachment: {
                filename: 'status_request.txt',
                content: btoa('Status change request'),
                encoding: 'base64',
              },
            };
            
            console.log('Trying fallback with attachment:', JSON.stringify(fallbackBody, null, 2));
            
            const { data: fallbackData, error: fallbackError } = await supabase.functions.invoke('email-test-m1', {
              method: 'POST',
              body: fallbackBody,
            });
            
            if (fallbackError) {
              console.error('Fallback also failed:', fallbackError);
              console.error('Fallback error details:', {
                message: fallbackError.message,
                status: fallbackError.status,
                statusText: fallbackError.statusText,
                details: fallbackError.details
              });
              setStatusRequestMessage(`Failed to send request: ${error.message}. Please contact support.`);
            } else {
              console.log('Fallback succeeded:', fallbackData);
              setStatusRequestMessage(
                `A request to change your membership status to "${requestedStatus}" has been sent to finance@tum-ai.com. You will receive a confirmation email once the request is processed.`
              );
            }
          } catch (fallbackErr) {
            console.error('Fallback approach also failed:', fallbackErr);
            console.error('Fallback exception details:', fallbackErr);
            setStatusRequestMessage(`Failed to send request: ${error.message}. Please contact support.`);
          }
        } else {
          console.log('Status change request sent successfully:', data);
          setStatusRequestMessage(
            `A request to change your membership status to "${requestedStatus}" has been sent to finance@tum-ai.com. You will receive a confirmation email once the request is processed.`
          );
        }
      } catch (err) {
        console.error('Unexpected error sending status change request:', err);
        console.error('Full error object:', err);
        setStatusRequestMessage('An unexpected error occurred while sending the request. Please try again.');
      }
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

              {personalFields.filter(f => !['title', 'salutation', 'active', 'email', 'country'].includes(f.name)).map(({ label, name, type }) => (
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
              
              {/* Country dropdown */}
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                Country: *<br />
                <select
                  name="country"
                  value={member.country}
                  onChange={handleMemberChange}
                  disabled={loading}
                  required
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                >
                  <option value="">-- Please choose a country --</option>
                  {countries.map(country => (
                    <option key={country.code} value={country.name}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </label>
              
              {/* Email field - read only */}
              <label style={{ display: 'block', marginBottom: '0.75rem' }}>
                Email: *<br />
                <input
                  type="email"
                  name="email"
                  value={member.email}
                  disabled={true}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', backgroundColor: '#333', color: '#999' }}
                />
                <small style={{ color: 'lightgray', display: 'block', marginTop: '0.25rem' }}>
                  Email address cannot be changed. Contact support if you need to update your email.
                </small>
              </label>
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
          confirmText="Save"
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
          <PrivacyPolicy privacyAgreed={sepa.privacy_agreed} context="modal" />
        </Modal>
      )}
    </div>
  )
}
