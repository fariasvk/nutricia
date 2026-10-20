/* NutricIA v2 — lógica do app, autenticação opcional, busca de produtos e assistente com fontes */
'use strict';

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v2/product/';

/*
  CONFIGURAÇÃO:
  1) Para login real, crie um app no Firebase Console, ative Authentication > Email/Password
     e substitua os quatro valores abaixo pelos dados do app Web do Firebase.
  2) Para IA generativa real, implante worker.js no Cloudflare e coloque a URL do endpoint abaixo.
  Nunca coloque uma chave de API Gemini neste arquivo público.
*/
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDP6U3Ieb_mt7SB11j3EqPGPUrBZQJBM_o',
  authDomain: 'nutricia-160b1.firebaseapp.com',
  projectId: 'nutricia-160b1',
  appId: '1:697120155955:web:1167fc4c5d19328745b646'
};
const NUTRICIA_AI_ENDPOINT = 'https://nutriciadivine-night-0498.victor-farias.workers.dev/ask'; // Ex.: https://nutricia-ai.seu-subdominio.workers.dev/ask

const PROFILE_MAP = {
  geral: {
    label: 'Geral',
    title: 'Perfil Geral',
    text: 'Análise ampla dos nutrientes disponíveis, sem foco restritivo individual.'
  },
  hipertensao: {
    label: 'Hipertensão',
    title: 'Perfil Hipertensão',
    text: 'Destaca o sódio por 100 g e por porção quando esses valores estão disponíveis.'
  },
  diabetes: {
    label: 'Diabetes',
    title: 'Perfil Diabetes',
    text: 'Destaca carboidratos, açúcares e tamanho da porção quando informados no registro.'
  },
  intestinal: {
    label: 'Saúde intestinal',
    title: 'Perfil Saúde Intestinal',
    text: 'Destaca fibras e ingredientes quando essas informações constam no registro.'
  },
  atleta: {
    label: 'Atleta',
    title: 'Perfil Atleta',
    text: 'Destaca energia, carboidratos e proteínas quando informados.'
  }
};

const DEMO_PRODUCTS = [
  {
    code: 'DEMO-CEREAL',
    name: 'Cereal matinal integral (exemplo fictício)',
    brand: 'Demonstração',
    source: 'Demonstração — dados fictícios',
    verified: false,
    demo: true,
    queryDate: 'Exemplo',
    portion: '30 g',
    ingredients: 'Ingredientes ilustrativos; não é um produto verificado.',
    per100g: { energy: 380, carbs: 75, sugars: 22, proteins: 8, fats: 3, fiber: 9, sodium: 180 }
  },
  {
    code: 'DEMO-BISCOITO',
    name: 'Biscoito recheado (exemplo fictício)',
    brand: 'Demonstração',
    source: 'Demonstração — dados fictícios',
    verified: false,
    demo: true,
    queryDate: 'Exemplo',
    portion: '30 g',
    ingredients: 'Ingredientes ilustrativos; não é um produto verificado.',
    per100g: { energy: 470, carbs: 68, sugars: 34, proteins: 6, fats: 19, fiber: 2, sodium: 320 }
  }
];

function loadProducts() {
  try {
    const raw = localStorage.getItem('nutricia_db');
    if (raw === null) return [...DEMO_PRODUCTS];
    const products = JSON.parse(raw);
    return Array.isArray(products) ? products.filter(p => p && p.per100g && p.code) : [...DEMO_PRODUCTS];
  } catch (_) {
    return [...DEMO_PRODUCTS];
  }
}

const state = {
  activeTab: 'inicio',
  activeProfile: 'geral',
  products: loadProducts(),
  scannerInstance: null,
  scanning: false,
  weights: { sodium: 2.0, sugar: 1.5, fiber: 2.0 }
};

let firebaseAuth = null;
let firebaseConfigured = false;
let authMode = 'login';
let introStep = 0;
let assistantBusy = false;

document.addEventListener('DOMContentLoaded', initNutricia);

function initNutricia() {
  initTheme();
  initNavigation();
  initProfilePicker();
  initManualForms();
  initComparator();
  initWeightLab();
  initGlobalSearch();
  initAssistant();
  initOnboarding();
  initAuth();
  renderProductsTable();
  updateCompareDropdowns();
  updateProfileHighlights();
  updateDashboardStats();
  updateAssistantStatus();
  registerServiceWorker();

  const progress = document.getElementById('splash-progress');
  if (progress) requestAnimationFrame(() => { progress.style.width = '100%'; });

  setTimeout(() => {
    routeAfterSplash();
  }, 900);
}

function routeAfterSplash() {
  if (firebaseConfigured) {
    // O observador do Firebase controla a navegação quando a autenticação está configurada.
    if (firebaseAuth && firebaseAuth.currentUser) {
      showApplication(firebaseAuth.currentUser.email || 'Conta');
      return;
    }
    if (localStorage.getItem('nutricia-guest-session') === '1') {
      showApplication('Visitante');
      return;
    }
  } else if (localStorage.getItem('nutricia-guest-session') === '1') {
    showApplication('Visitante');
    return;
  }

  hideScreens();
  if (localStorage.getItem('nutricia-onboarding-done') === '1') {
    document.getElementById('auth-screen').classList.remove('hidden');
  } else {
    document.getElementById('onboarding-screen').classList.remove('hidden');
  }
}

