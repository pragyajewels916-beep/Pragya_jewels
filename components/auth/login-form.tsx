'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

interface LoginFormProps {
  onLogin: (username: string, role: 'admin' | 'staff') => void
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Authenticate with Supabase
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      // Store user data in sessionStorage for now (can be improved with proper session management)
      const userData = {
        id: data.user.id,
        username: data.user.username,
        role: data.user.role,
        staff_code: data.user.staff_code,
      }
      sessionStorage.setItem('user', JSON.stringify(userData))

      // Also store in Supabase session if needed
      const supabase = createClient()
      // Note: For custom auth, you might want to use a different approach
      // This is a simplified version

      onLogin(userData.username, userData.role as 'admin' | 'staff')
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-secondary flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-primary/20">
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-primary rounded-lg mx-auto mb-4 flex items-center justify-center text-white font-bold text-xl">
              J
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Jewelry ERP</h1>
            <p className="text-muted-foreground">Management System</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Username
              </label>
              <Input
                type="text"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Password
              </label>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-2 mt-6 disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>

          {/* Info */}
          <div className="mt-6 p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
            <p className="font-medium mb-1">Note:</p>
            <p>Use your database credentials to login</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
