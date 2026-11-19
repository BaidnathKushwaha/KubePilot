import { X } from 'lucide-react'
import { StatusBadge } from './StatusBadge'

interface ResourceDetailsPanelProps {
  type: string
  name: string
  status?: string | null
  fields: Array<{ label: string; value: string | number | null | undefined }>
  onClose: () => void
}

export function ResourceDetailsPanel({ type, name, status, fields, onClose }: ResourceDetailsPanelProps) {
  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/55 backdrop-blur-[2px]" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside role="dialog" aria-modal="true" aria-label={type + ' details'} className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#0d1523] p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] pb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">{type} details</p>
            <h2 className="mt-2 break-all text-lg font-semibold text-white">{name}</h2>
            {status && <div className="mt-2"><StatusBadge status={status} /></div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close details" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={18}/></button>
        </div>
        <dl className="mt-5 space-y-4">
          {fields.map(field => <div key={field.label} className="border-b border-white/[0.05] pb-3">
            <dt className="text-[11px] text-slate-500">{field.label}</dt>
            <dd className="mt-1 break-all text-sm text-slate-200">{field.value === null || field.value === undefined || field.value === '' ? 'Not available' : String(field.value)}</dd>
          </div>)}
        </dl>
      </aside>
    </div>
  )
}
