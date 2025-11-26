import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

interface SepaFormData {
  member_id: string;
  iban: string;
  bic: string;
  mandate_agreed: boolean;
}

export default function SepaForm() {
  const [form, setForm] = useState<SepaFormData>({ member_id: '', iban: '', bic: '', mandate_agreed: false })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('sepa_mandates').insert([form])
    if (error) alert('Error: ' + error.message)
    else alert('SEPA info added successfully!')
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-2">
      <input name="member_id" placeholder="Member ID" className="border p-2 w-full" value={form.member_id} onChange={handleChange} required />
      <input name="iban" placeholder="IBAN" className="border p-2 w-full" value={form.iban} onChange={handleChange} required />
      <input name="bic" placeholder="BIC" className="border p-2 w-full" value={form.bic} onChange={handleChange} required />
      <label className="block"><input type="checkbox" name="mandate_agreed" checked={form.mandate_agreed} onChange={handleChange} /> I agree to SEPA mandate</label>
      <button className="bg-green-600 text-white px-4 py-2 rounded" type="submit">Save SEPA Info</button>
    </form>
  )
}
