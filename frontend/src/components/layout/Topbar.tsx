import { useEffect, useState } from 'react'
import { Menu, Server, Signal } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { getPageTitle } from '../../config/navigation'
import { clusterApi } from '../../services/api'
import { useNamespace } from '../../context/NamespaceContext'

interface TopbarProps {
  onMenuClick: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const { pathname } = useLocation()
  const pageTitle = getPageTitle(pathname)
  const [apiOnline, setApiOnline] = useState<boolean | null>(null)
  const { namespace, setNamespace, namespaces, namespacesLoading, namespacesError } = useNamespace()

  useEffect(() => {
    let active = true
    const checkConnection = async () => {
      try {
        await clusterApi.getOverview()
        if (active) setApiOnline(true)
      } catch {
        if (active) setApiOnline(false)
      }
    }

    void checkConnection()
    const timer = window.setInterval(() => void checkConnection(), 15000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const statusLabel = apiOnline === null ? 'Checking' : apiOnline ? 'Connected' : 'Unavailable'
  const statusColor = apiOnline ? 'text-emerald-300' : apiOnline === false ? 'text-rose-300' : 'text-amber-300'
  const statusBorder = apiOnline ? 'border-emerald-400/20 bg-emerald-400/[0.06]' : apiOnline === false ? 'border-rose-400/20 bg-rose-400/[0.06]' : 'border-amber-400/20 bg-amber-400/[0.06]'

  return (
    <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-white/[0.07] bg-[#080d18]/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" aria-label="Open navigation menu" onClick={onMenuClick} className="rounded-lg border border-white/10 p-2 text-slate-400 hover:bg-white/5 hover:text-slate-100 lg:hidden">
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{pageTitle}</p>
          <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">Kubernetes operations workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <label className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-slate-400 sm:flex">
          Namespace
          <select aria-label="Global namespace filter" value={namespace} onChange={event => setNamespace(event.target.value)} disabled={namespacesLoading || Boolean(namespacesError)} className="max-w-36 bg-transparent text-slate-200 outline-none disabled:opacity-50">
            <option value="">All namespaces</option>
            {namespaces.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 md:flex">
          <Server size={14} className="text-slate-500" />
          <span className="text-xs text-slate-300">Cluster API</span>
          <span className={`ml-1 rounded-md px-1.5 py-0.5 text-[10px] ${statusColor} ${statusBorder}`}>{statusLabel}</span>
        </div>

        <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 sm:px-3 ${statusBorder}`}>
          <Signal size={14} className={statusColor} />
          <span className={`hidden text-[11px] font-medium sm:inline ${statusColor}`}>API {apiOnline === null ? 'checking' : apiOnline ? 'online' : 'offline'}</span>
          <span className={`text-[11px] font-medium sm:hidden ${statusColor}`}>{apiOnline ? 'Online' : apiOnline === false ? 'Offline' : '...'}</span>
        </div>

        <div className="hidden h-8 w-px bg-white/[0.08] sm:block" />
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/10 text-[11px] font-semibold text-cyan-100" aria-label="KubePilot user" title="KubePilot">KP</div>
      </div>
    </header>
  )
}
