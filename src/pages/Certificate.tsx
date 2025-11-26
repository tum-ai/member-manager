import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { jsPDF } from 'jspdf'
import { User } from '@supabase/supabase-js'

interface EngagementConfirmationProps {
  user: User;
}

interface MemberData {
  salutation: string;
  given_name: string;
  surname: string;
  date_of_birth: string;
  active: boolean;
  email: string;
}

interface Engagement {
  startDate: string;
  endDate: string;
  weeklyHours: string;
  department: string;
  isTeamLead: boolean;
  isStillActive: boolean;
  tasksDescription: string;
  [key: string]: any; // Allow indexing
}

export default function EngagementConfirmation({ user }: EngagementConfirmationProps) {
  const [loading, setLoading] = useState(true)
  const [isSendingEmail, setIsSendingEmail] = useState(false) // New state for email sending status
  const [memberData, setMemberData] = useState<MemberData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const institutionName = 'TUM.ai'

  const departments = [
    'Board',
    'Community',
    'Innovation Department',
    'Legal & Finance',
    'Makeathon',
    'Marketing',
    'Partners & Sponsors',
    'Research',
    'Software Development',
    'Venture',
  ].sort()

  const [engagements, setEngagements] = useState<Engagement[]>([
    {
      startDate: '',
      endDate: '',
      weeklyHours: '',
      department: '',
      isTeamLead: false,
      isStillActive: false, // Added isStillActive
      tasksDescription: 'List each responsibility on a new line',
    },
  ])

  useEffect(() => {
    async function fetchMemberData() {
      const { data, error } = await supabase
        .from('members')
        .select('salutation, given_name, surname, date_of_birth, active, email') // Added 'email'
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

  const updateEngagement = (index: number, key: string, value: any) => {
    const updated = [...engagements]
    updated[index][key] = value
    // If isStillActive changes to true, clear endDate
    if (key === 'isStillActive' && value === true) {
      updated[index].endDate = ''
    }
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
        isStillActive: false, // Reset isStillActive for new engagement
        tasksDescription: 'List each responsibility on a new line', // Reset description for new engagement
      },
    ])
  }

  const removeEngagement = (index: number) => {
    setEngagements(engagements.filter((_, i) => i !== index))
  }

  // --- NEW FUNCTION: Generate PDF as Blob ---
  const generatePdfBlob = async () => {
    if (!memberData) return null

    // Input validation
    for (const engagement of engagements) {
      if (
        !engagement.startDate ||
        (!engagement.isStillActive && !engagement.endDate) || // End date required only if not active
        !engagement.weeklyHours ||
        !engagement.department ||
        !engagement.tasksDescription ||
        engagement.tasksDescription.trim() === ''
      ) {
        alert('Please complete all required fields for each engagement before generating the PDF.')
        return null // Return null if validation fails
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
      const loadImageAsBase64 = (src: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (ctx) {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0)
                resolve(canvas.toDataURL('image/png'))
            } else {
                reject(new Error('Could not get canvas context'))
            }
          }
          img.onerror = reject
          img.src = src
        })
      }

      try {
        const base64Logo = await loadImageAsBase64(logoPath)
        const logoWidth = 60
        const logoHeight = 15 // Calculated to maintain aspect ratio (based on original 60x18, now 60x15)
        doc.addImage(
          base64Logo,
          'PNG',
          pageWidth / 2 - logoWidth / 2,
          10,
          logoWidth,
          logoHeight,
          undefined,
          'MEDIUM'
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
    doc.setTextColor(checkColor[0], checkColor[1], checkColor[2])
    doc.text('CERTIFICATE', pageWidth / 2, y, { align: 'center' })

    y += 20
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(textColor[0], textColor[1], textColor[2])
    doc.setLineHeightFactor(1.5)

    const intro = `
We hereby acknowledge that ${fullName}, born on ${birthDate}, participated in and contributed to the TUM.ai student initiative during the following periods.
    `
    const wrappedIntro = doc.splitTextToSize(intro.trim(), maxWidth)
    doc.text(wrappedIntro, margin, y)
    y += wrappedIntro.length * 7 + 5

    const col1Width = 40
    const col2Width = 50
    const col3Width = maxWidth - col1Width - col2Width - 2 * 5 // Adjusted for spacing

    const colX1 = margin
    const colX2 = colX1 + col1Width + 5
    const colX3 = colX2 + col2Width + 5

    doc.setFont('helvetica', 'bold')
    doc.text('Time Period', colX1, y)
    doc.text('Department', colX2, y)
    doc.text('Tasks', colX3, y)
    y += 8

    // Loop through engagements
    engagements.forEach(({ startDate, endDate, department, isTeamLead, isStillActive, tasksDescription }) => {
      const formatMonthYear = (dateStr: string) => {
        const date = new Date(dateStr)
        // Ensure date is valid before formatting
        if (isNaN(date.getTime())) {
          console.warn(`Invalid date string encountered: ${dateStr}`);
          return 'Invalid Date';
        }
        return date.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit' })
      }

      const start = formatMonthYear(startDate)
      const end = isStillActive ? 'Present' : formatMonthYear(endDate)

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

      const formattedTasks: { check: boolean; line: string }[] = []
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
        doc.setTextColor(textColor[0], textColor[1], textColor[2])

        if (wrappedPeriod[i]) doc.text(wrappedPeriod[i], colX1, y)
        if (wrappedDept[i]) doc.text(wrappedDept[i], colX2, y)

        const taskLine = formattedTasks[i]
        if (taskLine) {
          if (taskLine.check) {
            doc.setTextColor(checkColor[0], checkColor[1], checkColor[2])
            doc.text(checkmark, colX3, y)
            doc.setTextColor(textColor[0], textColor[1], textColor[2])
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

      y += 4 // Add some extra space after each engagement block
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
    doc.text(`Munich, ${today}`, rightX + 6, y + 12) // Adjusted x-coordinate for "Munich, today" on the right
    
    // Return the PDF as a Blob
    return doc.output('blob');
  }

  // --- Function to handle downloading the PDF ---
  // const handleDownloadPdf = async () => {
  //   const pdfBlob = await generatePdfBlob();
  //   if (pdfBlob && memberData) {
  //     const fullName = `${memberData.given_name} ${memberData.surname}`;
  //     const url = URL.createObjectURL(pdfBlob);
  //     const a = document.createElement('a');
  //     a.href = url;
  //     a.download = `TUMai_Certificate_${fullName}.pdf`;
  //     document.body.appendChild(a);
  //     a.click();
  //     document.body.removeChild(a);
  //     URL.revokeObjectURL(url);
  //   }
  // };

  // --- Function to handle sending the PDF via email ---
  const handleSendPdfEmail = async () => {
    if (isSendingEmail) return; // Prevent double clicks
    if (!memberData) return;

    const pdfBlob = await generatePdfBlob();
    if (!pdfBlob) return; // If PDF generation failed (e.g., validation), stop

    setIsSendingEmail(true); // Set loading state

    const fullName = `${memberData.given_name} ${memberData.surname}`;
    const recipientEmail = memberData.email; // Assuming user.email is the recipient

    if (!recipientEmail) {
        alert('Could not find recipient email. Please ensure your user data includes an email address.');
        setIsSendingEmail(false);
        return;
    }

    try {
      const reader = new FileReader();
      reader.readAsDataURL(pdfBlob);
      reader.onloadend = async () => {
        const result = reader.result as string;
        const base64Pdf = result.split(',')[1]; // Get only the base64 part
        const pdfFileName = `TUMai_Certificate_${fullName}.pdf`;

        const { data, error } = await supabase.functions.invoke('email-test-m1', {
          method: 'POST',
          body: {
            to: recipientEmail,
            subject: `Your TUM.ai Engagement Certificate`,
            html: `
              <p>Dear ${memberData.salutation} ${memberData.surname},</p>
              <p>Please find attached your Certificate of Voluntary Engagement with TUM.ai.</p>
              <p>If you have any questions, please feel free to reach out.</p>
              <p>Best regards,<br>The TUM.ai Team</p>
              <br/>
              <small>This is an automated email. Please do not reply to this address.</small>
            `,
            attachment: {
              filename: pdfFileName,
              content: base64Pdf,
              encoding: 'base64',
            },
          },
        });

        if (error) {
          console.error('Error invoking Supabase function:', error);
          alert(`Failed to send email: ${error.message}`);
        } else {
          console.log('Email sent response:', data);
          alert('Email sent successfully!');
        }
        setIsSendingEmail(false); // Reset loading state
      };
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        alert('Failed to read PDF file for sending.');
        setIsSendingEmail(false);
      };

    } catch (callError) {
      console.error('Error during function invocation:', callError);
      alert('An unexpected error occurred while sending the email.');
      setIsSendingEmail(false); // Reset loading state
    }
  };


  if (loading) return <div>Loading...</div>
  if (error) return <div>{error}</div>
  if (!memberData) return <div>No member data found.</div>

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
        <strong>{new Date(memberData.date_of_birth).toLocaleDateString('de-DE')}</strong>, has voluntarily engaged with our institution <strong>{institutionName}</strong>.
      </p>

      <form onSubmit={e => { e.preventDefault(); /* Prevent default form submission on enter */ }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {engagements.map((engagement, index) => (
          <div key={index} style={{ border: '1px solid #555', padding: '1rem', borderRadius: 8, marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: 8 }}>Engagement #{index + 1}</h3>

            <div>
              <label><strong>Start Date *</strong><br />
                <input type="date" value={engagement.startDate} onChange={e => updateEngagement(index, 'startDate', e.target.value)} required />
              </label>
            </div>

            <div>
              <label>
                <input 
                  type="checkbox" 
                  checked={engagement.isStillActive} 
                  onChange={e => updateEngagement(index, 'isStillActive', e.target.checked)} 
                />
                {' '}<strong>I am still active in this role</strong>
              </label>
            </div>

            {!engagement.isStillActive && ( // Conditionally render End Date
              <div>
                <label><strong>End Date *</strong><br />
                  <input
                    type="date"
                    value={engagement.endDate}
                    onChange={e => updateEngagement(index, 'endDate', e.target.value)}
                    required // End date is required only if not active
                  />
                </label>
              </div>
            )}

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
        
        {/* Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
          <button 
            type="button" // Change to type="button"
            onClick={handleSendPdfEmail} 
            disabled={isSendingEmail} // Disable button while sending
            style={{ flex: 1, padding: '0.75rem', fontSize: '16px', cursor: 'pointer', backgroundColor: '#222222', color: 'white', border: 'none', borderRadius: '4px' }}>
            {isSendingEmail ? 'Sending...' : 'Send PDF via Email'}
          </button>
        </div>
      </form>
    </div>
  )
}
