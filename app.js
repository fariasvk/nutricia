/* ==========================================================================
   NutricIA - Lógica de Negócios e Integrações (Feira de Ciências)
   ========================================================================== */

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v2/product/';

// Estado Global da Aplicação
const state = {
  activeTab: 'comparador',
  activeProfile: 'geral',
  products: JSON.parse(localStorage.getItem('nutricia_db')) || [
    {
      code: '7891000100103',
      name: 'Cereal Matinal Integral',
      brand: 'Marca Exemplo',
      source: 'Exemplo Local',
      verified: false,
      queryDate: '19/10/2026',
      per100g: { energy: 380, carbs: 75, sugars: 22, proteins: 8, fats: 3, fiber: 9, sodium: 180 },
      portion: '30g',
      ingredients: 'Farinha de trigo integral, açúcar, aveia, sal.'
    },
    {
      code: '7891000200202',
      name: 'Biscoito Recheado Chocolate',
      brand: 'Marca Exemplo',
      source: 'Exemplo Local',
      verified: false,
      queryDate: '19/10/2026',
      per100g: { energy: 470, carbs: 68, sugars: 34, proteins: 6, fats: 19, fiber: 2, sodium: 320 },
      portion: '30g',
      ingredients: 'Farinha de trigo, açúcar, gordura vegetal, cacau em pó, sal, emulsificantes.'
    }
  ],
  selectedForCompare: [],
  scannerInstance: null,
  weights: { sodium: 2.0, sugar: 1.5, fat: 1.0, fiber: 2.0 }
};

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initProfiles();
  initWeightLab();
  initManualForms();
  renderProductsTable();
  updateCompareDropdowns();
  registerServiceWorker();
});

// NAVEGAÇÃO E TABS
function initNavigation() {
  const buttons = document.querySelectorAll('.tab-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      buttons.forEach(b => b.classList.remove('active', 'border-emerald-500', 'text-emerald-400', 'bg-slate-800'));
      btn.classList.add('active', 'border-emerald-500', 'text-emerald-400', 'bg-slate-800');

      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(`tab-${target}`).classList.remove('hidden');

      if (target === 'scanner') {
        initCameraScanner();
      } else if (state.scannerInstance) {
        stopCameraScanner();
      }
    });
  });
}

// PERFIS DE SAÚDE
function initProfiles() {
  const btns = document.querySelectorAll('.profile-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('bg-emerald-600', 'text-white'));
      btn.classList.add('bg-emerald-600', 'text-white');
      state.activeProfile = btn.dataset.profile;
      updateProfileHighlights();
    });
  });
}

function updateProfileHighlights() {
  const badge = document.getElementById('profile-badge');
  const details = document.getElementById('profile-details');

  const map = {
    geral: { title: 'Perfil Geral', text: 'Análise ampla de macro e micronutrientes sem foco restritivo individual.' },
    hipertensao: { title: 'Perfil Hipertensão', text: 'Destaque prioritário para Sódio (mg) por 100g e por porção.' },
    diabetes: { title: 'Perfil Diabetes', text: 'Foco na quantidade de Carboidratos totais, Açúcares e tamanho da porção.' },
    intestinal: { title: 'Perfil Saúde Intestinal', text: 'Destaque para teores de Fibras alimentares e lista de ingredientes/alergênicos.' },
    atleta: { title: 'Perfil Atleta', text: 'Foco no aporte Energético (kcal), Carboidratos para energia e Proteínas.' }
  };

  const current = map[state.activeProfile] || map.geral;
  badge.textContent = current.title;
  details.textContent = current.text;
  renderComparisonTable();
}

// SCANNER E CONSULTA API OPEN FOOD FACTS
function initCameraScanner() {
  const feedback = document.getElementById('scanner-feedback');
  feedback.innerHTML = `<span class="text-slate-400">Aguardando permissão de câmera...</span>`;

  if (typeof Html5Qrcode === 'undefined') {
    feedback.innerHTML = `<span class="text-amber-400">Biblioteca de leitura não carregada. Use a busca manual.</span>`;
    return;
  }

  const html5QrCode = new Html5Qrcode("reader");
  state.scannerInstance = html5QrCode;

  html5QrCode.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: { width: 250, height: 150 } },
    (decodedText) => {
      stopCameraScanner();
      fetchProductFromOFF(decodedText);
    },
    (error) => { /* Silenciar tentativas de busca frame a frame */ }
  ).catch(err => {
    feedback.innerHTML = `<div class="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-xs">
      Permissão de câmera negada ou dispositivo sem HTTPS. Utilize a consulta por código de barras abaixo.
    </div>`;
  });
}

