import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OverviewPage } from './pages/OverviewPage'
import { ResourcePlaceholderPage } from './pages/ResourcePlaceholderPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route
            path="nodes"
            element={
              <ResourcePlaceholderPage
                title="Nodes"
                description="Inspect the machines that make up your Kubernetes cluster."
                eyebrow="Compute"
              />
            }
          />
          <Route
            path="pods"
            element={
              <ResourcePlaceholderPage
                title="Pods"
                description="Explore pod status, scheduling, restarts, and container information."
                eyebrow="Workloads"
              />
            }
          />
          <Route
            path="workloads"
            element={
              <ResourcePlaceholderPage
                title="Workloads"
                description="Manage and inspect Deployments, StatefulSets, and DaemonSets."
                eyebrow="Workloads"
              />
            }
          />
          <Route
            path="services"
            element={
              <ResourcePlaceholderPage
                title="Services & Networking"
                description="Explore Services, Ingress resources, and cluster networking relationships."
                eyebrow="Networking"
              />
            }
          />
          <Route
            path="topology"
            element={
              <ResourcePlaceholderPage
                title="Cluster topology"
                description="Understand how Kubernetes resources connect across your cluster."
                eyebrow="Visualization"
              />
            }
          />
          <Route
            path="events"
            element={
              <ResourcePlaceholderPage
                title="Events"
                description="Review Kubernetes events and investigate changes in cluster behavior."
                eyebrow="Observability"
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
