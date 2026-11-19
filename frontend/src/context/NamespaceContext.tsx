import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clusterApi } from '../services/api'

interface NamespaceContextValue {
  namespace: string
  setNamespace: (value: string) => void
  namespaces: string[]
  namespacesLoading: boolean
  namespacesError: string | null
  retryNamespaces: () => void
}

const NamespaceContext = createContext<NamespaceContextValue | null>(null)

export function NamespaceProvider({ children }: { children: ReactNode }) {
  const [namespace, setNamespaceState] = useState('')
  const [namespaces, setNamespaces] = useState<string[]>([])
  const [namespacesLoading, setNamespacesLoading] = useState(true)
  const [namespacesError, setNamespacesError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    clusterApi.getNamespaces(controller.signal)
      .then(items => setNamespaces(items.map(item => item.name).filter(Boolean).sort()))
      .catch(error => {
        if (error instanceof Error && error.name === 'AbortError') return
        setNamespacesError(error instanceof Error ? error.message : 'Unable to load namespaces')
      })
      .finally(() => { if (!controller.signal.aborted) setNamespacesLoading(false) })
    return () => controller.abort()
  }, [retryKey])

  const retryNamespaces = useCallback(() => {
    setNamespacesLoading(true)
    setNamespacesError(null)
    setRetryKey(key => key + 1)
  }, [])

  const setNamespace = useCallback((value: string) => setNamespaceState(value), [])
  const value = useMemo(() => ({
    namespace, setNamespace, namespaces, namespacesLoading, namespacesError, retryNamespaces,
  }), [namespace, setNamespace, namespaces, namespacesLoading, namespacesError, retryNamespaces])

  return <NamespaceContext.Provider value={value}>{children}</NamespaceContext.Provider>
}

export function useNamespace() {
  const context = useContext(NamespaceContext)
  if (!context) throw new Error('useNamespace must be used inside NamespaceProvider')
  return context
}
