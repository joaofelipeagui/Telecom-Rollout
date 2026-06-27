'use client'
import { useState, useCallback, createContext, useContext, ReactNode, useEffect } from 'react'
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: string; message: string; type: ToastType }
type ToastFn = (message: string, type?: ToastType) => void

// Module-level emitter so toast() works outside React tree
type Listener = (msg: string, type: ToastType) => void
let _listener: Listener | null = null
export function toast(message: string, type: ToastType = 'success') {
  _listener?.(message, type)
}

const ToastContext = createContext<ToastFn>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback<ToastFn>((message, type = 'success') => {
    const id = `${Date.now()}_${Math.random()}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  // Register module-level listener
  useEffect(() => { _listener = add; return () => { _listener = null } }, [add])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium
              ${t.type === 'success' ? 'bg-[#0a1f10] border-green-800/60 text-green-300' :
                t.type === 'error'   ? 'bg-[#1f0a0a] border-red-800/60 text-red-300' :
                                       'bg-[#0a1420] border-blue-800/60 text-blue-300'}`}>
            {t.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> :
             t.type === 'error'   ? <AlertTriangle className="w-4 h-4 flex-shrink-0" /> :
                                    <Info className="w-4 h-4 flex-shrink-0" />}
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="ml-1 opacity-50 hover:opacity-100 transition-opacity">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
