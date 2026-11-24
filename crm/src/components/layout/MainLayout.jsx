import React, { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'

export default function MainLayout({
  activeNav,
  onSelectNav,
  isAddOrEditPage = false,
  onOpenUpload,
  onAddLead,
  onNewFollowUp,
  onScheduleVisit,
  onSimulateEnquiry,
  isSimulating = false,
  headerTitle,
  headerSubtitle,
  searchTerm,
  onSearchChange,
  searchPlaceholder,
  notifications = [],
  dynamicBadges = {},
  children,
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F9] font-sans antialiased">
      {/* ── Fixed Sidebar ── */}
      <Sidebar
        activeNav={activeNav}
        onSelectNav={onSelectNav}
        onOpenUpload={onOpenUpload}
        dynamicBadges={dynamicBadges}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* ── Main Layout Column (Offset on md+ screens to match fixed sidebar) ── */}
      <div className="flex-1 flex flex-col h-screen min-w-0 md:ml-[240px] overflow-hidden">
        <Header
          activeNav={activeNav}
          isAddOrEditPage={isAddOrEditPage}
          title={headerTitle}
          subtitle={headerSubtitle}
          searchTerm={searchTerm}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          onOpenUpload={onOpenUpload}
          onAddLead={onAddLead}
          onNewFollowUp={onNewFollowUp}
          onScheduleVisit={onScheduleVisit}
          onSimulateEnquiry={onSimulateEnquiry}
          isSimulating={isSimulating}
          notifications={notifications}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        {/* ── Independently Scrollable Main Content Area ── */}
        <main className="flex-1 min-h-0 overflow-y-auto p-4 md:p-8 crm-main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
