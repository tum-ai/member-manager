import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jsPDF } from 'jspdf'

export default function Certificate({ user }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchMemberData() {
      const { data, error } = await supabase
        .from('members')
        .select('salutation, given_name, surname, date_of_birth, active')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Supabase fetch error:', error)
        setError('Error fetching data: ' + error.message)
      } else if (!data.active) {
        setError('Membership is not active.')
      } else {
        setMemberData(data)
      }
      setLoading(false)
    }

    fetchMemberData()
  }, [user])

  function downloadPdf() {
    if (!memberData) return

    const doc = new jsPDF()
    const today = new Date().toLocaleDateString()

    // Add TUM.ai logo (assuming it's in public folder)
    // Adjust x,y,width,height as needed
    doc.addImage('/img/logo.webp', 'WEBP', 80, 10, 50, 20)

    // Draw border rectangle
    doc.setLineWidth(1.5)
    doc.rect(10, 40, 190, 130) // x,y,width,height

    // Title
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    doc.text('Certificate of Membership', 105, 70, null, null, 'center')

    // Body text
    doc.setFontSize(16)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `This certifies that ${memberData.salutation} ${memberData.given_name} ${memberData.surname}`,
      105,
      90,
      null,
      null,
      'center'
    )
    doc.text(
      `born on ${new Date(memberData.date_of_birth).toLocaleDateString()}`,
      105,
      100,
      null,
      null,
      'center'
    )
    doc.text(
      'is an active member of TUM.ai.',
      105,
      110,
      null,
      null,
      'center'
    )
    
    // Signature placeholder
    doc.text('_________________________', 105, 135, null, null, 'center')
    doc.text('Authorized Signature', 105, 145, null, null, 'center')

    // Date
    doc.setFontSize(12)
    doc.text(`Issued on: ${today}`, 105, 160, null, null, 'center')


    doc.save('tum_ai_membership_certificate.pdf')
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div style={{ color: 'white', maxWidth: 600 }}>
      <h1 style={{ textAlign: 'center' }}>Certificate of Membership</h1>
      <div style={{ textAlign: 'center' }}>
        <img
          src="/img/logo.webp"
          alt="TUM.ai Logo"
          style={{ maxWidth: '150px', marginBottom: '1rem' }}
        />
      </div>
      <p style={{ fontSize: '18px', textAlign: 'center' }}>
        This certifies that <strong>{memberData.salutation} {memberData.given_name} {memberData.surname}</strong>, born on{' '}
        {new Date(memberData.date_of_birth).toLocaleDateString()}, is an active member of <strong>TUM.ai</strong>.
      </p>
      <div style={{ textAlign: 'center', marginTop: '3rem' }}>
        <div style={{ borderTop: '1px solid white', width: 200, margin: '0 auto' }}></div>
        <div>Authorized Signature</div>
      </div>

      <button
        onClick={downloadPdf}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
      >
        Download PDF
      </button>
    </div>
  )
}
