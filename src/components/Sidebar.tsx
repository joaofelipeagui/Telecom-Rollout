'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserProfile, ROLE_COLORS, ROLE_LABELS } from '@/lib/types'
import { clearCurrentUser } from '@/lib/user'
import { Network, Globe, LayoutDashboard, Radio, Package, Bot, LogOut, ChevronRight } from 'lucide-react'

const NAV = [
  { href: '/', icon: Globe, label: 'Projects' },
]

interface Props {
  user: UserProfile
  onLogout: () => void
  projectId?: string
}

export function Sidebar({ user, onLogout, projectId }: Props) {
  const pathname = usePathname()

  const projectNav = projectId ? [
    { href: `/projects/${projectId}`, icon: LayoutDashboard, label: 'Overview' },
    { href: `/projects/${projectId}/dia`, icon: Radio, label: 'DIA / Connectivity' },
    { href: `/projects/${projectId}/logistics`, icon: Package, label: 'Device Logistics' },
    { href: `/projects/${projectId}/ai`, icon: Bot, label: 'AI Assistant' },
  ] : []

  const allNav = [...NAV, ...projectNav]

  return (
    <div className="w-16 hover:w-52 group transition-all duration-200 flex-shrink-0 bg-[#070d16] border-r border-blue-950/60 flex flex-col h-screen sticky top-0 overflow-hidden" style={{boxShadow:'4px 0 24px rgba(0,0,0,0.4)'}}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
          <Network className="w-5 h-5 text-white" />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap overflow-hidden">
          <p className="text-sm font-bold text-white">Telecom PM</p>
          <p className="text-xs text-gray-400">LATAM Rollout</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {allNav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-all ${
                active
                  ? 'bg-blue-600/20 text-blue-300 sidebar-active-glow'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
              }`}>
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                {label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-800 p-2">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className={`w-8 h-8 rounded-full ${ROLE_COLORS[user.role]} flex items-center justify-center text-white text-sm font-bold flex-shrink-0`}>
            {user.name[0].toUpperCase()}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[user.role]}</p>
          </div>
          <button onClick={onLogout}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 flex-shrink-0">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
