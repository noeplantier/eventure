import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lhiqmyyxunpoyqdqkcnb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoaXFteXl4dW5wb3lxZHFrY25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njc2OTIsImV4cCI6MjA5NjM0MzY5Mn0.ZTrIWdXK1b8-qMdISiSinaBWRXi-pcR0syoqfyFmtPE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
export const isMockMode = false;