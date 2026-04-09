/* ========================================================
   Calculá tu Precio — Argentine Freelancer Price Calculator
   Core application logic with live API data
   ======================================================== */

// ===================== STATE =====================

const state = {
  // Live data from APIs
  dolarMep: null,
  dolarBlue: null,
  inflacionMensual: null,
  inflacionAnual: null,
  dataLoaded: false,

  // Expenses
  gastosTrabajo: [
    { name: 'Monotributo (se calcula)', amount: 0, currency: 'ARS', autoMono: true },
    { name: 'Contadora / Gestoría', amount: 45000, currency: 'ARS' },
    { name: 'Internet', amount: 28000, currency: 'ARS' },
    { name: 'Celular', amount: 18000, currency: 'ARS' },
    { name: 'Adobe CC', amount: 55, currency: 'USD' },
    { name: 'Marketing / SEO', amount: 30000, currency: 'ARS' },
  ],
  gastosPersonales: [
    { name: 'Alquiler / Hipoteca', amount: 350000, currency: 'ARS' },
    { name: 'Supermercado', amount: 280000, currency: 'ARS' },
    { name: 'Servicios (luz, gas, agua)', amount: 65000, currency: 'ARS' },
    { name: 'Transporte', amount: 45000, currency: 'ARS' },
    { name: 'Salud / Gimnasio', amount: 40000, currency: 'ARS' },
    { name: 'Ocio', amount: 50000, currency: 'ARS' },
  ],
  habitos: [
    { name: 'Café diario', amount: 2500, currency: 'ARS' },
    { name: 'Almuerzo / Vianda', amount: 6500, currency: 'ARS' },
  ],
  amortizacion: [
    { name: 'Notebook', price: 1200, currency: 'USD', years: 3 },
    { name: 'Monitor', price: 350, currency: 'USD', years: 4 },
    { name: 'Silla ergonómica', price: 280000, currency: 'ARS', years: 5 },
  ],

  // Config
  modalidad: 'freelance',
  tipoDolar: 'mep',
  pctImprevistos: 15,
  pctIIBB: 3.5,
  pctValorAgregado: 10,
  overrideActive: false,
  overrideMep: null,
  overrideInflacion: null,
};

// ===================== MONOTRIBUTO SCALES (Abril 2026) =====================

const MONOTRIBUTO_SERVICIOS = [
  { cat: 'A', topeAnual: 10277988.13, cuota: 42386.74 },
  { cat: 'B', topeAnual: 15058447.71, cuota: 48250.78 },
  { cat: 'C', topeAnual: 21113696.52, cuota: 56501.85 },
  { cat: 'D', topeAnual: 26212853.42, cuota: 72414.10 },
  { cat: 'E', topeAnual: 30833964.37, cuota: 102537.97 },
  { cat: 'F', topeAnual: 38642048.36, cuota: 129045.32 },
  { cat: 'G', topeAnual: 46211109.37, cuota: 197108.23 },
  { cat: 'H', topeAnual: 70113407.33, cuota: 447346.93 },
  { cat: 'I', topeAnual: 78479211.62, cuota: 824802.26 },
  { cat: 'J', topeAnual: 89872640.30, cuota: 999007.65 },
  { cat: 'K', topeAnual: 108357084.05, cuota: 1381687.90 },
];

// ===================== API FETCHING =====================

async function fetchDolar() {
  try {
    const [mepRes, blueRes] = await Promise.all([
      fetch('https://dolarapi.com/v1/dolares/bolsa'),
      fetch('https://dolarapi.com/v1/dolares/blue'),
    ]);
    const mep = await mepRes.json();
    const blue = await blueRes.json();
    state.dolarMep = mep.venta || mep.compra || 1430;
    state.dolarBlue = blue.venta || blue.compra || 1410;
  } catch (e) {
    console.warn('DolarApi failed, using fallback values', e);
    state.dolarMep = 1430;
    state.dolarBlue = 1410;
  }
}

