import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from 'react'
import { dataClient as api, IS_CLOUD, DEFAULT_CATEGORIES, DEFAULT_SETTINGS } from './lib/dataClient.js'
import Chart from 'chart.js/auto'

// ---------------- constants ----------------
// Live globals kept in sync by Shell so chart axis ticks and call-sites stay simple.
let CATS = DEFAULT_CATEGORIES.slice()
let CURRENCY = 'INR'
let SETTINGS = DEFAULT_SETTINGS
const currencySymbol = c => ({ INR: '₹', USD: '$', EUR: '€', GBP: '£' }[c] || '₹')
const catById = (cats, id) => (cats || CATS).find(c => c.id === id) || (cats || CATS)[(cats || CATS).length - 1] || { id: 'misc', name: 'Other', color: '#888780' }
const INR = n => currencySymbol(CURRENCY) + Math.round(n || 0).toLocaleString('en-IN')
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const fmtMonth = mk => { const [y, m] = mk.split('-'); return new Date(y, m - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }) }
const shiftMonth = (mk, delta) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + delta); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const weekOfMonth = dateStr => Math.ceil(new Date(dateStr).getDate() / 7)
const blankMonth = (mk, settings) => ({ month_key: mk, salary: 0, budgets: { total: 0, ...((settings && settings.defaultBudgets) || {}) }, expenses: [] })
const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
const gridColor = () => isDark() ? 'rgba(255,255,255,.08)' : 'rgba(60,45,20,.10)'
const tickColor = () => isDark() ? '#9c9384' : '#8a8073'
const cardColor = () => isDark() ? '#1a2127' : '#ffffff'
const axTicks = () => ({ callback: v => currencySymbol(CURRENCY) + (v / 1000) + 'k', font: { family: 'Spline Sans' }, color: tickColor() })
const catTicks = () => ({ font: { family: 'Spline Sans' }, color: tickColor() })
const legendCfg = (pos, bw) => ({ position: pos, labels: { font: { family: 'Spline Sans', size: 12 }, boxWidth: bw, color: tickColor(), usePointStyle: pos === 'top' } })
const SWATCHES = ['#5b8a8d', '#6a9b7a', '#c98a9b', '#8585b5', '#cf9270', '#6f9ac4', '#7bb39a', '#9aa3ab', '#c0635c', '#5aa89f', '#a98fc4', '#cbb26b']

const Ctx = createContext()

// Custom brand mark: an abstract ledger monogram with a coin.
function Logo({ size = 34 }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="lg-grad" x1="4" y1="4" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0.72" />
          </linearGradient>
        </defs>
        <path d="M7 6.5h11.5c4.4 0 7.5 2.9 7.5 7.2 0 4.2-3 7.1-7.4 7.1H12v4.7H7V6.5z" fill="url(#lg-grad)" />
        <rect x="12" y="11" width="9.4" height="5" rx="2.5" fill="var(--gold)" />
        <circle cx="22.5" cy="24.5" r="2.4" fill="#ffffff" fillOpacity="0.95" />
      </svg>
    </span>
  )
}

// ---------------- root ----------------
export default function App() {
  const [user, setUser] = useState(undefined) // undefined = still checking
  useEffect(() => { (async () => setUser(await api.getUser() || null))() }, [])
  if (user === undefined) return <Splash />
  if (!user) return <Auth onAuth={setUser} />
  return <Shell user={user} onLogout={async () => { await api.signOut(); setUser(null) }} />
}
function Splash() {
  return <div className="auth-wrap"><div className="brand"><Logo size={36} /><span className="serif" style={{ fontSize: 24 }}>Ledger</span></div></div>
}

// ---------------- auth ----------------
function Auth({ onAuth }) {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      const u = mode === 'in' ? await api.signIn(email.trim(), pw) : await api.signUp(email.trim(), pw)
      if (u) onAuth(u)
      else setErr('Check your email to confirm your account, then sign in.')
    } catch (e) { setErr(e.message || 'Something went wrong.') } finally { setBusy(false) }
  }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand"><Logo size={36} /><span className="serif" style={{ fontSize: 24 }}>Ledger</span></div>
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13.5, marginBottom: 8 }}>Personal expense &amp; budget tracking</p>
        <div className="seg" style={{ margin: '22px 0 6px' }}>
          <button className={mode === 'in' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('in')}>Sign in</button>
          <button className={mode === 'up' ? 'on' : ''} style={{ flex: 1 }} onClick={() => setMode('up')}>Create account</button>
        </div>
        <div className="field"><label>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" onKeyDown={e => e.key === 'Enter' && submit()} /></div>
        <div className="field"><label>Password</label>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && submit()} /></div>
        {err && <div className="err">{err}</div>}
        <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={busy} onClick={submit}>{busy ? 'Please wait…' : (mode === 'in' ? 'Sign in' : 'Create account')}</button>
        <p className="demo-note">{IS_CLOUD
          ? 'Connected to Supabase — your data syncs across devices.'
          : 'Demo mode — data is saved in this browser only. Add Supabase keys to enable real cloud login.'}</p>
      </div>
    </div>
  )
}

