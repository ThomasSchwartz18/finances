// pages/home/home.js

export async function initHomeTab(supabaseClient) {
    // 1) Inject HTML for Home tab
    const resp = await fetch(new URL('./home.html', import.meta.url));
    const html = await resp.text();
    document.querySelector('.container').insertAdjacentHTML('beforeend', html);
  
    // 2) DOM references
    const previewEl = document.getElementById('monthly-preview');
    const groupsContainer = document.getElementById('holdings-groups');
    const homeBtn = document.querySelector('[data-tab="home"]');
  
    // 3) Monthly overview loader
    window.loadMonthlyPreview = async function() {
      previewEl.innerHTML = '<p class="text-green-300">Loading...</p>';
      const { data: rows, error } = await supabaseClient
        .from('networth')
        .select('month, net_worth')
        .order('month', { ascending: false });
      if (error) {
        previewEl.innerHTML = `<p class="text-red-500">Error: ${error.message}</p>`;
        return;
      }
      previewEl.innerHTML = '';
      rows.forEach(r => {
        const card = document.createElement('div');
        card.className = 'bg-gray-800 p-4 rounded shadow flex justify-between';
        card.innerHTML = `
          <div>
            <p class="font-semibold text-green-200">
              ${new Date(r.month).toLocaleString('default',{month:'long',year:'numeric'})}
            </p>
            <p>Net Worth:
              <span class="font-bold text-green-100">
                $${r.net_worth.toLocaleString()}
              </span>
            </p>
          </div>`;
        previewEl.appendChild(card);
      });
    };
  
    // 4) Portfolio fetch
    async function fetchHoldings() {
      const { data, error } = await supabaseClient
        .from('holdings')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) console.error('Fetch holdings error', error);
      return data || [];
    }
  
    // 5) Price fetch (proxy for CORS)
    async function proxyFetch(url) {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Proxy fetch failed: ${res.status}`);
      return res;
    }
  
    async function fetchPrice(h) {
      if (h.type === 'stock') {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${h.ticker.toUpperCase()}&token=d1l7689r01qt4thecuogd1l7689r01qt4thecup0`
        );
        const json = await res.json();
        return json.c || 0;
      } else {
        const coinId = h.ticker.toLowerCase();
        const baseUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;
        try {
          let res = await proxyFetch(baseUrl);
          let json = await res.json();
          if (json[coinId]?.usd) return json[coinId].usd;
        } catch {};
        // fallback via search
        try {
          const searchUrl = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(h.ticker)}`;
          const searchRes = await proxyFetch(searchUrl);
          const search = await searchRes.json();
          if (search.coins?.length) {
            const id = search.coins[0].id;
            const priceRes = await proxyFetch(
              `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`
            );
            const json2 = await priceRes.json();
            if (json2[id]?.usd) return json2[id].usd;
          }
        } catch {};
        return 0;
      }
    }
  
    // 6) Grouping and rendering
    async function renderHoldings() {
      groupsContainer.innerHTML = '';
      const holdings = await fetchHoldings();
      // Group by account
      const byAccount = holdings.reduce((acc, h) => {
        acc[h.account] = acc[h.account] || [];
        acc[h.account].push(h);
        return acc;
      }, {});
  
      for (const [account, items] of Object.entries(byAccount)) {
        const section = document.createElement('div');
        section.className = 'pl-4';
        // Header
        const hdr = document.createElement('h3');
        hdr.className = 'text-lg font-semibold text-green-200';
        hdr.textContent = account;
        section.appendChild(hdr);
        // Table
        const tbl = document.createElement('table');
        tbl.className = 'w-full mt-2';
        tbl.innerHTML = `
          <thead>
            <tr>
              <th class="text-left text-green-200">Ticker</th>
              <th class="text-left text-green-200">Type</th>
              <th class="text-left text-green-200">Qty</th>
              <th class="text-left text-green-200">Price</th>
              <th class="text-left text-green-200">Value</th>
            </tr>
          </thead>
          <tbody class="text-green-100"></tbody>
        `;
        const tbody = tbl.querySelector('tbody');
        for (const h of items) {
          const price = await fetchPrice(h);
          const value = (price * h.amount).toFixed(2);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="px-2 py-1">${h.ticker.toUpperCase()}</td>
            <td class="px-2 py-1">${h.type}</td>
            <td class="px-2 py-1">${h.amount}</td>
            <td class="px-2 py-1">$${price.toLocaleString()}</td>
            <td class="px-2 py-1">$${Number(value).toLocaleString()}</td>
          `;
          tbody.appendChild(tr);
        }
        section.appendChild(tbl);
        groupsContainer.appendChild(section);
      }
    }
  
    // 7) Wire up Home button
    homeBtn.addEventListener('click', () => {
      toggleTabs('home');
      loadMonthlyPreview();
      renderHoldings();
    });
  
    // 8) Initial load
    await loadMonthlyPreview();
    await renderHoldings();
  }
  