async function fetchInflacion() {
  try {
    const res = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion');
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Get the latest month's data
      const latest = data[data.length - 1];
      state.inflacionMensual = latest.valor || 2.6;

      // Calculate trailing 12-month annual inflation
      const last12 = data.slice(-12);
      let anual = 1;
      for (const m of last12) {
        anual *= (1 + (m.valor || 0) / 100);
      }
      state.inflacionAnual = ((anual - 1) * 100);
    } else {
      state.inflacionMensual = 2.6;
      state.inflacionAnual = 29.1;
    }
  } catch (e) {
    console.warn('ArgentinaDatos failed, using fallback values', e);
    state.inflacionMensual = 2.6;
    state.inflacionAnual = 29.1;
  }
}

async function loadLiveData() {
  await Promise.all([fetchDolar(), fetchInflacion()]);
  state.dataLoaded = true;
  updateTicker();
  recalculate();
}

// ===================== TICKER =====================

function updateTicker() {
  const fmt = (n) => n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—';
  const fmtDec = (n) => n != null ? n.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—';

  document.getElementById('tickerMep').textContent = `$${fmt(state.dolarMep)}`;
  document.getElementById('tickerBlue').textContent = `$${fmt(state.dolarBlue)}`;
  document.getElementById('tickerInflacion').textContent = `${fmtDec(state.inflacionMensual)}%`;
  document.getElementById('tickerInflacionAnual').textContent = `~${fmtDec(state.inflacionAnual)}%`;

  const statusEl = document.getElementById('tickerStatus');
  statusEl.innerHTML = '<span class="ticker-dot"></span> Datos en vivo';
}

// ===================== CURRENCY HELPERS =====================

function getDolarRate() {
  if (state.overrideActive && state.overrideMep) {
    return state.overrideMep;
  }
  return state.tipoDolar === 'mep' ? (state.dolarMep || 1430) : (state.dolarBlue || 1410);
}

function toARS(amount, currency) {
  if (currency === 'USD') {
    return amount * getDolarRate();
  }
  return amount;
}

function formatARS(n) {
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function getInflacionMensual() {
  if (state.overrideActive && state.overrideInflacion != null) {
    return state.overrideInflacion;
  }
  return state.inflacionMensual || 2.6;
}

// ===================== INLINE EDITING HELPERS =====================

function getItemsArray(type) {
  if (type === 'trabajo') return state.gastosTrabajo;
  if (type === 'personal') return state.gastosPersonales;
  if (type === 'habitos') return state.habitos;
  return [];
}

function startEditName(type, index, spanEl) {
  const items = getItemsArray(type);
  const item = items[index];
  if (!item || item.autoMono) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.value = item.name;
  input.className = 'inline-edit';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = input.value.trim();
    if (val) item.name = val;
    renderAll();
    recalculate();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderAll(); recalculate(); }
  });
}

function startEditAmount(type, index, spanEl) {
  const items = getItemsArray(type);
  const item = items[index];
  if (!item || item.autoMono) return;

  const input = document.createElement('input');
  input.type = 'number';
  input.value = item.amount;
  input.className = 'inline-edit inline-edit--number';
  input.step = 'any';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = parseFloat(input.value);
    if (!isNaN(val) && val > 0) item.amount = val;
    renderAll();
    recalculate();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderAll(); recalculate(); }
  });
}

function startEditAmortField(index, field, spanEl, inputType) {
  const item = state.amortizacion[index];
  if (!item) return;

  const input = document.createElement('input');
  input.type = inputType || 'text';
  input.value = item[field];
  input.className = 'inline-edit inline-edit--number';
  if (inputType === 'number') input.step = 'any';
  spanEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const val = inputType === 'number' ? parseFloat(input.value) : input.value.trim();
    if (inputType === 'number') {
      if (!isNaN(val) && val > 0) item[field] = val;
    } else {
      if (val) item[field] = val;
    }
    renderAll();
    recalculate();
  };
  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { input.removeEventListener('blur', commit); commit(); }
    if (e.key === 'Escape') { input.removeEventListener('blur', commit); renderAll(); recalculate(); }
  });
}

// ===================== EXPENSE MANAGEMENT =====================