// ---------------- shell ----------------
function Shell({ user, onLogout }) {
  const [tab, setTab] = useState('dashboard')
  const [mk, setMk] = useState(todayKey())
  const [data, setData] = useState(null)
  const [toast, setToast] = useState(null)
  const [bump, setBump] = useState(0)
  const [settings, setSettings] = useState(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('ledger_theme') || 'light')

  // Load settings once on mount, sync module globals.
  useEffect(() => { (async () => {
    const s = await api.getSettings(user.id)
    CATS = s.categories; CURRENCY = s.currency; SETTINGS = s
    setSettings(s)
    if (!localStorage.getItem('ledger_theme') && s.themeDefault) setTheme(s.themeDefault)
  })() }, [])

  // keep globals fresh on every render once settings exist
  if (settings) { CATS = settings.categories; CURRENCY = settings.currency; SETTINGS = settings }

  const saveSettings = async patch => {
    const s = await api.saveSettings(user.id, patch)
    CATS = s.categories; CURRENCY = s.currency; SETTINGS = s
    setSettings(s); setBump(b => b + 1)
  }

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('ledger_theme', theme) }, [theme])
  useEffect(() => { if (!settings) return; let live = true; (async () => { const m = await api.getMonth(user.id, mk); if (live) setData(m || blankMonth(mk, SETTINGS)) })(); return () => { live = false } }, [mk, bump, settings])
  const persist = async next => { const saved = await api.upsertMonth(user.id, mk, next); setData(saved) }
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3200) }

  if (!settings) return <div className="empty" style={{ paddingTop: 80 }}>Loading…</div>

  const tabs = [['dashboard', 'Dashboard'], ['expenses', 'Expenses'], ['budgets', 'Budgets'], ['reports', 'Reports'], ['settings', 'Settings']]
  return (
    <Ctx.Provider value={{ user, mk, data, persist, showToast, theme, setTheme, settings, saveSettings, cats: settings.categories, refresh: () => setBump(b => b + 1) }}>
      <div className="app">
        {toast && <div className="toast"><span style={{ fontSize: 18 }}>⚠</span>{toast}</div>}
        <div className="topbar">
          <div className="brand"><Logo size={30} /><span className="serif" style={{ fontSize: 20 }}>Ledger</span></div>
          <div className="tabs">{tabs.map(([id, label]) => <button key={id} className={'tab' + (tab === id ? ' active' : '')} onClick={() => setTab(id)}>{label}</button>)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button className="theme-toggle" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} aria-label="Toggle dark mode">
              <span className="knob">{theme === 'light' ? '☀' : '☾'}</span>
            </button>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user.email}</span>
            <button className="btn btn-ghost" style={{ height: 36, padding: '0 14px', fontSize: 13 }} onClick={onLogout}>Sign out</button>
          </div>
        </div>
        <div className="main">
          {tab !== 'settings' && <MonthBar mk={mk} setMk={setMk} />}
          {tab !== 'settings' && !data ? <div className="empty">Loading…</div> : <>
            {tab === 'dashboard' && <Dashboard />}
            {tab === 'expenses' && <Expenses />}
            {tab === 'budgets' && <Budgets />}
            {tab === 'reports' && <Reports />}
            {tab === 'settings' && <Settings />}
          </>}
        </div>
      </div>
    </Ctx.Provider>
  )
}

function MonthBar({ mk, setMk }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>Viewing</div>
        <h1 style={{ fontSize: 32, marginTop: 2, lineHeight: 1.1 }}>{fmtMonth(mk)}</h1>
      </div>
      <div className="month-nav">
        <button className="arrow" onClick={() => setMk(shiftMonth(mk, -1))} aria-label="Previous month">‹</button>
        <button className="today" onClick={() => setMk(todayKey())}>Today</button>
        <button className="arrow" onClick={() => setMk(shiftMonth(mk, 1))} aria-label="Next month">›</button>
      </div>
    </div>
  )
}

function useTotals(data) {
  return useMemo(() => {
    const byCat = {}; let total = 0, unnecessary = 0
    ;(data.expenses || []).forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.amount; total += e.amount; if (e.unnecessary) unnecessary += e.amount })
    return { byCat, total, unnecessary, salary: data.salary || 0, savings: (data.salary || 0) - total }
  }, [data])
}

