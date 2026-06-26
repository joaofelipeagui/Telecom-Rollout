'use client'
import { useState } from 'react'
import { UserRole, UserProfile, ROLE_LABELS, ROLE_COLORS, ROLE_DESCRIPTIONS } from '@/lib/types'
import { setCurrentUser } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network, Zap, MapPin, Radio, Briefcase, BarChart3, Globe, ChevronRight } from 'lucide-react'

const ROLE_ICONS: Record<UserRole, React.ReactNode> = {
  program_manager: <Briefcase className="w-5 h-5" />,
  field_engineer: <MapPin className="w-5 h-5" />,
  sdwan_engineer: <Radio className="w-5 h-5" />,
  telco_engineer: <Zap className="w-5 h-5" />,
  solutions_manager: <Globe className="w-5 h-5" />,
  solutions_director: <BarChart3 className="w-5 h-5" />,
}

interface Props {
  onEnter: (user: UserProfile) => void
}

export function RolePicker({ onEnter }: Props) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<UserRole | null>(null)

  function handleEnter() {
    if (!name.trim() || !selected) return
    const user: UserProfile = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      role: selected,
    }
    setCurrentUser(user)
    onEnter(user)
  }

  const roles = Object.keys(ROLE_LABELS) as UserRole[]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
            <Network className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Telecom Rollout PM</h1>
            <p className="text-xs text-gray-400">AI-powered network deployment</p>
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-lg font-semibold text-white mb-1">Who are you?</h2>
          <p className="text-sm text-gray-400 mb-6">Your role determines your view and capabilities.</p>

          {/* Name */}
          <div className="mb-6">
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-base h-11"
              onKeyDown={e => e.key === 'Enter' && handleEnter()}
            />
          </div>

          {/* Role grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {roles.map(role => {
              const isSelected = selected === role
              return (
                <button
                  key={role}
                  onClick={() => setSelected(role)}
                  className={`text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/40'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 rounded-lg ${ROLE_COLORS[role]} flex items-center justify-center text-white`}>
                      {ROLE_ICONS[role]}
                    </div>
                    <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                      {ROLE_LABELS[role]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {ROLE_DESCRIPTIONS[role]}
                  </p>
                </button>
              )
            })}
          </div>

          <Button
            onClick={handleEnter}
            disabled={!name.trim() || !selected}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-base"
          >
            Enter <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}
