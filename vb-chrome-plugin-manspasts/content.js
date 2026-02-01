const LOGIN_HINT_WORDS = [
  'log in',
  'login',
  'sign in',
  'pieslegties',
  'pieslēgties'
];

const LOGIN_PATH = '/lv/login';
const NEW_ORDER_PATH = '/lv/order/new-order';
const ORDER_INFO_API_BASE = 'http://localhost:6161';
const ORDER_CTX_KEY = 'manspasts_order_ctx';
const ORDER_INFO_CACHE_KEY = 'manspasts_order_info_cache';
const ORDER_STEP3_RADIO_SET_KEY = 'manspasts_step3_radio_set';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const textIncludesLoginHint = (text) => {
  const t = (text || '').toLowerCase();
  return LOGIN_HINT_WORDS.some((w) => t.includes(w));
};

const findInputByLabelText = (variants) => {
  const labels = Array.from(document.querySelectorAll('label'));
  for (const label of labels) {
    const text = (label.textContent || '').toLowerCase().trim();
    if (!variants.some((v) => text.includes(v))) continue;
    const forId = label.getAttribute('for');
    if (forId) {
      const byId = document.getElementById(forId);
      if (byId && byId.tagName.toLowerCase() === 'input') return byId;
    }
    const nested = label.querySelector('input');
    if (nested) return nested;
    const parentInput = label.parentElement?.querySelector('input');
    if (parentInput) return parentInput;
  }
  return null;
};

const findEmailInput = () =>
  document.querySelector('#username, input[name="_username"]') ||
  document.querySelector(
    'input[type="email"], input[name*="email" i], input[id*="email" i], input[autocomplete="username"], input[autocomplete="email"], input[type="text"][name*="mail" i]'
  ) ||
  findInputByLabelText(['e-pasts', 'epasts', 'e mail', 'email']);

const findPasswordInput = () =>
  document.querySelector('#password, input[name="_password"]') ||
  document.querySelector(
    'input[type="password"], input[name*="password" i], input[id*="password" i], input[autocomplete="current-password"]'
  ) ||
  findInputByLabelText(['parole', 'password']);

const findSubmitButton = () =>
  document.querySelector('form[action="/lv/login"] button[type="submit"]') ||
  document.querySelector('button[type="submit"], input[type="submit"], button');

const formLooksLikeLogin = (emailInput, passwordInput) => {
  if (emailInput && passwordInput) return true;
  if (emailInput && textIncludesLoginHint(document.body?.innerText)) return true;
  if (passwordInput && textIncludesLoginHint(document.body?.innerText)) return true;
  return false;
};

const isLoginPage = () => {
  const path = location.pathname.toLowerCase();
  return path.includes('login') || path.includes('signin') || textIncludesLoginHint(document.title);
};

const isLoggedIn = () => {
  if (document.querySelector('nav.authentification-menu.authenticated')) return true;
  if (document.querySelector('.user-is-authorized')) return true;
  if (document.querySelector('#logout-handler')) return true;
  if (document.querySelector('a[href*="/logout"]')) return true;
  return false;
};

const typeValue = async (el, value) => {
  el.focus();
  el.value = '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  for (const ch of value) {
    el.value += ch;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(40 + Math.random() * 60);
  }
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

const hasOrderContext = async () => {
  const ctx = await readOrderContext();
  return Boolean(ctx?.orderId);
};

const isNewOrderPage = () => location.pathname.startsWith(NEW_ORDER_PATH);

