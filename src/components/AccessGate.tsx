'use client'
import { useState, useEffect, useRef } from 'react'
import { Lock, Eye, EyeOff, Shield, Mail, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'

const STORAGE_KEY = 'telecom_pm_access'

function getValidCodes(): string[] {
  const multi  = process.env.NEXT_PUBLIC_ACCESS_CODES ?? ''
  const single = process.env.NEXT_PUBLIC_ACCESS_CODE  ?? 'DEMO2025'
  const codes  = multi ? multi.split(',') : [single]
  return codes.map(c => c.trim().toUpperCase()).filter(Boolean)
}

export function AccessGate({ children }: { children: React.ReactNode }) {
  const [granted,  setGranted]  = useState<boolean | null>(null)
  const [view,     setView]     = useState<'code' | 'request' | 'sent'>('code')

  // Code entry state
  const [input,    setInput]    = useState('')
  const [showCode, setShowCode] = useState(false)
  const [error,    setError]    = useState(false)
  const [shaking,  setShaking]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Request form state
  const [reqName,    setReqName]    = useState('')
  const [reqEmail,   setReqEmail]   = useState('')
  const [reqMessage, setReqMessage] = useState('')
  const [sending,    setSending]    = useState(false)
  const [sendError,  setSendError]  = useState('')

  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    setGranted(stored === 'true')
  }, [])

  useEffect(() => {
    if (granted === false && view === 'code') setTimeout(() => inputRef.current?.focus(), 100)
  }, [granted, view])

  function attempt() {
    if (getValidCodes().includes(input.trim().toUpperCase())) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setGranted(true)
    } else {
      setError(true)
      setShaking(true)
      setInput('')
      setTimeout(() => setShaking(false), 600)
    }
  }

  async function sendRequest() {
    if (!reqName.trim() || !reqEmail.trim()) { setSendError('Please fill in your name and email.'); return }
    setSending(true)
    setSendError('')
    try {
      const res = await fetch('/api/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: reqName, email: reqEmail, message: reqMessage }),
      })
      if (!res.ok) throw new Error('Failed to send')
      setView('sent')
    } catch {
      setSendError('Could not send request. Please try again.')
    } finally {
      setSending(false)
    }
  }

  if (granted === null) return null
  if (granted) return <>{children}</>

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className={`relative w-full max-w-sm ${shaking ? 'animate-[shake_0.5s_ease]' : ''}`}>
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl shadow-black/60">

          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-colors ${
              view === 'sent' ? 'bg-green-950/60 border-green-800/50' : 'bg-blue-950/60 border-blue-800/50'
            }`}>
              {view === 'sent'
                ? <CheckCircle className="w-7 h-7 text-green-400" />
                : view === 'request'
                ? <Mail className="w-7 h-7 text-blue-400" />
                : <Shield className="w-7 h-7 text-blue-400" />
              }
            </div>
          </div>

          {/* ── Code entry ── */}
          {view === 'code' && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-lg font-bold text-white mb-1">Telecom Rollout PM</h1>
                <p className="text-sm text-gray-400">Enter your access code to continue</p>
              </div>
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
                  <button type="button" onClick={() => setShowCode(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors">
                    {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {error && <p className="text-xs text-red-400 text-center">Incorrect access code — please try again</p>}
                <button onClick={attempt}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-sm font-semibold text-white transition-colors">
                  Enter
                </button>
              </div>
              <div className="mt-5 pt-4 border-t border-gray-800 text-center">
                <p className="text-xs text-gray-500 mb-2">Don't have a code?</p>
                <button onClick={() => setView('request')}
                  className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                  Request access →
                </button>
              </div>
            </>
          )}

          {/* ── Request form ── */}
          {view === 'request' && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-lg font-bold text-white mb-1">Request Access</h1>
                <p className="text-sm text-gray-400">Fill in your details and the owner will send you a code</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text" placeholder="Your name" value={reqName}
                  onChange={e => { setReqName(e.target.value); setSendError('') }}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
                <input
                  type="email" placeholder="Your email" value={reqEmail}
                  onChange={e => { setReqEmail(e.target.value); setSendError('') }}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 text-sm text-white placeholder:text-gray-600 outline-none transition-colors"
                />
                <textarea
                  placeholder="Message (optional)" value={reqMessage}
                  onChange={e => setReqMessage(e.target.value)} rows={2}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-800 border border-gray-700 focus:border-blue-500 text-sm text-white placeholder:text-gray-600 outline-none transition-colors resize-none"
                />
                {sendError && <p className="text-xs text-red-400">{sendError}</p>}
                <button onClick={sendRequest} disabled={sending}
                  className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
                  {sending ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : 'Send Request'}
                </button>
                <button onClick={() => setView('code')}
                  className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors pt-1">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to access code
                </button>
              </div>
            </>
          )}

          {/* ── Sent confirmation ── */}
          {view === 'sent' && (
            <>
              <div className="text-center mb-6">
                <h1 className="text-lg font-bold text-white mb-1">Request Sent!</h1>
                <p className="text-sm text-gray-400">The project owner has been notified and will send your access code shortly.</p>
              </div>
              <button onClick={() => setView('code')}
                className="w-full py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium text-gray-300 transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to access code
              </button>
            </>
          )}

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