function hideScreens() {
  ['splash-screen', 'onboarding-screen', 'auth-screen', 'application'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

function showApplication(identity = 'Visitante') {
  hideScreens();
  document.getElementById('application').classList.remove('hidden');
  const greeting = document.getElementById('welcome-user');
  if (greeting) {
    const first = String(identity || 'Visitante').split('@')[0];
    greeting.textContent = `Olá, ${first}!`;
  }
  showTab(state.activeTab || 'inicio');
  renderProductsTable();
  updateCompareDropdowns();
  updateDashboardStats();
}

function showAuthScreen() {
  hideScreens();
  document.getElementById('auth-screen').classList.remove('hidden');
}

function initOnboarding() {
  const slides = [
    {
      kicker: 'Conheça o NutricIA · 1 de 3',
      title: 'Compare com mais clareza.',
      copy: 'Veja lado a lado os nutrientes que aparecem nos registros dos alimentos e confira a origem dos dados.'
    },
    {
      kicker: 'Informação útil · 2 de 3',
      title: 'Entenda, sem adivinhar.',
      copy: 'A assistente usa dados disponíveis e informa quando não encontra uma informação. Valores ausentes não são tratados como zero.'
    },
    {
      kicker: 'No seu ritmo · 3 de 3',
      title: 'Um passo de cada vez.',
      copy: 'Escaneie produtos, escolha um perfil de destaque e salve seus itens neste navegador. O app é educativo e não substitui orientação profissional.'
    }
  ];

  const renderSlide = () => {
    const slide = slides[introStep];
    document.getElementById('onboarding-kicker').textContent = slide.kicker;
    document.getElementById('onboarding-title').textContent = slide.title;
    document.getElementById('onboarding-copy').textContent = slide.copy;
    for (let i = 0; i < 3; i++) {
      document.getElementById(`onboarding-dot-${i}`).style.background = i === introStep ? 'var(--green)' : 'var(--border)';
    }
    document.getElementById('onboarding-next').textContent = introStep === 2 ? 'Começar' : 'Próximo';
  };

  const finishIntro = () => {
    localStorage.setItem('nutricia-onboarding-done', '1');
    showAuthScreen();
  };

  document.getElementById('onboarding-next').addEventListener('click', () => {
    if (introStep < slides.length - 1) {
      introStep += 1;
      renderSlide();
    } else finishIntro();
  });
  document.getElementById('onboarding-skip').addEventListener('click', finishIntro);
  renderSlide();
}

function isFirebaseConfigReady() {
  return typeof firebase !== 'undefined' &&
    FIREBASE_CONFIG.apiKey &&
    !FIREBASE_CONFIG.apiKey.startsWith('COLE_AQUI') &&
    FIREBASE_CONFIG.authDomain &&
    !FIREBASE_CONFIG.authDomain.startsWith('COLE_AQUI') &&
    FIREBASE_CONFIG.projectId &&
    !FIREBASE_CONFIG.projectId.startsWith('COLE_AQUI') &&
    FIREBASE_CONFIG.appId &&
    !FIREBASE_CONFIG.appId.startsWith('COLE_AQUI');
}

function initAuth() {
  firebaseConfigured = isFirebaseConfigReady();
  if (firebaseConfigured) {
    try {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      firebaseAuth = firebase.auth();
      firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      firebaseAuth.onAuthStateChanged(user => {
        if (user) showApplication(user.email || 'Conta');
        else if (localStorage.getItem('nutricia-guest-session') === '1') showApplication('Visitante');
        else if (!document.getElementById('splash-screen').classList.contains('hidden')) return;
        else showAuthScreen();
      });
      document.getElementById('auth-feedback').textContent = 'Entre com sua conta ou continue como visitante. O login usa Firebase após a configuração do projeto.';
    } catch (error) {
      firebaseConfigured = false;
      firebaseAuth = null;
      setAuthFeedback('Não foi possível iniciar o Firebase. Confira a configuração e tente novamente.', true);
    }
  } else {
    setAuthFeedback('O login real ainda precisa ser conectado a um projeto Firebase. Para usar o app agora, escolha “Continuar como visitante”.');
  }

  document.getElementById('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!firebaseConfigured || !firebaseAuth) {
      setAuthFeedback('O login ainda não foi conectado. Configure o Firebase para habilitar contas reais, ou entre como visitante.', true);
      return;
    }

    const submit = document.getElementById('auth-submit');
    submit.disabled = true;
    submit.textContent = authMode === 'register' ? 'Criando conta...' : 'Entrando...';
    try {
      if (authMode === 'register') {
        await firebaseAuth.createUserWithEmailAndPassword(email, password);
      } else {
        await firebaseAuth.signInWithEmailAndPassword(email, password);
      }
    } catch (error) {
      const messages = {
        'auth/invalid-email': 'Esse e-mail não parece válido.',
        'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
        'auth/wrong-password': 'A senha não confere.',
        'auth/invalid-credential': 'E-mail ou senha não conferem.',
        'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
        'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
        'auth/network-request-failed': 'Sem conexão. Confira a internet e tente novamente.'
      };
      setAuthFeedback(messages[error.code] || 'Não foi possível entrar. Verifique as configurações do Firebase e tente novamente.', true);
    } finally {
      submit.disabled = false;
      submit.textContent = authMode === 'register' ? 'Criar conta' : 'Entrar';
    }
  });

  document.getElementById('auth-switch-mode').addEventListener('click', () => {
    authMode = authMode === 'login' ? 'register' : 'login';
    document.getElementById('auth-title').textContent = authMode === 'register' ? 'Crie sua conta.' : 'Que bom ter você aqui.';
    document.getElementById('auth-subtitle').textContent = authMode === 'register' ? 'Cadastre-se para entrar com sua conta.' : 'Entre com sua conta ou use o aplicativo como visitante.';
    document.getElementById('auth-submit').textContent = authMode === 'register' ? 'Criar conta' : 'Entrar';
    document.getElementById('auth-switch-mode').textContent = authMode === 'register' ? 'Já tenho conta' : 'Criar conta';
    document.getElementById('auth-forgot').classList.toggle('hidden', authMode === 'register');
    document.getElementById('auth-password').autocomplete = authMode === 'register' ? 'new-password' : 'current-password';
    setAuthFeedback(firebaseConfigured ? 'Digite seu e-mail e senha.' : 'Para criar uma conta real, conecte um projeto Firebase. Você ainda pode entrar como visitante.');
  });

  document.getElementById('auth-forgot').addEventListener('click', async () => {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) {
      setAuthFeedback('Digite seu e-mail primeiro para solicitar a redefinição.', true);
      return;
    }
    if (!firebaseConfigured || !firebaseAuth) {
      setAuthFeedback('A recuperação de senha ficará disponível depois que o Firebase estiver configurado.', true);
      return;
    }
    try {
      await firebaseAuth.sendPasswordResetEmail(email);
      setAuthFeedback('Se o e-mail estiver cadastrado, você receberá instruções para redefinir a senha.');
    } catch (_) {
      setAuthFeedback('Não foi possível enviar o e-mail. Confira o endereço e a configuração do Firebase.', true);
    }
  });

  document.getElementById('guest-button').addEventListener('click', () => {
    localStorage.setItem('nutricia-guest-session', '1');
    showApplication('Visitante');
  });

  const logout = async () => {
    localStorage.removeItem('nutricia-guest-session');
    if (firebaseAuth && firebaseAuth.currentUser) {
      try { await firebaseAuth.signOut(); } catch (_) {}
    }
    showAuthScreen();
  };
  document.getElementById('logout-button').addEventListener('click', logout);
  document.getElementById('logout-button-profile').addEventListener('click', logout);
}

