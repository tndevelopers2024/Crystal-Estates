import { useState, useEffect, useCallback } from 'react'
import { fetchOptions, addOption, deleteOption } from '../lib/api'

/**
 * Server-backed editable option list.
 * Returns { options, loading, add(value), remove(value), error }.
 * `fallback` is shown until the server answers (or if it can't be reached).
 */
export function useOptions(list, fallback = []) {
  const [options, setOptions] = useState(fallback)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    fetchOptions(list)
      .then((data) => {
        if (active && Array.isArray(data.values)) setOptions(data.values)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [list])

  const add = useCallback(
    async (value) => {
      const data = await addOption(list, value)
      setOptions(data.values)
      return data.value
    },
    [list],
  )

  const remove = useCallback(
    async (value) => {
      const data = await deleteOption(list, value)
      setOptions(data.values)
    },
    [list],
  )

  return { options, loading, error, add, remove }
}
