import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://sfewurguxogwodnfomfc.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNmZXd1cmd1eG9nd29kbmZvbWZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5Mzk5NzYsImV4cCI6MjA2NDUxNTk3Nn0.azcQXQfujx06oG8ffxPSUCh4n_T-Gi5qfgpbQ8ADf_I'
export const supabase = createClient(supabaseUrl, supabaseKey)