function setAuthFeedback(message, error = false) {
  const el = document.getElementById('auth-feedback');
  if (!el) return;
  el.textContent = message;
  el.style.borderColor = error ? '#d97778' : 'var(--border)';
}

function initTheme() {
  const root = document.documentElement;
  const themeButton = document.getElementById('theme-toggle');
  const label = document.getElementById('theme-label');
  const update = () => {
    const dark = root.classList.contains('dark');
    label.textContent = dark ? 'Modo claro' : 'Modo escuro';
    themeButton.setAttribute('aria-label', dark ? 'Ativar modo claro' : 'Ativar modo escuro');
    try { localStorage.setItem('nutricia-theme', dark ? 'dark' : 'light'); } catch (_) {}
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0c1c1a' : '#0b684c');
  };
  update();
  themeButton.addEventListener('click', () => {
    root.classList.toggle('dark');
    update();
  });
}

function initNavigation() {
  document.querySelectorAll('[data-target]').forEach(button => {
    button.addEventListener('click', event => {
      const target = event.currentTarget.dataset.target;
      if (!document.getElementById(`tab-${target}`)) return;
      showTab(target);
    });
  });
}

function showTab(target) {
  const panel = document.getElementById(`tab-${target}`);
  if (!panel) return;
  state.activeTab = target;
  document.querySelectorAll('.tab-content').forEach(section => section.classList.add('hidden'));
  panel.classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(button => {
    const active = button.dataset.target === target;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
  if (target === 'scanner') initCameraScanner();
  else stopCameraScanner();
  if (target === 'assistente') {
    updateAssistantStatus();
    document.getElementById('assistant-question').focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initProfilePicker() {
  const button = document.getElementById('profile-picker-button');
  const menu = document.getElementById('profile-picker-menu');
  const search = document.getElementById('profile-search');
  const mainSearch = document.getElementById('profile-search-main');

  button.addEventListener('click', () => {
    const shouldOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !shouldOpen);
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    if (shouldOpen) {
      search.value = '';
      renderProfileOptions('', 'profile-options');
      setTimeout(() => search.focus(), 20);
    }
  });

  search.addEventListener('input', () => renderProfileOptions(search.value, 'profile-options'));
  if (mainSearch) mainSearch.addEventListener('input', () => renderProfileOptions(mainSearch.value, 'profile-options-main'));

  document.getElementById('change-profile-home').addEventListener('click', () => {
    showTab('perfil');
    mainSearch.focus();
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.profile-picker')) {
      menu.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu.classList.add('hidden');
      button.setAttribute('aria-expanded', 'false');
    }
  });
  renderProfileOptions('', 'profile-options');
  renderProfileOptions('', 'profile-options-main');
}

function renderProfileOptions(query, targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  const q = String(query || '').trim().toLocaleLowerCase('pt-BR');
  if (!q) {
    container.innerHTML = '<p class="muted text-sm p-3">Digite para procurar um perfil.</p>';
    return;
  }
  const matches = Object.entries(PROFILE_MAP).filter(([key, profile]) =>
    `${key} ${profile.label} ${profile.title} ${profile.text}`.toLocaleLowerCase('pt-BR').includes(q)
  );
  if (!matches.length) {
    container.innerHTML = '<p class="muted text-sm p-3">Nenhum perfil encontrado. Tente outra palavra.</p>';
    return;
  }
  container.innerHTML = matches.map(([key, profile]) => `
    <button class="${targetId === 'profile-options-main' ? 'health-card w-full text-left' : 'profile-option'}" type="button" data-profile-pick="${escapeHtml(key)}" role="option" aria-selected="${state.activeProfile === key}">
      <span class="health-dot"></span>
      <span><strong class="block">${escapeHtml(profile.label)}</strong><span class="muted text-xs">${escapeHtml(profile.text)}</span></span>
    </button>
  `).join('');

  container.querySelectorAll('[data-profile-pick]').forEach(option => {
    option.addEventListener('click', () => {
      state.activeProfile = option.dataset.profilePick;
      updateProfileHighlights();
      document.getElementById('profile-picker-menu').classList.add('hidden');
      document.getElementById('profile-picker-button').setAttribute('aria-expanded', 'false');
      const mainSearch = document.getElementById('profile-search-main');
      if (mainSearch) mainSearch.value = '';
      renderProfileOptions('', 'profile-options-main');
      renderProfileOptions('', 'profile-options');
    });
  });
}

function updateProfileHighlights() {
  const profile = PROFILE_MAP[state.activeProfile] || PROFILE_MAP.geral;
  document.getElementById('profile-short-label').textContent = `Perfil: ${profile.label}`;
  document.getElementById('profile-badge').textContent = profile.title;
  document.getElementById('profile-details').textContent = profile.text;
  document.getElementById('active-profile-name').textContent = profile.label;
  document.getElementById('profile-main-title').textContent = profile.title;
  document.getElementById('profile-main-desc').textContent = profile.text;
  renderComparisonTable();
}

function initGlobalSearch() {
  const search = document.getElementById('global-search');
  const homeSearch = document.getElementById('home-search');
  const doSearch = value => {
    const target = document.getElementById('search-db');
    if (target) target.value = value;
    showTab('banco');
    renderProductsTable();
  };
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') doSearch(search.value.trim());
  });
  if (homeSearch) {
    homeSearch.addEventListener('keydown', event => {
      if (event.key === 'Enter') doSearch(homeSearch.value.trim());
    });
  }
  document.getElementById('search-db').addEventListener('input', renderProductsTable);
}

