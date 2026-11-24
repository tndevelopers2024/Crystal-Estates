import React, { useEffect, useMemo, useState } from 'react'
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import PropertyGrid from './components/properties/PropertyGrid'
import AddEditPropertyPage from './components/properties/AddEditPropertyPage'
import PlotsPage from './components/properties/PlotsPage'
import PaymentsPage from './components/payments/PaymentsPage'
import CustomersPage from './components/customers/CustomersPage'
import CustomerProfilePage from './components/customers/CustomerProfilePage'
import DocumentsPage from './components/documents/DocumentsPage'
import DashboardView from './components/dashboard/DashboardView'
import LeadsPipelineView from './components/leads/LeadsPipelineView'
import PlaceholderView from './components/views/PlaceholderView'
import ManagementView from './components/views/ManagementView'
import ReportsView from './components/views/ReportsView'
import TeamView from './components/views/TeamView'
import SettingsView from './components/views/SettingsView'
import { Lock } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { openFollowUps, inRange } from './lib/analytics'
import { fetchTeam } from './lib/teamApi'
import FollowUpsView from './components/followups/FollowUpsView'
import SiteVisitsView from './components/visits/SiteVisitsView'
import ScheduleFollowUpModal from './components/leads/ScheduleFollowUpModal'
import LoginPage from './components/auth/LoginPage'
import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ProtectedRoute from './components/auth/ProtectedRoute'
import RegisterPage from './components/auth/RegisterPage'
import SetPasswordPage from './components/auth/SetPasswordPage'
import Toast from './components/common/Toast'
import { useDialog } from './context/DialogContext'
import { useProperties } from './hooks/useProperties'
import { useLeads } from './hooks/useLeads'
import { useSiteVisits } from './hooks/useSiteVisits'

/**
 * Wrapper to resolve property data for /properties/edit/:id route
 */
function EditPropertyRouteWrapper({ properties, loading, onSave, onCancel }) {
  const { id } = useParams()
  const rawId = id || ''
  const decodedId = decodeURIComponent(rawId)

  const property = properties.find((p) => {
    if (!p) return false
    const pid = String(p.id || '')
    const projId = String(p.projectId || '')
    const slug = String(p.slug || '')
    const name = String(p.name || '').toLowerCase()
    const target = decodedId.toLowerCase()
    return (
      pid === rawId ||
      pid === decodedId ||
      projId === rawId ||
      projId === decodedId ||
      slug === rawId ||
      slug === decodedId ||
      name === target ||
      name.replace(/\s+/g, '-') === target ||
      name.replace(/[^a-z0-9]/g, '') === target.replace(/[^a-z0-9]/g, '')
    )
  })

  if (loading && !property) {
    return (
      <div className="flex items-center justify-center p-16 text-slate-500 text-xs font-semibold">
        <div className="animate-spin w-5 h-5 border-2 border-[#0F3D2E] border-t-transparent rounded-full mr-3" />
        Loading property specifications...
      </div>
    )
  }

  if (!loading && !property) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center max-w-md mx-auto my-12 shadow-xs">
        <h3 className="text-base font-bold text-slate-800">Project Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">
          Could not find details for project &ldquo;{decodedId}&rdquo;.
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-4 px-4 py-2 bg-[#0F3D2E] text-white text-xs font-semibold rounded-xl hover:bg-[#16533D] transition cursor-pointer"
        >
          Back to Properties
        </button>
      </div>
    )
  }

  return (
    <AddEditPropertyPage
      key={property.id || id}
      initialData={property}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
}

/**
 * Wrapper to resolve the property for /properties/:id/plots
 */
function PlotsRouteWrapper({ properties, loading, onPropertyUpdated, onShowToast, onBack }) {
  const { id } = useParams()
  const property = properties.find((p) => p.id === id || p.projectId === id)

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-16 text-slate-500 text-sm font-semibold">
        {loading ? (
          <>
            <div className="animate-spin w-5 h-5 border-2 border-[#0F3D2E] border-t-transparent rounded-full" />
            Loading plots...
          </>
        ) : (
          <>
            <span>Property not found.</span>
            <button type="button" onClick={onBack} className="px-4 py-2 bg-[#0F3D2E] text-white text-xs font-bold rounded-xl">
              Back to properties
            </button>
          </>
        )}
      </div>
    )
  }

  return <PlotsPage property={property} onPropertyUpdated={onPropertyUpdated} onShowToast={onShowToast} onBack={onBack} />
}

