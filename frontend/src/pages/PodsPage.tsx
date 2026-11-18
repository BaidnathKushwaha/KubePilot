import { useCallback, useEffect, useMemo, useState } from 'react'
import { Boxes, RefreshCw, Search } from 'lucide-react'
import { RequestState } from '../components/dashboard/RequestState'
import { StatusBadge } from '../components/dashboard/StatusBadge'
import { clusterApi } from '../services/api'
import type { KubernetesPod } from '../types/cluster'

export function PodsPage() {
  const [pods, setPods] = useState<KubernetesPod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const loadPods = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      setPods(await clusterApi.getPods(signal))
    } catch (cause) {
      if (cause instanceof Error && cause.name === 'AbortError') return
      setError(cause instanceof Error ? cause.message : 'Unexpected error while loading pods')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void loadPods(controller.signal)
    return () => controller.abort()
  }, [loadPods])

  const filteredPods = useMemo(() => pods.filter((pod) =>
    [pod.name, pod.namespace, pod.status, pod.nodeName ?? '', pod.podIP ?? '']
      .some((value) => value.toLowerCase().includes(search.toLowerCase())),
  ), [pods, search])

  return (
    <div className="space-y-7">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Workspace / Workloads</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">Pods</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Pod inventory across all namespaces in the current cluster.</p>
        </div>
        <button type="button" onClick={() => void loadPods()} disabled={loading} className="inline-flex items-center gap-2 self-start rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50 sm:self-auto"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </section>

      <RequestState loading={loading && pods.length === 0} error={error && pods.length === 0 ? error : null} onRetry={() => void loadPods()}>
        <section className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">
          <div className="flex flex-col gap-3 border-b border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2"><Boxes size={16} className="text-cyan-200" /><h2 className="text-sm font-semibold text-slate-100">Cluster pods</h2><span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-slate-400">{pods.length} total</span></div>
            <label className="relative block sm:w-64"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pods..." className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></label>
          </div>
          {error && <p role="status" className="px-4 py-2 text-xs text-amber-300">Refresh failed: {error}. Showing previously loaded data.</p>}
          {filteredPods.length === 0 ? (
            <div className="px-5 py-14 text-center"><p className="text-sm font-medium text-slate-300">{pods.length === 0 ? 'No pods found' : 'No matching pods'}</p><p className="mt-1 text-xs text-slate-500">{pods.length === 0 ? 'The API returned an empty pod list.' : 'Try a different search term.'}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-xs">
                <thead className="bg-white/[0.025] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">Pod name</th><th className="px-5 py-3 font-semibold">Namespace</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Ready</th><th className="px-5 py-3 font-semibold">Restarts</th><th className="px-5 py-3 font-semibold">Node</th><th className="px-5 py-3 font-semibold">Pod IP</th></tr></thead>
                <tbody className="divide-y divide-white/[0.055]">
                  {filteredPods.map((pod) => <tr key={`${pod.namespace}/${pod.name}`} className="transition hover:bg-white/[0.025]">
                    <td className="max-w-[260px] truncate px-5 py-4 font-medium text-slate-200" title={pod.name}>{pod.name}</td><td className="px-5 py-4 text-slate-400">{pod.namespace}</td><td className="px-5 py-4"><StatusBadge status={pod.status} /></td><td className="px-5 py-4"><StatusBadge status={pod.ready ? 'Ready' : 'Not ready'} /></td><td className={`px-5 py-4 tabular-nums ${pod.restarts > 0 ? 'text-amber-300' : 'text-slate-400'}`}>{pod.restarts}</td><td className="max-w-[180px] truncate px-5 py-4 text-slate-400" title={pod.nodeName ?? ''}>{pod.nodeName || '—'}</td><td className="px-5 py-4 font-mono text-slate-500">{pod.podIP || '—'}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </RequestState>
    </div>
  )
}