function initManualForms() {
  document.getElementById('btn-manual-search').addEventListener('click', () => {
    const input = document.getElementById('manual-barcode');
    const code = input.value.trim().replace(/\s+/g, '');
    if (!code) {
      setScannerFeedback('Digite o código de barras antes de buscar.', 'warning');
      return;
    }
    fetchProductFromOFF(code);
  });

  document.getElementById('btn-save-manual').addEventListener('click', () => {
    const name = document.getElementById('new-name').value.trim();
    const brand = document.getElementById('new-brand').value.trim();
    const code = document.getElementById('new-code').value.trim() || `MANUAL-${Date.now()}`;
    if (!name) {
      alert('Informe o nome do produto.');
      document.getElementById('new-name').focus();
      return;
    }
    const parseVal = id => {
      const value = document.getElementById(id).value.trim();
      return value !== '' && Number.isFinite(Number(value)) ? Number(value) : 'Não disponível';
    };
    const newProduct = {
      code,
      name,
      brand: brand || 'Inserção manual',
      source: 'Inserção Manual — não verificado',
      verified: false,
      demo: false,
      queryDate: new Date().toLocaleDateString('pt-BR'),
      portion: '100 g',
      ingredients: 'Não informado',
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
    saveProductToDb(newProduct);
    ['new-name','new-brand','new-code','new-energy','new-carbs','new-sugars','new-proteins','new-fats','new-fiber','new-sodium'].forEach(id => {
      document.getElementById(id).value = '';
    });
    alert('Produto salvo neste navegador. Os dados foram marcados como inserção manual, sem verificação externa.');
  });
}

function initComparator() {
  document.getElementById('select-prod-1').addEventListener('change', renderComparisonTable);
  document.getElementById('select-prod-2').addEventListener('change', renderComparisonTable);
}

function initWeightLab() {
  const sliders = [
    ['weight-sodium', 'sodium'],
    ['weight-sugar', 'sugar'],
    ['weight-fiber', 'fiber']
  ];
  sliders.forEach(([id, key]) => {
    document.getElementById(id).addEventListener('input', event => {
      state.weights[key] = Number(event.target.value);
      const value = document.getElementById(`${id}-value`);
      if (value) value.textContent = `${Number(event.target.value).toFixed(1)}x`;
      document.getElementById('lab-feedback').textContent = `Coeficiente ${key} ajustado para ${Number(event.target.value).toFixed(1)}. Pontuações válidas foram recalculadas.`;
      renderComparisonTable();
    });
  });
}

async function initCameraScanner() {
  const feedback = document.getElementById('scanner-feedback');
  if (state.scanning || state.scannerInstance) return;
  feedback.textContent = 'Solicitando acesso à câmera...';
  if (typeof Html5Qrcode === 'undefined') {
    setScannerFeedback('A biblioteca do scanner não carregou. Use a busca manual.', 'warning');
    return;
  }
  const reader = document.getElementById('reader');
  if (!reader) return;
  try {
    const scanner = new Html5Qrcode('reader');
    state.scannerInstance = scanner;
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 140 } },
      async decodedText => {
        if (state.scanning) return;
        state.scanning = true;
        await stopCameraScanner();
        state.scanning = false;
        document.getElementById('manual-barcode').value = decodedText;
        await fetchProductFromOFF(decodedText);
      },
      () => {}
    );
    setScannerFeedback('Câmera ativa. Aponte para o código de barras do produto.', 'success');
  } catch (_) {
    state.scannerInstance = null;
    setScannerFeedback('Não foi possível abrir a câmera. Confira a permissão e tente a busca manual.', 'error');
  }
}