function renderExpenseList(listId, items, type) {
  const container = document.getElementById(listId);
  container.innerHTML = '';

  items.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'expense-item';

    const displayAmount = item.currency === 'USD'
      ? `USD $${item.amount.toLocaleString('es-AR')}`
      : formatARS(item.amount);

    const arsEquiv = item.currency === 'USD'
      ? ` (≈ ${formatARS(toARS(item.amount, 'USD'))})`
      : '';

    if (item.autoMono) {
      el.innerHTML = `
        <span class="expense-item__name">${item.name}</span>
        <span class="expense-item__amount" style="color: var(--text-muted); font-style: italic;">auto</span>
        <span style="width: 24px;"></span>
      `;
    } else {
      // Name span (editable on click)
      const nameSpan = document.createElement('span');
      nameSpan.className = 'expense-item__name expense-item__editable';
      nameSpan.title = 'Clic para editar';
      nameSpan.textContent = item.name;
      nameSpan.addEventListener('click', () => startEditName(type, index, nameSpan));

      // Amount span (editable on click)
      const amountSpan = document.createElement('span');
      amountSpan.className = 'expense-item__amount expense-item__editable';
      amountSpan.title = arsEquiv || 'Clic para editar';
      amountSpan.textContent = displayAmount;
      amountSpan.addEventListener('click', () => startEditAmount(type, index, amountSpan));

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.className = 'expense-item__remove';
      removeBtn.title = 'Eliminar';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeExpense(type, index));

      el.appendChild(nameSpan);
      el.appendChild(amountSpan);
      el.appendChild(removeBtn);
    }

    container.appendChild(el);
  });
}

function addExpense(type) {
  let nameInput, amountInput, currencyInput;

  if (type === 'trabajo') {
    nameInput = document.getElementById('nuevoGastoTrabajoNombre');
    amountInput = document.getElementById('nuevoGastoTrabajoMonto');
    currencyInput = document.getElementById('nuevoGastoTrabajoCurrency');
  } else if (type === 'personal') {
    nameInput = document.getElementById('nuevoGastoPersonalNombre');
    amountInput = document.getElementById('nuevoGastoPersonalMonto');
    currencyInput = document.getElementById('nuevoGastoPersonalCurrency');
  } else if (type === 'habitos') {
    nameInput = document.getElementById('nuevoHabitoNombre');
    amountInput = document.getElementById('nuevoHabitoMonto');
    currencyInput = { value: 'ARS' };
  }

  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const currency = currencyInput.value || 'ARS';

  if (!name || isNaN(amount) || amount <= 0) return;

  const item = { name, amount, currency };

  if (type === 'trabajo') {
    state.gastosTrabajo.push(item);
  } else if (type === 'personal') {
    state.gastosPersonales.push(item);
  } else {
    state.habitos.push(item);
  }

  nameInput.value = '';
  amountInput.value = '';
  renderAll();
  recalculate();
}

function removeExpense(type, index) {
  if (type === 'trabajo') {
    if (state.gastosTrabajo[index].autoMono) return;
    state.gastosTrabajo.splice(index, 1);
  } else if (type === 'personal') {
    state.gastosPersonales.splice(index, 1);
  } else {
    state.habitos.splice(index, 1);
  }
  renderAll();
  recalculate();
}

// ===================== AMORTIZATION =====================

function renderAmortList() {
  const container = document.getElementById('listaAmortizacion');
  container.innerHTML = '';

  state.amortizacion.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'amort-item';

    const priceDisplay = item.currency === 'USD'
      ? `USD $${item.price}`
      : formatARS(item.price);

    const monthlyARS = toARS(item.price, item.currency) / (item.years * 12);

    // Name (editable)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'expense-item__name expense-item__editable';
    nameSpan.title = 'Clic para editar';
    nameSpan.textContent = item.name;
    nameSpan.addEventListener('click', () => startEditAmortField(index, 'name', nameSpan, 'text'));

    // Price (editable)
    const priceSpan = document.createElement('span');
    priceSpan.className = 'expense-item__amount expense-item__editable';
    priceSpan.style.fontSize = '0.75rem';
    priceSpan.title = 'Clic para editar precio';
    priceSpan.textContent = priceDisplay;
    priceSpan.addEventListener('click', () => startEditAmortField(index, 'price', priceSpan, 'number'));

    // Years (editable)
    const yearsSpan = document.createElement('span');
    yearsSpan.className = 'expense-item__editable';
    yearsSpan.style.cssText = 'font-size: 0.7rem; color: var(--text-muted); cursor: pointer;';
    yearsSpan.title = 'Clic para editar vida útil';
    yearsSpan.textContent = `${item.years}a`;
    yearsSpan.addEventListener('click', () => startEditAmortField(index, 'years', yearsSpan, 'number'));

    // Monthly (read-only)
    const monthlySpan = document.createElement('span');
    monthlySpan.className = 'amort-item__monthly';
    monthlySpan.textContent = `${formatARS(monthlyARS)}/m`;

    // Remove
    const removeBtn = document.createElement('button');
    removeBtn.className = 'expense-item__remove';
    removeBtn.title = 'Eliminar';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removeAmort(index));

    el.appendChild(nameSpan);
    el.appendChild(priceSpan);
    el.appendChild(yearsSpan);
    el.appendChild(monthlySpan);
    el.appendChild(removeBtn);

    container.appendChild(el);
  });
}

