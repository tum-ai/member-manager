import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    console.log(isLogin ? 'Logging in...' : 'Registering...', { email, password })

    const fn = isLogin ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { data, error } = await fn({ email, password })

    console.log('Auth result:', { data, error })

    if (error) {
      setMessage(error.message)
    } else {
      if (isLogin) {
        const user = data.user || data.session?.user
        if (user?.email === 'legal-finance@tum-ai.com') {
          onLogin({ ...user, role: 'admin' }) //can access ibans and so on
        } else {
          onLogin({ ...user, role: 'user' })
        }
      } 
    }
  }

  return (
    <div
      style={{
        backgroundColor: 'black',
        color: 'white',
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '2rem',
      }}
    >
      <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        {/* Logo */}
        <img
          src="/img/logo.webp"
          alt="TUM.ai Logo"
          style={{ width: '120px', marginBottom: '2rem' }}
        />

        <h2>{isLogin ? 'Login' : 'Register'}</h2>

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: '#222',
              color: 'white',
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              backgroundColor: '#222',
              color: 'white',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#001f3f',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>

        {message && (
          <p style={{ color: 'red', marginTop: '1rem' }}>{message}</p>
        )}

        <button
          onClick={() => setIsLogin(!isLogin)}
          style={{
            marginTop: '1rem',
            background: 'none',
            border: 'none',
            color: '#00aaff',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
            fontSize: '1rem',
          }}
        >
          {isLogin ? 'Need to register?' : 'Have an account? Login'}
        </button>
      </div>
    </div>
  )
}
