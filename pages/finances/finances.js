// pages/finances/finances.js

export async function initFinancesTab(supabaseClient) {
  // 1) load the HTML fragment for Finances tab
  const resp = await fetch(new URL('./finances.html', import.meta.url));
  const html = await resp.text();
  document.querySelector('.container').insertAdjacentHTML('beforeend', html);

  // 2) Wire up the "Finances" tab button
  document.querySelector('[data-tab="finances"]').addEventListener('click', () => {
    toggleTabs('finances');
  });

  // --- Net Worth tracker functionality ---
  const assetsTable       = document.querySelector('#assets-table tbody');
  const liabilitiesTable  = document.querySelector('#liabilities-table tbody');
  const addAssetBtn       = document.getElementById('add-asset');
  const addLiabilityBtn   = document.getElementById('add-liability');
  const assetsTotalEl     = document.getElementById('assets-total');
  const liabilitiesTotalEl= document.getElementById('liabilities-total');
  const netWorthEl        = document.getElementById('net-worth');
  const saveMonthBtn      = document.getElementById('save-month');
  const monthPicker       = document.getElementById('month-picker');
  const ctx               = document.getElementById('networth-chart').getContext('2d');

  // Chart.js initialization
  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Assets', 'Liabilities', 'Net Worth'],
      datasets: [{
        label: 'Amount',
        data: [0, 0, 0],
        backgroundColor: ['rgba(0,255,0,0.6)', 'rgba(255,0,0,0.6)', 'rgba(0,255,0,0.6)'],
        borderColor: ['#0f0', '#f00', '#0f0'],
        borderWidth: 1,
        borderRadius: 6,
        hoverBackgroundColor: ['#0a0', '#c00', '#0a0']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } }
    }
  });

  // Update totals and chart
  function updateSummary() {
    let assetsTotal = 0;
    document.querySelectorAll('.asset-value').forEach(i => assetsTotal += parseFloat(i.value) || 0);
    let liabilitiesTotal = 0;
    document.querySelectorAll('.liability-value').forEach(i => liabilitiesTotal += parseFloat(i.value) || 0);
    const netWorth = assetsTotal - liabilitiesTotal;

    assetsTotalEl.textContent        = `$${assetsTotal.toLocaleString()}`;
    liabilitiesTotalEl.textContent   = `$${liabilitiesTotal.toLocaleString()}`;
    netWorthEl.textContent           = `$${netWorth.toLocaleString()}`;
    netWorthEl.classList.toggle('negative', netWorth < 0);
    netWorthEl.classList.toggle('positive', netWorth >= 0);

    chart.data.datasets[0].data = [assetsTotal, liabilitiesTotal, netWorth];
    chart.update();

    return { assetsTotal, liabilitiesTotal, netWorth };
  }

  // Helper to create a table row
  function createRow(table, type, prefill = { name: '', value: 0 }) {
    const tr = document.createElement('tr');

    // Name cell
    const nameTd = document.createElement('td');
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = prefill.name;
    nameInput.placeholder = `${type} Name`;
    nameInput.className = 'w-full border rounded px-2 py-1';
    if (type === 'Liability') nameInput.classList.add('text-red-400');
    nameTd.appendChild(nameInput);

    // Value cell
    const valueTd = document.createElement('td');
    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.value = prefill.value;
    valueInput.placeholder = '$0';
    valueInput.className = `${type.toLowerCase()}-value w-full border rounded px-2 py-1`;
    if (type === 'Liability') valueInput.classList.add('text-red-400');
    valueInput.addEventListener('input', updateSummary);
    valueTd.appendChild(valueInput);

    // Remove button
    const removeTd = document.createElement('td');
    const removeBtn = document.createElement('button');
    removeBtn.textContent = 'Remove';
    removeBtn.className = 'bg-gray-200 hover:bg-gray-300 text-gray-800 px-2 py-1 rounded';
    removeBtn.addEventListener('click', () => { tr.remove(); updateSummary(); });
    removeTd.appendChild(removeBtn);

    tr.append(nameTd, valueTd, removeTd);
    table.appendChild(tr);
  }

  // Helper to clear all rows
  function clearTable(tb) {
    while (tb.firstChild) tb.removeChild(tb.firstChild);
  }

  // Initialize empty rows
  addAssetBtn.addEventListener('click', () => createRow(assetsTable, 'Asset'));
  addLiabilityBtn.addEventListener('click', () => createRow(liabilitiesTable, 'Liability'));
  createRow(assetsTable, 'Asset');
  createRow(liabilitiesTable, 'Liability');
  updateSummary();

  // Save month to Supabase
  saveMonthBtn.addEventListener('click', async () => {
    const monthVal = monthPicker.value;
    if (!monthVal) return alert('Please select a month.');
    const { assetsTotal, liabilitiesTotal, netWorth } = updateSummary();

    const assets = Array.from(assetsTable.querySelectorAll('tr')).map(row => ({
      name: row.querySelector('input[type="text"]').value || '',
      value: parseFloat(row.querySelector('input[type="number"]').value) || 0
    }));
    const liabilities = Array.from(liabilitiesTable.querySelectorAll('tr')).map(row => ({
      name: row.querySelector('input[type="text"]').value || '',
      value: parseFloat(row.querySelector('input[type="number"]').value) || 0
    }));

    const { error } = await supabaseClient
      .from('networth')
      .upsert(
        [{ month: `${monthVal}-01`, assets, liabilities, assets_total: assetsTotal, liabilities_total: liabilitiesTotal, net_worth: netWorth }],
        { onConflict: 'month' }
      );

    if (error) alert('Error saving data: ' + error.message);
    else alert('Month saved successfully!');
  });

  // Auto-populate assets/liabilities when selecting an existing month
  monthPicker.addEventListener('change', async () => {
    const monthVal = monthPicker.value;
    if (!monthVal) return;
    const monthKey = `${monthVal}-01`;

    const { data, error } = await supabaseClient
      .from('networth')
      .select('assets, liabilities')
      .eq('month', monthKey)
      .maybeSingle();

    if (error) return console.error('Fetch error:', error);

    clearTable(assetsTable);
    clearTable(liabilitiesTable);

    if (data) {
      data.assets.forEach(a => createRow(assetsTable, 'Asset', { name: a.name, value: a.value }));
      data.liabilities.forEach(l => createRow(liabilitiesTable, 'Liability', { name: l.name, value: l.value }));
    } else {
      createRow(assetsTable, 'Asset');
      createRow(liabilitiesTable, 'Liability');
    }
    updateSummary();
  });

  // --- Portfolio addition functionality ---
  const accountEl = document.getElementById('holding-account');
  const typeEl    = document.getElementById('holding-type');
  const tickerEl  = document.getElementById('holding-ticker');
  const amountEl  = document.getElementById('holding-amount');
  const addBtn2   = document.getElementById('add-holding');

  addBtn2.addEventListener('click', async () => {
    const account = accountEl.value;
    const type    = typeEl.value;
    const ticker  = tickerEl.value.trim();
    const amount  = parseFloat(amountEl.value);
    if(!ticker || isNaN(amount)||amount<=0) return alert('Enter a valid ticker and quantity.');
    const {error} = await supabaseClient.from('holdings').insert([{account,type,ticker,amount}]);
    if(error) return alert('Insert error: '+error.message);
    tickerEl.value=''; amountEl.value='';
    if(window.renderHoldings) window.renderHoldings();
  });
}

