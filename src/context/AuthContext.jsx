import { createContext, useContext, useState, useEffect } from 'react'
import { login as dbLogin, logout as dbLogout, getSession, register as dbRegister } from '../lib/db.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getSession())
    setLoading(false)
  }, [])

  async function login(email, password) {
    const session = await dbLogin(email, password)
    setUser(session)
    return session
  }

  async function register(data) {
    const session = await dbRegister(data)
    setUser(session)
    return session
  }

  function logout() {
    dbLogout()
    setUser(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