async function stopCameraScanner() {
  const scanner = state.scannerInstance;
  if (!scanner) return;
  state.scannerInstance = null;
  try {
    if (scanner.isScanning) await scanner.stop();
    try { await scanner.clear(); } catch (_) {}
  } catch (_) {}
}

async function fetchProductFromOFF(barcode) {
  const code = String(barcode || '').trim().replace(/\s+/g, '');
  if (!/^\d{8,14}$/.test(code)) {
    setScannerFeedback('O código deve conter de 8 a 14 números. Confira o código de barras.', 'warning');
    return;
  }
  setScannerFeedback(`Consultando Open Food Facts para o código ${code}...`, 'info');

  try {
    const response = await fetch(`${OFF_API_URL}${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,serving_size,image_front_url,ingredients_text,ingredients_text_pt`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.status !== 1 || !payload.product) {
      setScannerFeedback('Produto não encontrado na Open Food Facts. Você pode cadastrar os valores do rótulo manualmente.', 'warning');
      return;
    }
    const product = payload.product;
    const n = product.nutriments || {};
    const newProduct = {
      code: product.code || code,
      name: product.product_name || 'Nome não informado',
      brand: product.brands || 'Marca não informada',
      source: 'Open Food Facts API (base colaborativa)',
      verified: false,
      demo: false,
      queryDate: new Date().toLocaleDateString('pt-BR'),
      image: product.image_front_url || null,
      ingredients: product.ingredients_text_pt || product.ingredients_text || 'Não disponível',
      portion: product.serving_size || 'Não disponível',
      per100g: {
        energy: finiteOrNA(n['energy-kcal_100g']),
        carbs: finiteOrNA(n.carbohydrates_100g),
        sugars: finiteOrNA(n.sugars_100g),
        proteins: finiteOrNA(n.proteins_100g),
        fats: finiteOrNA(n.fat_100g),
        fiber: finiteOrNA(n.fiber_100g),
        sodium: n.sodium_100g !== undefined && Number.isFinite(Number(n.sodium_100g))
          ? Math.round(Number(n.sodium_100g) * 1000)
          : 'Não disponível'
      }
    };
    saveProductToDb(newProduct);
    displayScanResult(newProduct);
    setScannerFeedback(`Encontrado: ${newProduct.name}. Confira as informações na embalagem.`, 'success');
  } catch (_) {
    setScannerFeedback('Não conseguimos consultar a base agora. Confira a conexão ou tente novamente.', 'error');
  }
}

function finiteOrNA(value) {
  return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
    ? Number(value)
    : 'Não disponível';
}

