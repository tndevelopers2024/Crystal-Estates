/**
 * In-memory stand-in for the CRM API used by the e2e tests.
 * Mirrors the real server's response shapes for the routes the lead pipeline
 * uses, and records every write so tests can assert the payloads.
 * Anything unmocked gets a 404 — no request ever leaves the browser.
 */

const PROJECT = {
  id: 'proj-test-1',
  name: 'Test Meadows',
  location: 'Chennai, Tamil Nadu',
  status: 'Available',
  plots: [
    { uid: 'p1-3', plotNo: '3', phase: 'Phase 1', status: 'Available', area: '1200 sq.ft', facing: 'East' },
    { uid: 'p1-5', plotNo: '5', phase: 'Phase 1', status: 'Available', area: '1500 sq.ft', facing: 'North' },
    { uid: 'p1-7', plotNo: '7', phase: 'Phase 1', status: 'Sold', area: '1200 sq.ft', facing: 'West' },
  ],
}

const AGENTS = [
  { name: 'Test Admin', initials: 'TA', color: '#0F3D2E' },
  { name: 'Test Agent', initials: 'TG', color: '#0B57D0' },
]

const STAGES = [
  { id: 'new', label: 'New leads' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'followup', label: 'Follow-up' },
  { id: 'sitevisit', label: 'Site visit' },
  { id: 'sitevisitdone', label: 'Site visit done' },
  { id: 'negotiation', label: 'Negotiation' },
  { id: 'won', label: 'Won - Booked' },
  { id: 'lost', label: 'Lost' },
]

const fmt = (n) => `₹${Math.round(Number(n)).toLocaleString('en-IN')}`

export function makeLead(overrides = {}) {
  return {
    id: 'lead-test-1',
    name: 'Asha Test',
    phone: '+919800000001',
    email: 'asha@example.test',
    property: PROJECT.name,
    propertyId: PROJECT.id,
    stage: 'negotiation',
    source: 'Website',
    budget: 0,
    budgetFormatted: 'TBD',
    assignedAgent: AGENTS[0],
    requirement: 'Plot / Land',
    unit: 'Plot 3',
    advanceReceived: null,
    upcomingFollowUps: [],
    activity: [{ id: 'act-seed', text: 'Enquiry captured', time: '1 Nov', createdAt: '2026-11-01T09:00:00.000Z' }],
    payments: [],
    createdAt: '2026-11-01T09:00:00.000Z',
    ...overrides,
  }
}

export function makeCustomer(overrides = {}) {
  return {
    id: 'cust-test-1',
    name: 'Asha Test',
    phone: '+919800000001',
    phoneKey: '9800000001',
    email: 'asha@example.test',
    emailKey: 'asha@example.test',
    city: 'Chennai',
    address: '',
    notes: '',
    tags: ['Investor'],
    status: 'active',
    source: 'Website',
    assignedAgent: { name: 'Test Admin' },
    leadIds: ['lead-test-1'],
    primaryLeadId: 'lead-test-1',
    interests: [{ propertyId: PROJECT.id, property: PROJECT.name, unit: 'Plot 3' }],
    activityCount: 2,
    totalPaid: 25500,
    paymentsCount: 1,
    lastActivityAt: '2026-11-18T10:00:00.000Z',
    convertedAt: '2026-11-02T09:00:00.000Z',
    createdAt: '2026-11-02T09:00:00.000Z',
    ...overrides,
  }
}

const seedActivity = () => [
  { id: 'ca-1', customerId: 'cust-test-1', type: 'payment', title: 'Booking advance of ₹25,500 received', details: 'Mode: Cash', occurredAt: '2026-11-18T10:00:00.000Z', amount: 25500, paymentId: 'pay-1', source: 'auto', actor: { name: 'Test Admin' } },
  { id: 'ca-2', customerId: 'cust-test-1', type: 'status', title: 'Customer profile created — Stage moved to Contacted', occurredAt: '2026-11-02T09:00:00.000Z', source: 'auto', actor: { name: 'Test Admin' } },
]

