import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

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

  // Filter helper function
  function filterRow(row) {
    const { search, mandateAgreed, privacyAgreed, active } = filters

    // Text search on all string fields
    const text = `${row.surname} ${row.given_name} ${row.email} ${row.phone} ${row.sepa.iban || ''} ${row.sepa.bic || ''} ${row.sepa.bank_name || ''}`.toLowerCase()
    if (search && !text.includes(search.toLowerCase())) return false

    // Filter by mandateAgreed (expects 'true' or 'false' or '')
    if (mandateAgreed !== '') {
      const val = String(row.sepa.mandate_agreed)
      if (val !== mandateAgreed) return false
    }

    // Filter by privacyAgreed
    if (privacyAgreed !== '') {
      const val = String(row.sepa.privacy_agreed)
      if (val !== privacyAgreed) return false
    }

    // Filter by active (members.active is probably boolean or string)
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

  // Options for filtering
  const boolOptions = [
    { label: 'All', value: '' },
    { label: 'Yes', value: 'true' },
    { label: 'No', value: 'false' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '2rem', color: 'white', backgroundColor: 'black' }}>
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
            <tr key={i}>
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
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', padding: '1rem' }}>
                No records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
