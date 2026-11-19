import { Boxes, ChevronRight, Server, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { navigationItems } from '../../config/navigation'

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const workspaceItems = navigationItems.filter((item) => item.group === 'workspace')
  const observeItems = navigationItems.filter((item) => item.group === 'observe')

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-white/[0.07] bg-[#0b1220] transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-[76px] items-center justify-between border-b border-white/[0.07] px-5">
          <NavLink to="/" className="flex items-center gap-3" onClick={onClose}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
              <Boxes size={20} strokeWidth={2.2} />
            </span>
            <span>
              <span className="block text-[15px] font-semibold tracking-[0.02em] text-slate-100">
                KubePilot
              </span>
              <span className="mt-0.5 block text-[10px] font-medium uppercase tracking-[0.19em] text-slate-500">
                Cluster operations
              </span>
            </span>
          </NavLink>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-slate-200 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 space-y-7 overflow-y-auto px-3 py-6">
          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Workspace
            </p>
            <div className="space-y-1">
              {workspaceItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-400/[0.11] text-cyan-200 ring-1 ring-inset ring-cyan-300/15'
                          : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight
                      size={14}
                      className="text-slate-600 opacity-0 transition-opacity group-[.active]:opacity-100"
                    />
                  </NavLink>
                )
              })}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
              Observe
            </p>
            <div className="space-y-1">
              {observeItems.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                        isActive
                          ? 'bg-cyan-400/[0.11] text-cyan-200 ring-1 ring-inset ring-cyan-300/15'
                          : 'text-slate-400 hover:bg-white/[0.045] hover:text-slate-100'
                      }`
                    }
                  >
                    <Icon size={17} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/[0.07] p-4">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
              <Server size={14} className="text-cyan-300" />
              Cluster workspace
            </div>
            <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
              Live Kubernetes resources are discovered through the KubePilot backend.
            </p>
          </div>
          <p className="mt-4 px-1 text-[10px] text-slate-600">KubePilot · Cluster operations</p>
        </div>
      </aside>
    </>
  )
}
