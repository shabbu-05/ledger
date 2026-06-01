// ============================================================================
// dataClient.js
// A single abstraction layer the whole app talks to.
//
// It has TWO backends:
//   1. SUPABASE  -> used automatically when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
//                   are present (i.e. on Netlify with your env vars set).
//   2. DEMO/LOCAL -> used when those env vars are absent (i.e. the live preview here,
//                    or local dev before you add keys). Persists to localStorage so
//                    your clicking-around survives refreshes.
//
// The rest of the app NEVER imports supabase directly. It only calls the methods
// below, so swapping demo <-> cloud requires zero component changes.
// ============================================================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const IS_CLOUD = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// ----------------------------------------------------------------------------
// CLOUD BACKEND (Supabase)
// ----------------------------------------------------------------------------
let supabase = null;
async function getSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabase;
}

const cloudClient = {
  async signUp(email, password) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
    return data.user;
  },
  async signIn(email, password) {
    const sb = await getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  },
  async signOut() {
    const sb = await getSupabase();
    await sb.auth.signOut();
  },
  async getUser() {
    const sb = await getSupabase();
    const { data } = await sb.auth.getUser();
    return data.user;
  },
  async getMonth(userId, monthKey) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('months')
      .select('*')
      .eq('user_id', userId)
      .eq('month_key', monthKey)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  async listMonths(userId) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('months')
      .select('*')
      .eq('user_id', userId)
      .order('month_key', { ascending: true });
    if (error) throw error;
    return data || [];
  },
  async upsertMonth(userId, monthKey, payload) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('months')
      .upsert(
        { user_id: userId, month_key: monthKey, ...payload },
        { onConflict: 'user_id,month_key' }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },
  async getSettings(userId) {
    const sb = await getSupabase();
    const { data, error } = await sb
      .from('settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(data.data || {}) };
  },
  async saveSettings(userId, patch) {
    const sb = await getSupabase();
    const current = await this.getSettings(userId);
    const merged = { ...current, ...patch };
    const { error } = await sb
      .from('settings')
      .upsert({ user_id: userId, data: merged }, { onConflict: 'user_id' });
    if (error) throw error;
    return merged;
  },
};

// ----------------------------------------------------------------------------
// Shared defaults
// ----------------------------------------------------------------------------
export const DEFAULT_CATEGORIES = [
  { id: 'rent', name: 'Rent', color: '#5b8a8d' },
  { id: 'groceries', name: 'Groceries', color: '#6a9b7a' },
  { id: 'hotel', name: 'Hotel & Dining', color: '#c98a9b' },
  { id: 'emi', name: 'EMI', color: '#8585b5' },
  { id: 'fuel', name: 'Fuel', color: '#cf9270' },
  { id: 'utilities', name: 'Utilities', color: '#6f9ac4' },
  { id: 'family', name: 'Parents / Family', color: '#7bb39a' },
  { id: 'misc', name: 'Miscellaneous', color: '#9aa3ab' },
];
export const DEFAULT_SETTINGS = { categories: DEFAULT_CATEGORIES, defaultBudgets: {}, currency: 'INR', monthStart: 1, themeDefault: 'light' };

// ----------------------------------------------------------------------------
// DEMO BACKEND (localStorage) - mirrors the cloud API exactly
// ----------------------------------------------------------------------------
const LS_KEY = 'expense_tracker_demo_v1';

function loadDemo() {
  try {
    const d = JSON.parse(localStorage.getItem(LS_KEY)) || {};
    d.users = d.users || {};
    d.months = d.months || {};
    d.settings = d.settings || {};
    if (!('session' in d)) d.session = null;
    return d;
  } catch {
    return { users: {}, session: null, months: {}, settings: {} };
  }
}
function saveDemo(db) {
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

const demoClient = {
  async signUp(email, password) {
    const db = loadDemo();
    if (db.users[email]) throw new Error('An account with this email already exists.');
    const user = { id: 'demo-' + email, email };
    db.users[email] = { password, user };
    db.session = user;
    db.settings = db.settings || {};
    db.settings[user.id] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    saveDemo(db);
    return user;
  },
  async signIn(email, password) {
    const db = loadDemo();
    const rec = db.users[email];
    if (!rec || rec.password !== password) throw new Error('Invalid email or password.');
    db.session = rec.user;
    saveDemo(db);
    return rec.user;
  },
  async signOut() {
    const db = loadDemo();
    db.session = null;
    saveDemo(db);
  },
  async getUser() {
    return loadDemo().session;
  },
  async getSettings(userId) {
    const db = loadDemo();
    return { ...DEFAULT_SETTINGS, ...((db.settings || {})[userId] || {}) };
  },
  async saveSettings(userId, patch) {
    const db = loadDemo();
    db.settings = db.settings || {};
    db.settings[userId] = { ...DEFAULT_SETTINGS, ...(db.settings[userId] || {}), ...patch };
    saveDemo(db);
    return db.settings[userId];
  },
  async getMonth(userId, monthKey) {
    const db = loadDemo();
    return db.months[`${userId}:${monthKey}`] || null;
  },
  async listMonths(userId) {
    const db = loadDemo();
    return Object.entries(db.months)
      .filter(([k]) => k.startsWith(userId + ':'))
      .map(([, v]) => v)
      .sort((a, b) => a.month_key.localeCompare(b.month_key));
  },
  async upsertMonth(userId, monthKey, payload) {
    const db = loadDemo();
    const key = `${userId}:${monthKey}`;
    const existing = db.months[key] || { user_id: userId, month_key: monthKey };
    db.months[key] = { ...existing, ...payload };
    saveDemo(db);
    return db.months[key];
  },
};

export const dataClient = IS_CLOUD ? cloudClient : demoClient;
