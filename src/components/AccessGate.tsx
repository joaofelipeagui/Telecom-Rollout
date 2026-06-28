'use client'
import { useState, useEffect, useRef } from 'react'
import { Lock, Eye, EyeOff, Shield } from 'lucide-react'

const STORAGE_KEY = 'telecom_pm_access'

// Supports both a single code and a comma-separated list
// NEXT_PUBLIC_ACCESS_CODES = LOREAL2025,DEMO_CLIENT,INTERNAL01
// NEXT_PUBLIC_ACCESS_CODE  = DEMO2025  (fallback single code)
function getValidCodes(): string[] {
  const multi  = process.env.NEXT_PUBLIC_ACCESS_CODES ?? ''
  const single = process.env.NEXT_PUBLIC_ACCESS_CODE  ?? 'DEMO2025'
  const codes  = multi ? multi.split(',') : [single]
  return codes.map(c => c.trim().toUpperCase()).filter(Boolean)
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [granted,   setGranted]   = useState<boolean | null>(null)
  const [input,     setInput]     = useState('')
  const [showCode,  setShowCode]  = useState(false)
  const [error,     setError]     = useState(false)
  const [shaking,   setShaking]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    setGranted(stored === 'true')
  }, [])

  useEffect(() => {
    if (granted === false) setTimeout(() => inputRef.current?.focus(), 100)
  }, [granted])

  function attempt() {
    if (getValidCodes().includes(input.trim().toUpperCase())) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setGranted(true)
      setError(false)
    } else {
      setError(true)
      setShaking(true)
      setInput('')
      setTimeout(() => setShaking(false), 600)
    }
  }

  // Still checking localStorage
  if (granted === null) return null

  // Granted — render the app
  if (granted) return <>{children}</>

  // Gate screen
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Subtle grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className={`relative w-full max-w-sm ${shaking ? 'animate-[shake_0.5s_ease]' : ''}`}>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/60">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/60 border border-blue-800/50 flex items-center justify-center">
              <Shield className="w-7 h-7 text-blue-400" />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-lg font-bold text-white mb-1">Telecom Rollout PM</h1>
            <p className="text-sm text-gray-400">Enter your access code to continue</p>
          </div>

          {/* Input */}
          <div className="space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                ref={inputRef}
                type={showCode ? 'text' : 'password'}
                value={input}
                onChange={e => { setInput(e.target.value); setError(false) }}
                onKeyDown={e => e.key === 'Enter' && attempt()}
                placeholder="Access code"
                className={`w-full pl-9 pr-10 py-2.5 rounded-lg bg-gray-800 border text-sm text-white placeholder:text-gray-600 outline-none transition-colors ${
                  error ? 'border-red-600 focus:border-red-500' : 'border-gray-700 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCode(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-red-400 text-center">Incorrect access code — please try again</p>
            )}

            <button
              onClick={attempt}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm font-semibold text-white transition-colors"
            >
              Enter
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-gray-600 mt-5">
            Contact the project owner to request access
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0) }
          20%      { transform: translateX(-8px) }
          40%      { transform: translateX(8px) }
          60%      { transform: translateX(-6px) }
          80%      { transform: translateX(6px) }
        }
      `}</style>
    </div>
  )
}