// ---------------- dashboard ----------------
function Dashboard() {
  const { data, persist } = useContext(Ctx)
  const t = useTotals(data)
  const [salaryInput, setSalaryInput] = useState(data.salary || '')
  useEffect(() => setSalaryInput(data.salary || ''), [data.month_key])
  const savingsRate = t.salary > 0 ? Math.round((t.savings / t.salary) * 100) : 0
  const topCats = Object.entries(t.byCat).sort((a, b) => b[1] - a[1]).slice(0, 5)
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div className="inline-field" style={{ flex: '1 1 220px' }}>
          <label>Monthly salary / income for {fmtMonth(data.month_key)}</label>
          <input type="number" value={salaryInput} onChange={e => setSalaryInput(e.target.value)} placeholder="e.g. 85000" />
        </div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '0 22px' }} onClick={() => persist({ ...data, salary: Number(salaryInput) || 0 })}>Save income</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
        <Stat label="Income" val={INR(t.salary)} />
        <Stat label="Spent" val={INR(t.total)} accent="var(--red)" />
        <Stat label="Savings" val={INR(t.savings)} accent={t.savings >= 0 ? 'var(--green)' : 'var(--red)'} />
        <Stat label="Savings rate" val={savingsRate + '%'} accent={savingsRate >= 0 ? 'var(--green)' : 'var(--red)'} />
      </div>
      <div className="row">
        <div className="card" style={{ flex: '1 1 380px' }}>
          <h2>Where the money went</h2>
          <p className="sub">Category breakdown for {fmtMonth(data.month_key)}</p>
          {topCats.length === 0 ? <div className="empty">No expenses yet. Add some in the Expenses tab.</div> : <DonutChart byCat={t.byCat} total={t.total} />}
        </div>
        <div className="card" style={{ flex: '1 1 300px' }}>
          <h2>Top categories</h2>
          <p className="sub">Your biggest spends this month</p>
          {topCats.length === 0 ? <div className="empty">Nothing logged yet.</div> : topCats.map(([cid, amt]) => {
            const c = catById(CATS, cid); const pct = t.total > 0 ? Math.round(amt / t.total * 100) : 0
            return <div key={cid} style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 5 }}>
                <span><span className="cat-dot" style={{ background: c.color }}></span>{c.name}</span>
                <span className="num" style={{ fontWeight: 500 }}>{INR(amt)} · {pct}%</span>
              </div>
              <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: c.color }}></div></div>
            </div>
          })}
        </div>
      </div>
    </div>
  )
}
function Stat({ label, val, accent }) {
  return <div className="stat"><div className="label">{label}</div><div className="val num" style={{ color: accent || 'var(--ink)' }}>{val}</div></div>
}

// ---------------- expenses ----------------
function Expenses() {
  const { data, persist, showToast } = useContext(Ctx)
  const t = useTotals(data)
  const [name, setName] = useState(''); const [amount, setAmount] = useState(''); const [category, setCategory] = useState('rent')
  const [unnecessary, setUnnecessary] = useState(false)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const budgetFor = cid => (data.budgets && data.budgets[cid]) || 0
  const unnecLimit = (data.budgets && data.budgets.unnecessary) || 0
  const add = () => {
    const amt = Number(amount); if (!name.trim() || !amt) return
    const b = budgetFor(category); const already = t.byCat[category] || 0; const c = catById(CATS, category)
    if (b > 0 && already >= b) showToast(`Budget exceeded for ${c.name} — already ${INR(already)} of ${INR(b)} budget!`)
    else if (b > 0 && already + amt > b) showToast(`This spend pushes ${c.name} over budget (${INR(already + amt)} / ${INR(b)})!`)
    if (unnecessary && unnecLimit > 0) {
      const after = t.unnecessary + amt
      if (t.unnecessary >= unnecLimit) showToast(`Heads up — you've already spent ${INR(t.unnecessary)} on unnecessary things, past your ${INR(unnecLimit)} limit. Added anyway.`)
      else if (after > unnecLimit) showToast(`This pushes your unnecessary spending to ${INR(after)}, over your ${INR(unnecLimit)} limit. Added anyway.`)
    }
    persist({ ...data, expenses: [{ id: Date.now(), name: name.trim(), amount: amt, category, date, unnecessary }, ...(data.expenses || [])] })
    setName(''); setAmount(''); setUnnecessary(false)
  }
  const remove = id => persist({ ...data, expenses: data.expenses.filter(e => e.id !== id) })
  const toggleUnnec = id => persist({ ...data, expenses: data.expenses.map(e => e.id === id ? { ...e, unnecessary: !e.unnecessary } : e) })
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2>Add an expense</h2>
        <p className="sub">Log a spend and assign it a category. Flag impulse buys as unnecessary to track waste.</p>
        <div className="add-row">
          <div className="inline-field"><label>Description</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly rent" onKeyDown={e => e.key === 'Enter' && add()} /></div>
          <div className="inline-field"><label>Amount ({currencySymbol(CURRENCY)})</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" onKeyDown={e => e.key === 'Enter' && add()} /></div>
          <div className="inline-field"><label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>{CATS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0 20px' }} onClick={add}>Add</button>
        </div>
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
          <div className="inline-field" style={{ maxWidth: 200 }}><label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <label className="check" style={{ height: 40, alignItems: 'center' }}>
            <input type="checkbox" checked={unnecessary} onChange={e => setUnnecessary(e.target.checked)} />
            Flag as unnecessary (impulse / avoidable)
          </label>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h2>This month's expenses</h2>
          <span style={{ fontSize: 14, color: 'var(--muted)' }}>Total <strong className="num" style={{ color: 'var(--ink)' }}>{INR(t.total)}</strong></span>
        </div>
        {(!data.expenses || data.expenses.length === 0) ? <div className="empty">No expenses logged for {fmtMonth(data.month_key)} yet.</div> :
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Description</th><th>Category</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'center' }}>Unnecessary</th><th></th></tr></thead>
            <tbody>{data.expenses.map(e => { const c = catById(CATS, e.category); return (
              <tr key={e.id}>
                <td style={{ fontWeight: 500 }}>{e.name}{e.unnecessary && <span className="unnec-badge" style={{ marginLeft: 8 }}>⚠</span>}</td>
                <td><span className="tag" style={{ background: c.color + '22', color: c.color }}>{c.name}</span></td>
                <td style={{ color: 'var(--muted)' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td style={{ textAlign: 'right', fontWeight: 500 }} className="num">{INR(e.amount)}</td>
                <td style={{ textAlign: 'center' }}>
                  <input type="checkbox" checked={!!e.unnecessary} onChange={() => toggleUnnec(e.id)}
                    title="Mark this expense as unnecessary" style={{ width: 17, height: 17, accentColor: 'var(--red)', cursor: 'pointer' }} /></td>
                <td style={{ textAlign: 'right' }}><button className="icon-btn" onClick={() => remove(e.id)} title="Delete">✕</button></td>
              </tr>) })}
            </tbody>
          </table>}
      </div>
    </div>
  )
}

