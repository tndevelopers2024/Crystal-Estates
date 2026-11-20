export const STATUS = {
  available: { label: 'Available', color: '#1fbf75' },
  booked: { label: 'Booked', color: '#f0a92e' },
  reserved: { label: 'Reserved', color: '#8b5cf6' },
  sold: { label: 'Sold', color: '#d6584f' },
  untagged: { label: 'No record', color: '#cfc8b8' },
}
export const STATUS_ORDER = ['available', 'booked', 'reserved', 'sold']

export const SIZES = [
  { id: 'all', label: 'Any size', test: () => true },
  { id: 's', label: 'Under 1,000 sq.ft', test: (n) => n !== null && n < 1000 },
  { id: 'm', label: '1,000 – 1,500 sq.ft', test: (n) => n !== null && n >= 1000 && n < 1500 },
  { id: 'l', label: '1,500 – 2,400 sq.ft', test: (n) => n !== null && n >= 1500 && n < 2400 },
  { id: 'xl', label: '2,400 sq.ft +', test: (n) => n !== null && n >= 2400 },
]

export const cls = (...xs) => xs.filter(Boolean).join(' ')