function stopCameraScanner() {
  if (state.scannerInstance) {
    state.scannerInstance.stop().then(() => {
      state.scannerInstance = null;
    }).catch(() => {});
  }
}

async function fetchProductFromOFF(barcode) {
  const feedback = document.getElementById('scanner-feedback');
  feedback.innerHTML = `<span class="text-amber-400 animate-pulse">Buscando produto no Open Food Facts (${barcode})...</span>`;

  try {
    const res = await fetch(`${OFF_API_URL}${barcode}.json`);
    const data = await res.json();

    if (data.status === 1 && data.product) {
      const prod = data.product;
      const nut = prod.nutriments || {};

      const newProd = {
        code: barcode,
        name: prod.product_name || 'Nome não informado',
        brand: prod.brands || 'Marca não informada',
        source: 'Open Food Facts API',
        verified: false, // API aberta não significa verificação científica clínica
        queryDate: new Date().toLocaleDateString('pt-BR'),
        image: prod.image_front_url || null,
        ingredients: prod.ingredients_text_pt || prod.ingredients_text || 'Não disponível',
        portion: prod.serving_size || '100g',
        per100g: {
          energy: nut['energy-kcal_100g'] !== undefined ? nut['energy-kcal_100g'] : 'Não disponível',
          carbs: nut.carbohydrates_100g !== undefined ? nut.carbohydrates_100g : 'Não disponível',
          sugars: nut.sugars_100g !== undefined ? nut.sugars_100g : 'Não disponível',
          proteins: nut.proteins_100g !== undefined ? nut.proteins_100g : 'Não disponível',
          fats: nut.fat_100g !== undefined ? nut.fat_100g : 'Não disponível',
          fiber: nut.fiber_100g !== undefined ? nut.fiber_100g : 'Não disponível',
          sodium: nut.sodium_100g !== undefined ? Math.round(nut.sodium_100g * 1000) : 'Não disponível'
        }
      };

      displayScanResult(newProd);
      saveProductToDb(newProd);
    } else {
      feedback.innerHTML = `<div class="p-3 bg-amber-900/50 border border-amber-700 rounded-lg text-amber-200 text-xs">
        Produto não encontrado na base Open Food Facts. Você pode cadastrá-lo manualmente na aba Banco.
      </div>`;
    }
  } catch (err) {
    feedback.innerHTML = `<div class="p-3 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-xs">
      Erro de conexão com o servidor da API Open Food Facts.
    </div>`;
  }
}

function displayScanResult(prod) {
  const container = document.getElementById('scan-result-container');
  container.classList.remove('hidden');
  container.innerHTML = `
    <div class="p-4 bg-slate-800 border border-emerald-500/50 rounded-xl">
      <div class="flex items-center gap-4">
        ${prod.image ? `<img src="${prod.image}" class="w-16 h-16 object-cover rounded-lg border border-slate-700">` : ''}
        <div>
          <h4 class="font-bold text-emerald-400">${prod.name}</h4>
          <p class="text-xs text-slate-400">Marca: ${prod.brand} | EAN: ${prod.code}</p>
          <p class="text-[10px] text-slate-500 mt-1">Fonte: ${prod.source} em ${prod.queryDate}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs bg-slate-900 p-2 rounded-lg">
        <div>Sódio: <span class="text-slate-200 font-semibold">${prod.per100g.sodium !== 'Não disponível' ? prod.per100g.sodium + ' mg' : 'Não disponível'}</span></div>
        <div>Açúcares: <span class="text-slate-200 font-semibold">${prod.per100g.sugars !== 'Não disponível' ? prod.per100g.sugars + ' g' : 'Não disponível'}</span></div>
        <div>Fibras: <span class="text-slate-200 font-semibold">${prod.per100g.fiber !== 'Não disponível' ? prod.per100g.fiber + ' g' : 'Não disponível'}</span></div>
        <div>Proteínas: <span class="text-slate-200 font-semibold">${prod.per100g.proteins !== 'Não disponível' ? prod.per100g.proteins + ' g' : 'Não disponível'}</span></div>
      </div>
    </div>
  `;
}