// ---------------- budgets ----------------
function Budgets() {
  const { data, persist } = useContext(Ctx)
  const t = useTotals(data)
  // Store budget fields as raw strings while editing so partial input ("", "1", "12")
  // is never coerced mid-keystroke. Numbers are parsed only when persisting.
  const toStr = obj => { const o = {}; Object.keys(obj || {}).forEach(k => { o[k] = obj[k] === 0 ? '' : String(obj[k]) }); return o }
  const [budgets, setBudgets] = useState(() => toStr(data.budgets))
  useEffect(() => setBudgets(toStr(data.budgets)), [data.month_key])
  const setB = (k, v) => setBudgets(p => ({ ...p, [k]: v }))
  const numericBudgets = () => { const o = {}; Object.keys(budgets).forEach(k => { o[k] = Number(budgets[k]) || 0 }); return o }
  const saveBudgets = () => persist({ ...data, budgets: numericBudgets() })
  const num = k => Number(budgets[k]) || 0
  const totalBudget = num('total')
  const fragmentSum = CATS.reduce((s, c) => s + num(c.id), 0)
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="card">
        <h2>Overall monthly budget</h2>
        <p className="sub">Set a ceiling for total spending, then break it down by category below.</p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="inline-field" style={{ flex: '1 1 220px' }}><label>Total budget (₹)</label>
            <input type="number" value={budgets.total || ''} onChange={e => setB('total', e.target.value)} onBlur={saveBudgets} placeholder="e.g. 60000" /></div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0 22px' }} onClick={saveBudgets}>Save budgets</button>
        </div>
        {totalBudget > 0 && <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
            <span>Spent {INR(t.total)} of {INR(totalBudget)}</span>
            <span style={{ color: t.total > totalBudget ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
              {t.total > totalBudget ? `Over by ${INR(t.total - totalBudget)}` : `${INR(totalBudget - t.total)} left`}</span>
          </div>
          <div className="bar-track" style={{ height: 12 }}>
            <div className="bar-fill" style={{ width: Math.min(100, totalBudget ? t.total / totalBudget * 100 : 0) + '%', background: t.total > totalBudget ? 'var(--red)' : 'var(--gold)' }}></div></div>
          {fragmentSum > totalBudget && <p style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>⚠ Your category budgets ({INR(fragmentSum)}) add up to more than your total budget.</p>}
        </div>}
      </div>
      <div className="card">
        <h2>Unnecessary spending limit</h2>
        <p className="sub">Set a monthly cap for things you flag as unnecessary. When a new unnecessary expense crosses this, you'll get a soft warning (it still adds).</p>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="inline-field" style={{ flex: '1 1 220px' }}><label>Unnecessary limit (₹)</label>
            <input type="number" value={budgets.unnecessary || ''} onChange={e => setB('unnecessary', e.target.value)} onBlur={saveBudgets} placeholder="e.g. 5000" /></div>
        </div>
        {num('unnecessary') > 0 && <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
            <span>Unnecessary spend {INR(t.unnecessary)} of {INR(num('unnecessary'))}</span>
            <span style={{ color: t.unnecessary > num('unnecessary') ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
              {t.unnecessary > num('unnecessary') ? `Over by ${INR(t.unnecessary - num('unnecessary'))}` : `${INR(num('unnecessary') - t.unnecessary)} left`}</span>
          </div>
          <div className="bar-track" style={{ height: 12 }}>
            <div className="bar-fill" style={{ width: Math.min(100, t.unnecessary / num('unnecessary') * 100) + '%', background: t.unnecessary > num('unnecessary') ? 'var(--red)' : 'var(--gold)' }}></div></div>
        </div>}
      </div>
      <div className="card">
        <h2>Category budgets</h2>
        <p className="sub">Spend in a category turns red once it crosses its limit. A warning pops up when you try to add more.</p>
        <table>
          <thead><tr><th>Category</th><th style={{ width: 160 }}>Monthly limit</th><th>Spent</th><th style={{ width: 200 }}>Progress</th></tr></thead>
          <tbody>{CATS.map(c => {
            const lim = num(c.id); const spent = t.byCat[c.id] || 0
            const pct = lim > 0 ? Math.min(100, spent / lim * 100) : 0; const over = lim > 0 && spent > lim
            return <tr key={c.id}>
              <td style={{ fontWeight: 500 }}><span className="cat-dot" style={{ background: c.color }}></span>{c.name}</td>
              <td><input type="number" value={budgets[c.id] || ''} onChange={e => setB(c.id, e.target.value)} onBlur={saveBudgets} placeholder="—"
                style={{ width: 130, height: 36, padding: '0 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--paper-2)', color: 'var(--ink)' }} /></td>
              <td className="num" style={{ color: over ? 'var(--red)' : 'var(--ink)', fontWeight: over ? 600 : 400 }}>
                {INR(spent)}{over && <span className="pill" style={{ background: 'var(--red-bg)', color: 'var(--red)', marginLeft: 8 }}>OVER</span>}</td>
              <td>{lim > 0 ? <div className="bar-track"><div className="bar-fill" style={{ width: pct + '%', background: over ? 'var(--red)' : c.color }}></div></div> : <span style={{ color: 'var(--muted)', fontSize: 13 }}>No limit</span>}</td>
            </tr>
          })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ---------------- reports ----------------
function Reports() {
  const { user, data, mk } = useContext(Ctx)
  const [view, setView] = useState('category')
  const [prev, setPrev] = useState(null)
  const [allMonths, setAllMonths] = useState([])
  const prevMk = shiftMonth(mk, -1)
  useEffect(() => { (async () => {
    setPrev(await api.getMonth(user.id, prevMk) || blankMonth(prevMk, SETTINGS))
    setAllMonths(await api.listMonths(user.id))
  })() }, [mk])
  const t = useTotals(data); const pt = useTotals(prev || blankMonth(prevMk, SETTINGS))
  const weeks = [1, 2, 3, 4, 5].map(w => ({ week: w, amount: (data.expenses || []).filter(e => weekOfMonth(e.date) === w).reduce((s, e) => s + e.amount, 0) })).filter(w => w.amount > 0 || w.week <= 4)
  const avg = allMonths.length ? allMonths.reduce((s, m) => s + (m.expenses || []).reduce((a, e) => a + e.amount, 0), 0) / allMonths.length : 0
  const unnecItems = (data.expenses || []).filter(e => e.unnecessary).sort((a, b) => b.amount - a.amount)
  const unnecShareTotal = t.total > 0 ? Math.round(t.unnecessary / t.total * 100) : 0
  const unnecShareIncome = t.salary > 0 ? Math.round(t.unnecessary / t.salary * 100) : 0
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div className="row">
        <Stat2 label="This month spent" val={INR(t.total)} />
        <Stat2 label="Last month spent" val={INR(pt.total)} />
        <Stat2 label="Change" val={(t.total - pt.total >= 0 ? '+' : '') + INR(t.total - pt.total)} accent={t.total > pt.total ? 'var(--red)' : 'var(--green)'} />
        <Stat2 label="Unnecessary spend" val={INR(t.unnecessary)} accent={t.unnecessary > 0 ? 'var(--red)' : 'var(--green)'} />
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div><h2>Spending breakdown</h2><p className="sub" style={{ margin: 0 }}>{fmtMonth(mk)}</p></div>
          <div className="seg">
            <button className={view === 'category' ? 'on' : ''} onClick={() => setView('category')}>By category</button>
            <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>By week</button>
            <button className={view === 'compare' ? 'on' : ''} onClick={() => setView('compare')}>vs last month</button>
          </div>
        </div>
        {view === 'category' && (Object.keys(t.byCat).length === 0 ? <div className="empty">No data for this month.</div> : <BarByCategory byCat={t.byCat} />)}
        {view === 'week' && <BarByWeek weeks={weeks} />}
        {view === 'compare' && <CompareChart cur={t.byCat} prev={pt.byCat} curLabel={fmtMonth(mk)} prevLabel={fmtMonth(prevMk)} />}
      </div>
      <div className="card">
        <h2>Unnecessary spending <span className="unnec-badge" style={{ marginLeft: 6, verticalAlign: 'middle' }}>⚠</span></h2>
        <p className="sub">Money that went to impulse or avoidable buys this month — and what it cost you.</p>
        {unnecItems.length === 0 ? <div className="empty">Nothing flagged as unnecessary this month. Nice.</div> : <>
          <div className="row" style={{ marginBottom: 18 }}>
            <Stat2 label="Total wasted" val={INR(t.unnecessary)} accent="var(--red)" />
            <Stat2 label="Share of spending" val={unnecShareTotal + '%'} accent="var(--red)" />
            <Stat2 label="Share of income" val={unnecShareIncome + '%'} accent="var(--red)" />
          </div>
          <table>
            <thead><tr><th>Item</th><th>Category</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
            <tbody>{unnecItems.map(e => { const c = catById(CATS, e.category); return (
              <tr key={e.id}>
                <td style={{ fontWeight: 500 }}>{e.name}</td>
                <td><span className="tag" style={{ background: c.color + '22', color: c.color }}>{c.name}</span></td>
                <td style={{ color: 'var(--muted)' }}>{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                <td style={{ textAlign: 'right', fontWeight: 500, color: 'var(--red)' }} className="num">{INR(e.amount)}</td>
              </tr>) })}
            </tbody>
          </table>
          {t.salary > 0 && <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 12 }}>If you cut this out, you'd save <strong style={{ color: 'var(--green)' }}>{INR(t.unnecessary * 12)}</strong> a year.</p>}
        </>}
      </div>
      <div className="card">
        <h2>Income vs spending vs savings</h2>
        <p className="sub">Your trend across all tracked months</p>
        {allMonths.length === 0 ? <div className="empty">Track a few months to see your trend line.</div> : <TrendChart months={allMonths} />}
      </div>
    </div>
  )
}
function Stat2(props) { return <div style={{ flex: '1 1 180px' }}><Stat {...props} /></div> }

// ---------------- settings ----------------
function ColorPicker({ value, onChange, dropUp }) {
  const [open, setOpen] = useState(false)
  const pos = dropUp ? { bottom: 42 } : { top: 42 }
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} aria-label="Pick colour"
        style={{ width: 38, height: 38, borderRadius: 10, background: value, border: '2px solid var(--card)', boxShadow: '0 0 0 1px var(--line-2)', cursor: 'pointer' }}></button>
      {open && <div style={{ position: 'absolute', zIndex: 50, left: 0, ...pos, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 10, boxShadow: 'var(--shadow-lift)', display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, width: 220 }}>
        {SWATCHES.map(s => <button key={s} onClick={() => { onChange(s); setOpen(false) }} aria-label={s}
          style={{ width: 26, height: 26, borderRadius: 7, background: s, border: value === s ? '2px solid var(--ink)' : '2px solid transparent', cursor: 'pointer' }}></button>)}
      </div>}
    </div>
  )
}
function Settings() {
  const { settings, saveSettings, theme, setTheme, showToast } = useContext(Ctx)
  const [cats, setCats] = useState(settings.categories)
  const [newName, setNewName] = useState(''); const [newColor, setNewColor] = useState(SWATCHES[0])
  const [currency, setCurrency] = useState(settings.currency)
  const [monthStart, setMonthStart] = useState(settings.monthStart || 1)
  const [defBud, setDefBud] = useState(() => { const o = {}; Object.keys(settings.defaultBudgets || {}).forEach(k => o[k] = String(settings.defaultBudgets[k])); return o })

  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('cat' + Date.now())
  const addCat = () => { if (!newName.trim()) return; const id = slug(newName); if (cats.some(c => c.id === id)) { showToast('A category with a similar name already exists.'); return } setCats([...cats, { id, name: newName.trim(), color: newColor }]); setNewName('') }
  const renameCat = (id, name) => setCats(cats.map(c => c.id === id ? { ...c, name } : c))
  const recolorCat = (id, color) => setCats(cats.map(c => c.id === id ? { ...c, color } : c))
  const removeCat = id => { if (cats.length <= 1) { showToast('Keep at least one category.'); return } setCats(cats.filter(c => c.id !== id)) }
  const setBud = (k, v) => setDefBud(p => ({ ...p, [k]: v }))

  const saveCats = () => { saveSettings({ categories: cats }); showToast('Categories saved.') }
  const saveDefaults = () => { const o = {}; Object.keys(defBud).forEach(k => { const n = Number(defBud[k]); if (n > 0) o[k] = n }); saveSettings({ defaultBudgets: o }); showToast('Default budgets saved — they seed new months.') }
  const savePrefs = () => { saveSettings({ currency, monthStart: Number(monthStart), themeDefault: theme }); showToast('Preferences saved.') }

  const fieldStyle = { height: 36, padding: '0 10px', border: '1px solid var(--line-2)', borderRadius: 8, background: 'var(--paper-2)', color: 'var(--ink)' }
  return (
    <div className="grid" style={{ gap: 20 }}>
      <div><h1 style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 2 }}>Settings</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Manage your categories, default budgets, and preferences. Changes apply to new months; existing months keep their own data.</p></div>

      <div className="card">
        <h2>Categories</h2>
        <p className="sub">Add, rename, recolour, or remove. These carry forward across all months.</p>
        <table>
          <thead><tr><th style={{ width: 90 }}>Colour</th><th>Name</th><th style={{ width: 60 }}></th></tr></thead>
          <tbody>{cats.map(c => (
            <tr key={c.id}>
              <td><ColorPicker value={c.color} onChange={col => recolorCat(c.id, col)} /></td>
              <td><input value={c.name} onChange={e => renameCat(c.id, e.target.value)} style={{ ...fieldStyle, width: '100%', maxWidth: 280 }} /></td>
              <td style={{ textAlign: 'right' }}><button className="icon-btn" onClick={() => removeCat(c.id)} title="Remove">✕</button></td>
            </tr>))}
          </tbody>
        </table>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
          <div className="inline-field"><label>New category</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Subscriptions" onKeyDown={e => e.key === 'Enter' && addCat()} style={{ minWidth: 200 }} /></div>
          <div className="inline-field"><label>Colour</label><ColorPicker value={newColor} onChange={setNewColor} dropUp /></div>
          <button className="btn btn-ghost" style={{ height: 40, padding: '0 16px' }} onClick={addCat}>+ Add</button>
          <div style={{ flex: 1 }}></div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0 22px' }} onClick={saveCats}>Save categories</button>
        </div>
      </div>

      <div className="card">
        <h2>Default budgets</h2>
        <p className="sub">Set the budgets a brand-new month should start with. You can still override any month in the Budgets tab.</p>
        <table>
          <thead><tr><th>Category</th><th style={{ width: 180 }}>Default monthly budget</th></tr></thead>
          <tbody>
            <tr><td style={{ fontWeight: 500 }}>Overall total</td>
              <td><input type="number" value={defBud.total || ''} onChange={e => setBud('total', e.target.value)} placeholder="—" style={{ ...fieldStyle, width: 150 }} /></td></tr>
            {cats.map(c => (
              <tr key={c.id}><td style={{ fontWeight: 500 }}><span className="cat-dot" style={{ background: c.color }}></span>{c.name}</td>
                <td><input type="number" value={defBud[c.id] || ''} onChange={e => setBud(c.id, e.target.value)} placeholder="—" style={{ ...fieldStyle, width: 150 }} /></td></tr>))}
            <tr><td style={{ fontWeight: 500 }}>Unnecessary limit</td>
              <td><input type="number" value={defBud.unnecessary || ''} onChange={e => setBud('unnecessary', e.target.value)} placeholder="—" style={{ ...fieldStyle, width: 150 }} /></td></tr>
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: 16 }}><button className="btn btn-primary" style={{ width: 'auto', padding: '0 22px' }} onClick={saveDefaults}>Save defaults</button></div>
      </div>

      <div className="card">
        <h2>Preferences</h2>
        <p className="sub">Currency, when your financial month begins, and your default theme.</p>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="inline-field"><label>Currency</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={{ minWidth: 150 }}>
              <option value="INR">₹ Indian Rupee (INR)</option>
              <option value="USD">$ US Dollar (USD)</option>
              <option value="EUR">€ Euro (EUR)</option>
              <option value="GBP">£ British Pound (GBP)</option>
            </select></div>
          <div className="inline-field"><label>Month starts on day</label>
            <input type="number" min="1" max="28" value={monthStart} onChange={e => setMonthStart(e.target.value)} style={{ width: 120 }} /></div>
          <div className="inline-field"><label>Default theme</label>
            <div className="seg" style={{ height: 40 }}>
              <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>Light</button>
              <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>Dark</button>
            </div></div>
          <div style={{ flex: 1 }}></div>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0 22px' }} onClick={savePrefs}>Save preferences</button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>Month-start day is stored for your records; weekly report grouping still uses calendar weeks in this version.</p>
      </div>
    </div>
  )
}