function addAmortItem() {
  const name = document.getElementById('nuevoEquipoNombre').value.trim();
  const price = parseFloat(document.getElementById('nuevoEquipoPrecio').value);
  const currency = document.getElementById('nuevoEquipoCurrency').value;
  const years = parseInt(document.getElementById('nuevoEquipoVida').value);

  if (!name || isNaN(price) || price <= 0) return;

  state.amortizacion.push({ name, price, currency, years });

  document.getElementById('nuevoEquipoNombre').value = '';
  document.getElementById('nuevoEquipoPrecio').value = '';

  renderAll();
  recalculate();
}

function removeAmort(index) {
  state.amortizacion.splice(index, 1);
  renderAll();
  recalculate();
}

// ===================== CORE CALCULATION =====================

function recalculate() {
  const dolar = getDolarRate();

  // 1. Sum business expenses (excluding auto-mono line)
  let totalTrabajo = 0;
  state.gastosTrabajo.forEach(item => {
    if (!item.autoMono) {
      totalTrabajo += toARS(item.amount, item.currency);
    }
  });

  // 2. Sum personal expenses
  let totalPersonal = 0;
  state.gastosPersonales.forEach(item => {
    totalPersonal += toARS(item.amount, item.currency);
  });

  // 3. Habits (daily * 20 workdays)
  let totalHabitos = 0;
  state.habitos.forEach(item => {
    totalHabitos += item.amount * 20;
  });

  // 4. Amortization
  let totalAmort = 0;
  state.amortizacion.forEach(item => {
    totalAmort += toARS(item.price, item.currency) / (item.years * 12);
  });

  // 5. Subtotal
  const subtotal = totalTrabajo + totalPersonal + totalHabitos + totalAmort;

  // 6. Imprevistos
  const imprevistos = subtotal * (state.pctImprevistos / 100);

  // 7. Valor agregado
  const valorAgregado = subtotal * (state.pctValorAgregado / 100);

  // 8. Base to cover before taxes
  const basePreTax = subtotal + imprevistos + valorAgregado;

  // 9. Monotributo category matching
  const metaAnual = basePreTax * 12;
  let monoCat = null;
  let monoCuota = 0;
  for (const cat of MONOTRIBUTO_SERVICIOS) {
    if (metaAnual <= cat.topeAnual) {
      monoCat = cat;
      monoCuota = cat.cuota;
      break;
    }
  }

  // Update the auto-mono line in gastosTrabajo
  const autoMonoItem = state.gastosTrabajo.find(i => i.autoMono);
  if (autoMonoItem) {
    autoMonoItem.amount = monoCuota;
    // Re-sum trabajo with the updated monotributo
    totalTrabajo = 0;
    state.gastosTrabajo.forEach(item => {
      if (!item.autoMono) {
        totalTrabajo += toARS(item.amount, item.currency);
      }
    });
  }

  // 10. IIBB
  const iibb = basePreTax * (state.pctIIBB / 100);

  // 11. Total meta mensual
  const metaMensual = basePreTax + monoCuota + iibb;

  // 12. Hourly rate
  const horasMes = state.modalidad === 'freelance' ? 80 : 160;
  const precioHora = metaMensual / horasMes;
  const precioHoraUSD = precioHora / dolar;

  // ---- UPDATE UI ----
  document.getElementById('resultGastosTrabajo').textContent = formatARS(totalTrabajo);
  document.getElementById('resultGastosPersonales').textContent = formatARS(totalPersonal);
  document.getElementById('resultHabitos').textContent = formatARS(totalHabitos);
  document.getElementById('resultAmortizacion').textContent = formatARS(totalAmort);
  document.getElementById('resultSubtotal').textContent = formatARS(subtotal);
  document.getElementById('resultImprevistos').textContent = formatARS(imprevistos);
  document.getElementById('resultValorAgregado').textContent = formatARS(valorAgregado);
  document.getElementById('resultMonotributo').textContent = formatARS(monoCuota);
  document.getElementById('resultIIBB').textContent = formatARS(iibb);
  document.getElementById('resultMetaMensual').textContent = formatARS(metaMensual);

  // Hourly
  document.getElementById('resultHourlyRate').textContent = formatARS(precioHora);
  document.getElementById('resultHourlyUsd').textContent = `≈ USD $${precioHoraUSD.toFixed(2)}`;

  // Mono category badge
  const monoEl = document.getElementById('resultMonoCategoria');
  if (monoCat) {
    monoEl.innerHTML = `<span class="mono-badge mono-badge--fit">CAT ${monoCat.cat} ✓</span>`;
  } else {
    monoEl.innerHTML = `<span class="mono-badge mono-badge--exceed">EXCEDE MONO ⚠️</span>`;
  }

  // Tax breakdown bar
  const totalForBar = metaMensual;
  const netAmount = subtotal + valorAgregado;
  const netPct = (netAmount / totalForBar * 100);
  const monoPct = (monoCuota / totalForBar * 100);
  const iibbPct = (iibb / totalForBar * 100);
  const imprevPct = (imprevistos / totalForBar * 100);

  const taxBar = document.getElementById('taxBar');
  taxBar.innerHTML = `
    <div class="tax-bar__segment tax-bar__segment--net" style="width: ${netPct}%"></div>
    <div class="tax-bar__segment tax-bar__segment--monotributo" style="width: ${monoPct}%"></div>
    <div class="tax-bar__segment tax-bar__segment--iibb" style="width: ${iibbPct}%"></div>
    <div class="tax-bar__segment tax-bar__segment--unforeseen" style="width: ${imprevPct}%"></div>
  `;

  // Tax legend with actual values
  const fmtPct = (n) => n.toFixed(1) + '%';
  const taxLegend = document.getElementById('taxLegend');
  taxLegend.innerHTML = `
    <div class="tax-legend__item">
      <span class="tax-legend__dot tax-legend__dot--net"></span>
      Tu bolsillo: ${fmtPct(netPct)} (${formatARS(netAmount)})
    </div>
    <div class="tax-legend__item">
      <span class="tax-legend__dot tax-legend__dot--monotributo"></span>
      Monotributo: ${fmtPct(monoPct)} (${formatARS(monoCuota)})
    </div>
    <div class="tax-legend__item">
      <span class="tax-legend__dot tax-legend__dot--iibb"></span>
      IIBB: ${fmtPct(iibbPct)} (${formatARS(iibb)})
    </div>
    <div class="tax-legend__item">
      <span class="tax-legend__dot tax-legend__dot--unforeseen"></span>
      Imprevistos: ${fmtPct(imprevPct)} (${formatARS(imprevistos)})
    </div>
  `;

  // Update print-only summary
  const printHourly = document.getElementById('printHourly');
  if (printHourly) {
    printHourly.textContent = formatARS(precioHora) + ' /hora';
    document.getElementById('printHourlyUsd').textContent = `USD $${precioHoraUSD.toFixed(2)} /hora`;
    document.getElementById('printMeta').textContent = formatARS(metaMensual) + ' /mes';
    document.getElementById('printMono').textContent = monoCat ? `Categoría ${monoCat.cat}` : 'Excede Mono';
    const printDate = document.getElementById('printDate');
    if (printDate) {
      printDate.textContent = `Calculado el ${new Date().toLocaleDateString('es-AR')} — Dólar ${state.tipoDolar.toUpperCase()}: $${getDolarRate().toLocaleString('es-AR')} — Inflación: ${getInflacionMensual()}% mensual`;
    }
  }

  // Inflation projection chart (12 months)
  renderProjectionChart(precioHora);

  // Re-render amort list to update ARS equivalents
  renderAmortList();
  // Re-render the auto-mono line
  renderExpenseList('listaGastosTrabajo', state.gastosTrabajo, 'trabajo');
}

