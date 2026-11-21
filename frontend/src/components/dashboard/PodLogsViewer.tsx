import { useEffect, useMemo, useState } from 'react'
import {
    RefreshCw,
    Search,
    FileText,
    Clock,
    AlertCircle,
} from 'lucide-react'
import { clusterApi } from '../../services/api'

interface PodLogsViewerProps {
    namespace: string
    podName: string
    containers: string[]
}

export function PodLogsViewer({
                                  namespace,
                                  podName,
                                  containers,
                              }: PodLogsViewerProps) {

    const [container, setContainer] = useState('')
    const [tailLines, setTailLines] = useState(200)
    const [timestamps, setTimestamps] = useState(true)
    const [previous, setPrevious] = useState(false)

    const [logs, setLogs] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    const loadLogs = async (signal?: AbortSignal) => {
        setLoading(true)
        setError(null)

        try {
            const result = await clusterApi.getPodLogs(
                namespace,
                podName,
                container || undefined,
                tailLines,
                timestamps,
                previous,
                signal,
            )

            setLogs(result)
        } catch (cause) {
            if (cause instanceof Error && cause.name === 'AbortError') return

            setError(
                cause instanceof Error
                    ? cause.message
                    : 'Failed to load pod logs',
            )
        } finally {
            if (!signal?.aborted) {
                setLoading(false)
            }
        }
    }

    // Reset state when the selected pod changes
    useEffect(() => {
        setLogs('')
        setError(null)
        setContainer('')
        setPrevious(false)
        setSearch('')
        setTailLines(200)
        setTimestamps(true)
    }, [namespace, podName])

// Retrieve logs whenever log retrieval settings change
    useEffect(() => {
        const controller = new AbortController()

        void loadLogs(controller.signal)

        return () => controller.abort()
    }, [namespace, podName, container, tailLines, timestamps, previous])

    const filteredLogs = useMemo(() => {
        if (!search.trim()) return logs

        return logs
            .split('\n')
            .filter(line =>
                line.toLowerCase().includes(search.toLowerCase()),
            )
            .join('\n')
    }, [logs, search])

    const logLineCount = logs
        ? logs.split('\n').filter(line => line.length > 0).length
        : 0

    return (
        <section className="mt-6 overflow-hidden rounded-xl border border-white/[0.07] bg-[#0d1523]">

            {/* Header */}
            <div className="border-b border-white/[0.07] p-4">

                <div className="flex items-center justify-between gap-3">

                    <div className="flex items-center gap-2">
                        <FileText size={15} className="text-cyan-300" />

                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                            Container Logs
                        </h3>
                    </div>

                    <button
                        type="button"
                        onClick={() => void loadLogs()}
                        disabled={loading}
                        title="Refresh logs"
                        className="rounded-lg border border-white/[0.08] p-2 text-slate-400 hover:bg-white/[0.05] hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw
                            size={14}
                            className={loading ? 'animate-spin' : ''}
                        />
                    </button>

                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">

                    {/* Container */}
                    {containers.length > 0 && (
                        <select
                            value={container}
                            onChange={event => setContainer(event.target.value)}
                            className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-300/40"
                        >
                            <option value="">Default container</option>

                            {containers.map(name => (
                                <option key={name} value={name}>
                                    {name}
                                </option>
                            ))}
                        </select>
                    )}

                    {/* Tail */}
                    <select
                        value={tailLines}
                        onChange={event => setTailLines(Number(event.target.value))}
                        className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-xs text-slate-300 outline-none focus:border-cyan-300/40"
                    >
                        <option value={100}>Last 100 lines</option>
                        <option value={200}>Last 200 lines</option>
                        <option value={500}>Last 500 lines</option>
                        <option value={1000}>Last 1000 lines</option>
                        <option value={2000}>Last 2000 lines</option>
                        <option value={5000}>Last 5000 lines</option>
                    </select>

                    {/* Previous */}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                        <input
                            type="checkbox"
                            checked={previous}
                            onChange={event => setPrevious(event.target.checked)}
                            className="accent-cyan-400"
                        />
                        Previous container
                    </label>

                    {/* Timestamp */}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-400">
                        <input
                            type="checkbox"
                            checked={timestamps}
                            onChange={event => setTimestamps(event.target.checked)}
                            className="accent-cyan-400"
                        />
                        Timestamps
                    </label>

                </div>

                {/* Search */}
                <div className="mt-3">

                    <label className="relative block">

                        <Search
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                        />

                        <input
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Filter logs..."
                            className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan-300/40"
                        />

                    </label>

                </div>

                {/* Stats */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">

                    <div className="flex items-center gap-2">
                        <Clock size={12} />

                        <span>
                            {logLineCount} lines retrieved
                        </span>
                    </div>

                    <span>
                        {previous ? 'Previous container logs' : 'Current container logs'}
                    </span>

                </div>

            </div>

            {/* Error */}
            {error && (
                <div className="border-b border-red-400/20 bg-red-400/[0.04] p-3">

                    <div className="flex items-start gap-2">

                        <AlertCircle
                            size={14}
                            className="mt-0.5 shrink-0 text-red-300"
                        />

                        <div>
                            <p className="text-xs font-medium text-red-300">
                                Failed to retrieve logs
                            </p>

                            <p className="mt-1 break-all text-xs text-slate-400">
                                {error}
                            </p>
                        </div>

                    </div>

                </div>
            )}

            {/* Log output */}
            <div className="relative">

                {loading && (
                    <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2 text-xs text-cyan-300">

                        <RefreshCw size={12} className="animate-spin" />

                        Retrieving logs...

                    </div>
                )}

                <div className="max-h-[500px] min-h-[220px] overflow-auto bg-[#080d16]">

                    {filteredLogs.length === 0 && !loading ? (
                        <div className="flex min-h-[220px] items-center justify-center px-6 text-center">

                            <div>
                                <FileText
                                    size={22}
                                    className="mx-auto text-slate-600"
                                />

                                <p className="mt-3 text-xs text-slate-500">
                                    {error
                                        ? 'Logs could not be retrieved.'
                                        : search
                                            ? 'No log lines match your filter.'
                                            : 'No log output available.'}
                                </p>
                            </div>

                        </div>
                    ) : (

                        <pre className="whitespace-pre-wrap break-all p-4 font-mono text-[11px] leading-5 text-slate-300">

                            {filteredLogs}

                        </pre>

                    )}

                </div>

            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">

                <p className="text-[10px] text-slate-500">
                    Snapshot retrieval. Logs are not streamed live.
                </p>

                <button
                    type="button"
                    onClick={() => void loadLogs()}
                    disabled={loading}
                    className="rounded-lg border border-white/[0.08] px-3 py-2 text-xs text-slate-300 hover:bg-white/[0.05] disabled:opacity-50"
                >
                    Refresh
                </button>

            </div>

        </section>
    )
}