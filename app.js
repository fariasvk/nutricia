/* NutricIA v2 — lógica do app, autenticação opcional, busca de produtos e assistente com fontes */
'use strict';

const OFF_API_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const OFF_FIELDS = 'code,product_name,brands,nutriments,serving_size,image_front_url,ingredients_text,ingredients_text_pt,allergens_tags,allergens,allergens_from_ingredients,traces_tags,traces,labels_tags,labels,ingredients_analysis_tags';

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
    text: 'Destaca o sódio por 100 g e por porção.'
  },
  diabetes: {
    label: 'Diabetes',
    title: 'Perfil Diabetes',
    text: 'Destaca carboidratos, açúcares e tamanho da porção.'
  },
  intestinal: {
    label: 'Saúde intestinal',
    title: 'Perfil Saúde Intestinal',
    text: 'Destaca fibras e ingredientes disponíveis.'
  },
  atleta: {
    label: 'Atleta',
    title: 'Perfil Atleta',
    text: 'Destaca energia, carboidratos e proteínas.'
  },
  lactose: {
    label: 'Intolerância à lactose',
    title: 'Perfil Intolerância à Lactose',
    text: 'Verifica informações sobre lactose nos ingredientes e avisos do rótulo.'
  },
  celiaca: {
    label: 'Doença celíaca',
    title: 'Perfil Doença Celíaca',
    text: 'Verifica a declaração de presença ou ausência de glúten.'
  },
  colesterol: {
    label: 'Colesterol elevado',
    title: 'Perfil Colesterol Elevado',
    text: 'Destaca gorduras saturadas e trans quando disponíveis.'
  },
  obesidade: {
    label: 'Controle de peso',
    title: 'Perfil Controle de Peso',
    text: 'Destaca energia, fibras, açúcares e tamanho das porções.'
  },
  renal: {
    label: 'Doença renal crônica',
    title: 'Perfil Saúde Renal',
    text: 'Destaca sódio e outros nutrientes relevantes conforme orientação individual.'
  },
  alergia_leite: {
    label: 'Alergia à proteína do leite',
    title: 'Perfil Alergia ao Leite',
    text: 'Verifica leite, derivados e avisos de alergênicos. Sem lactose não significa sem leite.'
  },
  alergia_ovo: {
    label: 'Alergia ao ovo',
    title: 'Perfil Alergia ao Ovo',
    text: 'Verifica ovos, derivados e avisos de alergênicos.'
  },
    alergia_amendoim: {
    label: 'Alergia ao amendoim',
    title: 'Perfil Alergia ao Amendoim',
    text: 'Verifica amendoim e avisos de possível contaminação cruzada.'
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


const savedProfiles = (() => {
  try {
    const saved = JSON.parse(
      localStorage.getItem('nutricia-active-profiles')
    );

    if (Array.isArray(saved)) {
      const valid = [...new Set(saved.filter(key => Object.hasOwn(PROFILE_MAP, key)))];
      if (valid.length) return valid.length > 1 ? valid.filter(key => key !== 'geral') : valid;
    }
  } catch (error) {
    console.warn('Não foi possível recuperar os perfis:', error);
  }

  return ['geral'];
})();

const state = {
  activeTab: 'inicio',
  activeProfile: savedProfiles[0],
  activeProfiles: savedProfiles,
  products: [],
  scannerInstance: null,
  scanning: false,
  lastScanCode: '',
  lastScanAt: 0,
  weights: { sodium: 2.0, sugar: 1.5, fiber: 2.0 }
};


let firebaseAuth = null;
let firebaseDb = null;
let firebaseConfigured = false;
let authMode = 'login';
let introStep = 0;
let assistantBusy = false;
let deferredInstallPrompt = null;

// Metadados estáticos; não entram no banco pessoal, no IAC ou nos prompts de IA automaticamente.
let catalogItems = null;
let catalogPromise = null;
let catalogVisibleCount = 16;
let catalogSelectedCode = '';
let catalogQueryTimer = null;
let catalogFetchBusy = false;
let scannerLibraryPromise = null;

function normalizeCatalogText(text) {
  return String(text ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

async function loadCatalog() {
  if (catalogItems) return catalogItems;
  if (catalogPromise) return catalogPromise;
  const status = document.getElementById('catalog-status');
  if (status) status.textContent = 'Carregando catálogo local...';
  catalogPromise = (async () => {
    const response = await fetch('./catalogo_299.json');
    if (!response.ok) throw new Error(`Catálogo não disponível (HTTP ${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.items) || data.items.length !== 299) {
      throw new Error('O arquivo do catálogo está incompleto.');
    }
    const seen = new Set();
    catalogItems = data.items.filter(item => {
      if (!/^\d{13}$/.test(String(item.code || '')) || seen.has(item.code)) return false;
      seen.add(item.code);
      item._search = normalizeCatalogText(`${item.code} ${item.name} ${item.brand} ${item.category} ${item.package} ${item.variant}`);
      return true;
    });
    if (catalogItems.length !== 299) throw new Error('Há códigos inválidos ou repetidos no catálogo.');
    if (status) status.textContent = '299 registros de referência. Sem valores nutricionais ou alergênicos confirmados.';
    renderCatalogResults();
    return catalogItems;
  })().catch(error => {
    if (status) status.textContent = 'Não foi possível abrir o catálogo. Confira se catalogo_299.json foi publicado com o aplicativo.';
    console.warn('Catálogo local indisponível:', error);
    return null;
  }).finally(() => { catalogPromise = null; });
  return catalogPromise;
}

function initCatalog() {
  const search = document.getElementById('search-db');
  if (search) {
    search.addEventListener('input', () => {
      clearTimeout(catalogQueryTimer);
      catalogQueryTimer = setTimeout(() => {
        catalogVisibleCount = 16;
        catalogSelectedCode = '';
        renderCatalogResults();
      }, 90);
    });
  }
  document.getElementById('catalog-list')?.addEventListener('click', async event => {
    const detailButton = event.target.closest('[data-catalog-detail]');
    const fetchButton = event.target.closest('[data-catalog-fetch]');
    if (detailButton) {
      const code = detailButton.dataset.catalogDetail;
      catalogSelectedCode = catalogSelectedCode === code ? '' : code;
      renderCatalogDetails();
    } else if (fetchButton && !catalogFetchBusy) {
      const code = fetchButton.dataset.catalogFetch;
      await queryCatalogNutrition(code);
    }
  });
  document.getElementById('catalog-more')?.addEventListener('click', () => {
    catalogVisibleCount += 24;
    renderCatalogResults();
  });
}

function renderCatalogResults() {
  const target = document.getElementById('catalog-list');
  if (!target || !catalogItems) return;
  const q = normalizeCatalogText(document.getElementById('search-db')?.value || '');
  const found = q ? catalogItems.filter(item => item._search.includes(q)) : catalogItems;
  const showing = found.slice(0, catalogVisibleCount);
  const counter = document.getElementById('catalog-count');
  if (counter) counter.textContent = `${found.length} de 299 registros encontrados`;
  target.innerHTML = showing.length ? showing.map(item => `
    <article class="catalog-entry" data-catalog-code="${escapeHtml(item.code)}">
      <div class="catalog-copy">
        <p class="catalog-name">${escapeHtml(item.name)}</p>
        <p class="muted text-xs">${escapeHtml(item.brand)} · ${escapeHtml(item.category)} · ${escapeHtml(item.package)}</p>
        <p class="muted text-xs font-mono">EAN ${escapeHtml(item.code)}</p>
      </div>
      <div class="catalog-actions">
        <button type="button" class="btn btn-secondary catalog-btn" data-catalog-detail="${escapeHtml(item.code)}" aria-expanded="${catalogSelectedCode === item.code}">Detalhes</button>
        <button type="button" class="btn btn-outline catalog-btn" data-catalog-fetch="${escapeHtml(item.code)}">Buscar nutrientes</button>
      </div>
      <div class="catalog-detail-container" data-catalog-detail-container="${escapeHtml(item.code)}"></div>
    </article>`).join('')
    : '<p class="muted text-sm p-4">Nenhum item encontrado no catálogo. Tente outro nome, marca ou EAN.</p>';
  const more = document.getElementById('catalog-more');
  if (more) more.classList.toggle('hidden', found.length <= catalogVisibleCount);
  renderCatalogDetails();
}

function renderCatalogDetails() {
  document.querySelectorAll('[data-catalog-detail-container]').forEach(node => {
    node.innerHTML = '';
    const expanded = node.dataset.catalogDetailContainer === catalogSelectedCode;
    const button = node.parentElement.querySelector('[data-catalog-detail]');
    if (button) button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    if (!expanded || !catalogItems) return;
    const item = catalogItems.find(p => p.code === catalogSelectedCode);
    if (!item) return;
    const safeSource = (() => {
      try {
        const parsed = new URL(item.source);
        return ['https:', 'http:'].includes(parsed.protocol)
          ? `<a href="${escapeHtml(parsed.href)}" target="_blank" rel="noopener noreferrer" class="catalog-link">Consultar fonte original</a>`
          : '<span>Fonte sem endereço verificável</span>';
      } catch (_) { return '<span>Fonte sem endereço verificável</span>'; }
    })();
    const show = (label, value) => `<div><span class="muted text-xs block">${label}</span><strong class="text-sm">${escapeHtml(value || 'Não informado')}</strong></div>`;
    node.innerHTML = `<div class="catalog-details soft p-4 mt-3">
      <div class="catalog-details-grid">
        ${show('EAN-13', item.code)}${show('Categoria', item.category)}${show('Embalagem', item.package)}
        ${show('Tipo de grão ou farinha', item.grainType)}${show('Variação', item.variant)}
        ${show('Perfil indicativo do catálogo', item.indicativeProfile)}
        ${show('Avaliação nutricional no arquivo', item.classification)}
      </div>
      <p class="muted text-xs mt-3">${escapeHtml(item.verificationNotes)}</p>
      <div class="mt-3 text-sm">${safeSource}</div>
      <p class="catalog-disclaimer mt-3">Os dados acima são apenas cadastrais. Este catálogo não comprova que o alimento seja seguro para alergias, nem possui informações nutricionais suficientes para calcular IAC.</p>
    </div>`;
  });
}

async function queryCatalogNutrition(code) {
  if (catalogFetchBusy) return;
  const item = catalogItems?.find(p => p.code === code);
  if (!item) return;
  const status = document.getElementById('catalog-status');
  catalogFetchBusy = true;
  const buttons = [...document.querySelectorAll('[data-catalog-fetch]')];
  buttons.forEach(button => { button.disabled = true; });
  if (status) status.textContent = `Consultando dados nutricionais de ${item.name}...`;
  try {
    const result = await fetchProductFromOFF(code);
    if (result) {
      if (status) status.textContent = `Cadastro encontrado: ${result.name}. Dados nutricionais incluídos em Meus produtos. Confira a embalagem.`;
      renderCatalogResults();
    } else if (status) {
      status.textContent = 'Consulta não disponível ou produto sem cadastro nutricional no Open Food Facts. Os dados do catálogo continuam acessíveis.';
    }
  } catch (error) {
    if (status) status.textContent = 'A consulta falhou. Os registros locais continuam disponíveis.';
  } finally {
    catalogFetchBusy = false;
    buttons.forEach(button => { button.disabled = false; });
  }
}


window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.querySelectorAll('#install-btn-auth, #install-btn-main')
    .forEach(button => button.hidden = true);
});

function initInstallButtons() {
    const isInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (isInstalled) {
    document.querySelectorAll('#install-btn-auth, #install-btn-main')
      .forEach(button => button.style.display = 'none');
    return;
  }
  const buttons = document.querySelectorAll(
    '#install-btn-auth, #install-btn-main'
  );

  buttons.forEach(button => {
    button.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        const promptEvent = deferredInstallPrompt;
        deferredInstallPrompt = null;
        await promptEvent.prompt();
        await promptEvent.userChoice;
     } else {
  console.log('Instalação não disponível neste momento.');
}
    });
  });
}
document.addEventListener('DOMContentLoaded', initNutricia);

function initNutricia() {
  initTheme();
  initInstallButtons();
  initNavigation();
  initProfilePicker();
  initBrandHome();
  initManualForms();
  initComparator();
  initWeightLab();
  initGlobalSearch();
  initCatalog();
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
  }, 350);
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
  
if (identity === 'Visitante') {
  try {
    const saved = JSON.parse(localStorage.getItem('nutricia_guest_db') || '[]');
    state.products = Array.isArray(saved)
      ? saved.filter(p => p && p.code && p.per100g)
      : [];
  } catch (_) {
    state.products = [];
  }
}
  
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
      firebaseDb = firebase.firestore();
      firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {});
      firebaseAuth.onAuthStateChanged(user => {
      if (user) {
  showApplication(user.email || 'Conta');
  loadProductsFromCloud(user);
}
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
    
    state.products = [];
renderProductsTable();
updateCompareDropdowns();
updateDashboardStats();
    
    if (firebaseAuth && firebaseAuth.currentUser) {
      try { await firebaseAuth.signOut(); } catch (_) {}
    }
    showAuthScreen();
  };
  document.getElementById('logout-button-profile')?.addEventListener('click', logout);
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

function initBrandHome() {
  document.getElementById('brand-home')?.addEventListener('click', () => showTab('inicio'));
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
  if (target === 'banco') loadCatalog();
  else stopCameraScanner();
  if (target === 'assistente') {
    updateAssistantStatus();
    document.getElementById('assistant-question').focus({ preventScroll: true });
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function initProfilePicker() {
  const button = document.getElementById('profile-picker-button');
  const addButton = document.getElementById('add-profile-button');
  const menu = document.getElementById('profile-picker-menu');
  const search = document.getElementById('profile-search');
  const mainSearch = document.getElementById('profile-search-main');


  function toggleProfileMenu() {
    const shouldOpen = menu.classList.contains('hidden');

    menu.classList.toggle('hidden', !shouldOpen);
    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');

    if (shouldOpen) {
      search.value = '';
      renderProfileOptions('', 'profile-options');
      setTimeout(() => search.focus(), 20);
    }
  }

  
button.addEventListener('click', toggleProfileMenu);

addButton.addEventListener('click', () => {
  mainSearch.value = '';
  renderProfileOptions('', 'profile-options-main');
  mainSearch.focus();
  mainSearch.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
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

  const matches = Object.entries(PROFILE_MAP)
  .filter(([key]) => !state.activeProfiles.includes(key))
  .filter(([key, profile]) =>
    `${key} ${profile.label} ${profile.title} ${profile.text}`.toLocaleLowerCase('pt-BR').includes(q)
  );
  if (!matches.length) {
    container.innerHTML = '<p class="muted text-sm p-3">Nenhum perfil disponível nesta busca.</p>';
    return;
  }
  container.innerHTML = matches.map(([key, profile]) => `
    <button class="${targetId === 'profile-options-main' ? 'health-card profile-choice w-full text-left' : 'profile-option'}" type="button" data-profile-pick="${escapeHtml(key)}" role="option" aria-selected="${state.activeProfiles.includes(key)}">
      <span class="health-dot"></span>
      <span><strong class="block">${escapeHtml(profile.label)}</strong><span class="muted text-xs">${escapeHtml(profile.text)}</span></span>
    </button>
  `).join('');

  container.querySelectorAll('[data-profile-pick]').forEach(option => {
   option.addEventListener('click', () => {
  const selected = option.dataset.profilePick;

  if (selected === 'geral') {
    state.activeProfiles = ['geral'];
  } else {
    const current = state.activeProfiles.filter(p => p !== 'geral');

    state.activeProfiles = current.includes(selected)
      ? current.filter(p => p !== selected)
      : [...current, selected];

    if (state.activeProfiles.length === 0) {
      state.activeProfiles = ['geral'];
    }
  }

  
state.activeProfile = state.activeProfiles[0];
updateProfileHighlights();

const mainSearch = document.getElementById('profile-search-main');
const menuSearch = document.getElementById('profile-search');

renderProfileOptions(mainSearch?.value || '', 'profile-options-main');
renderProfileOptions(menuSearch?.value || '', 'profile-options');

    });
  });
}


function updateProfileHighlights() {
  const selected = state.activeProfiles?.length
    ? state.activeProfiles
    : ['geral'];
  
try {
  localStorage.setItem(
    'nutricia-active-profiles',
    JSON.stringify(selected)
  );
} catch (error) {
  console.warn('Não foi possível salvar os perfis:', error);
}


  const profiles = selected
    .map(key => PROFILE_MAP[key])
    .filter(Boolean);

  const names = profiles.map(p => p.label).join(' + ');
  const descriptions = profiles.map(p => p.text).join(' ');

  const shortLabel = document.getElementById('profile-short-label');
  shortLabel.textContent = selected.length > 1 ? `${selected.length} perfis selecionados` : `Perfil: ${names}`;
  shortLabel.title = names;
  document.getElementById('profile-badge').textContent = names;
  document.getElementById('profile-details').textContent = descriptions;
  document.getElementById('active-profile-name').textContent = names;
  document.getElementById('profile-main-title').textContent = names;
  document.getElementById('profile-main-desc').textContent = descriptions;

  const list = document.getElementById('selected-profiles-list');

  if (list) {
    list.innerHTML = selected.map(key => {
      const profile = PROFILE_MAP[key];
      if (!profile) return '';

      return `
        <div class="selected-profile-card flex items-center justify-between gap-3">
          <div>
            <strong class="block">${escapeHtml(profile.label)}</strong>
            <span class="muted text-xs">${escapeHtml(profile.text)}</span>
          </div>

          <button
            type="button"
            class="profile-remove"
            data-remove-profile="${escapeHtml(key)}"
            aria-label="Remover ${escapeHtml(profile.label)}"
          >✕</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('[data-remove-profile]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.removeProfile;

        state.activeProfiles = state.activeProfiles.filter(p => p !== key);

        if (state.activeProfiles.length === 0) {
          state.activeProfiles = ['geral'];
        }

        state.activeProfile = state.activeProfiles[0];

        updateProfileHighlights();

        const mainSearch = document.getElementById('profile-search-main');
        const menuSearch = document.getElementById('profile-search');

        renderProfileOptions(mainSearch?.value || '', 'profile-options-main');
        renderProfileOptions(menuSearch?.value || '', 'profile-options');
      });
    });
  }

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
    catalogVisibleCount = 16;
    renderCatalogResults();
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
  document.getElementById('comparison-results')?.addEventListener('click', async event => {
    const button = event.target.closest('[data-refresh-barcode]');
    if (!button || button.disabled) return;
    button.disabled = true;
    button.textContent = 'Atualizando cadastro...';
    try {
      const product = await fetchProductFromOFF(button.dataset.refreshBarcode);
      if (product) button.textContent = 'Dados atualizados';
      else { button.textContent = 'Falhou. Tentar novamente'; button.disabled = false; }
    } catch (_) { button.disabled = false; button.textContent = 'Tentar novamente'; }
  });
  document.getElementById('compare-ai-button')?.addEventListener('click', async () => {
    const first = state.products.find(p => p.code === document.getElementById('select-prod-1').value);
    const second = state.products.find(p => p.code === document.getElementById('select-prod-2').value);
    if (!first || !second) return;
    if (first.demo || second.demo) {
      const output = document.getElementById('comparison-ai-output');
      output.classList.remove('hidden');
      output.textContent = 'Produtos de demonstração são fictícios e não podem ser analisados como dados reais pela IA.';
      return;
    }
    const button = document.getElementById('compare-ai-button');
    const output = document.getElementById('comparison-ai-output');
    button.disabled = true;
    output.classList.remove('hidden');
    output.textContent = 'Analisando os dados disponíveis...';
    const snapshot = `${first.code}|${second.code}`;
    try {
      const question = `Compare apenas estes dois produtos cadastrados: ${first.name} (código ${first.code}) e ${second.name} (código ${second.code}). Use exclusivamente seus nutrientes por 100 g e as declarações de ingredientes/alérgenos do contexto enviado. Explique as diferenças de forma curta, separando o IAC simulado da segurança para os perfis selecionados. Não declare produto seguro quando faltarem dados de alergênicos. Destaque se é necessário conferir o rótulo.`;
      const response = await askNutricia(question, [first.code, second.code]);
      if (document.getElementById('comparison-ai-area').dataset.selection === snapshot) {
        output.textContent = formatNutriciaAnswer(response.text);
      }
    } catch (error) {
      output.textContent = `Não foi possível gerar a explicação agora: ${error.message || 'tente novamente'}`;
    } finally { button.disabled = false; }
  });
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

function loadScannerLibrary() {
  if (typeof Html5Qrcode !== 'undefined' && typeof Html5QrcodeSupportedFormats !== 'undefined') {
    return Promise.resolve(true);
  }
  if (scannerLibraryPromise) return scannerLibraryPromise;
  scannerLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/html5-qrcode';
    script.async = true;
    const timeout = setTimeout(() => {
      script.remove();
      reject(new Error('O leitor demorou demais para carregar.'));
    }, 8500);
    script.onload = () => { clearTimeout(timeout); resolve(true); };
    script.onerror = () => { clearTimeout(timeout); reject(new Error('Não foi possível baixar o leitor.')); };
    document.head.appendChild(script);
  }).finally(() => { scannerLibraryPromise = null; });
  return scannerLibraryPromise;
}

async function initCameraScanner() {
  if (state.scannerInstance || state.scanning) return;
  if (!window.isSecureContext && location.hostname !== 'localhost') {
    setScannerFeedback('A câmera exige conexão HTTPS. Você pode digitar o código abaixo.', 'warning');
    return;
  }
  if (typeof Html5Qrcode === 'undefined') {
    setScannerFeedback('Preparando leitor de códigos... Você já pode digitar o EAN abaixo.', 'info');
    try { await loadScannerLibrary(); }
    catch (_) {
      setScannerFeedback('A câmera não pôde ser preparada. Use o código digitado.', 'warning');
      return;
    }
  }
  if (state.activeTab !== 'scanner') return;
  if (typeof Html5Qrcode === 'undefined' || typeof Html5QrcodeSupportedFormats === 'undefined') {
    setScannerFeedback('O leitor de códigos não está disponível. Digite o EAN.', 'warning');
    return;
  }
  const reader = document.getElementById('reader');
  if (!reader) return;
  setScannerFeedback('Solicitando acesso à câmera...', 'info');
  try {
    const scanner = new Html5Qrcode('reader', {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A
      ],
      verbose: false
    });
    state.scannerInstance = scanner;
    const scanConfig = {
      fps: 10,
      aspectRatio: 1.7778,
      qrbox: (width, height) => ({
        width: Math.min(Math.max(160, Math.round(width * .84)), Math.max(160, width - 12)),
        height: Math.min(125, Math.max(75, Math.round(height * .35)))
      })
    };
    const found = async decodedText => {
      const now = Date.now();
      if (state.scanning || (state.lastScanCode === decodedText && now - state.lastScanAt < 8000)) return;
      state.scanning = true;
      state.lastScanCode = decodedText;
      state.lastScanAt = now;
      const field = document.getElementById('manual-barcode');
      if (field) field.value = decodedText;
      try {
        const product = await fetchProductFromOFF(decodedText);
        if (product) {
          await stopCameraScanner();
          setScannerFeedback('Produto localizado. Para ler outro código, abra novamente o scanner.', 'success');
        }
      } finally {
        state.scanning = false;
      }
    };
    try {
      await scanner.start({ facingMode: 'environment' }, scanConfig, found, () => {});
    } catch (firstError) {
      const cameras = await Html5Qrcode.getCameras();
      const rear = cameras.find(camera => /back|rear|traseira|environment/i.test(camera.label)) || cameras[0];
      if (!rear) throw firstError;
      await scanner.start(rear.id, scanConfig, found, () => {});
    }
    setScannerFeedback('Câmera ativa. Enquadre o código de barras e evite reflexos.', 'success');
  } catch (error) {
    try { await state.scannerInstance?.clear(); } catch (_) {}
    state.scannerInstance = null;
    console.warn('Não foi possível iniciar a câmera:', error);
    setScannerFeedback('Não foi possível acessar a câmera. Confira a permissão do navegador ou digite o código.', 'warning');
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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${OFF_API_URL}${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
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

allergens: Array.isArray(product.allergens_tags)
  ? product.allergens_tags
  : [],

allergensText: product.allergens || product.allergens_from_ingredients || '',

traces: Array.isArray(product.traces_tags)
  ? product.traces_tags
  : [],

tracesText: product.traces || '',
labels: product.labels || '',
labelsTags: Array.isArray(product.labels_tags) ? product.labels_tags : [],
ingredientsAnalysisTags: Array.isArray(product.ingredients_analysis_tags) ? product.ingredients_analysis_tags : [],

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
    return newProduct;
  } catch (error) {
    console.warn('Erro na consulta à Open Food Facts:', error);
    setScannerFeedback(error.name === 'AbortError'
      ? 'A consulta demorou demais. Tente novamente; o catálogo continua acessível.'
      : 'Não conseguimos consultar a base agora. Confira a conexão ou tente novamente.', 'error');
    return null;
  } finally {
    clearTimeout(timeoutId);
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
async function loadProductsFromCloud(user) {
  if (!user || !firebaseDb) return;

  try {
    const snapshot = await firebaseDb
      .collection('users')
      .doc(user.uid)
      .collection('products')
      .get();

    const cloudProducts = snapshot.docs
      .map(doc => doc.data())
      .filter(p => p && p.code && p.per100g);

    console.log('Produtos encontrados na nuvem:', cloudProducts.length);
    if (firebaseAuth.currentUser?.uid !== user.uid) return;

const localProducts = state.products;

const mergedProducts = [...cloudProducts];

localProducts.forEach(product => {
  if (!mergedProducts.some(p => p.code === product.code)) {
    mergedProducts.push(product);
  }
});

state.products = mergedProducts.map(p => {
  const local = localProducts.find(item => item.code === p.code);
  // Evita substituir dados locais mais completos por um cadastro antigo da nuvem.
  if (local && local.code === p.code &&
      (Array.isArray(local.allergens) || Array.isArray(local.traces)) &&
      !Array.isArray(p.allergens) && !Array.isArray(p.traces)) return local;
  return p;
});

renderProductsTable();
updateCompareDropdowns();
updateDashboardStats();
  } catch (error) {
    console.error('Erro ao carregar produtos do Firestore:', error);
  }
}
async function saveProductToCloud(product) {
  const user = firebaseAuth?.currentUser;

  if (!user || !firebaseDb) return;

  try {
    await firebaseDb
      .collection('users')
      .doc(user.uid)
      .collection('products')
      .doc(encodeURIComponent(String(product.code)))
      .set(product);
  } catch (error) {
    console.error('Erro ao salvar produto no Firestore:', error);
  }
}
function saveProductToDb(product) {
  state.products = state.products.filter(p => p.code !== product.code);
  state.products.unshift(product);
  try {
   if (!firebaseAuth?.currentUser) {
  localStorage.setItem('nutricia_guest_db', JSON.stringify(state.products));
}
  } catch (_) {
    alert('O navegador não conseguiu salvar. Talvez o armazenamento esteja cheio.');
  }
  
  saveProductToCloud(product);
  
  renderProductsTable();
  updateCompareDropdowns();
  updateDashboardStats();
}
async function removeProductFromCloud(code) {
  const user = firebaseAuth?.currentUser;
  if (!user || !firebaseDb) return;

  try {
    await firebaseDb
      .collection('users')
      .doc(user.uid)
      .collection('products')
      .doc(encodeURIComponent(String(code)))
      .delete();
  } catch (error) {
    console.error('Erro ao excluir produto do Firestore:', error);
  }
}
function removeProductFromDb(code) {
  state.products = state.products.filter(p => p.code !== code);
if (!firebaseAuth?.currentUser) {
  try {
    localStorage.setItem('nutricia_guest_db', JSON.stringify(state.products));
  } catch (_) {
    console.error('Erro ao atualizar os produtos do visitante.');
  }
}
  
  removeProductFromCloud(code);
  
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
  tbody.innerHTML = products.slice(0, 80).map(p => `
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


function getAllergenAlerts(product) {
  const selected = state.activeProfiles?.length ? state.activeProfiles : ['geral'];
  const restrictions = {
    alergia_leite: { label: 'Alergia à proteína do leite', tags: ['en:milk'] },
    alergia_ovo: { label: 'Alergia ao ovo', tags: ['en:eggs'] },
    alergia_amendoim: { label: 'Alergia ao amendoim', tags: ['en:peanuts'] },
    celiaca: { label: 'Doença celíaca', tags: ['en:gluten'] },
    lactose: { label: 'Intolerância à lactose', tags: [] }
  };
  const allergens = Array.isArray(product.allergens) ? product.allergens.map(x => String(x).toLowerCase()) : [];
  const traces = Array.isArray(product.traces) ? product.traces.map(x => String(x).toLowerCase()) : [];
  const allergensText = String(product.allergensText || '').toLocaleLowerCase('pt-BR');
  const tracesText = String(product.tracesText || '').toLocaleLowerCase('pt-BR');
  const ingredients = String(product.ingredients || '').toLocaleLowerCase('pt-BR');
  const labels = String(product.labels || '').toLocaleLowerCase('pt-BR');
  const labelTags = Array.isArray(product.labelsTags) ? product.labelsTags : [];
  const isUseful = value => value && !/^(não disponível|não informado|não informada|ingredientes ilustrativos)/i.test(value.trim());
  const containsWords = (text, regex) => isUseful(text) && regex.test(text);
  const alerts = [];

  for (const key of selected) {
    const item = restrictions[key];
    if (!item) continue;
    let confirmed = item.tags.some(tag => allergens.includes(tag));
    let possible = item.tags.some(tag => traces.includes(tag));
    let evidence = confirmed ? 'Alérgeno registrado no cadastro Open Food Facts.' : '';

    // Só interpreta declarações explícitas nos campos disponíveis; não assume ausência de alérgenos.
    const patterns = {
      alergia_leite: /\b(leite|milk|case[ií]na|soro de leite|whey|lactalbumina)\b/i,
      alergia_ovo: /\b(ovos?|eggs?|albumina de ovo)\b/i,
      alergia_amendoim: /\b(amendoim|peanuts?|arachis)\b/i,
      celiaca: /\b(gl[uú]ten|gluten)\b/i,
      lactose: /\blactose\b/i
    };
    const reg = patterns[key];
    if (!confirmed && key !== 'lactose' && containsWords(allergensText, reg)) {
      confirmed = true;
      evidence = 'Alérgeno declarado no cadastro do produto.';
    }
    if (!possible && containsWords(tracesText, reg)) possible = true;

    // A lista de ingredientes ajuda a detectar presença positiva de leite, ovo ou amendoim.
    // Não a usamos para declarar ausência, nem para inferir glúten a partir de cereais.
    if (!confirmed && ['alergia_leite', 'alergia_ovo', 'alergia_amendoim'].includes(key) &&
        containsWords(ingredients, reg) && !/sem (leite|ovo|amendoim)/i.test(ingredients)) {
      confirmed = true;
      evidence = 'Ingrediente identificado no texto do cadastro. Confirme no rótulo.';
    }
    if (key === 'celiaca') {
      // Para doença celíaca, prioriza a declaração expressa CONTÉM GLÚTEN e os tags.
      if (!confirmed && /\bcont[eé]m gl[uú]ten\b/i.test(labels)) {
        confirmed = true;
        evidence = 'Declaração CONTÉM GLÚTEN no cadastro.';
      }
      if (!confirmed && /\bgl[uú]ten\b/i.test(ingredients) &&
          !/\b(n[aã]o cont[eé]m|sem) gl[uú]ten\b/i.test(ingredients)) {
        confirmed = true;
        evidence = 'Menção a glúten nos ingredientes do cadastro. Confirme no rótulo.';
      }
    }
    if (key === 'lactose') {
      // Leite não comprova a presença de lactose: há leite sem lactose.
      confirmed = /\bcont[eé]m lactose\b/i.test(labels) ||
        (containsWords(ingredients, /\blactose\b/i) && !/sem lactose|zero lactose/i.test(ingredients));
      evidence = confirmed ? 'Lactose declarada no texto disponível.' : '';
      possible = !confirmed && (allergens.includes('en:milk') ||
        /\b(leite|milk)\b/i.test(ingredients) && isUseful(ingredients)) &&
        !/\b(sem|zero) lactose\b/i.test(labels + ' ' + ingredients);
    }

    if (confirmed) {
      alerts.push({
        type: 'danger', title: `${item.label} — incompatibilidade identificada`,
        message: evidence || 'Ingrediente incompatível identificado nos dados do produto.',
        recommendation: 'Não é recomendado consumir este produto com a restrição selecionada. Confira o rótulo antes de qualquer decisão.'
      });
    } else if (possible) {
      alerts.push({
        type: 'warning', title: `${item.label} — atenção`,
        message: key === 'lactose' ? 'O cadastro menciona leite, mas não confirma o teor de lactose.' :
          'O cadastro informa possível presença ou traços desse alérgeno.',
        recommendation: 'Não considere o produto seguro sem conferir a embalagem e, se necessário, o fabricante.'
      });
    } else {
      alerts.push({
        type: 'unknown', title: `${item.label} — não verificado`,
        message: 'Este cadastro não possui evidência suficiente para confirmar presença nem ausência da substância relevante.',
        recommendation: 'Confira a declaração de alergênicos e a lista de ingredientes no rótulo. Dados ausentes não significam que o produto seja seguro.'
      });
    }
  }
  return alerts;
}

function renderComparisonTable() {
  const container = document.getElementById('comparison-results');
  if (!container) return;
  const code1 = document.getElementById('select-prod-1')?.value;
  const code2 = document.getElementById('select-prod-2')?.value;
  const products = [state.products.find(p => p.code === code1), state.products.find(p => p.code === code2)];
  const aiArea = document.getElementById('comparison-ai-area');
  const aiOutput = document.getElementById('comparison-ai-output');
  if (aiArea) aiArea.classList.toggle('hidden', !products[0] || !products[1]);
  const selectionKey = `${code1 || ''}|${code2 || ''}`;
  if (aiArea?.dataset.selection !== selectionKey) {
    aiArea.dataset.selection = selectionKey;
    if (aiOutput) { aiOutput.textContent = ''; aiOutput.classList.add('hidden'); }
  }
  if (!products.some(Boolean)) {
    container.innerHTML = '<p class="muted text-sm text-center py-8">Selecione pelo menos um produto para começar.</p>';
    return;
  }
  const fields = [
    ['Energia', 'energy', 'kcal'], ['Carboidratos', 'carbs', 'g'],
    ['Açúcares', 'sugars', 'g'], ['Proteínas', 'proteins', 'g'],
    ['Gorduras', 'fats', 'g'], ['Fibras', 'fiber', 'g'], ['Sódio', 'sodium', 'mg']
  ];
  const selectedProfiles = state.activeProfiles?.length ? state.activeProfiles : ['geral'];
  container.innerHTML = `<div class="grid md:grid-cols-2 gap-4">${products.map(product => {
    if (!product) return '<div class="soft p-5 text-center muted">Selecione o outro produto para comparar.</div>';
    const score = calculateIACScore(product);
    const scoreText = score === null ? 'Dados insuficientes' : `${score}/100`;
    const alerts = getAllergenAlerts(product);
    const hasDanger = alerts.some(alert => alert.type === 'danger');
    const alertHTML = alerts.map(alert => `<div class="food-alert food-alert-${alert.type}" role="status">
      <p class="font-black text-sm">${escapeHtml(alert.title)}</p>
      <p class="text-sm mt-2">${escapeHtml(alert.message)}</p>
      <p class="font-bold text-sm mt-2">${escapeHtml(alert.recommendation)}</p>
    </div>`).join('');
    const refreshButton = String(product.source || '').includes('Open Food Facts') && /^\d{8,14}$/.test(String(product.code || ''))
      ? `<button type="button" class="refresh-label-data" data-refresh-barcode="${escapeHtml(product.code)}">Atualizar informações deste produto</button>` : '';
    return `<article class="soft comparison-product p-4${hasDanger ? ' comparison-incompatible' : ''}">
      <div class="comparison-product-header"><div><h3 class="font-black text-lg">${escapeHtml(product.name)}</h3>
      <p class="muted text-sm mt-1">${escapeHtml(product.brand)}</p><p class="muted text-xs mt-1">Fonte: ${escapeHtml(product.source || 'Não informada')}</p></div>
      ${hasDanger ? '<span class="comparison-status-danger">Incompatível com perfil</span>' : ''}</div>
      <div class="surface score-box text-center p-4 mt-4"><p class="muted text-xs uppercase tracking-wide">IAC nutricional simulado</p><p class="text-2xl font-black mt-1">${scoreText}</p><p class="muted text-xs mt-1">Não avalia alergias nem segurança de consumo.</p></div>
      ${alertHTML}
      ${refreshButton}
      <div class="mt-4 space-y-0">${fields.map(([label,key,unit]) => {
        const highlighted =
          (selectedProfiles.includes('hipertensao') && key === 'sodium') ||
          (selectedProfiles.includes('diabetes') && ['carbs', 'sugars'].includes(key)) ||
          (selectedProfiles.includes('intestinal') && key === 'fiber') ||
          (selectedProfiles.includes('atleta') && ['energy', 'carbs', 'proteins'].includes(key)) ||
          (selectedProfiles.includes('colesterol') && key === 'fats') ||
          (selectedProfiles.includes('obesidade') && ['energy', 'sugars', 'fiber'].includes(key)) ||
          (selectedProfiles.includes('renal') && key === 'sodium');
        return `<div class="flex justify-between gap-3 py-2 border-b" style="border-color:var(--border);${highlighted ? 'font-weight:800;color:var(--green)' : ''}"><span>${label}</span><span class="text-right">${displayNumber(product.per100g?.[key], unit)}</span></div>`;
      }).join('')}</div>
    </article>`;
  }).join('')}</div>`;
}

function displayNumber(value, unit = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'Não disponível';
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}${unit ? ` ${unit}` : ''}`;
}

function getEvidenceProducts(productCodes = null) {
  return state.products
    .filter(p => !productCodes || productCodes.includes(p.code))
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
      allergens: Array.isArray(p.allergens) ? p.allergens : [],
      traces: Array.isArray(p.traces) ? p.traces : [],
      allergensText: String(p.allergensText || ''),
      tracesText: String(p.tracesText || ''),
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
  const questionBox = document.getElementById('assistant-question');

  questionBox.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (assistantBusy) return;
    const questionBox = document.getElementById('assistant-question');
    const question = questionBox.value.trim();
    if (!question) return;
    assistantBusy = true;
    addChatBubble(question, 'user');
    questionBox.value = '';
const loading = addChatBubble('', 'assistant');
const typing = loading.querySelector('.chat-text');

typing.classList.add('typing-indicator');
typing.innerHTML = `
  <span style="display:inline-block;background:#888;width:8px;height:8px;border-radius:50%"></span>
  <span style="display:inline-block;background:#888;width:8px;height:8px;border-radius:50%"></span>
  <span style="display:inline-block;background:#888;width:8px;height:8px;border-radius:50%"></span>
`;
    const submit = document.getElementById('assistant-submit');
    submit.disabled = true;


try {
  const answer = await askNutricia(question);
  loading.querySelector('.chat-text').classList.remove('typing-indicator');
loading.querySelector('.chat-text').textContent = formatNutriciaAnswer(answer.text);

  if (answer.source) {
    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = answer.source;
    loading.appendChild(meta);
  }

} catch (error) {
  console.error('Erro na NutricIA:', error);
  loading.querySelector('.chat-text').classList.remove('typing-indicator');

  loading.querySelector('.chat-text').textContent =
    error.message || 'Não consegui consultar a assistente agora. Tente novamente mais tarde.';

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

async function askNutricia(question, productCodes = null) {
  const products = getEvidenceProducts(productCodes);
  if (NUTRICIA_AI_ENDPOINT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 18000);
    let response;
    try {
      response = await fetch(NUTRICIA_AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          profile: PROFILE_MAP[state.activeProfile],
          profiles: state.activeProfiles.map(key => PROFILE_MAP[key]).filter(Boolean),
          products
        })
      });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A resposta da IA demorou demais. Tente uma pergunta mais curta.');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
   
if (!response.ok) {
  if (response.status === 429) {
    throw new Error('A NutricIA atingiu o limite gratuito de perguntas. Aguarde a renovação da cota para continuar.');
  }

  if (response.status === 503) {
    throw new Error('A inteligência artificial está temporariamente indisponível.');
  }

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

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./sw.js').catch(() => {
    // O aplicativo continua funcionando mesmo sem o cache.
  });
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