function setScannerFeedback(message, kind = 'info') {
  const feedback = document.getElementById('scanner-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.style.color = kind === 'error' ? '#bd4141' : kind === 'warning' ? 'var(--orange)' : kind === 'success' ? 'var(--green)' : 'var(--muted)';
}

function displayScanResult(product) {
  const container = document.getElementById('scan-result-container');
  if (!container) return;
  container.classList.remove('hidden');
  const imageHTML = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="" class="w-16 h-16 rounded-xl object-cover border" style="border-color:var(--border)">`
    : '';
  const metrics = [
    ['Sódio', product.per100g.sodium, 'mg'],
    ['Açúcares', product.per100g.sugars, 'g'],
    ['Fibras', product.per100g.fiber, 'g'],
    ['Proteínas', product.per100g.proteins, 'g']
  ];
  container.innerHTML = `
    <div class="soft p-4 rounded-2xl">
      <div class="flex items-center gap-3">${imageHTML}<div class="min-w-0"><h3 class="font-black">${escapeHtml(product.name)}</h3><p class="muted text-sm">${escapeHtml(product.brand)} · EAN ${escapeHtml(product.code)}</p><p class="muted text-xs mt-1">Fonte: ${escapeHtml(product.source)} · ${escapeHtml(product.queryDate)}</p></div></div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
        ${metrics.map(([label,value,unit]) => `<div class="surface p-3"><p class="muted text-xs">${label}</p><p class="font-black mt-1">${displayNumber(value, unit)}</p></div>`).join('')}
      </div>
    </div>`;
}

function saveProductToDb(product) {
  state.products = state.products.filter(p => p.code !== product.code);
  state.products.unshift(product);
  try {
    localStorage.setItem('nutricia_db', JSON.stringify(state.products));
  } catch (_) {
    alert('O navegador não conseguiu salvar. Talvez o armazenamento esteja cheio.');
  }
  renderProductsTable();
  updateCompareDropdowns();
  updateDashboardStats();
}

function removeProductFromDb(code) {
  state.products = state.products.filter(p => p.code !== code);
  try { localStorage.setItem('nutricia_db', JSON.stringify(state.products)); } catch (_) {}
  renderProductsTable();
  updateCompareDropdowns();
  updateDashboardStats();
}

function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  if (!tbody) return;
  const query = (document.getElementById('search-db')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const products = state.products.filter(product =>
    `${product.name} ${product.brand} ${product.code}`.toLocaleLowerCase('pt-BR').includes(query)
  );
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted text-center p-6">Nenhum produto encontrado. Escaneie um código ou cadastre um rótulo.</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.name)}</strong><span class="block muted text-xs mt-1">${escapeHtml(p.brand)}</span></td>
      <td class="font-mono text-xs">${escapeHtml(p.code)}</td>
      <td>${displayNumber(p.per100g.sodium, 'mg')}</td>
      <td>${displayNumber(p.per100g.sugars, 'g')}</td>
      <td><span class="tiny-source">${escapeHtml(p.source || 'Fonte não informada')}</span></td>
      <td><button type="button" class="btn btn-quiet text-sm" data-remove-code="${escapeHtml(p.code)}" aria-label="Remover ${escapeHtml(p.name)}">Remover</button></td>
    </tr>
  `).join('');
  tbody.querySelectorAll('[data-remove-code]').forEach(button => {
    button.addEventListener('click', () => removeProductFromDb(button.dataset.removeCode));
  });
}

function updateDashboardStats() {
  const total = document.getElementById('stat-products');
  const api = document.getElementById('stat-api-products');
  if (total) total.textContent = String(state.products.filter(p => !p.demo && !String(p.source).toLowerCase().includes('demonstração')).length);
  if (api) api.textContent = String(state.products.filter(p => String(p.source).includes('Open Food Facts')).length);
}

function updateCompareDropdowns() {
  const s1 = document.getElementById('select-prod-1');
  const s2 = document.getElementById('select-prod-2');
  if (!s1 || !s2) return;
  const old1 = s1.value;
  const old2 = s2.value;
  const options = '<option value="">Selecione um produto</option>' + state.products.map(p =>
    `<option value="${escapeHtml(p.code)}">${escapeHtml(p.name)} — ${escapeHtml(p.brand)}</option>`
  ).join('');
  s1.innerHTML = options;
  s2.innerHTML = options;
  if (state.products.some(p => p.code === old1)) s1.value = old1;
  if (state.products.some(p => p.code === old2)) s2.value = old2;
  renderComparisonTable();
}

