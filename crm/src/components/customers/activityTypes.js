import {
  Phone,
  CalendarClock,
  Users,
  MapPin,
  GitBranch,
  IndianRupee,
  Building2,
  StickyNote,
  MessageCircle,
  Mail,
  FileText,
  UserCog,
  Circle,
} from 'lucide-react'

/** Timeline entry types — must match ACTIVITY_TYPES on the server. */
export const ACTIVITY_TYPES = [
  { id: 'call', label: 'Call', icon: Phone, tone: 'bg-sky-50 text-sky-700 ring-sky-200' },
  { id: 'followup', label: 'Follow-up', icon: CalendarClock, tone: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { id: 'meeting', label: 'Meeting', icon: Users, tone: 'bg-violet-50 text-violet-700 ring-violet-200' },
  { id: 'visit', label: 'Site visit', icon: MapPin, tone: 'bg-teal-50 text-teal-700 ring-teal-200' },
  { id: 'status', label: 'Status change', icon: GitBranch, tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { id: 'payment', label: 'Payment', icon: IndianRupee, tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  { id: 'property', label: 'Property interest', icon: Building2, tone: 'bg-lime-50 text-lime-800 ring-lime-200' },
  { id: 'note', label: 'Note', icon: StickyNote, tone: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tone: 'bg-green-50 text-green-700 ring-green-200' },
  { id: 'email', label: 'Email', icon: Mail, tone: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { id: 'document', label: 'Document', icon: FileText, tone: 'bg-orange-50 text-orange-700 ring-orange-200' },
  { id: 'profile', label: 'Profile', icon: UserCog, tone: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
  { id: 'other', label: 'Other', icon: Circle, tone: 'bg-slate-50 text-slate-600 ring-slate-200' },
]

const BY_ID = Object.fromEntries(ACTIVITY_TYPES.map((t) => [t.id, t]))
export const activityType = (id) => BY_ID[id] || BY_ID.other

/** Types staff can log by hand (automatic ones like status/profile come from other records). */
export const MANUAL_TYPES = ACTIVITY_TYPES.filter((t) => !['status', 'profile'].includes(t.id))

export const STAGE_LABELS = {
  new: 'New lead',
  contacted: 'Contacted',
  followup: 'Follow-up',
  sitevisit: 'Site visit',
  sitevisitdone: 'Site visit done',
  negotiation: 'Negotiation',
  won: 'Won - Booked',
  lost: 'Lost',
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'CU'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function fmtDateTime(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function fmtDate(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtTime(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  return dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

/** "Today", "Yesterday" or a date — used to group the timeline. */
export function dayLabel(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return 'Undated'
  const today = new Date()
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((startOf(today) - startOf(dt)) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return dt.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function relativeTime(d) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return '—'
  const mins = Math.round((Date.now() - dt.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 30) return `${days} d ago`
  return fmtDate(dt)
}

/** Value for <input type="datetime-local"> in the user's own timezone. */
export function toLocalInput(d = new Date()) {
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}