const selectShipmentType = async () => {
  if (!isNewOrderPage()) return;
  if (!(await hasOrderContext())) return;
  const select = document.querySelector('select[name="order_type_form[shipmentName]"]');
  if (!select) return;
  const option = Array.from(select.options).find((opt) =>
    (opt.textContent || '').includes('Sīkpaka')
  );
  if (!option) return;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const selectShipmentTraceability = async (orderInfo) => {
  if (!isNewOrderPage()) return;
  if (!(await hasOrderContext())) return;
  const select = document.querySelector('select[name="order_type_form[shipmentType]"]');
  if (!select) return;
  const isTraceable = orderInfo?.mode === 'TRACEABLE';
  const desiredText = isTraceable ? 'Izsekojama' : 'Vienkārša';
  const option = Array.from(select.options).find((opt) =>
    (opt.textContent || '').includes(desiredText)
  );
  if (!option) return;
  select.value = option.value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

const clickNextStep = async () => {
  if (!isNewOrderPage()) return;
  if (!(await hasOrderContext())) return;
  const findButton = () => {
    const candidates = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], a'));
    return candidates.find((el) => {
      const text = (el.textContent || el.value || '').trim().toLowerCase();
      return text.includes('nākamais solis');
    });
  };

  for (let i = 0; i < 10; i += 1) {
    const button = findButton();
    if (button) {
      button.click();
      return;
    }
    await new Promise((r) => setTimeout(r, 300));
  }
};

let fillRecipientInProgress = false;
const fillRecipientFormIfPresent = async () => {
  if (fillRecipientInProgress) return;
  fillRecipientInProgress = true;
  if (!(await hasOrderContext())) {
    fillRecipientInProgress = false;
    return;
  }

  let info = window.manspastsOrderInfo || null;
  if (!info) {
    const ctx = await readOrderContext();
    if (ctx?.orderId && ctx?.weight) {
      info = await readOrderInfoCache(ctx.orderId, ctx.weight);
      if (info) window.manspastsOrderInfo = info;
    }
  }
  if (!info) {
    fillRecipientInProgress = false;
    return;
  }

  const setValue = (selector, value) => {
    const input = document.querySelector(selector);
    if (!input || value == null) return false;
    if (input.value && input.value.trim() === String(value).trim()) return true;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  };

  setValue('#order_registered_recipient_form_userInfo_fullName', info.fullName);
  setValue('#order_registered_recipient_form_userInfo_telephone', info.phone);
  setValue('#order_registered_recipient_form_userInfo_email', info.email);
  setValue('input[name="order_registered_recipient_form[userInfo][fullName]"]', info.fullName);
  setValue('input[name="order_registered_recipient_form[userInfo][telephone]"]', info.phone);
  setValue('input[name="order_registered_recipient_form[userInfo][email]"]', info.email);

  const ctx = await readOrderContext();
  const orderId = ctx?.orderId;
  const radio = document.querySelector('input[type="radio"][name="order_registered_recipient_form[newAddress][type]"][value="1"]');
  if (radio && !radio.checked && !(await hasStep3RadioBeenSet(orderId))) {
    radio.checked = true;
    // Do not dispatch change to avoid AJAX reload loops.
    await markStep3RadioSet(orderId);
  }
  fillRecipientInProgress = false;
};

const readCredentials = async () => {
  try {
    const stored = await chrome.storage.local.get(['email', 'password']);
    if (!stored.email || !stored.password) return null;
    return { email: stored.email, password: stored.password };
  } catch {
    return null;
  }
};

const saveOrderContext = async () => {
  const url = new URL(location.href);
  const orderId = url.searchParams.get('orderId');
  if (!orderId) return null;
  const weight = url.searchParams.get('weight');
  try {
    await chrome.storage.local.set({
      [ORDER_CTX_KEY]: { orderId, weight }
    });
  } catch {
    // Ignore
  }
  return { orderId, weight };
};

const readOrderContext = async () => {
  try {
    const stored = await chrome.storage.local.get([ORDER_CTX_KEY]);
    return stored[ORDER_CTX_KEY] || null;
  } catch {
    return null;
  }
};

const clearOrderContext = async () => {
  try {
    await chrome.storage.local.remove(ORDER_CTX_KEY);
    await chrome.storage.local.remove(ORDER_STEP3_RADIO_SET_KEY);
  } catch {
    // Ignore
  }
};

const getOrderInfoCacheKey = (orderId, weight) => `${orderId || ''}:${weight || ''}`;

const readOrderInfoCache = async (orderId, weight) => {
  if (!orderId || !weight) return null;
  try {
    const stored = await chrome.storage.local.get([ORDER_INFO_CACHE_KEY]);
    const cache = stored[ORDER_INFO_CACHE_KEY] || {};
    return cache[getOrderInfoCacheKey(orderId, weight)] || null;
  } catch {
    return null;
  }
};

const writeOrderInfoCache = async (orderId, weight, data) => {
  if (!orderId || !weight || !data) return;
  try {
    const stored = await chrome.storage.local.get([ORDER_INFO_CACHE_KEY]);
    const cache = stored[ORDER_INFO_CACHE_KEY] || {};
    cache[getOrderInfoCacheKey(orderId, weight)] = data;
    await chrome.storage.local.set({ [ORDER_INFO_CACHE_KEY]: cache });
  } catch {
    // Ignore
  }
};

const hasStep3RadioBeenSet = async (orderId) => {
  if (!orderId) return false;
  try {
    const stored = await chrome.storage.local.get([ORDER_STEP3_RADIO_SET_KEY]);
    const map = stored[ORDER_STEP3_RADIO_SET_KEY] || {};
    return Boolean(map[orderId]);
  } catch {
    return false;
  }
};

const markStep3RadioSet = async (orderId) => {
  if (!orderId) return;
  try {
    const stored = await chrome.storage.local.get([ORDER_STEP3_RADIO_SET_KEY]);
    const map = stored[ORDER_STEP3_RADIO_SET_KEY] || {};
    map[orderId] = true;
    await chrome.storage.local.set({ [ORDER_STEP3_RADIO_SET_KEY]: map });
  } catch {
    // Ignore
  }
};

const fetchOrderInfo = async () => {
  if (!isNewOrderPage()) return null;
  const ctx = await readOrderContext();
  if (!ctx?.orderId || !ctx?.weight) return null;

  const cached = await readOrderInfoCache(ctx.orderId, ctx.weight);
  if (cached) {
    window.manspastsOrderInfo = cached;
    await selectShipmentTraceability(cached);
    await clickNextStep();
    await fillRecipientFormIfPresent();
    renderStatusWidget();
    return cached;
  }

  try {
    const resp = await fetch(`${ORDER_INFO_API_BASE}/api/bricklink/order-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId: Number(ctx.orderId),
        weight: Number(ctx.weight)
      })
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    window.manspastsOrderInfo = data;
    await selectShipmentTraceability(data);
    await clickNextStep();
    await fillRecipientFormIfPresent();
    await writeOrderInfoCache(ctx.orderId, ctx.weight, data);
    renderStatusWidget();
    return data;
  } catch (err) {
    console.error('[manspasts] order info fetch error', err);
    return null;
  }
};

const renderStatusWidget = async () => {
  const existing = document.getElementById('manspasts-status-widget');
  if (existing) existing.remove();

  const ctx = await readOrderContext();
  let info = window.manspastsOrderInfo || null;
  if (!info && ctx?.orderId && ctx?.weight) {
    info = await readOrderInfoCache(ctx.orderId, ctx.weight);
    if (info) {
      window.manspastsOrderInfo = info;
    }
  }

  const wrap = document.createElement('div');
  wrap.id = 'manspasts-status-widget';
  wrap.style.position = 'fixed';
  wrap.style.right = '16px';
  wrap.style.bottom = '16px';
  wrap.style.zIndex = '2147483647';
  wrap.style.background = '#ffffff';
  wrap.style.border = '1px solid #c7c7c7';
  wrap.style.borderRadius = '10px';
  wrap.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
  wrap.style.padding = '12px';
  wrap.style.fontFamily = 'Arial, sans-serif';
  wrap.style.fontSize = '12px';
  wrap.style.maxWidth = '320px';

  const title = document.createElement('div');
  title.textContent = 'Manspasts Order Status';
  title.style.fontWeight = '700';
  title.style.marginBottom = '8px';

  const line = (label, value) => {
    const row = document.createElement('div');
    row.style.marginBottom = '4px';
    row.textContent = `${label}: ${value ?? '-'}`;
    return row;
  };

  wrap.appendChild(title);
  wrap.appendChild(line('Order ID', ctx?.orderId));
  wrap.appendChild(line('Weight', ctx?.weight));
  wrap.appendChild(line('Full name', info?.fullName));
  wrap.appendChild(line('Email', info?.email));
  wrap.appendChild(line('Phone', info?.phone));
  wrap.appendChild(line('Address1', info?.address1));
  wrap.appendChild(line('Address2', info?.address2));
  wrap.appendChild(line('Postal', info?.postalCode));
  wrap.appendChild(line('Country', info?.countryCode));
  wrap.appendChild(line('Mode', info?.mode));

  const actions = document.createElement('div');
  actions.style.marginTop = '8px';
  actions.style.display = 'flex';
  actions.style.gap = '6px';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear details';
  clearBtn.style.border = '1px solid #c7c7c7';
  clearBtn.style.background = '#fff';
  clearBtn.style.borderRadius = '6px';
  clearBtn.style.padding = '6px 8px';
  clearBtn.style.cursor = 'pointer';

  clearBtn.addEventListener('click', async () => {
    window.manspastsOrderInfo = null;
    await clearOrderContext();
    try {
      await chrome.storage.local.remove(ORDER_INFO_CACHE_KEY);
    } catch {
      // Ignore
    }
    renderStatusWidget();
  });

  actions.appendChild(clearBtn);
  wrap.appendChild(actions);

  document.body.appendChild(wrap);
};

const maybePromptForCredentials = async () => {
  const existing = await readCredentials();
  if (existing) return false;

  if (document.getElementById('manspasts-cred-overlay')) return true;

  const overlay = document.createElement('div');
  overlay.id = 'manspasts-cred-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.zIndex = '2147483647';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.fontFamily = 'Arial, sans-serif';

  const card = document.createElement('div');
  card.style.width = '360px';
  card.style.background = '#fff';
  card.style.borderRadius = '10px';
  card.style.padding = '18px';
  card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';

  const title = document.createElement('div');
  title.textContent = 'Save Manspasts credentials';
  title.style.fontWeight = '700';
  title.style.marginBottom = '12px';

  const emailLabel = document.createElement('label');
  emailLabel.textContent = 'Email';
  emailLabel.style.display = 'block';
  emailLabel.style.margin = '8px 0 4px';

  const emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.style.width = '100%';
  emailInput.style.padding = '8px';
  emailInput.style.border = '1px solid #c7c7c7';
  emailInput.style.borderRadius = '6px';

  const passLabel = document.createElement('label');
  passLabel.textContent = 'Password';
  passLabel.style.display = 'block';
  passLabel.style.margin = '10px 0 4px';

  const passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.style.width = '100%';
  passInput.style.padding = '8px';
  passInput.style.border = '1px solid #c7c7c7';
  passInput.style.borderRadius = '6px';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.gap = '8px';
  actions.style.marginTop = '14px';

  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.style.flex = '1';
  saveBtn.style.padding = '8px';
  saveBtn.style.border = 'none';
  saveBtn.style.borderRadius = '6px';
  saveBtn.style.background = '#0b5fff';
  saveBtn.style.color = '#fff';
  saveBtn.style.cursor = 'pointer';

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.flex = '1';
  cancelBtn.style.padding = '8px';
  cancelBtn.style.border = '1px solid #c7c7c7';
  cancelBtn.style.borderRadius = '6px';
  cancelBtn.style.background = '#fff';
  cancelBtn.style.cursor = 'pointer';

  const note = document.createElement('div');
  note.textContent = 'Stored locally in this browser profile.';
  note.style.fontSize = '12px';
  note.style.color = '#666';
  note.style.marginTop = '10px';

  saveBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passInput.value;
    if (!email || !password) return;
    try {
      await chrome.storage.local.set({ email, password });
      overlay.remove();
      await performLoginIfPossible();
    } catch (err) {
      console.error('[manspasts] credentials save error', err);
    }
  });

  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  card.appendChild(title);
  card.appendChild(emailLabel);
  card.appendChild(emailInput);
  card.appendChild(passLabel);
  card.appendChild(passInput);
  card.appendChild(actions);
  card.appendChild(note);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
  emailInput.focus();
  return true;
};

const getOrderId = () => {
  const url = new URL(location.href);
  return url.searchParams.get('orderId');
};

const redirectToLogin = (orderId) => {
  const loginUrl = new URL(LOGIN_PATH, location.origin);
  if (orderId) {
    loginUrl.searchParams.set('orderId', orderId);
    const url = new URL(location.href);
    const weight = url.searchParams.get('weight');
    if (weight) loginUrl.searchParams.set('weight', weight);
  }
  if (location.pathname !== loginUrl.pathname) {
    location.href = loginUrl.toString();
  }
};

const redirectToNewOrder = async () => {
  if (location.pathname === NEW_ORDER_PATH) return;
  const ctx = await readOrderContext();
  if (!ctx) return;
  const url = new URL(NEW_ORDER_PATH, location.origin);
  url.searchParams.set('orderId', ctx.orderId);
  if (ctx.weight) url.searchParams.set('weight', ctx.weight);
  await clearOrderContext();
  location.href = url.toString();
};

const waitForLoginForm = async (timeoutMs = 10000) => {
  const start = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      const emailInput = findEmailInput();
      const passwordInput = findPasswordInput();
      if (emailInput && passwordInput) {
        resolve({ emailInput, passwordInput });
        return true;
      }
      return false;
    };

    if (check()) return;

    const observer = new MutationObserver(() => {
      if (check()) {
        observer.disconnect();
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    const timer = setInterval(() => {
      if (Date.now() - start > timeoutMs) {
        observer.disconnect();
        clearInterval(timer);
        resolve(null);
      }
    }, 200);
  });
};

const performLoginIfPossible = async () => {
  const inputs = await waitForLoginForm();
  const emailInput = inputs?.emailInput || findEmailInput();
  const passwordInput = inputs?.passwordInput || findPasswordInput();

  if (!formLooksLikeLogin(emailInput, passwordInput)) {
    return false;
  }

  const creds = await readCredentials();
  if (!creds) return false;

  if (emailInput) await typeValue(emailInput, creds.email);
  if (passwordInput) await typeValue(passwordInput, creds.password);

  const submit = findSubmitButton();
  if (submit) {
    submit.click();
  } else if (emailInput?.form) {
    emailInput.form.submit();
  }
  return true;
};

(async () => {
  try {
    const orderId = getOrderId();
    if (!orderId) return;
    await saveOrderContext();

    if (isLoggedIn()) {
      await redirectToNewOrder();
      await selectShipmentType();
      await fetchOrderInfo();
      await renderStatusWidget();
      return;
    }

    if (isLoginPage()) {
      const loggedInNow = await performLoginIfPossible();
      if (!loggedInNow) {
        await maybePromptForCredentials();
      }
      await renderStatusWidget();
      return;
    }

    redirectToLogin(orderId);
    return;
  } catch (err) {
    console.error('[manspasts] error', err);
  }
})();

// Apply defaults when already on the new order page.
selectShipmentType();
fetchOrderInfo();
renderStatusWidget();
fillRecipientFormIfPresent();

if (isNewOrderPage()) {
  const observer = new MutationObserver(() => {
    fillRecipientFormIfPresent();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
