import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as XLSX from 'xlsx'


export default function AdminDatabaseView() {
  const [data, setData] = useState([])
  const [filters, setFilters] = useState({
    search: '',
    mandateAgreed: '',
    privacyAgreed: '',
    active: '',
  })
  const [sortBy, setSortBy] = useState('surname')
  const [sortAsc, setSortAsc] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  function getRowStyle(member) {
    if (member.sepa?.mandate_agreed && !member.active) {
      return { backgroundColor: '#dc3545', color: 'white' } // red: SEPA enabled but inactive
    } else if (member.sepa?.mandate_agreed && member.active) {
      return { backgroundColor: '#28a745', color: 'white' } // green: SEPA enabled and active
    } else {
      return { backgroundColor: '#fd7e14', color: 'white' } // orange: SEPA not enabled (and not one of the first two cases)
    }
  }


  async function toggleMemberStatus(member) {
    const newStatus = !member.active
    const confirmation = window.confirm(
      `Are you sure you want to change the status of ${member.given_name} ${member.surname} to ${newStatus ? 'active' : 'inactive'}?`
    )

    if (!confirmation) return

    const { error } = await supabase
      .from('members')
      .update({ active: newStatus })
      .eq('user_id', member.user_id)

    if (error) {
      alert('Failed to update status: ' + error.message)
      return
    }

    setData(prev =>
      prev.map(m =>
        m.user_id === member.user_id ? { ...m, active: newStatus } : m
      )
    )
  }

  useEffect(() => {
    async function fetchData() {
      const { data: members, error: membersError } = await supabase.from('members').select('*')
      const { data: sepa, error: sepaError } = await supabase.from('sepa').select('*')

      if (membersError || sepaError) {
        setError(membersError?.message || sepaError?.message)
        setLoading(false)
        return
      }

      const joined = members.map(member => ({
        ...member,
        sepa: sepa.find(s => s.user_id === member.user_id) || {},
      }))

      setData(joined)
      setLoading(false)
    }

    fetchData()
  }, [])

  function exportToExcel() {
    const exportData = filtered.map(member => ({
      Surname: member.surname,
      "Given Name": member.given_name,
      Email: member.email,
      Phone: member.phone,
      IBAN: member.sepa?.iban || '',
      BIC: member.sepa?.bic || '',
      "Bank Name": member.sepa?.bank_name || '',
      "SEPA Mandate": String(member.sepa?.mandate_agreed),
      "Privacy Agreed": String(member.sepa?.privacy_agreed),
      Active: String(member.active),
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members')

    XLSX.writeFile(workbook, 'members_export.xlsx')
  }

  function downloadEmails() {
    const emails = filtered.map(m => m.email).filter(Boolean).join('; ')
    const blob = new Blob([emails], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = 'filtered_emails.txt'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function filterRow(row) {
    const { search, mandateAgreed, privacyAgreed, active } = filters

    const text = `${row.surname} ${row.given_name} ${row.email} ${row.phone} ${row.sepa.iban || ''} ${row.sepa.bic || ''} ${row.sepa.bank_name || ''}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false

    if (mandateAgreed !== '') {
      const val = String(row.sepa.mandate_agreed)
      if (val !== mandateAgreed) return false
    }

    if (privacyAgreed !== '') {
      const val = String(row.sepa.privacy_agreed)
      if (val !== privacyAgreed) return false
    }

    if (active !== '') {
      const val = String(row.active)
      if (val !== active) return false
    }

    return true
  }

  const filtered = data.filter(filterRow).sort((a, b) => {
    const valA = a[sortBy] ?? a.sepa?.[sortBy] ?? ''
    const valB = b[sortBy] ?? b.sepa?.[sortBy] ?? ''
    return sortAsc
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  if (loading) return <div style={{ color: 'white' }}>Loading data…</div>
  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>

  const boolOptions = [
    { label: 'All', value: '' },
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', color: 'white'}}>
      <h2>Admin Database View</h2>

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search text..."
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          style={{ padding: '0.5rem', borderRadius: '4px', width: '300px', marginRight: '1rem' }}
        />

        <label>
          SEPA Mandate:
          <select
            value={filters.mandateAgreed}
            onChange={e => setFilters(f => ({ ...f, mandateAgreed: e.target.value }))}
            style={{ marginLeft: '0.5rem', marginRight: '1rem' }}
          >
            {boolOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Privacy Agreed:
          <select
            value={filters.privacyAgreed}
            onChange={e => setFilters(f => ({ ...f, privacyAgreed: e.target.value }))}
            style={{ marginLeft: '0.5rem', marginRight: '1rem' }}
          >
            {boolOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>

        <label>
          Active:
          <select
            value={filters.active}
            onChange={e => setFilters(f => ({ ...f, active: e.target.value }))}
            style={{ marginLeft: '0.5rem' }}
          >
            {boolOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={exportToExcel}
          style={{
            marginRight: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#007bff',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Export to Excel
        </button>

        <button
          onClick={downloadEmails}
          style={{
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: '#17a2b8',
            color: 'white',
            cursor: 'pointer',
          }}
        >
          Download Filtered Emails
        </button>
      </div>

      <table
        border="1"
        cellPadding="6"
        style={{
          width: '100%',
          backgroundColor: '#111',
          color: 'white',
          borderCollapse: 'collapse',
          cursor: 'default',
        }}
      >
        <thead>
          <tr>
            {[
              { key: 'surname', label: 'Surname' },
              { key: 'given_name', label: 'Given Name' },
              { key: 'email', label: 'Email' },
              { key: 'phone', label: 'Phone' },
              { key: 'iban', label: 'IBAN' },
              { key: 'bic', label: 'BIC' },
              { key: 'bank_name', label: 'Bank Name' },
              { key: 'mandate_agreed', label: 'SEPA Mandate' },
              { key: 'privacy_agreed', label: 'Privacy Agreed' },
              { key: 'active', label: 'Active' },
              { key: 'actions', label: 'Actions' }
            ].map(({ key, label }) => (
              <th
                key={key}
                onClick={() => {
                  setSortBy(key)
                  setSortAsc(prev => (sortBy === key ? !prev : true))
                }}
                style={{ cursor: 'pointer', backgroundColor: '#222', userSelect: 'none' }}
              >
                {label} {sortBy === key ? (sortAsc ? '▲' : '▼') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row, i) => (
            <tr key={i} style={getRowStyle(row)}>
              <td>{row.surname}</td>
              <td>{row.given_name}</td>
              <td>{row.email}</td>
              <td>{row.phone}</td>
              <td>{row.sepa?.iban || ''}</td>
              <td>{row.sepa?.bic || ''}</td>
              <td>{row.sepa?.bank_name || ''}</td>
              <td>{String(row.sepa?.mandate_agreed)}</td>
              <td>{String(row.sepa?.privacy_agreed)}</td>
              <td>{String(row.active)}</td>
              <td>
                <button
                  onClick={() => toggleMemberStatus(row)}
                  style={{
                    padding: '0.25rem 0.5rem',
                    backgroundColor: row.active ? '#dc3545' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {row.active ? 'Set Inactive' : 'Set Active'}
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '1rem' }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
