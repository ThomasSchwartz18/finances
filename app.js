// app.js :contentReference[oaicite:1]{index=1}
import { createClient }    from '@supabase/supabase-js';
import { initHomeTab }     from './pages/home/home.js';
import { initFinancesTab } from './pages/finances/finances.js';

const supabaseUrl = 'https://fyjtfocpvmgctzpgxsng.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5anRmb2Nwdm1nY3R6cGd4c25nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE3MzI4MTEsImV4cCI6MjA2NzMwODgxMX0.MnU0es_uAhGGva8G3NR7qujZk3ujicZbz0pmizvv7pw';
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// helper to switch tabs
window.toggleTabs = tabId => {
  document.querySelectorAll('.tab-content')
          .forEach(el => el.classList.add('hidden'));
  document.getElementById(`${tabId}-tab`)
          .classList.remove('hidden');
};

document.addEventListener('DOMContentLoaded', async () => {
  await initHomeTab(supabaseClient);
  await initFinancesTab(supabaseClient);
  document.querySelector('[data-tab="home"]').click();

  // Optional typing effect
  function typePrompt(el, text, speed = 50) {
    let i = 0;
    const iv = setInterval(() => {
      el.textContent += text[i++]||'';
      if (i > text.length) clearInterval(iv);
    }, speed);
  }
  document.querySelectorAll('.term-header')
          .forEach(h=>typePrompt(h, h.textContent.trim()));
});
