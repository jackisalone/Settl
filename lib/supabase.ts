import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const SUPABASE_URL = 'https://vpzlmfczldajzghgrzkp.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwemxtZmN6bGRhanpnaGdyemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODM5NDMsImV4cCI6MjA4OTY1OTk0M30.QrVFyy8UgK84VyC8ZL7lDtTcE0SxCx2-M-syU7lvE8s'

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
