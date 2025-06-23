import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [message, setMessage] = useState('')

  // Create or check member after login
  async function handlePostLogin(user) {
    try {
      const { data: existingMember, error: fetchError } = await supabase
        .from('members')
        .select('user_id')
        .eq('user_id', user.id)
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error checking member:', fetchError)
        setMessage('Error verifying user profile. Please try again later.')
        return
      }

      if (!existingMember) {
        const { error: insertError } = await supabase.from('members').insert({
          user_id: user.id,
          email: user.email,
          given_name: '',
          surname: '',
          date_of_birth: '1900-01-01',
          street: '',
          number: '',
          postal_code: '',
          city: '',
          country: '',
          active: true,
          salutation: '',
          role: 'user',
        })

        if (insertError) {
          console.error('Error inserting member:', insertError)
          setMessage('Failed to create user profile.')
          return
        }
      }

      const { data: memberData, error: roleError } = await supabase
        .from('members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (roleError) {
        console.error('Error fetching role:', roleError)
        setMessage('Failed to retrieve user role.')
        return
      }

      const role = memberData?.role || 'user'
      onLogin({ ...user, role })
    } catch (err) {
      console.error('Unexpected error in post-login:', err)
      setMessage('Unexpected error occurred. Please try again.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setMessage('')
    console.log(isLogin ? 'Logging in...' : 'Registering...', { email, password })

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
          setMessage(error.message)
          return
        }

        const user = data.user || data.session?.user
        if (!user) {
          setMessage('Login failed. No user returned.')
          return
        }

        await handlePostLogin(user)
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`, // optional, can point to a login page or landing page
          },
        })

        if (error) {
          setMessage(error.message)
          return
        }

        // Don't insert into `members` yet – wait until user confirms and logs in
        setMessage(
          'Registration successful. Please check your email to confirm your address before logging in.'
        )
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setMessage('An unexpected error occurred.')
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
