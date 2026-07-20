'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function signInWithMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: '#0d0d0d' }}
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1
            className="text-5xl tracking-widest mb-1"
            style={{ color: '#e8ff47' }}
          >
            POWER + PACE
          </h1>
          <p style={{ color: '#666666', fontSize: '0.75rem' }}>
            training tracker
          </p>
        </div>

        {sent ? (
          <div
            className="text-center text-sm p-4 rounded border"
            style={{
              color: '#4aff91',
              borderColor: '#4aff91',
              backgroundColor: 'rgba(74,255,145,0.05)',
            }}
          >
            Check your email for a magic link.
          </div>
        ) : (
          <div className="space-y-4">
            <Button
              onClick={signInWithGoogle}
              className="w-full h-12"
              style={{
                backgroundColor: '#181818',
                color: '#d0d0d0',
                border: '1px solid #181818',
                  fontSize: '0.8rem',
              }}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ backgroundColor: '#181818' }} />
              <span style={{ color: '#666666', fontSize: '0.7rem' }}>
                or
              </span>
              <div className="flex-1 h-px" style={{ backgroundColor: '#181818' }} />
            </div>

            <form onSubmit={signInWithMagicLink} className="space-y-3">
              <div className="space-y-1">
                <Label
                  htmlFor="email"
                  style={{ color: '#666666', fontSize: '0.7rem' }}
                >
                  email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="h-12"
                  style={{
                    backgroundColor: '#0f0f0f',
                    border: '1px solid #181818',
                    color: '#d0d0d0',
                          fontSize: '0.85rem',
                  }}
                />
              </div>
              {error && (
                <p style={{ color: '#ff6b47', fontSize: '0.7rem' }}>
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12"
                style={{
                  backgroundColor: '#e8ff47',
                  color: '#000',
                      fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {loading ? 'sending...' : 'send magic link'}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