function calculateIACScore(product) {
  const { sodium, sugars, fiber } = product.per100g || {};
  // Dados ausentes nunca são tratados como zero.
  if (![sodium, sugars, fiber].every(value => typeof value === 'number' && Number.isFinite(value))) return null;
  const score = 100 - (sodium / 100) * state.weights.sodium - sugars * state.weights.sugar + fiber * state.weights.fiber;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function renderComparisonTable() {
  const container = document.getElementById('comparison-results');
  const code1 = document.getElementById('select-prod-1')?.value;
  const code2 = document.getElementById('select-prod-2')?.value;
  const products = [state.products.find(p => p.code === code1), state.products.find(p => p.code === code2)];
  if (!products.some(Boolean)) {
    container.innerHTML = '<p class="muted text-sm text-center py-8">Selecione pelo menos um produto para começar.</p>';
    return;
  }

  const fields = [
    ['Energia', 'energy', 'kcal'],
    ['Carboidratos', 'carbs', 'g'],
    ['Açúcares', 'sugars', 'g'],
    ['Proteínas', 'proteins', 'g'],
    ['Gorduras', 'fats', 'g'],
    ['Fibras', 'fiber', 'g'],
    ['Sódio', 'sodium', 'mg']
  ];

  container.innerHTML = `<div class="grid md:grid-cols-2 gap-4">${products.map(product => {
    if (!product) return '<div class="soft p-5 text-center muted">Selecione o outro produto para comparar.</div>';
    const score = calculateIACScore(product);
    const scoreText = score === null ? 'Dados insuficientes' : `${score}/100`;
    return `<article class="soft p-4">
      <h3 class="font-black text-lg">${escapeHtml(product.name)}</h3>
      <p class="muted text-sm mt-1">${escapeHtml(product.brand)}</p>
      <p class="muted text-xs mt-1">Fonte: ${escapeHtml(product.source || 'Não informada')}</p>
      <div class="surface text-center p-4 mt-4"><p class="muted text-xs uppercase tracking-wide">IAC simulado</p><p class="text-2xl font-black mt-1">${scoreText}</p><p class="muted text-xs mt-1">Fórmula didática; não é índice oficial.</p></div>
      <div class="mt-4 space-y-0">${fields.map(([label,key,unit]) => {
        const highlight =
          (state.activeProfile === 'hipertensao' && key === 'sodium') ||
          (state.activeProfile === 'diabetes' && ['carbs','sugars'].includes(key)) ||
          (state.activeProfile === 'intestinal' && key === 'fiber') ||
          (state.activeProfile === 'atleta' && ['energy','carbs','proteins'].includes(key));
        return `<div class="flex justify-between gap-3 py-2 border-b" style="border-color:var(--border);${highlight ? 'font-weight:800;color:var(--green)' : ''}"><span>${label}</span><span class="text-right">${displayNumber(product.per100g[key], unit)}</span></div>`;
      }).join('')}</div>
    </article>`;
  }).join('')}</div>`;
}

function displayNumber(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Não disponível';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}`;
}

function getEvidenceProducts() {
  return state.products
    .filter(p => !p.demo && !String(p.source || '').toLowerCase().includes('demonstração') && !String(p.source || '').toLowerCase().includes('exemplo local'))
    .slice(0, 18)
    .map(p => ({
      name: String(p.name || ''),
      brand: String(p.brand || ''),
      code: String(p.code || ''),
      source: String(p.source || 'Fonte não informada'),
      date: String(p.queryDate || 'Data não informada'),
      portion: String(p.portion || 'Não disponível'),
      ingredients: String(p.ingredients || 'Não disponível'),
      nutrientsPer100g: {
        energyKcal: typeof p.per100g.energy === 'number' ? p.per100g.energy : null,
        carbohydratesG: typeof p.per100g.carbs === 'number' ? p.per100g.carbs : null,
        sugarsG: typeof p.per100g.sugars === 'number' ? p.per100g.sugars : null,
        proteinsG: typeof p.per100g.proteins === 'number' ? p.per100g.proteins : null,
        fatsG: typeof p.per100g.fats === 'number' ? p.per100g.fats : null,
        fiberG: typeof p.per100g.fiber === 'number' ? p.per100g.fiber : null,
        sodiumMg: typeof p.per100g.sodium === 'number' ? p.per100g.sodium : null
      }
    }));
}

function initAssistant() {
  const form = document.getElementById('assistant-form');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (assistantBusy) return;
    const questionBox = document.getElementById('assistant-question');
    const question = questionBox.value.trim();
    if (!question) return;
    assistantBusy = true;
    addChatBubble(question, 'user');
    questionBox.value = '';
    const loading = addChatBubble('Estou conferindo os registros disponíveis...', 'assistant');
    const submit = document.getElementById('assistant-submit');
    submit.disabled = true;


try {
  const answer = await askNutricia(question);
  loading.querySelector('.chat-text').textContent = formatNutriciaAnswer(answer.text);

  if (answer.source) {
    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = answer.source;
    loading.appendChild(meta);
  }
} catch (error) {
  console.error('Erro na NutricIA:', error);
  loading.querySelector('.chat-text').textContent = 'Não consegui consultar a assistente agora. Tente novamente mais tarde. Nenhum dado foi inventado.';
} finally {
  assistantBusy = false;
  submit.disabled = false;
  const list = document.getElementById('assistant-messages');
  list.scrollTop = list.scrollHeight;
  questionBox.focus({ preventScroll: true });
}
});


  document.querySelectorAll('.question-suggestion').forEach(button => {
    button.addEventListener('click', () => {
      document.getElementById('assistant-question').value = button.dataset.question;
      document.getElementById('assistant-question').focus();
    });
  });
}