/**
 * Wrapper to resolve sectionId for placeholder routes like /followups, /visits, etc.
 */
function SectionPlaceholderRouteWrapper({ onBack }) {
  const { sectionId } = useParams()
  return <PlaceholderView sectionId={sectionId} onBack={onBack} />
}

export default function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const { confirm } = useDialog()
  const { can, isSuperAdmin, home } = useAuth()

  const [toast, setToast] = useState(null)
  const [isAddLeadModalOpen, setIsAddLeadModalOpen] = useState(false)
  const [isNewFollowUpModalOpen, setIsNewFollowUpModalOpen] = useState(false)
  const [isScheduleVisitModalOpen, setIsScheduleVisitModalOpen] = useState(false)
  const [isSimulatingLead, setIsSimulatingLead] = useState(false)

  // Centralized hook managing live MongoDB plots & actual portfolio
  const {
    properties,
    totalCount,
    searchTerm,
    setSearchTerm,
    loading: propertiesLoading,
    addPlot,
    updatePlotState,
    deleteProperty,
  } = useProperties()

  // Centralized hook managing live MongoDB leads pipeline
  const leadsState = useLeads()

  // Centralized hook managing live MongoDB site visits
  const visitsState = useSiteVisits()

  // Registrations waiting for approval (Super Admin bell item)
  const [pendingUsers, setPendingUsers] = useState(0)
  useEffect(() => {
    if (!isSuperAdmin) return undefined
    let active = true
    const load = () =>
      fetchTeam()
        .then((d) => active && setPendingUsers((d.users || []).filter((u) => u.status === 'pending').length))
        .catch(() => {})
    load()
    const id = setInterval(load, 60000)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [isSuperAdmin])

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Derive activeNav and page state directly from URL pathname
  const getActiveNav = () => {
    const path = location.pathname
    if (path.startsWith('/properties')) return 'properties'
    if (path.startsWith('/leads')) return 'leads'
    if (path.startsWith('/customers')) return 'customers'
    if (path.startsWith('/dashboard')) return 'dashboard'
    if (path.startsWith('/followups')) return 'followups'
    if (path.startsWith('/visits')) return 'visits'
    if (path.startsWith('/management')) return 'management'
    if (path.startsWith('/reports')) return 'reports'
    if (path.startsWith('/payments')) return 'payments'
    if (path.startsWith('/documents')) return 'documents'
    if (path.startsWith('/whatsapp')) return 'whatsapp'
    if (path.startsWith('/vendors')) return 'vendors'
    if (path.startsWith('/landrecords')) return 'landrecords'
    if (path.startsWith('/team')) return 'team'
    if (path.startsWith('/settings')) return 'settings'
    return 'properties'
  }

  const activeNav = getActiveNav()
  const isAddOrEditPage =
    location.pathname === '/properties/add' ||
    location.pathname.startsWith('/properties/edit')

  // Handle Save / Update from AddEditPropertyPage
  const handleSaveProperty = (savedProperty, isEdit) => {
    if (isEdit) {
      updatePlotState(savedProperty)
      showToast(`Project "${savedProperty.name}" updated successfully!`)
    } else {
      addPlot(savedProperty)
      showToast(`Property "${savedProperty.name}" published to database!`)
    }
    navigate('/properties')
  }

  const handleDelete = async (id, name) => {
    const ok = await confirm({
      title: 'Delete Property',
      message: `Are you sure you want to permanently delete "${name}"? This action cannot be undone. All layout phases, plot allotments, and documents will be removed.`,
      confirmText: 'Delete Property',
      cancelText: 'Keep Property',
      type: 'danger',
    })
    if (!ok) return

    const success = await deleteProperty(id, name, true)
    if (success) {
      showToast(`Property "${name}" deleted from database.`)
    }
  }

  // Simulate an incoming enquiry from website/WhatsApp directly from top header
  const handleSimulateEnquiry = async () => {
    try {
      setIsSimulatingLead(true)
      const simulated = await leadsState.simulateEnquiry(properties)
      showToast(`New lead enquiry simulated from ${simulated.source}!`, 'success')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setIsSimulatingLead(false)
    }
  }

  // Dynamic header titles based on URL pathname
  const getHeaderInfo = () => {
    if (location.pathname === '/properties/add') {
      return {
        title: 'Add New Property',
        subtitle: 'Upload complete land specifications, CAD/PDF blueprint & media',
      }
    }
    if (location.pathname.startsWith('/properties/edit')) {
      return {
        title: 'Edit Project',
        subtitle: 'Update project specifications, pricing, documents & drone media',
      }
    }

    switch (activeNav) {
      case 'dashboard':
        return {
          title: 'Workspace Dashboard',
          subtitle: 'Real-time overview of active listings, leads & conversions',
        }
      case 'properties':
        return {
          title: 'Properties',
          subtitle: 'Projects, RERA details and live unit inventory',
        }
      case 'leads':
        return {
          title: 'Leads pipeline',
          subtitle: 'Drag a card to move a lead between stages. Click a card to open it.',
        }
      case 'followups':
        return {
          title: 'Follow-ups',
          subtitle: 'Calls, WhatsApp and meetings your team has promised',
        }
      case 'visits':
        return {
          title: 'Site visits',
          subtitle: 'Scheduled visits with cab pickup',
        }
      case 'management':
        return {
          title: 'Management',
          subtitle: 'Executive operations, portfolio overview and sales targets',
        }
      case 'reports':
        return {
          title: 'Reports & Analytics',
          subtitle: 'Real estate revenue, pipeline velocity and conversion reports',
        }
      case 'payments':
        return {
          title: 'Payments & Accounts',
          subtitle: 'Track advances, token amounts, RTGS and installment records',
        }
      case 'documents':
        return {
          title: 'Documents & Registry',
          subtitle: 'Verified legal deeds, patta-chitta files and customer agreements',
        }
      case 'whatsapp':
        return {
          title: 'WhatsApp Automation',
          subtitle: 'Direct customer messaging, brochure dispatches and lead alerts',
        }
      case 'vendors':
        return {
          title: 'Vendors & Landowners',
          subtitle: 'Procurement network, survey agencies and landowner contracts',
        }
      case 'landrecords':
        return {
          title: 'Land Records',
          subtitle: 'Revenue cadastral maps, FMB sketches and village survey logs',
        }
      case 'team':
        return {
          title: 'Team & Roles',
          subtitle: 'Sales executive permissions, agent assignment and user roles',
        }
      case 'settings':
        return {
          title: 'Settings',
          subtitle: 'CRM company profile, notifications and system preferences',
        }
      default:
        return {
          title: activeNav.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
          subtitle: 'Connected to Crystal Estates secure management system',
        }
    }
  }

  const { title: headerTitle, subtitle: headerSubtitle } = getHeaderInfo()

  // Dynamic search value & handler based on active URL
  const currentSearchTerm = activeNav === 'leads' ? leadsState.searchQuery : searchTerm
  const handleCurrentSearchChange =
    isAddOrEditPage
      ? null
      : activeNav === 'properties'
      ? setSearchTerm
      : activeNav === 'leads'
      ? leadsState.setSearchQuery
      : null

  const currentSearchPlaceholder =
    activeNav === 'leads'
      ? 'Search name, phone, email...'
      : 'Search projects, location, type...'

  // Calculate real-time dynamic badges for sidebar navigation
  const totalLeadsCount = leadsState.allLeads?.length || 0
  const openFollowUpsCount = (leadsState.allLeads || []).reduce((acc, lead) => {
    if (lead.stage === 'won') return acc
    const count = (lead.upcomingFollowUps || []).filter(
      (fu) => !fu.completed && !String(fu.when || '').toLowerCase().includes('completed')
    ).length
    return acc + count
  }, 0)

  const dynamicBadges = {
    leads: String(totalLeadsCount),
    followups: String(openFollowUpsCount),
  }

  // Header bell: live items that need someone's attention
  const notifications = useMemo(() => {
    const leads = leadsState.allLeads || []
    const visits = visitsState.visits || []
    const items = []
    if (can('leads')) {
      const fresh = leads.filter((l) => inRange(l.createdAt, 1) && (l.stage || 'new') === 'new')
      items.push({ id: 'new-leads', label: 'New enquiries today', detail: fresh.slice(0, 2).map((l) => l.name).join(', '), count: fresh.length, path: '/leads' })
    }
    if (can('visits')) {
      const pending = visits.filter((v) => /pending/i.test(v.status || ''))
      items.push({ id: 'pending-visits', label: 'Site-visit requests to confirm', detail: pending.slice(0, 2).map((v) => v.leadName).join(', '), count: pending.length, path: '/visits' })
    }
    if (can('followups')) {
      const open = openFollowUps(leads)
      items.push({ id: 'followups', label: 'Open follow-ups', detail: open.slice(0, 2).map((f) => f.leadName).join(', '), count: open.length, path: '/followups' })
    }
    if (isSuperAdmin) items.push({ id: 'approvals', label: 'Accounts waiting for approval', count: pendingUsers, path: '/team' })
    return items
  }, [leadsState.allLeads, visitsState.visits, pendingUsers, can, isSuperAdmin])

  // Pages this role may open (Settings is for everyone: profile & password)
  const sectionAllowed = (nav) => (nav === 'team' ? isSuperAdmin : nav === 'settings' ? true : can(nav))
  const pageAllowed =
    isAddOrEditPage ? can('properties', 'edit') : location.pathname === '/' ? true : sectionAllowed(activeNav)

  // Check if current URL is an auth route
  const isAuthRoute =
    ['/login', '/forgot-password', '/register', '/set-password'].includes(location.pathname)

  if (isAuthRoute) {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/set-password" element={<SetPasswordPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </>
    )
  }

  return (
    <ProtectedRoute>
      {/* ── Main Layout (Sidebar + Dynamic Top Navbar + Content Router) ── */}
      <MainLayout
        activeNav={activeNav}
        onSelectNav={(targetPath) => navigate(targetPath)}
        isAddOrEditPage={isAddOrEditPage}
        onOpenUpload={() => navigate('/properties/add')}
        onAddLead={() => setIsAddLeadModalOpen(true)}
        onNewFollowUp={() => setIsNewFollowUpModalOpen(true)}
        onScheduleVisit={() => setIsScheduleVisitModalOpen(true)}
        onSimulateEnquiry={handleSimulateEnquiry}
        isSimulating={isSimulatingLead}
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        searchTerm={currentSearchTerm}
        onSearchChange={handleCurrentSearchChange}
        searchPlaceholder={currentSearchPlaceholder}
        dynamicBadges={dynamicBadges}
        notifications={notifications}
      >
        {!pageAllowed ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-10 text-center max-w-lg mx-auto mt-10">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">You don't have access to this page</h3>
            <p className="text-xs text-slate-500 mt-2">Your role doesn't include it. Ask a Super Admin if you need access.</p>
            <button type="button" onClick={() => navigate(home)} className="mt-6 inline-flex items-center gap-2 px-4 py-2 bg-[#0F3D2E] hover:bg-[#16533D] text-white text-xs font-bold rounded-xl shadow-sm transition">
              Go to my workspace
            </button>
          </div>
        ) : (
        <Routes>
          {/* Default Route -> this role's home page */}
          <Route path="/" element={<Navigate to={home} replace />} />

          {/* Properties List */}
          <Route
            path="/properties"
            element={
              <PropertyGrid
                properties={properties}
                onEdit={(prop) => navigate(`/properties/edit/${encodeURIComponent(prop.id)}`)}
                onDelete={handleDelete}
                searchTerm={searchTerm}
                onClearSearch={() => setSearchTerm('')}
              />
            }
          />

          {/* Full plot management page (map, list, booking, payments, history) */}
          <Route
            path="/properties/:id/plots"
            element={
              <PlotsRouteWrapper
                properties={properties}
                loading={propertiesLoading}
                onPropertyUpdated={updatePlotState}
                onShowToast={showToast}
                onBack={() => navigate('/properties')}
              />
            }
          />

          {/* Add Property Page */}
          <Route
            path="/properties/add"
            element={
              <AddEditPropertyPage
                initialData={null}
                onSave={handleSaveProperty}
                onCancel={() => navigate('/properties')}
              />
            }
          />

          {/* Edit Property Page */}
          <Route
            path="/properties/edit/:id"
            element={
              <EditPropertyRouteWrapper
                properties={properties}
                loading={propertiesLoading}
                onSave={handleSaveProperty}
                onCancel={() => navigate('/properties')}
              />
            }
          />

          {/* Leads Pipeline */}
          <Route
            path="/leads"
            element={
              <LeadsPipelineView
                leadsState={leadsState}
                visitsState={visitsState}
                properties={properties}
                isAddModalOpen={isAddLeadModalOpen}
                setIsAddModalOpen={setIsAddLeadModalOpen}
                onShowToast={showToast}
              />
            }
          />

          {/* Follow-ups Workspace */}
          <Route
            path="/followups"
            element={
              <FollowUpsView
                leadsState={leadsState}
                properties={properties}
                onShowToast={showToast}
              />
            }
          />

          {/* Site Visits Workspace */}
          <Route
            path="/visits"
            element={
              <SiteVisitsView
                visitsState={visitsState}
                leadsState={leadsState}
                properties={properties}
                isScheduleModalOpen={isScheduleVisitModalOpen}
                setIsScheduleModalOpen={setIsScheduleVisitModalOpen}
                onShowToast={showToast}
              />
            }
          />

          {/* Workspace Dashboard */}
          <Route
            path="/dashboard"
            element={
              <DashboardView
                properties={properties}
                leads={leadsState.allLeads || []}
                visits={visitsState.visits || []}
                loading={leadsState.loading}
                onAddLead={() => {
                  navigate('/leads')
                  setIsAddLeadModalOpen(true)
                }}
                onScheduleVisit={() => {
                  navigate('/visits')
                  setIsScheduleVisitModalOpen(true)
                }}
              />
            }
          />

          {/* Customer management */}
          <Route path="/customers" element={<CustomersPage onShowToast={showToast} />} />
          <Route path="/customers/:id" element={<CustomerProfilePage properties={properties} onShowToast={showToast} />} />

          {/* Standalone Modules (Visits, Payments, etc.) */}
          <Route
            path="/payments"
            element={
              <PaymentsPage
                leads={leadsState.allLeads || []}
                properties={properties}
                onShowToast={showToast}
                onLeadsChanged={leadsState.refreshLeads}
              />
            }
          />
          <Route
            path="/documents"
            element={<DocumentsPage leads={leadsState.allLeads || []} properties={properties} onShowToast={showToast} />}
          />
          <Route
            path="/management"
            element={<ManagementView properties={properties} leads={leadsState.allLeads || []} visits={visitsState.visits || []} loading={leadsState.loading} />}
          />
          <Route
            path="/reports"
            element={<ReportsView leads={leadsState.allLeads || []} visits={visitsState.visits || []} loading={leadsState.loading} />}
          />
          <Route path="/team" element={<TeamView onShowToast={showToast} />} />
          <Route path="/settings" element={<SettingsView onShowToast={showToast} />} />

          {/* WhatsApp and land modules keep their current pages */}
          <Route
            path="/:sectionId"
            element={<SectionPlaceholderRouteWrapper onBack={() => navigate(home)} />}
          />

          {/* Fallback unknown route */}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
        )}
      </MainLayout>

      {/* ── Schedule Follow-up Modal for Workspace ── */}
      {isNewFollowUpModalOpen && (
        <ScheduleFollowUpModal
          isOpen={isNewFollowUpModalOpen}
          leads={leadsState.allLeads}
          onClose={() => setIsNewFollowUpModalOpen(false)}
          onSchedule={async ({ leadId, type, when, note }) => {
            await leadsState.scheduleFollowUp(leadId, { type, when, note })
            showToast('Follow-up scheduled successfully!')
          }}
        />
      )}

      {/* ── Toast Notifications ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </ProtectedRoute>
  )
}
