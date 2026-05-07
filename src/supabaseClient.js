import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jwizhhucznaoakaemojw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp3aXpoaHVjem5hb2FrYWVtb2p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4NzE0MTksImV4cCI6MjA5MzQ0NzQxOX0.J9leTDFwGJ4kvIDB5FlzxkDGZwSBRCaS_MxmvLhjctA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
