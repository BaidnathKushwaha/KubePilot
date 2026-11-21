import {
  Activity,
  Boxes,
  ChartNoAxesCombined,
  GitBranch,
  LayoutDashboard,
  Gauge,
  Network,
  Server,
  Database,
  type LucideIcon,
} from 'lucide-react'

export interface NavigationItem {
  label: string
  path: string
  icon: LucideIcon
  group: 'workspace' | 'observe'
}

export const navigationItems: NavigationItem[] = [
  {
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
    group: 'workspace',
  },
  {
    label: 'Nodes',
    path: '/nodes',
    icon: Server,
    group: 'workspace',
  },
  {
    label: 'Pods',
    path: '/pods',
    icon: Boxes,
    group: 'workspace',
  },
  {
    label: 'Workloads',
    path: '/workloads',
    icon: ChartNoAxesCombined,
    group: 'workspace',
  },
  {
    label: 'StatefulSets',
    path: '/statefulsets',
    icon: Database,
    group: 'workspace',
  },
  {
    label: 'Services & Networking',
    path: '/services',
    icon: Network,
    group: 'workspace',
  },
  {
    label: 'Cluster topology',
    path: '/topology',
    icon: GitBranch,
    group: 'observe',
  },
  {
    label: 'Resource metrics',
    path: '/metrics',
    icon: Gauge,
    group: 'observe',
  },
  {
    label: 'Events',
    path: '/events',
    icon: Activity,
    group: 'observe',
  },
]

export function getPageTitle(pathname: string): string {
  return navigationItems.find((item) => item.path === pathname)?.label ?? 'Overview'
}