function addChatBubble(text, type) {
  const list = document.getElementById('assistant-messages');
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${type}`;
  const content = document.createElement('div');
  content.className = 'chat-text';
  content.textContent = text;
  bubble.appendChild(content);
  list.appendChild(bubble);
  list.scrollTop = list.scrollHeight;
  return bubble;
}

function formatNutriciaAnswer(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/^#{1,6}\s+(.+)$/gm, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^---+$/gm, '')
    .trim();
}

async function askNutricia(question) {
  const products = getEvidenceProducts();
  if (NUTRICIA_AI_ENDPOINT) {
    const response = await fetch(NUTRICIA_AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        profile: PROFILE_MAP[state.activeProfile],
        products
      })
    });
    if (!response.ok) {
      if (response.status === 503) throw new Error('A chave da IA não está configurada no servidor.');
      throw new Error(`Erro no serviço de IA: ${response.status}`);
    }
    const data = await response.json();
    if (!data || typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('Resposta vazia.');
    return { text: data.answer, source: data.source || 'Dados enviados pelo NutricIA' };
  }

  return {
    text: localEvidenceAnswer(question, products),
    source: products.length ? `Modo local · ${products.length} registro(s) disponível(is). A IA generativa ainda não foi conectada.` : 'Modo local · nenhum registro real disponível.'
  };
}

function localEvidenceAnswer(question, products) {
  if (!products.length) {
    return 'Ainda não há produtos com dados reais no banco deste navegador. Escaneie o código de um alimento para consultar a Open Food Facts ou cadastre os valores do rótulo. Os produtos de demonstração são fictícios e foram excluídos desta resposta.';
  }

  const q = question.toLocaleLowerCase('pt-BR');
  const nutrientMap = [
    { keys: ['sódio','sodio','sal'], label: 'sódio', key: 'sodiumMg', unit: 'mg' },
    { keys: ['açúcar','açucares','acucar','açúcares','doce'], label: 'açúcares', key: 'sugarsG', unit: 'g' },
    { keys: ['fibra','fibras'], label: 'fibras', key: 'fiberG', unit: 'g' },
    { keys: ['proteína','proteinas','proteína','proteínas'], label: 'proteínas', key: 'proteinsG', unit: 'g' },
    { keys: ['carboidrato','carboidratos'], label: 'carboidratos', key: 'carbohydratesG', unit: 'g' },
    { keys: ['caloria','calorias','energia'], label: 'energia', key: 'energyKcal', unit: 'kcal' },
    { keys: ['gordura','gorduras'], label: 'gorduras', key: 'fatsG', unit: 'g' }
  ];
  const nutrient = nutrientMap.find(item => item.keys.some(key => q.includes(key)));
  const matching = products.filter(p => {
    const text = `${p.name} ${p.brand} ${p.code}`.toLocaleLowerCase('pt-BR');
    const words = q.split(/[^a-z0-9áéíóúãõç]+/i).filter(word => word.length >= 4);
    return words.some(word => text.includes(word));
  });

  if (nutrient && matching.length) {
    const lines = matching.map(product => {
      const value = product.nutrientsPer100g[nutrient.key];
      return `• ${product.name} (${product.brand}): ${value === null ? 'não disponível' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${nutrient.unit}`} por 100 g. Fonte indicada no cadastro: ${product.source}.`;
    });
    return `Encontrei estes registros para ${nutrient.label}:\n\n${lines.join('\n')}\n\nOs dados podem estar incompletos. A Open Food Facts é uma base colaborativa; confira o rótulo.`;
  }

  if (nutrient) {
    const lines = products.map(product => {
      const value = product.nutrientsPer100g[nutrient.key];
      return `• ${product.name}: ${value === null ? 'não disponível' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)} ${nutrient.unit}`} por 100 g (${product.source}).`;
    });
    return `Com os registros atuais, estes são os dados de ${nutrient.label} disponíveis:\n\n${lines.join('\n')}\n\nNão há dados suficientes para concluir se um alimento é adequado para uma condição de saúde.`;
  }

  if (q.includes('perfil') || q.includes('hipertens') || q.includes('diabet') || q.includes('intestinal') || q.includes('atleta')) {
    const profile = PROFILE_MAP[state.activeProfile];
    return `${profile.title}: ${profile.text}\n\nEsse perfil apenas destaca campos específicos na comparação. Ele não faz diagnóstico nem determina se um alimento é indicado para uma pessoa. Para responder sobre produtos, preciso de dados presentes no banco.`;
  }

  if (q.includes('faltando') || q.includes('disponível') || q.includes('disponivel') || q.includes('dados')) {
    return products.map(p => {
      const fields = Object.entries(p.nutrientsPer100g).filter(([, value]) => value === null).map(([key]) => key);
      return `• ${p.name}: ${fields.length ? `sem dado disponível para ${fields.join(', ')}` : 'todos os campos nutricionais usados pela assistente têm valor numérico no registro'}.`;
    }).join('\n');
  }

  return 'Posso conferir os dados de produtos cadastrados, mas esta versão ainda está no modo local e não tem IA generativa conectada. Faça perguntas específicas, por exemplo: “Quanto sódio há no produto X?” ou “Quais produtos têm dados de fibras?”. Para conversa em linguagem natural completa, configure o endpoint seguro do Cloudflare Worker descrito no arquivo LEIA-ME.';
}


function updateAssistantStatus() {
  const el = document.getElementById('assistant-source-status');
  if (!el) return;

  if (NUTRICIA_AI_ENDPOINT) {
    el.textContent = 'NutricIA conectada! Faça perguntas sobre alimentação, nutrição, saúde e produtos alimentícios. As respostas são geradas por inteligência artificial.';
  } else {
    el.textContent = 'Assistente em modo local. Para habilitar IA generativa em linguagem natural, configure o Cloudflare Worker e o segredo GEMINI_API_KEY. A chave nunca deve ficar no código público.';
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}
