import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { clearBizCache } from '../lib/db.js'

const AuthContext = createContext(null)

async function fetchProfile(userId) {
  const timeout = new Promise(resolve => setTimeout(resolve, 5000, null))
  const query = supabase.from('profiles').select('*').eq('id', userId).single()
    .then(({ data }) => data)
  return Promise.race([query, timeout])
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile ? { ...profile, email: session.user.email } : null)
      }
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearBizCache()
        setUser(null)
      } else if (session?.user) {
        const profile = await fetchProfile(session.user.id)
        setUser(profile ? { ...profile, email: session.user.email } : null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    const profile = await fetchProfile(data.user.id)
    if (!profile) return null  // caller redirects to signup to complete setup
    const u = { ...profile, email: data.user.email }
    setUser(u)
    return u
  }

  async function logout() {
    clearBizCache()
    await supabase.auth.signOut()
    setUser(null)
  }

  async function refreshUser() {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    const profile = await fetchProfile(authUser.id)
    if (profile) setUser({ ...profile, email: authUser.email })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 text-sm">Loading…</p>
      </div>
    )
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
