import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jsPDF } from 'jspdf'

export default function EngagementConfirmation({ user }) {
  const [loading, setLoading] = useState(true)
  const [memberData, setMemberData] = useState(null)
  const [error, setError] = useState(null)

  const institutionName = 'TUM.ai'

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

  const [engagements, setEngagements] = useState([
    {
      startDate: '',
      endDate: '',
      weeklyHours: '',
      department: '',
      isTeamLead: false,
      tasksDescription: 'List each responsibility on a new line',
    },
  ])

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

  const updateEngagement = (index, key, value) => {
    const updated = [...engagements]
    updated[index][key] = value
    setEngagements(updated)
  }

  const addEngagement = () => {
    if (engagements.length >= 5) {
      alert('You can only add up to 5 engagement periods.')
      return
    }
    setEngagements([
      ...engagements,
      {
        startDate: '',
        endDate: '',
        weeklyHours: '',
        department: '',
        isTeamLead: false,
        tasksDescription: '',
      },
    ])
  }

  const removeEngagement = (index) => {
    setEngagements(engagements.filter((_, i) => i !== index))
  }

  const downloadPdf = async () => {
    if (!memberData) return

    for (const engagement of engagements) {
      if (
        !engagement.startDate ||
        !engagement.endDate ||
        !engagement.weeklyHours ||
        !engagement.department ||
        !engagement.tasksDescription
      ) {
        alert('Please complete all required fields for each engagement.')
        return
      }
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    const fullName = `${memberData.given_name} ${memberData.surname}`
    const today = new Date().toLocaleDateString('de-DE')
    const birthDate = new Date(memberData.date_of_birth).toLocaleDateString('de-DE')

    const pageWidth = doc.internal.pageSize.getWidth()
    const margin = 20
    const maxWidth = pageWidth - margin * 2
    const checkColor = [60, 0, 180]
    const textColor = [40, 40, 40]
    let y = 50

    try {
      const logoPath = '/img/logo_black.png'
      
      // Load image as base64 to ensure proper loading
      const loadImageAsBase64 = (src) => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            canvas.width = img.width
            canvas.height = img.height
            ctx.drawImage(img, 0, 0)
            resolve(canvas.toDataURL('image/png'))
          }
          img.onerror = reject
          img.src = src
        })
      }
  
      try {
        const base64Logo = await loadImageAsBase64(logoPath)
        const logoWidth = 60
        const logoHeight = 15 // Calculated to maintain aspect ratio
        doc.addImage(
          base64Logo, 
          'PNG', 
          pageWidth / 2 - logoWidth / 2, 
          10, 
          logoWidth, 
          logoHeight,
          undefined,
          'MEDIUM' // compression - 'NONE' for best quality but for logo medium looks good enough
        )
      } catch (e) {
        console.warn('Failed to load logo as base64, trying direct method')
        doc.addImage('/img/logo_black.png', 'PNG', pageWidth / 2 - 30, 10, 60, 18)
      }
    } catch (e) {
      console.warn('Logo not found or failed to load:', e)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...checkColor)
    doc.text('CERTIFICATE', pageWidth / 2, y, { align: 'center' })

    y += 20
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...textColor)
    doc.setLineHeightFactor(1.5)

    const intro = `
We hereby acknowledge that ${fullName}, born on ${birthDate}, participated in and contributed to the TUM.ai student initiative during the following periods.
    `
    const wrappedIntro = doc.splitTextToSize(intro.trim(), maxWidth)
    doc.text(wrappedIntro, margin, y)
    y += wrappedIntro.length * 7 + 5

    const col1Width = 40
    const col2Width = 50
    const col3Width = maxWidth - col1Width - col2Width - 2 * 5

    const colX1 = margin
    const colX2 = colX1 + col1Width + 5
    const colX3 = colX2 + col2Width + 5

    doc.setFont('helvetica', 'bold')
    doc.text('Time Period', colX1, y)
    doc.text('Department', colX2, y)
    doc.text('Tasks', colX3, y)
    y += 8

    // Loop through engagements
    engagements.forEach(({ startDate, endDate, department, isTeamLead, tasksDescription }) => {
      const formatMonthYear = (dateStr) => {
        const date = new Date(dateStr)
        return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit' })
      }

      const start = formatMonthYear(startDate)
      const end = formatMonthYear(endDate)

      const period = `${start} - ${end}`
      const deptText = `${department}${isTeamLead ? ' (Team Lead)' : ''}`

      const tasks = tasksDescription
        .split('\n')
        .map(t => t.trim())
        .filter(Boolean)

      const wrappedPeriod = doc.splitTextToSize(period, col1Width)
      const wrappedDept = doc.splitTextToSize(deptText, col2Width)

      const checkmark = '•'
      const checkmarkOffset = 5
      const indentX = colX3 + checkmarkOffset 

      const formattedTasks = []
      tasks.forEach(task => {
        const wrapped = doc.splitTextToSize(task, col3Width - checkmarkOffset - 1)
        if (wrapped.length > 0) {
          formattedTasks.push({ check: true, line: wrapped[0] })
          for (let i = 1; i < wrapped.length; i++) {
            formattedTasks.push({ check: false, line: wrapped[i] })
          }
        }
      })

      const lines = Math.max(wrappedPeriod.length, wrappedDept.length, formattedTasks.length)
      const lineHeight = 6

      for (let i = 0; i < lines; i++) {
        doc.setTextColor(...textColor)

        if (wrappedPeriod[i]) doc.text(wrappedPeriod[i], colX1, y)
        if (wrappedDept[i]) doc.text(wrappedDept[i], colX2, y)

        const taskLine = formattedTasks[i]
        if (taskLine) {
          if (taskLine.check) {
            doc.setTextColor(...checkColor)
            doc.text(checkmark, colX3, y)
            doc.setTextColor(...textColor)
            doc.text(taskLine.line, colX3 + checkmarkOffset, y)
          } else {
            doc.text(taskLine.line, indentX, y)
          }
        }

        y += lineHeight
        if (y > 270) {
          doc.addPage()
          y = 20
        }
      }

      y += 4
    })

    const valueText = `
For the active and continuous contribution to TUM.ai, a high level of responsibility, personal commitment, team-spirit and curiosity are indispensable.

We thank ${fullName} for ${memberData.salutation === 'Ms.' ? 'her' : 'his'} commitment and enriching contribution to TUM.ai.
    `
    const wrappedValue = doc.splitTextToSize(valueText.trim(), maxWidth)
    doc.text(wrappedValue, margin, y)
    y += wrappedValue.length * 7 + 5

    doc.setFont('helvetica', 'bold')
    doc.text('About TUM.ai', margin, y)
    y += 8

    doc.setFont('helvetica', 'normal')
    const aboutText = `
TUM.ai is a non-profit student initiative around Artificial Intelligence (AI) based at the Technical University of Munich (TUM).

Shaping and empowering the AI ecosystem, TUM.ai runs projects focused on real-world problems, organizes its signature hackathon, hosts events and workshops, and supports funding AI startups.

Each member shapes their TUM.ai journey by joining one of the departments to contribute to our growth, launching new initiatives, and participating in hands-on offerings.
    `
    const wrappedAbout = doc.splitTextToSize(aboutText.trim(), maxWidth)
    doc.text(wrappedAbout, margin, y)
    y += wrappedAbout.length * 7

    y += 15
    // Check if near bottom of page and add page if needed
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')

    doc.text('Amy Chao,', margin, y)
    doc.text('TUM.ai vice-president', margin, y + 6)
    doc.text(`Munich, ${today}`, margin, y + 12)

    const rightX = pageWidth - margin - 60
    doc.text('Paul Schneider,', rightX, y)
    doc.text('TUM.ai president', rightX, y + 6)
    doc.text(`Munich, ${today}`, rightX, y + 12)

    doc.save(`TUMai_Certificate_${fullName}.pdf`)
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>

  return (
    <div style={{ color: 'white', maxWidth: 700, margin: 'auto', padding: '1rem' }}>
      <h1 style={{ textAlign: 'center' }}>Confirmation of Voluntary Engagement</h1>
      <div style={{ textAlign: 'center' }}>
        <img src="/img/logo.webp" alt="Institution Logo" style={{ maxWidth: '150px', marginBottom: '1rem' }} />
      </div>

      <p>
        This form will generate a personalized <strong>PDF certificate</strong> confirming your voluntary engagement with <strong>{institutionName}</strong>.
        Please enter <strong>accurate information</strong> for each period you were actively involved.
      </p>

      <p><strong>Important:</strong> Everything you enter below will directly appear in the final certificate. Make sure names, dates, and responsibilities are correct and complete.</p>

      <p>
        This is to confirm that{' '}
        <strong>
          {memberData.salutation} {memberData.given_name} {memberData.surname}
        </strong>, born on{' '}
        <strong>{new Date(memberData.date_of_birth).toLocaleDateString()}</strong>, has voluntarily engaged with our institution <strong>{institutionName}</strong>.
      </p>

      <form onSubmit={e => { e.preventDefault(); downloadPdf(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {engagements.map((engagement, index) => (
          <div key={index} style={{ border: '1px solid #555', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: 8 }}>Engagement #{index + 1}</h3>

            <div>
              <label><strong>Start Date *</strong><br />
                <input type="date" value={engagement.startDate} onChange={e => updateEngagement(index, 'startDate', e.target.value)} required />
              </label>
            </div>

            <div>
              <label><strong>End Date *</strong><br />
                <input type="date" value={engagement.endDate} onChange={e => updateEngagement(index, 'endDate', e.target.value)} required />
              </label>
            </div>

            <div>
              <label><strong>Weekly Hours *</strong><br />
                <select value={engagement.weeklyHours} onChange={e => updateEngagement(index, 'weeklyHours', e.target.value)} required>
                  <option value="" disabled>Select</option>
                  {[2, 5, 10, 15, 20].map(hour => (
                    <option key={hour} value={hour}>{hour} hours</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label><strong>Department *</strong><br />
                <select value={engagement.department} onChange={e => updateEngagement(index, 'department', e.target.value)} required>
                  <option value="" disabled>Select</option>
                  {departments.map(dep => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                <input type="checkbox" checked={engagement.isTeamLead} onChange={e => updateEngagement(index, 'isTeamLead', e.target.checked)} />
                {' '}<strong>I was a team lead</strong>
              </label>
            </div>

            <div>
              <label><strong>Tasks / Responsibilities *</strong><br />
                <textarea
                  rows={3}
                  placeholder="List each responsibility on a new line"
                  value={engagement.tasksDescription}
                  onChange={e => updateEngagement(index, 'tasksDescription', e.target.value)}
                  required
                  style={{ width: '100%' }}
                />
              </label>
            </div>

            {engagements.length > 1 && (
              <button type="button" onClick={() => removeEngagement(index)} style={{ marginTop: 8, color: 'red' }}>
                Remove Engagement
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addEngagement} style={{ margin: '1rem 0', padding: '0.5rem' }}>
          + Add Another Engagement
        </button>

        <div style={{ marginTop: '1rem' }}>
          <small style={{ color: 'lightgray' }}>* Required fields</small>
        </div>
        <button type="submit" style={{ padding: '0.75rem', fontSize: '16px', cursor: 'pointer' }}>
          Download PDF
        </button>
      </form>
    </div>
  )
}
