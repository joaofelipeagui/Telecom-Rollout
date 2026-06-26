'use client'
import { UserProfile } from './types'

const KEY = 'telecom_pm_user'

export function getCurrentUser(): UserProfile | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setCurrentUser(user: UserProfile) {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(user))
}

export function clearCurrentUser() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}