// ---------------- charts ----------------
function useChart(cfg, deps) {
  const ref = useRef(); const inst = useRef()
  const { theme } = useContext(Ctx)
  useEffect(() => { if (!ref.current) return; inst.current = new Chart(ref.current, cfg()); return () => inst.current && inst.current.destroy() }, [...deps, theme])
  return ref
}
function DonutChart({ byCat, total }) {
  const e = Object.entries(byCat)
  const ref = useChart(() => ({ type: 'doughnut',
    data: { labels: e.map(([id]) => catById(CATS, id).name), datasets: [{ data: e.map(([, v]) => v), backgroundColor: e.map(([id]) => catById(CATS, id).color), borderWidth: 3, borderColor: cardColor() }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '64%', plugins: { legend: { position: 'right', labels: { font: { family: 'Spline Sans', size: 12 }, padding: 12, boxWidth: 12, color: tickColor() } }, tooltip: { callbacks: { label: c => ` ${c.label}: ₹${Math.round(c.raw).toLocaleString('en-IN')} (${Math.round(c.raw / total * 100)}%)` } } } } }), [JSON.stringify(byCat)])
  return <div style={{ position: 'relative', height: 260 }}><canvas ref={ref} role="img" aria-label="Donut chart of spending by category"></canvas></div>
}
function BarByCategory({ byCat }) {
  const e = Object.entries(byCat).sort((a, b) => b[1] - a[1])
  const ref = useChart(() => ({ type: 'bar',
    data: { labels: e.map(([id]) => catById(CATS, id).name), datasets: [{ data: e.map(([, v]) => v), backgroundColor: e.map(([id]) => catById(CATS, id).color), borderRadius: 6 }] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ₹' + Math.round(c.raw).toLocaleString('en-IN') } } }, scales: { x: { ticks: axTicks(), grid: { color: gridColor() } }, y: { grid: { display: false }, ticks: catTicks() } } } }), [JSON.stringify(byCat)])
  return <div style={{ position: 'relative', height: Math.max(220, e.length * 44 + 40) }}><canvas ref={ref} role="img" aria-label="Bar chart of spending by category"></canvas></div>
}
function BarByWeek({ weeks }) {
  const ref = useChart(() => ({ type: 'bar',
    data: { labels: weeks.map(w => 'Week ' + w.week), datasets: [{ data: weeks.map(w => w.amount), backgroundColor: '#5aa89f', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ₹' + Math.round(c.raw).toLocaleString('en-IN') } } }, scales: { y: { ticks: axTicks(), grid: { color: gridColor() } }, x: { grid: { display: false }, ticks: catTicks() } } } }), [JSON.stringify(weeks)])
  return <div style={{ position: 'relative', height: 260 }}><canvas ref={ref} role="img" aria-label="Bar chart of spending by week"></canvas></div>
}
function CompareChart({ cur, prev, curLabel, prevLabel }) {
  const ids = [...new Set([...Object.keys(cur), ...Object.keys(prev)])]
  const ref = useChart(() => ({ type: 'bar',
    data: { labels: ids.map(id => catById(CATS, id).name), datasets: [
      { label: prevLabel, data: ids.map(id => prev[id] || 0), backgroundColor: isDark() ? '#3a454e' : '#d2d9dc', borderRadius: 5 },
      { label: curLabel, data: ids.map(id => cur[id] || 0), backgroundColor: '#5aa89f', borderRadius: 5 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legendCfg('top', 12), tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ₹' + Math.round(c.raw).toLocaleString('en-IN') } } }, scales: { y: { ticks: axTicks(), grid: { color: gridColor() } }, x: { grid: { display: false }, ticks: catTicks() } } } }), [JSON.stringify(cur), JSON.stringify(prev)])
  return ids.length === 0 ? <div className="empty">No data to compare.</div> : <div style={{ position: 'relative', height: 300 }}><canvas ref={ref} role="img" aria-label="Comparison of spending vs last month"></canvas></div>
}
function TrendChart({ months }) {
  const labels = months.map(m => fmtMonth(m.month_key).split(' ')[0].slice(0, 3))
  const income = months.map(m => m.salary || 0)
  const spent = months.map(m => (m.expenses || []).reduce((s, e) => s + e.amount, 0))
  const savings = months.map((m, i) => income[i] - spent[i])
  const ref = useChart(() => ({ type: 'line',
    data: { labels, datasets: [
      { label: 'Income', data: income, borderColor: '#3f8f6b', tension: .35, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#3f8f6b' },
      { label: 'Spending', data: spent, borderColor: '#c0635c', borderDash: [6, 4], tension: .35, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#c0635c' },
      { label: 'Savings', data: savings, borderColor: '#5aa89f', backgroundColor: '#5aa89f2e', tension: .35, fill: true, borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#5aa89f' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: legendCfg('top', 14), tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ₹' + Math.round(c.raw).toLocaleString('en-IN') } } }, scales: { y: { ticks: axTicks(), grid: { color: gridColor() } }, x: { grid: { display: false }, ticks: catTicks() } } } }), [JSON.stringify(months)])
  return <div style={{ position: 'relative', height: 300 }}><canvas ref={ref} role="img" aria-label="Line chart of income, spending and savings over time"></canvas></div>
}