// FORMULÁRIOS DE BUSCA MANUAL E CADASTRO
function initManualForms() {
  document.getElementById('btn-manual-search').addEventListener('click', () => {
    const val = document.getElementById('manual-barcode').value.trim();
    if (val) fetchProductFromOFF(val);
  });

  document.getElementById('btn-save-manual').addEventListener('click', () => {
    const name = document.getElementById('new-name').value.trim();
    const brand = document.getElementById('new-brand').value.trim();
    const code = document.getElementById('new-code').value.trim() || 'MANUAL-' + Date.now();

    if (!name) return alert('Informe o nome do produto.');

    const parseVal = (id) => {
      const v = document.getElementById(id).value;
      return v !== '' && !isNaN(v) ? parseFloat(v) : 'Não disponível';
    };

    const newProd = {
      code: code,
      name: name,
      brand: brand || 'Inserção Manual',
      source: 'Inserção Manual',
      verified: false,
      queryDate: new Date().toLocaleDateString('pt-BR'),
      portion: '100g',
      per100g: {
        energy: parseVal('new-energy'),
        carbs: parseVal('new-carbs'),
        sugars: parseVal('new-sugars'),
        proteins: parseVal('new-proteins'),
        fats: parseVal('new-fats'),
        fiber: parseVal('new-fiber'),
        sodium: parseVal('new-sodium')
      }
    };

    saveProductToDb(newProd);
    alert('Produto salvo com sucesso no navegador!');
  });
}

// BANCO DE ALIMENTOS LOCAL
function saveProductToDb(prod) {
  state.products = state.products.filter(p => p.code !== prod.code);
  state.products.unshift(prod);
  localStorage.setItem('nutricia_db', JSON.stringify(state.products));
  renderProductsTable();
  updateCompareDropdowns();
}

function removeProductFromDb(code) {
  state.products = state.products.filter(p => p.code !== code);
  localStorage.setItem('nutricia_db', JSON.stringify(state.products));
  renderProductsTable();
  updateCompareDropdowns();
}

function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  const searchVal = document.getElementById('search-db')?.value.toLowerCase() || '';

  const filtered = state.products.filter(p => 
    p.name.toLowerCase().includes(searchVal) || 
    p.brand.toLowerCase().includes(searchVal) || 
    p.code.toLowerCase().includes(searchVal)
  );

  tbody.innerHTML = filtered.map(p => `
    <tr class="border-b border-slate-700/50 hover:bg-slate-800/50">
      <td class="p-3 font-semibold text-slate-200">${p.name} <span class="block text-xs font-normal text-slate-400">${p.brand}</span></td>
      <td class="p-3 font-mono text-xs text-slate-400">${p.code}</td>
      <td class="p-3">${p.per100g.sodium !== 'Não disponível' ? p.per100g.sodium + ' mg' : 'Não disponível'}</td>
      <td class="p-3">${p.per100g.sugars !== 'Não disponível' ? p.per100g.sugars + ' g' : 'Não disponível'}</td>
      <td class="p-3">
        <span class="px-2 py-0.5 text-[10px] rounded ${p.source.includes('API') ? 'bg-emerald-900/80 text-emerald-300' : 'bg-amber-900/80 text-amber-300'}">
          ${p.source}
        </span>
      </td>
      <td class="p-3">
        <button onclick="removeProductFromDb('${p.code}')" class="text-red-400 hover:text-red-300 font-bold">✕</button>
      </td>
    </tr>
  `).join('');
}