// ===================== INFLATION PROJECTION CHART =====================

function renderProjectionChart(basePrecioHora) {
  const chartBarsEl = document.getElementById('chartBars');
  const chartLabelsEl = document.getElementById('chartLabels');
  const inflMensual = getInflacionMensual() / 100;
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const now = new Date();
  const currentMonth = now.getMonth();

  const values = [];
  let current = basePrecioHora;
  for (let i = 0; i < 12; i++) {
    values.push(current);
    current *= (1 + inflMensual);
  }

  const max = Math.max(...values);

  chartBarsEl.innerHTML = '';
  chartLabelsEl.innerHTML = '';

  values.forEach((val, i) => {
    const pct = (val / max) * 100;
    const monthIndex = (currentMonth + i) % 12;

    const bar = document.createElement('div');
    bar.className = 'chart-bar';
    bar.style.height = `${pct}%`;

    if (i === 0) {
      bar.style.background = 'var(--accent-emerald)';
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'chart-bar__tooltip';
    tooltip.textContent = formatARS(val) + '/h';
    bar.appendChild(tooltip);

    chartBarsEl.appendChild(bar);

    const label = document.createElement('span');
    label.textContent = monthNames[monthIndex];
    chartLabelsEl.appendChild(label);
  });
}

// ===================== RENDER ALL =====================

function renderAll() {
  renderExpenseList('listaGastosTrabajo', state.gastosTrabajo, 'trabajo');
  renderExpenseList('listaGastosPersonales', state.gastosPersonales, 'personal');
  renderExpenseList('listaHabitos', state.habitos, 'habitos');
  renderAmortList();
}

// ===================== CONFIG BINDINGS =====================

function bindControls() {
  // Modalidad
  document.getElementById('selectModalidad').addEventListener('change', (e) => {
    state.modalidad = e.target.value;
    recalculate();
  });

  // Tipo de dolar
  document.getElementById('selectTipoDolar').addEventListener('change', (e) => {
    state.tipoDolar = e.target.value;
    recalculate();
  });

  // Sliders with clickable value labels for manual input
  function makeValueClickable(sliderId, valueId, stateKey, suffix) {
    const el = document.getElementById(valueId);
    if (!el) return;
    el.classList.add('slider-value--clickable');
    el.title = 'Clic para escribir un valor';

    el.addEventListener('click', function handler() {
      const slider = document.getElementById(sliderId);
      const currentEl = document.getElementById(valueId);
      if (!currentEl) return;

      const input = document.createElement('input');
      input.type = 'number';
      input.value = state[stateKey];
      input.step = '0.1';
      input.min = '0';
      input.className = 'inline-edit inline-edit--number';
      input.style.width = '65px';
      input.style.fontSize = '0.85rem';
      input.style.textAlign = 'center';
      currentEl.replaceWith(input);
      input.focus();
      input.select();

      const commit = () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0) {
          state[stateKey] = val;
          if (slider) slider.value = Math.min(val, parseFloat(slider.max));
        }
        // Recreate the span
        const newSpan = document.createElement('span');
        newSpan.className = 'slider-value slider-value--clickable';
        newSpan.id = valueId;
        newSpan.title = 'Clic para escribir un valor';
        newSpan.textContent = `${state[stateKey]}${suffix}`;
        input.replaceWith(newSpan);
        // Re-attach click-to-edit on the new span
        makeValueClickable(sliderId, valueId, stateKey, suffix);
        recalculate();
      };

      input.addEventListener('blur', commit);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { input.removeEventListener('blur', commit); commit(); }
        if (e.key === 'Escape') { input.removeEventListener('blur', commit); commit(); }
      });
    });
  }

  // Bind slider drag → always finds current span by ID
  ['sliderImprevistos', 'sliderIIBB', 'sliderValorAgregado'].forEach(sliderId => {
    document.getElementById(sliderId).addEventListener('input', (e) => {
      const map = {
        sliderImprevistos: { key: 'pctImprevistos', valId: 'valImprevistos' },
        sliderIIBB: { key: 'pctIIBB', valId: 'valIIBB' },
        sliderValorAgregado: { key: 'pctValorAgregado', valId: 'valValorAgregado' },
      };
      const cfg = map[sliderId];
      state[cfg.key] = parseFloat(e.target.value);
      const valEl = document.getElementById(cfg.valId);
      if (valEl) valEl.textContent = `${state[cfg.key]}%`;
      recalculate();
    });
  });

  makeValueClickable('sliderImprevistos', 'valImprevistos', 'pctImprevistos', '%');
  makeValueClickable('sliderIIBB', 'valIIBB', 'pctIIBB', '%');
  makeValueClickable('sliderValorAgregado', 'valValorAgregado', 'pctValorAgregado', '%');

  // Override toggle
  document.getElementById('toggleOverride').addEventListener('change', (e) => {
    state.overrideActive = e.target.checked;
    document.getElementById('overrideInputs').classList.toggle('active', e.target.checked);
    recalculate();
  });

  document.getElementById('overrideMep').addEventListener('input', (e) => {
    state.overrideMep = parseFloat(e.target.value) || null;
    recalculate();
  });

  document.getElementById('overrideInflacion').addEventListener('input', (e) => {
    state.overrideInflacion = parseFloat(e.target.value);
    if (isNaN(state.overrideInflacion)) state.overrideInflacion = null;
    recalculate();
  });

  // Allow Enter key on add expense inputs
  document.querySelectorAll('.add-expense-row input, .add-amort-row input').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const btn = input.closest('.add-expense-row, .add-amort-row').querySelector('.btn-add');
        if (btn) btn.click();
      }
    });
  });
}

