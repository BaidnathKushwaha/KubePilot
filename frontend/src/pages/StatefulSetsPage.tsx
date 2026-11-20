import { useEffect, useState } from 'react'
import {
    RefreshCw,
    Database,
    Search,
} from 'lucide-react'

import { clusterApi } from '../services/api'
import { useNamespace } from '../context/NamespaceContext'

import type { StatefulSetInfo } from '../types/workload'

function healthStyle(health: StatefulSetInfo['health']) {

    switch (health) {

        case 'HEALTHY':
            return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'

        case 'DEGRADED':
            return 'bg-amber-500/10 text-amber-400 border-amber-500/20'

        case 'UNHEALTHY':
            return 'bg-red-500/10 text-red-400 border-red-500/20'

        case 'SCALED_DOWN':
            return 'bg-slate-500/10 text-slate-400 border-slate-500/20'

        default:
            return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
}

function StatefulSetsPage() {

    const { namespace } = useNamespace()

    const [statefulSets, setStatefulSets] =
        useState<StatefulSetInfo[]>([])

    const [loading, setLoading] = useState(true)

    const [error, setError] = useState<string | null>(null)

    const [search, setSearch] = useState('')

    const loadStatefulSets = async () => {

        setLoading(true)
        setError(null)

        try {

            const data = await clusterApi.getStatefulSets(namespace)

            setStatefulSets(data)

        } catch (err) {

            setError(
                err instanceof Error
                    ? err.message
                    : 'Unable to load StatefulSets'
            )

        } finally {

            setLoading(false)

        }
    }

    useEffect(() => {
        void loadStatefulSets()
    }, [namespace])

    const filteredStatefulSets = statefulSets.filter(statefulSet => {

        const value = search.toLowerCase()

        return (
            statefulSet.name.toLowerCase().includes(value) ||
            statefulSet.namespace.toLowerCase().includes(value)
        )
    })

    const healthyCount = statefulSets.filter(
        s => s.health === 'HEALTHY'
    ).length

    const degradedCount = statefulSets.filter(
        s => s.health === 'DEGRADED'
    ).length

    const unhealthyCount = statefulSets.filter(
        s => s.health === 'UNHEALTHY'
    ).length

    return (

        <div className="space-y-6">

            {/* Header */}

            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">

                <div>

                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">
                        Manage / Workloads
                    </p>

                    <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[30px]">
                        StatefulSets
                    </h1>

                    <p className="mt-2 text-sm text-slate-400">
                        Inspect Stateful workloads, replica readiness and storage configuration.
                    </p>

                </div>

                <button
                    type="button"
                    onClick={() => void loadStatefulSets()}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/[0.09] px-3 py-2 text-xs text-slate-300 hover:bg-white/5 disabled:opacity-50"
                >

                    <RefreshCw
                        size={13}
                        className={loading ? 'animate-spin' : ''}
                    />

                    Refresh

                </button>

            </section>


            {/* Summary */}

            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <SummaryCard
                    label="Total StatefulSets"
                    value={statefulSets.length}
                />

                <SummaryCard
                    label="Healthy"
                    value={healthyCount}
                    color="text-emerald-400"
                />

                <SummaryCard
                    label="Degraded"
                    value={degradedCount}
                    color="text-amber-400"
                />

                <SummaryCard
                    label="Unhealthy"
                    value={unhealthyCount}
                    color="text-red-400"
                />

            </section>


            {/* Search */}

            <div className="relative">

                <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search StatefulSets..."
                    className="w-full rounded-lg border border-white/10 bg-[#0d1523] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                />

            </div>


            {/* Loading */}

            {loading && (

                <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-12 text-center">

                    <RefreshCw
                        size={20}
                        className="mx-auto animate-spin text-cyan-300"
                    />

                    <p className="mt-3 text-sm text-slate-400">
                        Loading StatefulSets...
                    </p>

                </div>

            )}


            {/* Error */}

            {!loading && error && (

                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5">

                    <p className="text-sm text-red-400">
                        {error}
                    </p>

                    <button
                        onClick={() => void loadStatefulSets()}
                        className="mt-3 text-xs text-slate-300 underline"
                    >
                        Retry
                    </button>

                </div>

            )}


            {/* Empty */}

            {!loading && !error && filteredStatefulSets.length === 0 && (

                <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-12 text-center">

                    <Database
                        size={25}
                        className="mx-auto text-cyan-300"
                    />

                    <p className="mt-3 text-sm font-medium text-slate-200">
                        No StatefulSets found
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Try changing the namespace or search query.
                    </p>

                </div>

            )}


            {/* Table */}

            {!loading && !error && filteredStatefulSets.length > 0 && (

                <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">

                    <div className="overflow-x-auto">

                        <table className="w-full text-left">

                            <thead className="border-b border-white/[0.07]">

                            <tr className="text-[10px] uppercase tracking-wider text-slate-500">

                                <th className="px-5 py-4">StatefulSet</th>

                                <th className="px-5 py-4">Namespace</th>

                                <th className="px-5 py-4">Replicas</th>

                                <th className="px-5 py-4">Service</th>

                                <th className="px-5 py-4">Storage</th>

                                <th className="px-5 py-4">Health</th>

                            </tr>

                            </thead>

                            <tbody>

                            {filteredStatefulSets.map(statefulSet => (

                                <tr
                                    key={`${statefulSet.namespace}-${statefulSet.name}`}
                                    className="border-b border-white/[0.04] transition hover:bg-white/[0.025]"
                                >

                                    <td className="px-5 py-4">

                                        <div className="flex items-center gap-3">

                                            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-400/20 bg-cyan-400/10">

                                                <Database
                                                    size={15}
                                                    className="text-cyan-300"
                                                />

                                            </div>

                                            <div>

                                                <p className="text-sm font-medium text-slate-200">
                                                    {statefulSet.name}
                                                </p>

                                                <p className="mt-1 text-[10px] text-slate-500">
                                                    StatefulSet
                                                </p>

                                            </div>

                                        </div>

                                    </td>


                                    <td className="px-5 py-4">

                      <span className="rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1 text-xs text-slate-400">

                        {statefulSet.namespace}

                      </span>

                                    </td>


                                    <td className="px-5 py-4">

                      <span className="text-sm font-medium text-slate-200">

                        {statefulSet.readyReplicas}

                      </span>

                                        <span className="text-slate-500">

                        {' / '}{statefulSet.desiredReplicas}

                      </span>

                                    </td>


                                    <td className="px-5 py-4">

                      <span className="text-xs text-slate-300">

                        {statefulSet.serviceName ?? 'Not configured'}

                      </span>

                                    </td>


                                    <td className="px-5 py-4">

                                        {statefulSet.volumeClaimTemplates.length === 0 ? (

                                            <span className="text-xs text-slate-500">
                          No templates
                        </span>

                                        ) : (

                                            <div className="flex flex-wrap gap-1">

                                                {statefulSet.volumeClaimTemplates.map(claim => (

                                                    <span
                                                        key={claim}
                                                        className="rounded-md border border-cyan-400/20 bg-cyan-400/5 px-2 py-1 text-[10px] text-cyan-300"
                                                    >

                              {claim}

                            </span>

                                                ))}

                                            </div>

                                        )}

                                    </td>


                                    <td className="px-5 py-4">

                      <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${healthStyle(statefulSet.health)}`}
                      >

                        {statefulSet.health.replace('_', ' ')}

                      </span>

                                    </td>

                                </tr>

                            ))}

                            </tbody>

                        </table>

                    </div>

                </div>

            )}

        </div>

    )
}


function SummaryCard({
                         label,
                         value,
                         color = 'text-white',
                     }: {
    label: string
    value: number
    color?: string
}) {

    return (

        <div className="rounded-xl border border-white/[0.07] bg-[#0d1523] p-5">

            <p className="text-xs text-slate-500">
                {label}
            </p>

            <p className={`mt-3 text-2xl font-semibold ${color}`}>
                {value}
            </p>

        </div>

    )
}

export default StatefulSetsPage