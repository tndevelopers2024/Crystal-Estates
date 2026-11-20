/**
 * Same phase resolution the project page uses, so the 3D view and the 2D
 * viewer always agree on which plots belong to which phase.
 */
export function buildPhases(project) {
  if (!project) return []
  const raw =
    Array.isArray(project.layouts) && project.layouts.length > 0
      ? project.layouts
      : Array.isArray(project.phases) && project.phases.length > 0
        ? project.phases
        : null
  const fallbackUrl =
    project.layoutBackgroundUrl || project.layoutUrl || project.layoutPlan || project.layoutImage || null
  const all = Array.isArray(project.plots) ? project.plots : []

  if (!raw) {
    return [{ id: 'phase-1', name: 'Phase 1', layoutUrl: fallbackUrl, plots: all, viewBox: project.viewBox || '0 0 1056 816' }]
  }

  return raw.map((l, idx) => {
    const name = (l.name || `Phase ${idx + 1}`).trim()
    const same = (p) => p.phase && String(p.phase).trim().toLowerCase() === name.toLowerCase()
    let plots = Array.isArray(l.plots) ? l.plots : []
    if (plots.length > 0 && plots.some((p) => p.phase)) {
      plots = plots.filter((p) => !p.phase || same(p))
    } else if (plots.length === 0 && all.length > 0) {
      plots = all.filter(same)
      if (plots.length === 0 && idx === 0 && raw.length === 1) plots = all
    }
    return {
      id: l.id || `phase-${idx + 1}`,
      name,
      layoutUrl: l.layoutUrl || l.layoutBackgroundUrl || fallbackUrl,
      plots,
      viewBox: l.viewBox || project.viewBox || '0 0 1056 816',
    }
  })
}

/** ?phase=2 | ?phase=phase-2 | ?phase=Phase%202 → index */
export function phaseIndexFrom(phases, value) {
  if (value === null || value === undefined || value === '') return 0
  const v = String(value).trim().toLowerCase()
  const byName = phases.findIndex((p) => p.id.toLowerCase() === v || p.name.toLowerCase() === v)
  if (byName >= 0) return byName
  const n = parseInt(v.replace(/\D/g, ''), 10)
  return Number.isInteger(n) && n >= 1 && n <= phases.length ? n - 1 : 0
}
