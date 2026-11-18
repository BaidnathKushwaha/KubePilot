import { Menu, RefreshCw, Server, Signal } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { getPageTitle } from '../../config/navigation'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080d18]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          aria-label="Open navigation menu"
          onClick={onMenuClick}
          className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 lg:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{pageTitle}</p>
          <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
            Kubernetes operations workspace
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 md:flex">
          <Server size={14} className="text-slate-500" />
          <span className="text-xs text-slate-300">Cluster context</span>
          <span className="ml-1 rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[10px] text-slate-400">
            Not connected
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.06] px-2.5 py-2 sm:px-3">
          <Signal size={14} className="text-amber-300" />
          <span className="hidden text-[11px] font-medium text-amber-200 sm:inline">
            API integration pending
          </span>
          <span className="text-[11px] font-medium text-amber-200 sm:hidden">Offline</span>
        </div>

        <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[11px] font-semibold text-cyan-100"
          aria-label="KubePilot user"
          title="KubePilot"
        >
          KP
        </div>
      </div>
    </header>
  )
}
