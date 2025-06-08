import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jsPDF } from 'jspdf'

export default function EngagementConfirmation({ user }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [error, setError] = useState(null)

  // Fixed institution info (not editable)
  const institutionName = 'TUM.ai'
  const institutionGoals = 'to foster AI research and community collaboration'

  // Departments, alphabetically sorted
  const departments = [
    'Applied Accelerated Computing',
    'Community',
    'Legal & Finance',
    'Makeathon',
    'Marketing',
    'Med AI',
    'Partners & Sponsors',
    'Quant Finance',
    'Research',
    'Robotics',
    'Software Development',
    'Venture',
  ].sort()

  // User input states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [weeklyHours, setWeeklyHours] = useState('')
  const [tasksDescription, setTasksDescription] = useState(
    'supporting events and organizing workshops'
  )
  const [department, setDepartment] = useState('')
  const [isTeamLead, setIsTeamLead] = useState(false)

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

  if (!startDate || !endDate || !weeklyHours || !department) {
    alert(
      'Please fill in start date, end date, average weekly hours, and select a department.'
    )
    return
  }

  const doc = new jsPDF()
  const today = new Date().toLocaleDateString()

  // Add logo
  doc.addImage('/img/logo.webp', 'WEBP', 80, 10, 50, 20)

  // Title
  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.text('Confirmation of Voluntary Engagement', 105, 50, null, null, 'center')

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')

  let y = 70
  const lineHeight = 8
  const marginLeft = 15
  const maxTextWidth = 180

  // Utility function to add wrapped text and update y
  function addWrappedText(text) {
    const wrapped = doc.splitTextToSize(text, maxTextWidth)
    wrapped.forEach(line => {
      doc.text(line, marginLeft, y)
      y += lineHeight
    })
  }

  addWrappedText(
    `This is to confirm that ${memberData.given_name} ${memberData.surname}, born on ${new Date(
      memberData.date_of_birth
    ).toLocaleDateString()},`
  )

  addWrappedText(
    `has voluntarily engaged with our institution, ${institutionName}, during the period from ${new Date(
      startDate
    ).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}.`
  )

  addWrappedText(
    `The average time commitment was approximately ${weeklyHours} hours per week during this period.`
  )

  addWrappedText(
    `They were active in the ${department} department${isTeamLead ? ' as a team lead' : ''}.`
  )

  y += lineHeight / 2

  addWrappedText(`Our institution, ${institutionName}, aims to ${institutionGoals}.`)

  y += lineHeight / 2

  addWrappedText(
    `In the course of their engagement, ${memberData.given_name} ${memberData.surname} undertook the following tasks:`
  )

  addWrappedText(tasksDescription)

  y += lineHeight / 2

  addWrappedText(
    `We thank ${memberData.given_name} ${memberData.surname} for their committed, reliable, and active participation in our institution and wish them all the best for the future.`
  )

  y += lineHeight * 4
  doc.text('_________________________', 60, y)
  doc.text('Date and Signature', 65, y + 8)
  doc.text(`Authorized Representative of ${institutionName}`, 60, y + 16)

  doc.setFontSize(12)
  doc.text(`Issued on: ${today}`, 105, y + 40, null, null, 'center')

  doc.save('engagement_confirmation.pdf')
}


  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div
      style={{
        color: 'black',
        maxWidth: 700,
        margin: 'auto',
        padding: '1rem',
        backgroundColor: 'white',
        borderRadius: '8px',
      }}
    >
      <h1 style={{ textAlign: 'center' }}>Confirmation of Voluntary Engagement</h1>
      <div style={{ textAlign: 'center' }}>
        <img
          src="/img/logo.webp"
          alt="Institution Logo"
          style={{ maxWidth: '150px', marginBottom: '1rem' }}
        />
      </div>

      <p>
        This is to confirm that{' '}
        <strong>
          {memberData.salutation} {memberData.given_name} {memberData.surname}
        </strong>
        , born on <strong>{new Date(memberData.date_of_birth).toLocaleDateString()}</strong>, has
        voluntarily engaged with our institution <strong>{institutionName}</strong>.
      </p>

      <p>
        <strong>Institution goals:</strong> {institutionGoals}
      </p>

      <form
        onSubmit={e => {
          e.preventDefault()
          downloadPdf()
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <label>
          Engagement Period Start Date:
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Engagement Period End Date:
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            required
            style={{ width: '100%' }}
          />
        </label>

        <label>
          Average Weekly Hours:
          <select
            value={weeklyHours}
            onChange={e => setWeeklyHours(e.target.value)}
            required
            style={{ width: '100%' }}
          >
            <option value="" disabled>
              Select average weekly hours
            </option>
            {[2, 5, 10, 15, 20].map(hour => (
              <option key={hour} value={hour}>
                {hour} hours
              </option>
            ))}
          </select>
        </label>

        <label>
          Department:
          <select
            value={department}
            onChange={e => setDepartment(e.target.value)}
            required
            style={{ width: '100%' }}
          >
            <option value="" disabled>
              Select your department
            </option>
            {departments.map(dep => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={isTeamLead}
            onChange={e => setIsTeamLead(e.target.checked)}
          />
          I was a team lead
        </label>

        <label>
          Description of Tasks / Responsibilities:
          <textarea
            value={tasksDescription}
            onChange={e => setTasksDescription(e.target.value)}
            rows={4}
            required
            style={{ width: '100%' }}
          />
        </label>

        <button type="submit" style={{ padding: '0.75rem', fontSize: '16px', cursor: 'pointer' }}>
          Download PDF
        </button>
      </form>
    </div>
  )
}
