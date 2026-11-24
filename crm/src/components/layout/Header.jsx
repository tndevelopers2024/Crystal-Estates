import React from 'react'
import { Search, Bell, Plus, Sparkles, LogOut, User as UserIcon, Menu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useConfirm } from '../../context/DialogContext'
import { useNavigate } from 'react-router-dom'
import NotificationsMenu from './NotificationsMenu'

export default function Header({
  activeNav = 'properties',
  isAddOrEditPage = false,
  title = 'Properties',
  subtitle = 'Projects, RERA details and live unit inventory',
  searchTerm = '',
  onSearchChange,
  searchPlaceholder = 'Search projects, location, type...',
  onOpenUpload,
  onAddLead,
  onNewFollowUp,
  onScheduleVisit,
  onSimulateEnquiry,
  isSimulating = false,
  notifications = [],
  onToggleMobileMenu,
}) {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  const confirm = useConfirm()

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sign Out of CRM',
      message: 'Are you sure you want to end your Crystal Estates administrator session? You will need your credentials to log in again.',
      tag: user?.email ? `${user.name} (${user.email})` : 'Active Session',
      confirmText: 'Sign Out',
      cancelText: 'Stay Signed In',
      type: 'danger',
    })
    if (ok) {
      logout()
    }
  }

  return (
    <header className="h-18 shrink-0 bg-white border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Dynamic Title & Subtitle based on active page + Mobile Menu Button */}
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition shrink-0"
            aria-label="Toggle Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <h2 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight leading-tight truncate">
            {title}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Dynamic Controls based on active page */}
      <div className="flex items-center gap-3">
        {/* Dynamic Search Input */}
        {onSearchChange && !isAddOrEditPage && (
          <div className="relative w-64 hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-8 pr-4 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0F3D2E]/20 focus:border-[#0F3D2E] transition bg-slate-50 focus:bg-white"
            />
          </div>
        )}

        {/* ── LEADS PIPELINE ACTIONS ── */}
        {!isAddOrEditPage && activeNav === 'leads' && can('leads', 'edit') && (
          <>

            {onAddLead && (
              <button
                type="button"
                onClick={onAddLead}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add lead</span>
              </button>
            )}
          </>
        )}

        {/* ── FOLLOW-UPS ACTIONS ── */}
        {!isAddOrEditPage && activeNav === 'followups' && onNewFollowUp && can('followups', 'edit') && (
          <button
            type="button"
            onClick={onNewFollowUp}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New follow-up</span>
          </button>
        )}

        {/* ── SITE VISITS ACTIONS ── */}
        {!isAddOrEditPage && activeNav === 'visits' && onScheduleVisit && can('visits', 'edit') && (
          <button
            type="button"
            onClick={onScheduleVisit}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule visit</span>
          </button>
        )}

        {/* ── PROPERTIES & DASHBOARD ACTIONS ── */}
        {!isAddOrEditPage && activeNav === 'properties' && onOpenUpload && can('properties', 'edit') && (
          <button
            type="button"
            onClick={onOpenUpload}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F3D2E] hover:bg-[#16533D] text-white font-bold text-xs shadow-sm transition active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>
        )}

        {/* Notifications: live items that need attention */}
        <NotificationsMenu items={notifications} />

        {/* User Profile & Logout Action */}
        {user && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-xs shrink-0 hover:ring-2 hover:ring-[#0F3D2E]/30 transition"
              style={{ backgroundColor: user.color || '#0F3D2E' }}
              title={`${user.name} (${user.role || 'Admin'}) — profile & password`}
              aria-label="Profile and settings"
            >
              {user.initials || 'CA'}
            </button>

            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-800 leading-none">
                {user.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                {user.role || 'Super Admin'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 ml-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition flex items-center gap-1.5"
              title="Sign Out of CRM"
              aria-label="Logout"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden xl:inline text-xs font-bold">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