export async function mockApi(page, { leads = [makeLead()], customers = [], activity = null } = {}) {
  const state = {
    leads: structuredClone(leads),
    customers: structuredClone(customers),
    activity: structuredClone(activity || (customers.length ? seedActivity() : [])),
    writes: [],
    authHeaders: [],
  }
  const findLead = (id) => state.leads.find((l) => l.id === id)
  const findCustomer = (id) => state.customers.find((c) => c.id === id)
  const digits = (v) => String(v || '').replace(/\D/g, '').slice(-10)
  const json = (route, body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  // Signed-in CRM session (the app reads it from localStorage)
  await page.addInitScript(() => {
    localStorage.setItem('ce_crm_user', JSON.stringify({ id: 'u-test', name: 'Test Admin', email: 'admin@example.test', role: 'admin' }))
    localStorage.setItem('ce_crm_token', 'test-token')
  })

  await page.route('http://127.0.0.1:59998/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname
    const method = req.method()
    const body = req.postData() ? JSON.parse(req.postData()) : null
    if (method !== 'GET') state.writes.push({ method, path: p, body })

    if (p === '/api/auth/me') return json(route, { success: true, user: { id: 'u-test', name: 'Test Admin', email: 'admin@example.test', role: 'admin' } })

    /* ── Customers (require the CRM session like the real server) ── */
    if (p.startsWith('/api/customers')) {
      state.authHeaders.push(req.headers()['authorization'] || '')
      if (req.headers()['authorization'] !== 'Bearer test-token') return json(route, { success: false, error: 'Please sign in to the CRM again.' }, 401)
      const parts = p.split('/').slice(3) // [id?, 'activity'?, activityId?]
      if (!parts.length && method === 'GET') {
        const q = (url.searchParams.get('q') || '').toLowerCase()
        const status = url.searchParams.get('status') || 'active'
        const list = state.customers.filter(
          (c) =>
            (status === 'all' || (status === 'archived' ? c.status === 'archived' : c.status !== 'archived')) &&
            (!q || `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q)),
        )
        const archived = state.customers.filter((c) => c.status === 'archived').length
        return json(route, {
          success: true,
          customers: list,
          total: list.length,
          stats: { total: state.customers.length, active: state.customers.length - archived, archived, totalPaid: state.customers.reduce((s, c) => s + (c.totalPaid || 0), 0) },
        })
      }
      if (!parts.length && method === 'POST') {
        const dup = state.customers.find((c) => (body.phone && digits(c.phone) === digits(body.phone)) || (body.email && c.email === body.email))
        if (dup) return json(route, { success: false, error: `${dup.name} already has a profile with this phone or email.`, existingId: dup.id }, 409)
        const c = makeCustomer({ ...body, id: `cust-new-${state.customers.length + 1}`, leadIds: [], primaryLeadId: null, interests: [], totalPaid: 0, activityCount: 1, source: 'Added in CRM' })
        state.customers.push(c)
        state.activity.push({ id: `ca-n${state.activity.length}`, customerId: c.id, type: 'profile', title: 'Customer profile created in CRM', occurredAt: new Date().toISOString(), source: 'manual' })
        return json(route, { success: true, customer: c }, 201)
      }
      const customer = findCustomer(parts[0])
      if (!customer) return json(route, { success: false, error: 'Customer not found' }, 404)
      if (parts.length === 1 && method === 'GET') {
        const leadsFor = state.leads.filter((l) => customer.leadIds.includes(l.id))
        const payments = leadsFor.flatMap((l) => l.payments || [])
        return json(route, {
          success: true,
          customer,
          leads: leadsFor,
          payments,
          properties: [{ id: PROJECT.id, name: PROJECT.name, location: PROJECT.location }],
          activity: state.activity.filter((a) => a.customerId === customer.id).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)),
          totals: { paid: payments.reduce((s, x) => s + x.amount, 0), payments: payments.length },
        })
      }
      if (parts.length === 1 && method === 'PATCH') {
        const dup = body.phone && state.customers.find((c) => c.id !== customer.id && digits(c.phone) === digits(body.phone))
        if (dup) return json(route, { success: false, error: `${dup.name} already uses this phone or email.`, existingId: dup.id }, 409)
        const changed = Object.keys(body).filter((k) => JSON.stringify(customer[k]) !== JSON.stringify(body[k]))
        Object.assign(customer, body)
        if (changed.length) state.activity.push({ id: `ca-p${state.activity.length}`, customerId: customer.id, type: 'profile', title: `Profile updated: ${changed.join(', ')}`, occurredAt: new Date().toISOString(), source: 'manual' })
        return json(route, { success: true, customer, changed })
      }
      if (parts.length === 1 && method === 'DELETE') {
        state.customers = state.customers.filter((c) => c.id !== customer.id)
        return json(route, { success: true })
      }
      if (parts[1] === 'activity' && method === 'POST') {
        const a = { id: `ca-m${state.activity.length}`, customerId: customer.id, ...body, source: 'manual', actor: { name: 'Test Admin' } }
        state.activity.push(a)
        return json(route, { success: true, activity: a }, 201)
      }
      if (parts[1] === 'activity' && parts[2]) {
        const a = state.activity.find((x) => x.id === parts[2])
        if (!a) return json(route, { success: false, error: 'Activity not found' }, 404)
        if (a.source !== 'manual') return json(route, { success: false, error: 'Automatic entries can’t be edited.' }, 403)
        if (method === 'PATCH') Object.assign(a, body)
        if (method === 'DELETE') state.activity = state.activity.filter((x) => x.id !== a.id)
        return json(route, { success: true, activity: a })
      }
    }
    if (p === '/api/plots' && method === 'GET') return json(route, { success: true, plots: [PROJECT] })
    if (p === '/api/visits' && method === 'GET') return json(route, { success: true, visits: [] })
    if (p.startsWith('/api/crm-options/')) {
      const list = decodeURIComponent(p.split('/').pop())
      const values =
        list === 'paymentFor'
          ? ['Token advance', 'Booking advance', 'Part payment', 'Full payment']
          : list === 'paymentMode'
            ? ['UPI', 'Cash', 'Cheque']
            : []
      return json(route, { success: true, list, values })
    }
    if (p === '/api/leads/meta') {
      return json(route, {
        success: true,
        properties: [{ id: PROJECT.id, name: PROJECT.name }],
        agents: AGENTS,
        sources: ['Website', 'Walk-in'],
        stages: STAGES,
        paymentForOptions: ['Token advance'],
        paymentModes: ['UPI'],
      })
    }
    if (p === '/api/leads' && method === 'GET') return json(route, { success: true, leads: state.leads })

    let m = p.match(/^\/api\/leads\/([^/]+)\/payments$/)
    if (m && method === 'POST') {
      const lead = findLead(m[1])
      if (!lead) return json(route, { success: false, error: 'Lead not found' }, 404)
      const amount = Number(body.amount)
      if (!(amount > 0)) return json(route, { success: false, error: 'A valid payment amount is required' }, 400)
      const payment = {
        id: `pay-${state.writes.length}`,
        leadId: lead.id,
        paymentFor: body.paymentFor,
        amount,
        amountFormatted: body.amountFormatted || fmt(amount),
        mode: body.mode,
        referenceNo: body.referenceNo || '',
        propertyId: body.propertyId || null,
        property: body.propertyId === PROJECT.id ? PROJECT.name : lead.property,
        plotNo: body.plotNo || null,
        unitAllotted: body.unitAllotted || (body.plotNo ? `Plot ${body.plotNo}` : lead.unit),
        paidOn: body.paidOn,
        date: body.paidOn,
      }
      lead.payments.push(payment)
      lead.advanceReceived = payment.amountFormatted
      lead.unit = payment.unitAllotted
      if (body.moveLeadToWon) lead.stage = 'won'
      lead.activity.unshift({ id: `act-${state.writes.length}`, text: `${payment.paymentFor} of ${payment.amountFormatted} recorded via ${payment.mode}`, time: 'Just now' })
      return json(route, { success: true, payment, lead })
    }

    m = p.match(/^\/api\/leads\/([^/]+)\/notes$/)
    if (m && method === 'POST') {
      const lead = findLead(m[1])
      lead.activity.unshift({ id: `act-n${state.writes.length}`, text: `Note added: "${body.note}"`, time: 'Just now' })
      return json(route, { success: true, lead })
    }

    m = p.match(/^\/api\/leads\/([^/]+)\/followups$/)
    if (m && method === 'POST') {
      const lead = findLead(m[1])
      lead.upcomingFollowUps.unshift({ id: `fu-${state.writes.length}`, type: body.type, title: body.note, when: body.when, completed: false })
      lead.activity.unshift({ id: `act-f${state.writes.length}`, text: `Follow-up scheduled: ${body.type} for ${body.when}`, time: 'Just now' })
      return json(route, { success: true, lead })
    }

    m = p.match(/^\/api\/leads\/([^/]+)$/)
    if (m && method === 'PATCH') {
      const lead = findLead(m[1])
      if (body.stage && body.stage !== lead.stage) {
        lead.activity.unshift({ id: `act-s${state.writes.length}`, text: `Pipeline stage moved to "${STAGES.find((s) => s.id === body.stage)?.label}"`, time: 'Just now' })
      }
      Object.assign(lead, body)
      // Like the server: reaching a contacted stage links/creates the customer profile
      if (['contacted', 'followup', 'sitevisit', 'sitevisitdone', 'negotiation', 'won'].includes(lead.stage) && !lead.customerId) {
        let c = state.customers.find((x) => digits(x.phone) === digits(lead.phone))
        if (!c) {
          c = makeCustomer({ id: `cust-auto-${state.customers.length + 1}`, name: lead.name, phone: lead.phone, email: lead.email, leadIds: [lead.id] })
          state.customers.push(c)
          state.activity.push({ id: `ca-a${state.activity.length}`, customerId: c.id, type: 'status', title: 'Customer profile created — Stage moved to Contacted', occurredAt: new Date().toISOString(), source: 'auto' })
        } else if (!c.leadIds.includes(lead.id)) c.leadIds.push(lead.id)
        lead.customerId = c.id
      }
      return json(route, { success: true, lead })
    }

    return json(route, { success: false, error: `Route not found: ${method} ${p}` }, 404)
  })

  return state
}

export { PROJECT }
