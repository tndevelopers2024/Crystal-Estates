/**
 * A small in-memory stand-in for the Mongo driver, for tests. Supports the query
 * and update operators the CRM routes use: dotted paths, $or, $in, $ne, regex,
 * array membership, $set, $push ($each / $position) and $pull. Never the real database.
 */
const get = (doc, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), doc)

export function matches(doc, q) {
  return Object.entries(q).every(([k, cond]) => {
    if (k === '$or') return cond.some((c) => matches(doc, c))
    const v = get(doc, k)
    if (cond instanceof RegExp) return typeof v === 'string' && cond.test(v)
    if (cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
      if ('$in' in cond) return Array.isArray(v) ? v.some((x) => cond.$in.includes(x)) : cond.$in.some((x) => x === v || (x == null && v == null))
      if ('$ne' in cond) return cond.$ne === null ? v != null : v !== cond.$ne
    }
    if (Array.isArray(v)) return v.includes(cond)
    return cond === null ? v == null : v === cond
  })
}

function project(doc, proj) {
  const d = structuredClone(doc)
  if (!proj) return d
  const keys = Object.keys(proj).filter((k) => k !== '_id')
  if (keys.length && proj[keys[0]] === 1) {
    const tops = new Set(keys.map((k) => k.split('.')[0]))
    return Object.fromEntries([...tops].filter((k) => k in d).map((k) => [k, d[k]]))
  }
  for (const k of keys) delete d[k]
  return d
}

function applyUpdate(doc, u) {
  for (const [k, v] of Object.entries(u.$set || {})) doc[k] = structuredClone(v)
  for (const [k, v] of Object.entries(u.$push || {})) {
    doc[k] ||= []
    if (v && typeof v === 'object' && '$each' in v) {
      const items = structuredClone(v.$each)
      if (v.$position === 0) doc[k].unshift(...items)
      else doc[k].push(...items)
    } else doc[k].push(structuredClone(v))
  }
  for (const [k, v] of Object.entries(u.$pull || {})) doc[k] = (doc[k] || []).filter((x) => !matches(x, v))
}

export function makeDb() {
  const cols = {}
  const col = (name) =>
    (cols[name] ||= {
      rows: [],
      find(q = {}, o = {}) {
        let rows = this.rows.filter((d) => matches(d, q))
        const c = {
          sort(spec) {
            const [[k, dir]] = Object.entries(spec)
            rows = [...rows].sort((a, b) => (a[k] < b[k] ? -dir : a[k] > b[k] ? dir : 0))
            return c
          },
          limit(n) { rows = rows.slice(0, n); return c },
          async toArray() { return rows.map((r) => project(r, o.projection)) },
        }
        return c
      },
      async findOne(q = {}, o = {}) { const r = this.rows.find((d) => matches(d, q)); return r ? project(r, o.projection) : null },
      async insertOne(d) { this.rows.push(structuredClone(d)); return { insertedId: d.id } },
      async insertMany(ds) { ds.forEach((d) => this.rows.push(structuredClone(d))) },
      async replaceOne(q, d) { const i = this.rows.findIndex((r) => matches(r, q)); if (i >= 0) this.rows[i] = structuredClone(d) },
      async updateOne(q, u) { const r = this.rows.find((d) => matches(d, q)); if (r) applyUpdate(r, u); return { matchedCount: r ? 1 : 0 } },
      async updateMany(q, u) { this.rows.filter((d) => matches(d, q)).forEach((r) => applyUpdate(r, u)) },
      async deleteOne(q) { const i = this.rows.findIndex((r) => matches(r, q)); if (i >= 0) this.rows.splice(i, 1); return { deletedCount: i >= 0 ? 1 : 0 } },
      async deleteMany(q) { const n = this.rows.length; this.rows = this.rows.filter((r) => !matches(r, q)); return { deletedCount: n - this.rows.length } },
      async findOneAndDelete(q) { const i = this.rows.findIndex((r) => matches(r, q)); return i >= 0 ? this.rows.splice(i, 1)[0] : null },
      async countDocuments(q = {}) { return this.rows.filter((d) => matches(d, q)).length },
      async createIndex() {},
    })
  return { collection: col, cols }
}
