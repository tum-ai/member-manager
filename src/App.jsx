import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'

import Auth from './pages/Auth'
import MemberForm from './pages/MemberForm'
import SepaMandate from './pages/SepaMandate'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Certificate from './pages/Certificate'
import AdminDatabaseView from './pages/AdminDatabaseView'

const dummyUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'debug@example.com',
}


export default function App() {
  const isDev = import.meta.env.MODE === 'development'
  const [user, setUser] = useState(isDev ? dummyUser : null)
  const [loading, setLoading] = useState(!isDev)
  const [userRole, setUserRole] = useState(null)

  useEffect(() => {
    if (!isDev) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null)
        setLoading(false)
      })

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null)
      })

      return () => {
        listener.subscription.unsubscribe()
      }
    }
  }, [])

  useEffect(() => {
    if (user) {
      // Fetch the role from the user_roles table
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          if (data) setUserRole(data.role)
          else setUserRole(null)
        })
    } else {
      setUserRole(null)
    }
  }, [user])

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) return <div style={{ color: 'white', backgroundColor: 'black', minHeight: '100vh' }}>Loading...</div>
  
  if (!user) return <Auth onLogin={setUser} />

  return (
    <Router>
      <nav
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '1rem',
          background: ' #3c00b4  ',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', gap: '2rem' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>
            Member Form
          </Link>
          <Link to="/sepa" style={{ color: 'white', textDecoration: 'none' }}>
            SEPA
          </Link>
          <Link to="/privacy" style={{ color: 'white', textDecoration: 'none' }}>
            Privacy Policy
          </Link>
          <Link to="/certificate" style={{ color: 'white', textDecoration: 'none' }}>
            Certificate
          </Link>
          {userRole === 'admin' && (
            <Link to="/admin" style={{ color: 'white', textDecoration: 'none' }}>
              Admin
            </Link>
          )}
        </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <Link
          to="#"
          onClick={(e) => {
            e.preventDefault()
            handleLogout()
          }}
          style={{ color: 'white', cursor: 'pointer', textDecoration: 'none' }}
        >
          Logout
        </Link>
        <img
          src="/img/logo.webp"
          alt="Logo"
          style={{ height: '30px' }}
        />
      </div>

      </nav>


      <div style={{ backgroundColor: 'black', color: 'white', minHeight: '100vh', padding: '1rem' }}>
        <Routes>
          <Route path="/" element={<MemberForm user={user} />} />
          <Route path="/sepa" element={<SepaMandate />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/certificate" element={<Certificate user={user} />} />
          {userRole === 'admin' && (
            <Route path="/admin" element={<AdminDatabaseView />} />
          )}
        </Routes>
      </div>
    </Router>
  )
}
