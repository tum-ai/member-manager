import React, { useEffect, useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'

import Auth from './pages/Auth'
import MemberForm from './pages/MemberForm'
import Certificate from './pages/Certificate'
import AdminDatabaseView from './pages/AdminDatabaseView'

import SepaMandate from './pages/SepaMandate'
import PrivacyPolicy from './pages/PrivacyPolicy'

const dummyUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'debug@example.com',
  role: 'user',
}

// Simple reusable Modal
function Modal({ title, onClose, onConfirm, confirmDisabled, children }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
        padding: '1rem'
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          color: 'black',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '2rem',
          borderRadius: '8px',
          position: 'relative'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            fontSize: '1.5rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
        <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
          <button
            onClick={onConfirm}
            disabled={confirmDisabled}
            style={{
              backgroundColor: confirmDisabled ? '#aaa' : '#3c00b4',
              color: 'white',
              padding: '0.5rem 1rem',
              border: 'none',
              borderRadius: '4px',
              cursor: confirmDisabled ? 'not-allowed' : 'pointer'
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const isDev = import.meta.env.MODE === 'development'
  const [user, setUser] = useState(isDev ? dummyUser : null)
  const [loading, setLoading] = useState(!isDev)

  const [showSepa, setShowSepa] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)

  const [sepaChecked, setSepaChecked] = useState(false)
  const [privacyChecked, setPrivacyChecked] = useState(false)

  useEffect(() => {
    const handleOpenSepa = () => setShowSepa(true)
    const handleOpenPrivacy = () => setShowPrivacy(true)

    window.addEventListener('open-sepa', handleOpenSepa)
    window.addEventListener('open-privacy', handleOpenPrivacy)

    return () => {
      window.removeEventListener('open-sepa', handleOpenSepa)
      window.removeEventListener('open-privacy', handleOpenPrivacy)
    }
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

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) return <div style={{ color: 'white', backgroundColor: 'black', minHeight: '100vh' }}>Loading...</div>
  if (!user) return <Auth onLogin={setUser} />
  if (user.role === 'admin') return <AdminDatabaseView />

  return (
    <Router>
      <nav style={{ display: 'flex', alignItems: 'center', padding: '1rem', background: '#3c00b4', color: 'white' }}>
        <div style={{ display: 'flex', gap: '2rem' }}>
          <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Member Form</Link>
          <a href="#" onClick={() => setShowSepa(true)} style={{ color: 'white', textDecoration: 'none' }}>SEPA</a>
          <a href="#" onClick={() => setShowPrivacy(true)} style={{ color: 'white', textDecoration: 'none' }}>Privacy Policy</a>
          <Link to="/certificate" style={{ color: 'white', textDecoration: 'none' }}>Certificate</Link>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handleLogout()
            }}
            style={{ color: 'white', textDecoration: 'none', cursor: 'pointer' }}
          >
            Logout
          </a>
          <img src="/img/logo.webp" alt="Logo" style={{ height: '30px' }} />
        </div>
      </nav>

      <div style={{ backgroundColor: 'black', color: 'white', minHeight: '100vh', padding: '1rem' }}>
        <Routes>
          <Route path="/" element={<MemberForm user={user} />} />
          <Route path="/certificate" element={<Certificate user={user} />} />
        </Routes>
      </div>

      {/* SEPA Modal */}
      {showSepa && (
        <Modal
          title="SEPA Mandate"
          onClose={() => setShowSepa(false)}
          onConfirm={() => setShowSepa(false)}
          confirmDisabled={!sepaChecked}
        >
          <SepaMandate onCheckChange={setSepaChecked} />
        </Modal>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <Modal
          title="Privacy Policy"
          onClose={() => setShowPrivacy(false)}
          onConfirm={() => setShowPrivacy(false)}
          confirmDisabled={!privacyChecked}
        >
          <PrivacyPolicy onCheckChange={setPrivacyChecked} />
        </Modal>
      )}
    </Router>
  )
}