// COMPARADOR IAC & SELEÇÃO
function updateCompareDropdowns() {
  const s1 = document.getElementById('select-prod-1');
  const s2 = document.getElementById('select-prod-2');

  const options = `<option value="">-- Selecione --</option>` + 
    state.products.map(p => `<option value="${p.code}">${p.name} (${p.brand})</option>`).join('');

  if (s1) s1.innerHTML = options;
  if (s2) s2.innerHTML = options;

  s1?.addEventListener('change', renderComparisonTable);
  s2?.addEventListener('change', renderComparisonTable);
}

function calculateIACScore(p) {
  // Fórmula Acadêmica Simulada para Feira de Ciências
  const sod = p.per100g.sodium !== 'Não disponível' ? p.per100g.sodium : 0;
  const sug = p.per100g.sugars !== 'Não disponível' ? p.per100g.sugars : 0;
  const fib = p.per100g.fiber !== 'Não disponível' ? p.per100g.fiber : 0;

  let base = 100;
  base -= (sod / 100) * state.weights.sodium;
  base -= sug * state.weights.sugar;
  base += fib * state.weights.fiber;

  return Math.max(0, Math.min(100, Math.round(base)));
}

function renderComparisonTable() {
  const code1 = document.getElementById('select-prod-1')?.value;
  const code2 = document.getElementById('select-prod-2')?.value;

  const p1 = state.products.find(p => p.code === code1);
  const p2 = state.products.find(p => p.code === code2);

  const container = document.getElementById('comparison-results');
  if (!p1 && !p2) {
    container.innerHTML = `<p class="text-xs text-slate-500 text-center py-8">Selecione pelo menos um produto acima para visualizar a comparação nutricional.</p>`;
    return;
  }

  const renderCol = (p) => {
    if (!p) return `<div class="p-4 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-500">Selecione um produto</div>`;
    const score = calculateIACScore(p);
    return `
      <div class="p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-3">
        <div>
          <h4 class="font-bold text-emerald-400">${p.name}</h4>
          <p class="text-xs text-slate-400">${p.brand}</p>
        </div>
        <div class="p-2 bg-slate-900 rounded-lg text-center">
          <div class="text-[10px] text-slate-400 uppercase">Índice IAC Simulante</div>
          <div class="text-2xl font-black text-amber-400">${score}/100</div>
        </div>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between ${state.activeProfile === 'hipertensao' ? 'bg-amber-900/40 p-1 rounded font-bold text-amber-300' : ''}">
            <span>Sódio (100g):</span> <span>${p.per100g.sodium !== 'Não disponível' ? p.per100g.sodium + ' mg' : 'Não disponível'}</span>
          </div>
          <div class="flex justify-between ${state.activeProfile === 'diabetes' ? 'bg-amber-900/40 p-1 rounded font-bold text-amber-300' : ''}">
            <span>Açúcares (100g):</span> <span>${p.per100g.sugars !== 'Não disponível' ? p.per100g.sugars + ' g' : 'Não disponível'}</span>
          </div>
          <div class="flex justify-between ${state.activeProfile === 'intestinal' ? 'bg-emerald-900/40 p-1 rounded font-bold text-emerald-300' : ''}">
            <span>Fibras (100g):</span> <span>${p.per100g.fiber !== 'Não disponível' ? p.per100g.fiber + ' g' : 'Não disponível'}</span>
          </div>
          <div class="flex justify-between ${state.activeProfile === 'atleta' ? 'bg-emerald-900/40 p-1 rounded font-bold text-emerald-300' : ''}">
            <span>Proteínas (100g):</span> <span>${p.per100g.proteins !== 'Não disponível' ? p.per100g.proteins + ' g' : 'Não disponível'}</span>
          </div>
        </div>
      </div>
    `;
  };

  container.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">${renderCol(p1)}${renderCol(p2)}</div>`;
}

// LAB DE PASSOS (SLIDERS)
function initWeightLab() {
  const bind = (id, key) => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      state.weights[key] = parseFloat(e.target.value);
      document.getElementById('lab-feedback').textContent = `Coeficiente [${key}] atualizado para ${e.target.value}. O IAC foi recalculado.`;
      renderComparisonTable();
    });
  };

  bind('weight-sodium', 'sodium');
  bind('weight-sugar', 'sugar');
  bind('weight-fiber', 'fiber');
}

// SERVICE WORKER
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}