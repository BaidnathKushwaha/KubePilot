import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { OverviewPage } from './pages/OverviewPage'
import { NodesPage } from './pages/NodesPage'
import { PodsPage } from './pages/PodsPage'
import { MetricsPage } from './pages/MetricsPage'
import { TopologyPage } from './pages/TopologyPage'
import { ResourcePlaceholderPage } from './pages/ResourcePlaceholderPage'
import DeploymentsPage from './pages/DeploymentsPage'
import StatefulSetsPage from './pages/StatefulSetsPage'
import {NamespacesPage} from "./pages/NamespacesPage.tsx";
import {EventsPage} from "./pages/EventsPage.tsx";
import {ServicesPage} from "./pages/ServicesPage.tsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="nodes" element={<NodesPage />} />
          <Route path="pods" element={<PodsPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="workloads" element={<DeploymentsPage />} />
          <Route path="statefulsets" element={<StatefulSetsPage />} />
          <Route path="namespaces" element={<NamespacesPage/>} />
          <Route path="services" element={<ResourcePlaceholderPage title="Services & Networking" description="Explore Services, Ingress resources, and cluster networking relationships." eyebrow="Networking" />} />
          <Route path="topology" element={<TopologyPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
          <Route path="services" element={<ServicesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
