/* =====================================================
   Fissura Anal — Guia de Cuidado
   Navegação SPA + accordion + login (Supabase) +
   controle de acesso pago por 6 meses + Service Worker
   ===================================================== */

(function () {
  'use strict';

  var CFG = window.APP_CONFIG || {};
  var SNAP_KEY = 'fa_access_snapshot_v1';

  /* =========================================================
     1. NAVEGAÇÃO ENTRE TELAS
     ========================================================= */
  var navButtons = document.querySelectorAll('.nav-btn');
  var screens = document.querySelectorAll('.screen');

  function goTo(targetId) {
    var target = document.getElementById(targetId);
    if (!target) return;

    screens.forEach(function (s) { s.classList.remove('is-active'); });
    void target.offsetWidth;
    target.classList.add('is-active');

    navButtons.forEach(function (btn) {
      var active = btn.dataset.target === targetId;
      btn.classList.toggle('is-active', active);
      if (active) { btn.setAttribute('aria-current', 'page'); }
      else { btn.removeAttribute('aria-current'); }
    });

    window.scrollTo({ top: 0, behavior: 'auto' });
    target.focus({ preventScroll: true });
    if (history.replaceState) { history.replaceState(null, '', '#' + targetId); }
  }

  navButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { goTo(btn.dataset.target); });
  });

  var initialHash = (location.hash || '').replace('#', '');
  if (initialHash && document.getElementById(initialHash)) { goTo(initialHash); }

  /* =========================================================
     2. ACCORDION (Mitos & Cirurgia)
     ========================================================= */
  var triggers = document.querySelectorAll('.acc-trigger');

  function setPanel(trigger, open) {
    var panel = trigger.nextElementSibling;
    trigger.setAttribute('aria-expanded', String(open));
    panel.style.height = panel.firstElementChild.offsetHeight + 'px';
    if (!open) { void panel.offsetWidth; panel.style.height = '0px'; }
  }

  triggers.forEach(function (trigger) {
    trigger.addEventListener('click', function () {
      var isOpen = trigger.getAttribute('aria-expanded') === 'true';
      triggers.forEach(function (t) {
        if (t !== trigger && t.getAttribute('aria-expanded') === 'true') { setPanel(t, false); }
      });
      setPanel(trigger, !isOpen);
    });
  });

  window.addEventListener('resize', function () {
    triggers.forEach(function (t) {
      if (t.getAttribute('aria-expanded') === 'true') {
        var p = t.nextElementSibling;
        p.style.height = p.firstElementChild.offsetHeight + 'px';
      }
    });
  });

  /* =========================================================
     3. CONTROLE DE ACESSO (Supabase Auth + tabela "acessos")
     ========================================================= */
  var body = document.body;
  var loginForm = document.getElementById('login-form');
  var loginEmail = document.getElementById('login-email');
  var loginPass = document.getElementById('login-pass');
  var loginError = document.getElementById('login-error');
  var loginSubmit = document.getElementById('login-submit');
  var expiredView = document.getElementById('expired-view');
  var expiredTitle = document.getElementById('expired-title');
  var expiredMsg = document.getElementById('expired-msg');
  var expiredBuy = document.getElementById('expired-buy');
  var accountBtn = document.getElementById('account-btn');
  var accountDays = document.getElementById('account-days');
  var accEmail = document.getElementById('acc-email');
  var accStatus = document.getElementById('acc-status');
  var accMsg = document.getElementById('acc-msg');
  var newPass = document.getElementById('new-pass');
  var authViews = document.querySelectorAll('.auth-view');

  if (expiredBuy && CFG.COMPRA_URL) { expiredBuy.href = CFG.COMPRA_URL; }

  var supa = null;
  var configOk = CFG.SUPABASE_URL && CFG.SUPABASE_URL.indexOf('SEU-PROJETO') === -1 &&
                 CFG.SUPABASE_ANON_KEY && CFG.SUPABASE_ANON_KEY.indexOf('COLE_AQUI') === -1;

  if (configOk && window.supabase) {
    supa = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  /* ---- helpers de estado visual ---- */
  function setBodyState(state) { body.className = state; } // auth-pending | locked | unlocked

  function showAuthView(name) {
    authViews.forEach(function (v) { v.classList.remove('is-active'); });
    var el = document.getElementById(name);
    if (el) { el.classList.add('is-active'); }
  }

  function daysLeft(iso) {
    var ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400000));
  }

  /* ---- snapshot local (permite uso offline até expirar) ---- */
  function saveSnapshot(email, row) {
    try {
      localStorage.setItem(SNAP_KEY, JSON.stringify({
        email: email, status: row.status,
        expira_em: row.expira_em, ts: Date.now()
      }));
    } catch (e) {}
  }
  function readSnapshot() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function clearSnapshot() {
    try { localStorage.removeItem(SNAP_KEY); } catch (e) {}
  }
  function snapshotValid(snap, email) {
    return snap && snap.email === email && snap.status === 'ativo' &&
           new Date(snap.expira_em).getTime() > Date.now();
  }

  /* ---- telas ---- */
  function gateLogin() {
    accountBtn.hidden = true;
    setBodyState('locked');
    showAuthView('login-form');
  }

  function showExpired(row) {
    accountBtn.hidden = true;
    setBodyState('locked');
    showAuthView('expired-view');
    var st = row && row.status;
    if (st === 'reembolsado' || st === 'chargeback') {
      expiredTitle.textContent = 'Acesso cancelado';
      expiredMsg.textContent = 'Este acesso foi encerrado por reembolso ou contestação da compra.';
    } else if (st === 'cancelado') {
      expiredTitle.textContent = 'Acesso cancelado';
      expiredMsg.textContent = 'Este acesso foi cancelado. Adquira um novo para continuar.';
    } else {
      expiredTitle.textContent = 'Seu acesso expirou';
      expiredMsg.textContent = 'O período de 6 meses foi encerrado. Para continuar consultando o guia, adquira um novo acesso.';
    }
  }

  function unlock(row, email) {
    setBodyState('unlocked');
    accountBtn.hidden = false;
    var d = (row.dias_restantes != null) ? row.dias_restantes : daysLeft(row.expira_em);
    accountDays.textContent = d + 'd';
    accountDays.classList.toggle('is-warn', d <= (CFG.AVISO_EXPIRA_DIAS || 15));
    accEmail.textContent = email || '';
    var venc = new Date(row.expira_em).toLocaleDateString('pt-BR');
    accStatus.textContent = 'Acesso ativo • ' + d + ' dias restantes (até ' + venc + ')';
  }

  /* ---- avaliação central: o que mostrar? ---- */
  async function evaluate() {
    setBodyState('auth-pending');

    if (!supa) {
      // Supabase não configurado: mostra o guia para você conseguir testar o layout.
      console.warn('Supabase não configurado em config.js — modo de visualização livre.');
      setBodyState('unlocked');
      accountBtn.hidden = true;
      return;
    }

    var session = null;
    try {
      var res = await supa.auth.getSession();
      session = res.data.session;
    } catch (e) { session = null; }

    if (!session) { gateLogin(); return; }

    var email = session.user.email;

    try {
      var r = await supa.rpc('meu_acesso_valido');
      if (r.error) { throw r.error; }
      var row = Array.isArray(r.data) ? r.data[0] : r.data;

      if (row && row.valido) {
        saveSnapshot(email, row);
        unlock(row, email);
      } else if (row) {
        clearSnapshot();
        showExpired(row);
      } else {
        // logado, mas sem linha de acesso (ex.: compra ainda não processada)
        clearSnapshot();
        showExpired(null);
      }
    } catch (e) {
      // provável falta de rede -> tenta o snapshot offline
      var snap = readSnapshot();
      if (snapshotValid(snap, email)) {
        unlock({ expira_em: snap.expira_em, status: 'ativo' }, email);
      } else {
        showExpired(snap);
      }
    }
  }

  /* ---- login ---- */
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!supa) { return; }
      loginError.hidden = true;
      loginSubmit.disabled = true;
      loginSubmit.textContent = 'Entrando...';

      var email = (loginEmail.value || '').trim().toLowerCase();
      var pass = loginPass.value || '';

      try {
        var r = await supa.auth.signInWithPassword({ email: email, password: pass });
        if (r.error) {
          loginError.textContent = 'E-mail ou senha incorretos. Confira o e-mail que você recebeu após a compra.';
          loginError.hidden = false;
        } else {
          await evaluate();
        }
      } catch (err) {
        loginError.textContent = 'Sem conexão. Tente novamente quando estiver online.';
        loginError.hidden = false;
      } finally {
        loginSubmit.disabled = false;
        loginSubmit.textContent = 'Entrar';
      }
    });
  }

  /* ---- ações da conta (delegação) ---- */
  document.getElementById('auth-gate').addEventListener('click', async function (e) {
    var action = e.target && e.target.getAttribute('data-action');
    if (!action) { return; }

    if (action === 'back-to-login') {
      if (supa) { try { await supa.auth.signOut(); } catch (x) {} }
      clearSnapshot();
      gateLogin();
    }
    else if (action === 'logout') {
      if (supa) { try { await supa.auth.signOut(); } catch (x) {} }
      clearSnapshot();
      gateLogin();
    }
    else if (action === 'close-account') {
      evaluate();
    }
    else if (action === 'change-pass') {
      accMsg.hidden = true;
      var np = (newPass.value || '').trim();
      if (np.length < 6) {
        accMsg.textContent = 'A nova senha precisa ter pelo menos 6 caracteres.';
        accMsg.hidden = false;
        return;
      }
      try {
        var r = await supa.auth.updateUser({ password: np });
        accMsg.style.color = r.error ? '' : '#1e7d54';
        accMsg.textContent = r.error ? 'Não foi possível trocar a senha agora.' : 'Senha atualizada com sucesso!';
        accMsg.hidden = false;
        if (!r.error) { newPass.value = ''; }
      } catch (x) {
        accMsg.textContent = 'Sem conexão para trocar a senha.';
        accMsg.hidden = false;
      }
    }
  });

  if (accountBtn) {
    accountBtn.addEventListener('click', function () {
      setBodyState('locked');
      showAuthView('account-view');
    });
  }

  if (supa) {
    supa.auth.onAuthStateChange(function (event) {
      if (event === 'SIGNED_OUT') { gateLogin(); }
    });
  }

  /* =========================================================
     4. SERVICE WORKER
     ========================================================= */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('Falha ao registrar o Service Worker:', err);
      });
    });
  }

  /* ---- start ---- */
  evaluate();
})();
