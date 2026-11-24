import { useCallback, useEffect, useState } from 'react'
import { fetchAllPayments } from '../lib/api'

/** All recorded payments (shared by Dashboard, Management and Reports). */
export function usePayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllPayments()
      setPayments(Array.isArray(data.payments) ? data.payments : [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Could not load payments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { payments, loading, error, reload: load }
}
