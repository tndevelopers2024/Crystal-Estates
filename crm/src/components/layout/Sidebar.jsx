import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Plus, LogOut, X } from 'lucide-react'
import { NAVIGATION_SECTIONS } from '../../data/navigation'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar({ onOpenUpload, dynamicBadges = {}, isOpen = false, onClose }) {
  const location = useLocation()
  const { user, logout, can, isSuperAdmin } = useAuth()
  // Only pages this role may open (Team & roles: Super Admin; Settings: everyone, for profile & password)
  const allowed = (item) => {
    const id = typeof item === 'string' ? item : (item.permissionId || item.id)
    return id === 'team' ? isSuperAdmin : id === 'settings' ? true : can(id)
  }
  const sections = NAVIGATION_SECTIONS.map((sec) => ({ ...sec, items: sec.items.filter((it) => allowed(it)) })).filter((sec) => sec.items.length)

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* ── Fixed Left Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[240px] h-screen bg-[#0F3D2E] text-white flex flex-col select-none border-r border-[#16533D] transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header - Permanently fixed at top */}
        <div className="shrink-0 px-4 py-4 flex items-center justify-between border-b border-white/10 bg-[#0F3D2E]">
          <Link
            to="/properties"
            onClick={onClose}
            className="flex items-center gap-2 no-underline group min-w-0"
            aria-label="Crystal Estates CRM"
          >
            <img
              src="/logo-white.png"
              alt="Crystal Estates"
              className="h-8 max-w-[155px] w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold bg-[#B8964E] text-white px-1.5 py-0.5 rounded tracking-wide shadow-xs shrink-0">
              CRM
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="md:hidden p-1 text-emerald-200 hover:text-white rounded-lg hover:bg-white/10 transition"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Sections - Independently Scrollable Menu Items */}
        <nav className="flex-1 min-h-0 py-3 pl-3 pr-2.5 space-y-4 overflow-y-auto crm-sidebar-menu overscroll-contain">
          {sections.map((section) => (
            <div key={section.title}>
              <div className="px-3 text-[10px] font-bold tracking-wider text-emerald-200/70 uppercase mb-1">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon
                  const targetPath = item.path || `/${item.id}`
                  const isActive =
                    location.pathname === targetPath ||
                    (targetPath !== '/' && location.pathname.startsWith(`${targetPath}/`))

                  return (
                    <Link
                      key={item.id}
                      to={targetPath}
                      onClick={onClose}
                      className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition no-underline ${
                        isActive
                          ? 'bg-white text-[#0F3D2E] shadow-sm font-bold'
                          : 'text-emerald-100 hover:text-white hover:bg-white/10 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#0F3D2E]' : 'text-emerald-200/80'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {(() => {
                        const badge =
                          dynamicBadges[item.id] !== undefined
                            ? dynamicBadges[item.id]
                            : item.badge
                        if (!badge) return null
                        return (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ml-1.5 ${
                              isActive
                                ? 'bg-[#0F3D2E] text-white'
                                : 'bg-[#B8964E] text-white'
                            }`}
                          >
                            {badge}
                          </span>
                        )
                      })()}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User profile & Quick Action Button - Permanently fixed at bottom */}
        <div className="shrink-0 p-3 border-t border-white/10 space-y-2 mt-auto bg-[#0F3D2E]">
          {user && (
            <div className="p-2 bg-white/10 rounded-xl flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 overflow-hidden">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-inner"
                  style={{ backgroundColor: user.color || '#B8964E' }}
                >
                  {user.initials || 'CA'}
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="text-xs font-bold text-white truncate">{user.name}</div>
                  <div className="text-[10px] text-emerald-200 truncate">{user.role || 'Super Admin'}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Logout from CRM"
                className="p-1.5 text-emerald-200 hover:text-rose-300 hover:bg-white/10 rounded-lg transition shrink-0"
                aria-label="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
