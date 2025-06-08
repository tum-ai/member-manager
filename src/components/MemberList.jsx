import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function MemberList() {
  const [members, setMembers] = useState([])

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase.from('members').select('*')
      console.log('Fetched members:', data, 'Error:', error)
      if (!error) setMembers(data)
    }
    fetchMembers()
  }, [])


  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Current Members</h2>
      <ul className="space-y-1">
        {members.map(m => (
          <li key={m.id} className="border p-2 rounded">
            {m.name} – {m.email}
          </li>
        ))}
      </ul>
    </div>
  )
}