// ===================== CSV EXPORT =====================

function exportCSV() {
  const dolar = getDolarRate();
  const lines = [
    ['Categoría', 'Concepto', 'Monto Original', 'Moneda', 'Equivalente ARS'],
  ];

  state.gastosTrabajo.forEach(item => {
    if (!item.autoMono) {
      lines.push(['Gastos de Trabajo', item.name, item.amount, item.currency, Math.round(toARS(item.amount, item.currency))]);
    }
  });

  state.gastosPersonales.forEach(item => {
    lines.push(['Gastos Personales', item.name, item.amount, item.currency, Math.round(toARS(item.amount, item.currency))]);
  });

  state.habitos.forEach(item => {
    lines.push(['Hábitos (diario)', item.name, item.amount, 'ARS', item.amount * 20 + ' (mensual)']);
  });

  state.amortizacion.forEach(item => {
    const monthly = toARS(item.price, item.currency) / (item.years * 12);
    lines.push(['Amortización', item.name, item.price, item.currency, Math.round(monthly) + ' /mes']);
  });

  lines.push([]);
  lines.push(['CONFIG', 'Dólar usado', dolar, state.tipoDolar.toUpperCase()]);
  lines.push(['CONFIG', 'Inflación mensual', getInflacionMensual() + '%']);
  lines.push(['CONFIG', 'Imprevistos', state.pctImprevistos + '%']);
  lines.push(['CONFIG', 'IIBB', state.pctIIBB + '%']);
  lines.push(['CONFIG', 'Valor Agregado', state.pctValorAgregado + '%']);
  lines.push(['CONFIG', 'Modalidad', state.modalidad]);

  const hourlyEl = document.getElementById('resultHourlyRate').textContent;
  const metaEl = document.getElementById('resultMetaMensual').textContent;
  lines.push([]);
  lines.push(['RESULTADO', 'Precio por hora', hourlyEl]);
  lines.push(['RESULTADO', 'Meta mensual', metaEl]);

  const csv = lines.map(row => row.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `precio-freelancer-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ===================== LOCAL STORAGE PERSISTENCE =====================

const STORAGE_KEY = 'calcuprecio_data';

function saveToLocalStorage() {
  const dataToSave = {
    gastosTrabajo: state.gastosTrabajo,
    gastosPersonales: state.gastosPersonales,
    habitos: state.habitos,
    amortizacion: state.amortizacion,
    modalidad: state.modalidad,
    tipoDolar: state.tipoDolar,
    pctImprevistos: state.pctImprevistos,
    pctIIBB: state.pctIIBB,
    pctValorAgregado: state.pctValorAgregado,
    savedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {
    console.warn('Could not save to localStorage', e);
  }
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);

    if (data.gastosTrabajo) state.gastosTrabajo = data.gastosTrabajo;
    if (data.gastosPersonales) state.gastosPersonales = data.gastosPersonales;
    if (data.habitos) state.habitos = data.habitos;
    if (data.amortizacion) state.amortizacion = data.amortizacion;
    if (data.modalidad) state.modalidad = data.modalidad;
    if (data.tipoDolar) state.tipoDolar = data.tipoDolar;
    if (data.pctImprevistos != null) state.pctImprevistos = data.pctImprevistos;
    if (data.pctIIBB != null) state.pctIIBB = data.pctIIBB;
    if (data.pctValorAgregado != null) state.pctValorAgregado = data.pctValorAgregado;

    // Sync UI controls with loaded state
    document.getElementById('selectModalidad').value = state.modalidad;
    document.getElementById('selectTipoDolar').value = state.tipoDolar;
    document.getElementById('sliderImprevistos').value = state.pctImprevistos;
    document.getElementById('valImprevistos').textContent = `${state.pctImprevistos}%`;
    document.getElementById('sliderIIBB').value = state.pctIIBB;
    document.getElementById('valIIBB').textContent = `${state.pctIIBB}%`;
    document.getElementById('sliderValorAgregado').value = state.pctValorAgregado;
    document.getElementById('valValorAgregado').textContent = `${state.pctValorAgregado}%`;

    console.log('📂 Data loaded from localStorage (saved:', data.savedAt, ')');
    return true;
  } catch (e) {
    console.warn('Could not load from localStorage', e);
    return false;
  }
}

// Auto-save on every change (called from recalculate)
const _originalRecalculate = recalculate;
recalculate = function() {
  _originalRecalculate();
  saveToLocalStorage();
};

// ===================== JSON EXPORT/IMPORT (for Drive / device transfer) =====================

function exportJSON() {
  const dataToExport = {
    version: 1,
    app: 'CalcuPrecio — Freelancer Argentina',
    exportedAt: new Date().toISOString(),
    gastosTrabajo: state.gastosTrabajo,
    gastosPersonales: state.gastosPersonales,
    habitos: state.habitos,
    amortizacion: state.amortizacion,
    config: {
      modalidad: state.modalidad,
      tipoDolar: state.tipoDolar,
      pctImprevistos: state.pctImprevistos,
      pctIIBB: state.pctIIBB,
      pctValorAgregado: state.pctValorAgregado,
    },
  };

  const json = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `calcuprecio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);

        if (data.version !== 1 || !data.gastosTrabajo) {
          alert('❌ Archivo no válido. Asegurate de usar un backup de CalcuPrecio.');
          return;
        }

        state.gastosTrabajo = data.gastosTrabajo;
        state.gastosPersonales = data.gastosPersonales;
        state.habitos = data.habitos;
        state.amortizacion = data.amortizacion;

        if (data.config) {
          state.modalidad = data.config.modalidad || 'freelance';
          state.tipoDolar = data.config.tipoDolar || 'mep';
          state.pctImprevistos = data.config.pctImprevistos ?? 15;
          state.pctIIBB = data.config.pctIIBB ?? 3.5;
          state.pctValorAgregado = data.config.pctValorAgregado ?? 10;
        }

        // Sync UI
        document.getElementById('selectModalidad').value = state.modalidad;
        document.getElementById('selectTipoDolar').value = state.tipoDolar;
        document.getElementById('sliderImprevistos').value = state.pctImprevistos;
        document.getElementById('valImprevistos').textContent = `${state.pctImprevistos}%`;
        document.getElementById('sliderIIBB').value = state.pctIIBB;
        document.getElementById('valIIBB').textContent = `${state.pctIIBB}%`;
        document.getElementById('sliderValorAgregado').value = state.pctValorAgregado;
        document.getElementById('valValorAgregado').textContent = `${state.pctValorAgregado}%`;

        renderAll();
        recalculate();

        alert(`✅ Datos importados correctamente!\nBackup del: ${data.exportedAt}`);
      } catch (err) {
        alert('❌ Error al leer el archivo: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
  input.click();
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', () => {
  bindControls();

  // Try to load saved data
  const loaded = loadFromLocalStorage();

  renderAll();
  recalculate();
  loadLiveData();

  // Refresh data every 5 minutes
  setInterval(loadLiveData, 5 * 60 * 1000);
});

