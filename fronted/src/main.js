import './style.css'

import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  updateCurrentUser,
  saveUserUpiSecure,
  getCurrentUserUpiStatus,
  requestUserWithdrawal,
  saveUserTransaction
} from './auth.js'

import {
  isAdmin,
  getAdminState,
  setGameEnabled,
  setGameLocked,
  setAnnouncement,
  getAllUsers,
  adjustDemoBalance,
  createDemoId,
  payAgentDemoSalary,
  createGiftCode,
  toggleGiftCode,
  claimGiftCode,
  setForcedResult,
  setModeForcedResult,
  setAviatorCrashPoint,
  getReferralDetails,
  getAllWithdrawals,
  updateAdminWithdrawalStatus,
  getAllDeposits,
  updateAdminDepositStatus
} from './admin.js'

import {
  showToast,
  openCustomerService,
  saveUserBetRecord,
  getUserBetRecords
} from './extras.js'

/* =========================
   GLOBAL STATE & MODES
========================= */

const modes = [
  { key: 'wingo30', name: 'Wingo 30 Sec', seconds: 30 },
  { key: 'wingo60', name: 'Wingo 1 Min', seconds: 60 },
  { key: 'wingo180', name: 'Wingo 3 Min', seconds: 180 },
  { key: 'wingo300', name: 'Wingo 5 Min', seconds: 300 }
]

let currentPage = 'home'
let currentMode = 30
let currentModeKey = 'wingo30'
let timeLeft = 30
let selectedChoice = null
let selectedMultiplier = 1
let selectedAmount = 10
let lockedPrediction = null

let period = Number(
  localStorage.getItem('kivoro_period') || 20260826100051604
)

let history = []
let aviatorTimer = null
let aviatorRestartTimer = null
let wingoInterval = null
let liveTickerInterval = null

try {
  const savedHistory = JSON.parse(
    localStorage.getItem('kivoro_history') || '[]'
  )
  history = Array.isArray(savedHistory) && savedHistory.length ? savedHistory : [
    { period: 20260826100051603, number: 4, color: 'RED', size: 'Small' },
    { period: 20260826100051602, number: 3, color: 'GREEN', size: 'Small' },
    { period: 20260826100051601, number: 4, color: 'RED', size: 'Small' },
    { period: 20260826100051600, number: 9, color: 'GREEN', size: 'Big' }
  ]
} catch {
  history = []
}

/* =========================
   UTILITIES & HELPERS
========================= */

function app() {
  return document.querySelector('#app')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function getBalance() {
  return Number(getCurrentUser()?.balance || 0)
}

function setBalance(value) {
  updateCurrentUser({
    balance: Math.max(0, Math.floor(Number(value) || 0))
  })
}

function saveHistory() {
  localStorage.setItem('kivoro_history', JSON.stringify(history.slice(0, 100)))
}

function savePeriod() {
  localStorage.setItem('kivoro_period', String(period))
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60)
  const sec = Math.max(0, seconds % 60)
  return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
}

function getModeName() {
  return modes.find(mode => mode.seconds === currentMode)?.name || 'Wingo 30 Sec'
}

function stopAllSpecialTimers() {
  stopAviator()
  if (wingoInterval) {
    clearInterval(wingoInterval)
    wingoInterval = null
  }
}

// 🛡️ ₹100 Deposit Guard
function checkGameEntry(onSuccess) {
  const balance = getBalance()
  if (balance < 100) {
    showDepositPromptModal()
    return false
  }
  if (typeof onSuccess === 'function') {
    onSuccess()
  }
  return true
}

function showDepositPromptModal() {
  document.querySelector('.deposit-prompt-modal')?.remove()

  const modal = document.createElement('div')
  modal.className = 'deposit-prompt-modal'
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); backdrop-filter: blur(5px);
    display: grid; place-items: center; z-index: 999999;
  `
  modal.innerHTML = `
    <div style="background: #ffffff; border-radius: 16px; width: 90%; max-width: 320px; padding: 25px; text-align: center; color: #1e293b; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
      <div style="font-size: 50px; margin-bottom: 8px;">⚠️</div>
      <h3 style="color: #00d26a; margin-bottom: 6px; font-size: 19px; font-weight: 800;">Recharge Required</h3>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 20px;">
        Game play karne ke liye wallet me minimum <strong>₹100</strong> hona zaroori hai. Kripya pehle recharge karein.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="cancelPromptBtn" style="flex: 1; padding: 10px; background: #e2e8f0; border: none; border-radius: 8px; color: #475569; font-weight: bold; cursor: pointer;">Cancel</button>
        <button id="goToDepositBtn" style="flex: 1; padding: 10px; background: #00d26a; border: none; border-radius: 8px; color: #fff; font-weight: bold; cursor: pointer;">Deposit ₹100</button>
      </div>
    </div>
  `

  document.body.appendChild(modal)
  document.querySelector('#cancelPromptBtn').onclick = () => modal.remove()
  document.querySelector('#goToDepositBtn').onclick = () => {
    modal.remove()
    showWallet()
    setTimeout(() => {
      document.querySelector('#depositBtn')?.click()
    }, 100)
  }
}

/* =========================
   OFFICIAL PAYMENT GATEWAY (New Tab Window)
========================= */

function openDepositGateway(amount, channel = 'UPI Express Pay') {
  const user = getCurrentUser()
  if (!user) {
    showToast('Please login first!', 'error')
    return
  }

  const bonus = Math.floor(amount * 0.10)
  const orderId = 'ORD-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000)
  const upiId = 'ayush122312@ybl'
  const upiPayUrl = `upi://pay?pa=${upiId}&pn=YaarWinOfficial&am=${amount}&cu=INR&tn=Deposit_${orderId}`

  const gatewayHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Gateway - Yaar Win</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; font-family:'Inter', sans-serif; }
        body { background:#f1f5f9; display:flex; justify-content:center; padding:15px; color:#1e293b; }
        .pay-box { background:#fff; width:100%; max-width:420px; border-radius:16px; padding:20px; box-shadow:0 10px 25px rgba(0,0,0,0.08); }
        .header { text-align:center; padding-bottom:15px; border-bottom:1px solid #e2e8f0; }
        .timer-badge { background:#fee2e2; color:#ef4444; padding:4px 10px; border-radius:20px; font-weight:bold; font-size:12px; display:inline-block; margin-top:6px; }
        .amount-row { display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px; border-radius:10px; margin:15px 0; border:1px solid #e2e8f0; }
        .upi-box { background:#f0fdf4; border:1px dashed #00d26a; padding:12px; border-radius:10px; text-align:center; margin-bottom:15px; }
        .copy-btn { background:#00d26a; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-size:12px; font-weight:bold; cursor:pointer; margin-left:6px; }
        .qr-img { width:140px; height:140px; border-radius:8px; border:1px solid #e2e8f0; margin:10px auto; display:block; }
        .btn-pay-app { display:block; width:100%; text-align:center; background:#00d26a; color:#fff; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; font-size:14px; margin-bottom:15px; }
        .input-field { width:100%; padding:12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; margin-bottom:12px; outline:none; }
        .submit-btn { width:100%; padding:14px; background:#2563eb; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer; }
      </style>
    </head>
    <body>
      <div class="pay-box">
        <div class="header">
          <h2 style="color:#00d26a; font-weight:900;">👑 Yaar Win Official Gateway</h2>
          <small style="color:#64748b;">Order: ${orderId} | Channel: ${channel}</small><br>
          <span class="timer-badge">⏳ Payment Expires in: <span id="payTimer">10:00</span></span>
        </div>

        <div class="amount-row">
          <div>
            <span style="font-size:12px; color:#64748b;">Deposit Amount:</span><br>
            <strong style="font-size:22px; color:#00d26a;">₹${amount.toFixed(2)}</strong>
          </div>
          <span style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">+₹${bonus} Bonus</span>
        </div>

        <div class="upi-box">
          <span style="font-size:12px; color:#64748b;">Official Receiver UPI:</span><br>
          <strong style="font-size:14px; color:#1e293b;" id="upiText">${upiId}</strong>
          <button class="copy-btn" onclick="navigator.clipboard.writeText('${upiId}'); alert('UPI ID Copied!');">Copy</button>
        </div>

        <img class="qr-img" src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(upiPayUrl)}" alt="Scan QR">

        <a class="btn-pay-app" href="${upiPayUrl}" target="_blank">Pay via GPay / PhonePe / Paytm App</a>

        <div style="background:#f8fafc; padding:12px; border-radius:10px; margin-bottom:15px; border:1px solid #e2e8f0;">
          <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:4px;">Enter 12-Digit UPI Ref / UTR Number:</label>
          <input id="utrInput" class="input-field" maxlength="12" placeholder="e.g. 4235XXXXXXXX" inputmode="numeric">
          <button id="submitUtrBtn" class="submit-btn">Submit UTR for Instant Approval</button>
        </div>
      </div>

      <script>
        let sec = 600;
        const timerEl = document.getElementById('payTimer');
        const timerInt = setInterval(() => {
          sec--;
          if (sec <= 0) { clearInterval(timerInt); alert('Payment time expired!'); window.close(); }
          const m = Math.floor(sec/60);
          const s = sec % 60;
          timerEl.textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
        }, 1000);

        document.getElementById('submitUtrBtn').onclick = () => {
          const utr = document.getElementById('utrInput').value.trim();
          if(!utr || utr.length < 8) {
            alert('Please enter valid 12-digit UTR number!');
            return;
          }
          const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');
          if(deposits.some(d => d.utr === utr)) {
            alert('This UTR has already been submitted!');
            return;
          }
          deposits.unshift({
            id: 'DEP-' + Math.floor(100000 + Math.random()*900000),
            uid: '${user.id}',
            name: '${escapeHtml(user.name)}',
            phone: '${escapeHtml(user.phone)}',
            amount: ${amount},
            bonus: ${bonus},
            utr: utr,
            channel: '${channel}',
            status: 'Pending',
            date: new Date().toLocaleString(),
            createdAt: new Date().toISOString()
          });
          localStorage.setItem('kivoro_deposits', JSON.stringify(deposits));
          alert('Deposit submitted successfully! Waiting for Admin Approval.');
          window.close();
        };
      </script>
    </body>
    </html>
  `

  const win = window.open('', '_blank')
  if (win) {
    win.document.write(gatewayHtml)
    win.document.close()
  } else {
    showToast('Pop-up blocked! Allow popups to open Payment Gateway.', 'error')
  }
}

/* =========================
   NAVIGATION BAR
========================= */

function navigation(active) {
  return `
    <nav class="yw-bottom-nav">
      <button id="navHome" class="yw-nav-item ${active === 'home' ? 'active' : ''}">
        <span style="font-size:20px;">🎮</span>
        <span>Home</span>
      </button>
      <button id="navActivity" class="yw-nav-item ${active === 'activity' ? 'active' : ''}">
        <span style="font-size:20px;">🎁</span>
        <span>Activity</span>
      </button>
      <div id="navWheel" class="center-wheel-btn">
        <span style="font-size:12px; font-weight:900;">GO</span>
        <span>Get ₹500</span>
      </div>
      <button id="navPromotion" class="yw-nav-item ${active === 'promotion' ? 'active' : ''}">
        <span style="font-size:20px;">💎</span>
        <span>Promotion</span>
      </button>
      <button id="navAccount" class="yw-nav-item ${active === 'account' ? 'active' : ''}">
        <span style="font-size:20px;">👤</span>
        <span>Account</span>
      </button>
    </nav>
  `
}

function connectNavigation() {
  setTimeout(() => {
    const h = document.querySelector('#navHome')
    const a = document.querySelector('#navActivity')
    const w = document.querySelector('#navWheel')
    const p = document.querySelector('#navPromotion')
    const acc = document.querySelector('#navAccount')

    if (h) h.onclick = showHome
    if (a) a.onclick = showActivity
    if (w) w.onclick = () => showMiniGame('Lucky Wheel')
    if (p) p.onclick = showPromotion
    if (acc) acc.onclick = showAccount
  }, 50)
}

/* =========================
   AUTHENTICATION VIEWS
========================= */

function showAuthTab(type = 'login') {
  currentPage = type
  stopAllSpecialTimers()

  const urlParams = new URLSearchParams(window.location.search)
  const inviteFromUrl = urlParams.get('invite') || ''

  app().innerHTML = `
    <div style="min-height:100vh; background:#f8fafc; display:flex; flex-direction:column; justify-content:center; padding:20px;">
      <div style="text-align:center; margin-bottom:25px;">
        <h1 style="color:#00d26a; font-size:32px; font-weight:900; letter-spacing:0.5px;">Yaar Win</h1>
        <p style="color:#64748b; font-size:13px;">Official Fair Gaming & Lottery Platform</p>
      </div>

      <div style="background:#fff; border-radius:20px; padding:25px; box-shadow:0 8px 25px rgba(0,0,0,0.06);">
        <div style="display:flex; background:#f1f5f9; border-radius:10px; padding:4px; margin-bottom:20px;">
          <button id="tabLoginBtn" style="flex:1; padding:10px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; background:${type === 'login' ? '#00d26a' : 'transparent'}; color:${type === 'login' ? '#fff' : '#64748b'};">Login</button>
          <button id="tabRegBtn" style="flex:1; padding:10px; border:none; border-radius:8px; font-weight:bold; cursor:pointer; background:${type === 'register' ? '#00d26a' : 'transparent'}; color:${type === 'register' ? '#fff' : '#64748b'};">Register</button>
        </div>

        <div id="authFormArea">
          ${
            type === 'login'
              ? `
            <div style="display:flex; align-items:center; border:1px solid #e2e8f0; border-radius:8px; padding:0 12px; margin-bottom:12px;">
              <span style="color:#00d26a; font-weight:bold; margin-right:8px;">+91</span>
              <input id="loginPhone" maxlength="10" inputmode="numeric" placeholder="Mobile Number" style="flex:1; border:none; padding:12px 0; outline:none; font-size:14px;">
            </div>
            <input id="loginPassword" type="password" placeholder="Password" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:18px; outline:none; font-size:14px;">
            <button id="loginBtn" style="width:100%; padding:14px; background:#00d26a; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">Log in</button>
          `
              : `
            <input id="regName" placeholder="Full Name" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; outline:none; font-size:14px;">
            <div style="display:flex; align-items:center; border:1px solid #e2e8f0; border-radius:8px; padding:0 12px; margin-bottom:12px;">
              <span style="color:#00d26a; font-weight:bold; margin-right:8px;">+91</span>
              <input id="regPhone" maxlength="10" inputmode="numeric" placeholder="Mobile Number" style="flex:1; border:none; padding:12px 0; outline:none; font-size:14px;">
            </div>
            <input id="regPassword" type="password" placeholder="Password" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:12px; outline:none; font-size:14px;">
            <input id="regInvite" placeholder="Invite Code (Optional)" value="${escapeHtml(inviteFromUrl)}" style="width:100%; border:1px solid #e2e8f0; border-radius:8px; padding:12px; margin-bottom:18px; outline:none; font-size:14px;">
            <button id="registerBtn" style="width:100%; padding:14px; background:#00d26a; color:#fff; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">Create Account</button>
          `
          }
        </div>
      </div>
    </div>
  `

  document.querySelector('#tabLoginBtn').onclick = () => showAuthTab('login')
  document.querySelector('#tabRegBtn').onclick = () => showAuthTab('register')

  if (type === 'login') {
    document.querySelector('#loginBtn').onclick = () => {
      const result = loginUser(
        document.querySelector('#loginPhone').value,
        document.querySelector('#loginPassword').value
      )

      if (!result.success) {
        showToast(result.message, 'error')
        return
      }

      if (isAdmin(result.user)) {
        showAdmin()
      } else {
        showHome()
      }
    }
  } else {
    document.querySelector('#registerBtn').onclick = () => {
      const result = registerUser(
        document.querySelector('#regName').value,
        document.querySelector('#regPhone').value,
        document.querySelector('#regPassword').value,
        document.querySelector('#regInvite').value
      )

      if (!result.success) {
        showToast(result.message, 'error')
        return
      }

      showToast('Account created successfully!', 'success')
      showHome()
    }
  }
}

function showLogin() { showAuthTab('login') }
function showRegister() { showAuthTab('register') }

/* =========================
   HOME SCREEN (YaarWin Exact UI)
========================= */

function showHome() {
  stopAllSpecialTimers()
  if (liveTickerInterval) clearInterval(liveTickerInterval)

  const user = getCurrentUser()
  if (!user) { showLogin(); return; }
  if (isAdmin(user)) { showAdmin(); return; }

  currentPage = 'home'
  const admin = getAdminState()

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header">
        <div class="yw-top-row">
          <span class="yw-logo">Yaar Win</span>
          <div style="display:flex; gap:10px;">
            <button id="homeSupportBtn" style="background:none; border:none; font-size:20px; cursor:pointer;">🎧</button>
          </div>
        </div>
      </div>

      <section style="background:#ffffff; padding:10px 14px; border-radius:10px; margin: -10px 12px 10px 12px; display:flex; align-items:center; gap:8px; font-size:12px; box-shadow:0 2px 8px rgba(0,0,0,0.04); border-left:4px solid #00d26a;">
        <span style="color:#00d26a; font-weight:bold; white-space:nowrap;">🔥 LIVE WINS:</span>
        <div id="liveWinnerTicker" style="color:#475569; white-space:nowrap; transition: all 0.5s ease;">
          User 98***71 won ₹450 in Wingo 30s
        </div>
      </section>

      <div class="yw-card" style="background: linear-gradient(135deg, #059669, #10b981); color:#fff;">
        <small style="text-transform:uppercase; letter-spacing:1px; opacity:0.9;">First Deposit</small>
        <h2 style="font-size:24px; font-weight:900; margin:4px 0;">UP TO ₹10,000 BONUS</h2>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span>Wallet: <strong>₹${getBalance().toLocaleString()}</strong></span>
          <button id="quickRechargeHome" style="background:#fff; color:#059669; border:none; padding:6px 14px; border-radius:20px; font-weight:bold; cursor:pointer;">Deposit</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 12px;">
        <div class="yw-normal-card" style="margin:0; text-align:center; cursor:pointer;" id="wheelFeatureBtn">
          <div style="font-size:28px;">🎡</div>
          <strong style="font-size:13px; display:block;">Wheel of fortune</strong>
          <small style="color:#00d26a; font-weight:bold;">View</small>
        </div>
        <div class="yw-normal-card" style="margin:0; text-align:center; cursor:pointer;" id="bonusFeatureBtn">
          <div style="font-size:28px;">💎</div>
          <strong style="font-size:13px; display:block;">Welcome Bonus</strong>
          <small style="color:#00d26a; font-weight:bold;">View</small>
        </div>
      </div>

      <h3 style="margin:14px 12px 6px 12px; font-size:16px;">Lottery & Wingo</h3>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:0 12px;">
        ${modes.map(mode => {
          const enabled = admin.games?.[mode.key] !== false
          const locked = admin.lockedGames?.[mode.key] === true
          return `
            <button class="yw-normal-card" data-mode="${mode.seconds}" data-key="${mode.key}" style="margin:0; border:none; text-align:left; cursor:pointer;">
              <div style="font-size:24px; margin-bottom:4px;">⏱️</div>
              <strong style="font-size:14px; color:#1e293b;">${mode.name}</strong><br>
              <small style="color:${!enabled ? '#ef4444' : locked ? '#f59e0b' : '#00d26a'}; font-weight:bold;">
                ${!enabled ? 'Disabled' : locked ? 'Locked' : 'Play Now'}
              </small>
            </button>
          `
        }).join('')}
      </div>

      <h3 style="margin:14px 12px 6px 12px; font-size:16px;">Casino & Mini Games</h3>
      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin:0 12px;">
        <button class="yw-normal-card" data-mini="Dice" style="margin:0; border:none; text-align:center; cursor:pointer;">
          <span style="font-size:24px;">🎲</span><br><small style="font-weight:bold;">Dice</small>
        </button>
        <button class="yw-normal-card" data-mini="Coin Flip" style="margin:0; border:none; text-align:center; cursor:pointer;">
          <span style="font-size:24px;">🪙</span><br><small style="font-weight:bold;">Coin Flip</small>
        </button>
        <button class="yw-normal-card" id="aviatorBtn" style="margin:0; border:none; text-align:center; cursor:pointer;">
          <span style="font-size:24px;">✈️</span><br><small style="font-weight:bold;">Aviator</small>
        </button>
      </div>

      ${navigation('home')}
    </div>
  `

  document.querySelector('#homeSupportBtn').onclick = openCustomerService
  document.querySelector('#wheelFeatureBtn').onclick = () => showMiniGame('Lucky Wheel')
  document.querySelector('#bonusFeatureBtn').onclick = showPromotion
  document.querySelector('#quickRechargeHome').onclick = showWallet

  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      const modeSec = Number(btn.dataset.mode)
      const modeKey = btn.dataset.key
      const state = getAdminState()
      if (state.lockedGames?.[modeKey]) {
        showToast('Game currently locked!', 'error')
        return
      }
      checkGameEntry(() => {
        currentMode = modeSec
        currentModeKey = modeKey
        timeLeft = currentMode
        selectedChoice = null
        lockedPrediction = null
        showWingo()
      })
    }
  })

  document.querySelectorAll('[data-mini]').forEach(btn => {
    btn.onclick = () => {
      checkGameEntry(() => showMiniGame(btn.dataset.mini))
    }
  })

  document.querySelector('#aviatorBtn').onclick = () => {
    checkGameEntry(showAviator)
  }

  startLiveWinnerTicker()
  connectNavigation()
}

function startLiveWinnerTicker() {
  const ticker = document.querySelector('#liveWinnerTicker')
  if (!ticker) return

  const mockUsers = ['98***21', '87***64', '91***30', '95***19', '70***82', '81***43']
  const mockGames = ['Wingo 30s', 'Wingo 1M', 'Aviator', 'Dice', 'Wheel']
  const mockPrizes = [200, 450, 900, 1800, 3600, 520]

  liveTickerInterval = setInterval(() => {
    const u = mockUsers[Math.floor(Math.random() * mockUsers.length)]
    const g = mockGames[Math.floor(Math.random() * mockGames.length)]
    const p = mockPrizes[Math.floor(Math.random() * mockPrizes.length)]
    const el = document.querySelector('#liveWinnerTicker')
    if (el) {
      el.style.opacity = '0'
      setTimeout(() => {
        el.innerHTML = `User <strong style="color:#00d26a;">${u}</strong> won <strong style="color:#059669;">₹${p}</strong> in ${g}`
        el.style.opacity = '1'
      }, 300)
    }
  }, 3500)
}

/* =========================
   WINGO SCREEN (0-9 Circular Number Balls & Bet Engine)
========================= */

function showWingo() {
  currentPage = 'wingo'
  stopAllSpecialTimers()

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header" style="padding-bottom:16px;">
        <div class="yw-top-row">
          <button id="backBtn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">←</button>
          <span class="yw-logo">${getModeName()}</span>
          <span>🎧</span>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.15); padding:8px 12px; border-radius:10px;">
          <div>
            <small style="opacity:0.8;">Period</small><br>
            <strong id="period" style="font-size:14px;">${period}</strong>
          </div>
          <div style="text-align:right;">
            <small style="opacity:0.8;">Time Remaining</small><br>
            <strong id="timer" style="font-size:18px;">${formatTime(timeLeft)}</strong>
          </div>
        </div>
      </div>

      <div class="yw-normal-card">
        <div id="wingoStatus" style="text-align:center; padding:10px; border-radius:8px; background:#f1f5f9; font-weight:bold; color:#334155; margin-bottom:12px;">
          Round running...
        </div>

        <div class="wingo-color-grid">
          <button class="choice-btn green" data-choice="GREEN">Green</button>
          <button class="choice-btn violet" data-choice="VIOLET">Violet</button>
          <button class="choice-btn red" data-choice="RED">Red</button>
        </div>

        <div class="number-ball-grid">
          <button class="num-ball dual-violet-red" data-choice="0">0</button>
          <button class="num-ball green" data-choice="1">1</button>
          <button class="num-ball red" data-choice="2">2</button>
          <button class="num-ball green" data-choice="3">3</button>
          <button class="num-ball red" data-choice="4">4</button>
          <button class="num-ball dual-violet-green" data-choice="5">5</button>
          <button class="num-ball red" data-choice="6">6</button>
          <button class="num-ball green" data-choice="7">7</button>
          <button class="num-ball red" data-choice="8">8</button>
          <button class="num-ball green" data-choice="9">9</button>
        </div>

        <div class="multiplier-row">
          <button class="mul-chip active" data-mul="1">X1</button>
          <button class="mul-chip" data-mul="5">X5</button>
          <button class="mul-chip" data-mul="10">X10</button>
          <button class="mul-chip" data-mul="20">X20</button>
          <button class="mul-chip" data-mul="50">X50</button>
          <button class="mul-chip" data-mul="100">X100</button>
        </div>

        <div class="big-small-grid">
          <button class="btn-big" data-choice="BIG">Big</button>
          <button class="btn-small" data-choice="SMALL">Small</button>
        </div>

        <h3>Select Amount</h3>
        <div class="amount-buttons" style="display:flex; gap:6px; flex-wrap:wrap; margin:8px 0;">
          <button class="mul-chip amt-btn active" data-amount="10">10</button>
          <button class="mul-chip amt-btn" data-amount="50">50</button>
          <button class="mul-chip amt-btn" data-amount="100">100</button>
          <button class="mul-chip amt-btn" data-amount="500">500</button>
          <button class="mul-chip amt-btn" data-amount="1000">1000</button>
        </div>

        <div class="custom-amount" style="margin-top:10px; display:flex; gap:8px;">
          <button id="amountMinus" style="padding:8px 14px; background:#e2e8f0; border:none; color:#1e293b; border-radius:6px; font-weight:bold; cursor:pointer;">−</button>
          <input id="gameAmount" type="number" min="10" step="10" value="10" style="flex:1; padding:8px; border:1px solid #cbd5e1; border-radius:6px; text-align:center;">
          <button id="amountPlus" style="padding:8px 14px; background:#e2e8f0; border:none; color:#1e293b; border-radius:6px; font-weight:bold; cursor:pointer;">+</button>
        </div>

        <p id="amountStatus" style="text-align:center; font-weight:700; margin-top:8px; color:#475569;">Selected Amount: 10 x X1 (Total: ₹10)</p>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;">
          <span style="font-size:13px; color:#64748b;">Selected: <strong id="selection" style="color:#00d26a; font-size:15px;">Choose option</strong></span>
          <button id="lockPredictionBtn" class="main-btn" style="width:auto; padding:10px 24px;">Lock Bet</button>
        </div>
      </div>

      <div class="yw-normal-card">
        <h4 style="margin-bottom:8px;">Game Record History</h4>
        <table class="yw-history-table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Number</th>
              <th>Big/Small</th>
              <th>Color</th>
            </tr>
          </thead>
          <tbody id="wingoHistoryBody"></tbody>
        </table>
      </div>
    </div>
  `

  selectedAmount = 10
  selectedMultiplier = 1

  document.querySelector('#backBtn').onclick = () => {
    stopAllSpecialTimers()
    showHome()
  }

  // Option selection
  document.querySelectorAll('[data-choice]').forEach(button => {
    button.onclick = () => {
      if (timeLeft <= 5) {
        showToast('Round Locked in last 5 seconds!', 'error')
        return
      }
      if (lockedPrediction) {
        showToast('Bet already locked for this round!', 'error')
        return
      }

      selectedChoice = String(button.dataset.choice)
      document.querySelectorAll('[data-choice]').forEach(item => item.classList.remove('selected'))
      button.classList.add('selected')
      updateSelection()
    }
  })

  // Multipliers selection
  document.querySelectorAll('[data-mul]').forEach(button => {
    button.onclick = () => {
      selectedMultiplier = Number(button.dataset.mul)
      document.querySelectorAll('[data-mul]').forEach(item => item.classList.remove('active'))
      button.classList.add('active')
      updateAmountStatus()
    }
  })

  // Amount buttons
  document.querySelectorAll('[data-amount]').forEach(button => {
    button.onclick = () => {
      selectedAmount = Number(button.dataset.amount)
      document.querySelectorAll('[data-amount]').forEach(item => item.classList.remove('active'))
      button.classList.add('active')
      const amountInput = document.querySelector('#gameAmount')
      if (amountInput) amountInput.value = selectedAmount
      updateAmountStatus()
    }
  })

  document.querySelector('#amountMinus').onclick = () => {
    selectedAmount = Math.max(10, selectedAmount - 10)
    document.querySelector('#gameAmount').value = selectedAmount
    updateAmountStatus()
  }

  document.querySelector('#amountPlus').onclick = () => {
    selectedAmount += 10
    document.querySelector('#gameAmount').value = selectedAmount
    updateAmountStatus()
  }

  document.querySelector('#gameAmount').oninput = (e) => {
    selectedAmount = Number(e.target.value) || 10
    updateAmountStatus()
  }

  function updateAmountStatus() {
    const total = selectedAmount * selectedMultiplier
    const amountStatus = document.querySelector('#amountStatus')
    if (amountStatus) amountStatus.textContent = `Selected Amount: ${selectedAmount} x X${selectedMultiplier} (Total: ₹${total})`
  }

  document.querySelector('#lockPredictionBtn').onclick = lockPrediction

  updateSelection()
  renderWingoHistory()

  wingoInterval = setInterval(() => {
    if (currentPage !== 'wingo') return
    timeLeft--
    if (timeLeft <= 0) finishRound()
    const timer = document.querySelector('#timer')
    if (timer) timer.textContent = formatTime(timeLeft)
  }, 1000)
}

function updateSelection() {
  const box = document.querySelector('#selection')
  if (box) box.textContent = selectedChoice ? selectedChoice : 'Choose option'
}

function lockPrediction() {
  if (timeLeft <= 5) {
    showToast('Round Locked in last 5 seconds!', 'error')
    return
  }

  if (!selectedChoice) {
    showToast('Pehle Color, Number ya Size select karein!', 'error')
    return
  }

  if (lockedPrediction) {
    showToast('Bet already locked for this round!', 'error')
    return
  }

  const currentBalance = getBalance()
  const totalBet = selectedAmount * selectedMultiplier

  if (totalBet <= 0) {
    showToast('Valid bet amount dalein!', 'error')
    return
  }

  if (totalBet > currentBalance) {
    showToast('Insufficient balance! Kripya recharge karein.', 'error')
    return
  }

  setBalance(currentBalance - totalBet)

  lockedPrediction = {
    choice: selectedChoice,
    amount: totalBet,
    period: period
  }

  const btn = document.querySelector('#lockPredictionBtn')
  if (btn) {
    btn.disabled = true
    btn.textContent = 'Bet Locked ✅'
    btn.style.background = '#94a3b8'
  }

  showToast(`Bet of ₹${totalBet} locked on ${selectedChoice}!`, 'success')
}

function finishRound() {
  const adminState = getAdminState()
  let number

  let forced = adminState.modeForcedResults?.[currentModeKey] || adminState.forcedResult

  if (forced !== null && forced !== undefined && forced !== '') {
    const fStr = String(forced).toUpperCase()
    if (!isNaN(fStr)) {
      number = Number(fStr)
    } else if (fStr === 'GREEN') {
      const gNums = '1,3,7,9'.split(',').map(Number)
      number = gNums[Math.floor(Math.random() * gNums.length)]
    } else if (fStr === 'RED') {
      const rNums = '2,4,6,8'.split(',').map(Number)
      number = rNums[Math.floor(Math.random() * rNums.length)]
    } else if (fStr === 'VIOLET') {
      number = Math.random() < 0.5 ? 0 : 5
    } else if (fStr === 'BIG') {
      const bNums = '5,6,7,8,9'.split(',').map(Number)
      number = bNums[Math.floor(Math.random() * bNums.length)]
    } else if (fStr === 'SMALL') {
      const sNums = '0,1,2,3,4'.split(',').map(Number)
      number = sNums[Math.floor(Math.random() * sNums.length)]
    } else {
      number = Math.floor(Math.random() * 10)
    }
  } else {
    number = Math.floor(Math.random() * 10)
  }

  const isGreen = (number === 1 || number === 3 || number === 7 || number === 9)
  const isDual = (number === 0 || number === 5)
  const color = isDual ? 'VIOLET' : isGreen ? 'GREEN' : 'RED'
  const size = number >= 5 ? 'Big' : 'Small'

  let matched = false
  let winAmount = 0
  const user = getCurrentUser()

  if (lockedPrediction) {
    if (
      lockedPrediction.choice === String(number) ||
      lockedPrediction.choice === color ||
      lockedPrediction.choice.toUpperCase() === size.toUpperCase()
    ) {
      matched = true
      let multiplier = 2
      if (!isNaN(lockedPrediction.choice)) multiplier = 9
      winAmount = lockedPrediction.amount * multiplier
      setBalance(getBalance() + winAmount)
    }

    if (user) {
      saveUserBetRecord(user.id, {
        game: getModeName(),
        period: period,
        choice: lockedPrediction.choice,
        bet: lockedPrediction.amount,
        result: matched ? 'WIN' : 'LOSS',
        payout: winAmount,
        date: new Date().toLocaleString()
      })
    }
  }

  history.unshift({ period, number, color, size })
  saveHistory()

  const currentResult = { number, color, size }
  if (lockedPrediction) {
    showResultPopup(matched, currentResult, winAmount)
  }

  period++
  savePeriod()
  timeLeft = currentMode
  selectedChoice = null
  lockedPrediction = null

  if (currentPage === 'wingo') {
    const periodBox = document.querySelector('#period')
    if (periodBox) periodBox.textContent = period

    const btn = document.querySelector('#lockPredictionBtn')
    if (btn) {
      btn.disabled = false
      btn.textContent = 'Lock Bet'
      btn.style.background = '#00d26a'
    }

    document.querySelectorAll('[data-choice]').forEach(item => item.classList.remove('selected'))
    updateSelection()
    renderWingoHistory()
  }
}

function renderWingoHistory() {
  const tbody = document.querySelector('#wingoHistoryBody')
  if (!tbody) return
  tbody.innerHTML = history.slice(0, 10).map(h => `
    <tr>
      <td style="color:#64748b;">${h.period}</td>
      <td style="font-weight:900; color:${h.color === 'GREEN' ? '#00d26a' : '#ef4444'};">${h.number}</td>
      <td>${h.size}</td>
      <td><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${h.color === 'GREEN' ? '#00d26a' : h.color === 'VIOLET' ? '#a855f7' : '#ef4444'};"></span></td>
    </tr>
  `).join('')
}

function showResultPopup(won, result, payout) {
  document.querySelector('.result-popup')?.remove()

  const popup = document.createElement('div')
  popup.className = 'result-popup'
  popup.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: grid; place-items:center; z-index:99999;
  `
  popup.innerHTML = `
    <div style="background:#fff; border-radius:20px; padding:30px; text-align:center; width:90%; max-width:320px; color:#1e293b; box-shadow:0 20px 40px rgba(0,0,0,0.3);">
      <div style="font-size:65px; margin-bottom:10px;">${won ? '🎉' : '🎯'}</div>
      <h2 style="color:${won ? '#00d26a' : '#ef4444'}; font-size:24px; font-weight:900; margin-bottom:10px;">${won ? 'WIN' : 'LOSS'}</h2>
      <div style="font-size:42px; font-weight:900; margin:10px 0; background:#f1f5f9; padding:10px; border-radius:12px; color:#00d26a;">
        ${result.number}
      </div>
      <p style="color:#64748b; font-weight:bold; margin-bottom:15px;">${result.color} • ${result.size}</p>
      ${won ? `<p style="color:#00d26a; font-weight:bold; font-size:18px; margin-bottom:15px;">+₹${payout} Won</p>` : ''}
      <button id="closeResultPopup" style="width:100%; padding:12px; background:#00d26a; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Continue</button>
    </div>
  `

  document.body.appendChild(popup)
  document.querySelector('#closeResultPopup').onclick = () => popup.remove()
  setTimeout(() => popup.remove(), 4000)
}

/* =========================
   MINI GAMES ENGINE
========================= */

function showMiniGame(name) {
  currentPage = 'mini'
  stopAllSpecialTimers()
  let miniBetAmt = 100

  app().innerHTML = `
    <div class="app-shell">
      <header class="game-header" style="background:#00d26a; color:#fff; padding:12px 16px; display:flex; justify-content:space-between; align-items:center; border-radius:0 0 16px 16px;">
        <button id="miniBack" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">←</button>
        <div>
          <strong>${escapeHtml(name)}</strong>
          <small style="display:block; opacity:0.8;">Mini Game Center</small>
        </div>
        <div class="game-balance" id="miniBalanceDisplay" style="font-weight:bold;">
          ₹${getBalance().toLocaleString()}
        </div>
      </header>

      <section class="yw-normal-card" style="text-align:center; margin-top:20px;">
        <div id="miniDisplay" style="min-height:140px; display:grid; place-items:center; font-size:65px; margin-bottom:15px;">🎮</div>
        
        <h3>Select Amount</h3>
        <div class="amount-buttons" style="margin:10px 0; display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
          <button class="mul-chip m-amt" data-amount="10">10</button>
          <button class="mul-chip m-amt" data-amount="50">50</button>
          <button class="mul-chip m-amt active" data-amount="100">100</button>
          <button class="mul-chip m-amt" data-amount="500">500</button>
          <button class="mul-chip m-amt" data-amount="1000">1000</button>
        </div>

        <button id="miniPlayBtn" class="main-btn" style="margin-bottom:15px;">Play & Win</button>
        <h2 id="miniResult" style="font-size:16px; font-weight:bold; color:#64748b;">Ready to Play</h2>
      </section>
    </div>
  `

  document.querySelector('#miniBack').onclick = showHome

  document.querySelectorAll('.m-amt').forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll('.m-amt').forEach(b => b.classList.remove('active'))
      e.target.classList.add('active')
      miniBetAmt = Number(e.target.dataset.amount)
    }
  })

  document.querySelector('#miniPlayBtn').onclick = () => {
    const bal = getBalance()
    if (miniBetAmt > bal) {
      showToast('Insufficient balance!', 'error')
      return
    }

    setBalance(bal - miniBetAmt)
    document.querySelector('#miniBalanceDisplay').textContent = `₹${getBalance().toLocaleString()}`

    const display = document.querySelector('#miniDisplay')
    const result = document.querySelector('#miniResult')
    
    display.textContent = '🎲 ...'
    result.textContent = 'Rolling...'

    setTimeout(() => {
      let isWin = Math.random() < 0.35
      let outcome = ''
      let winCoins = 0

      if (name === 'Dice') {
        const val = Math.floor(Math.random() * 6) + 1
        display.textContent = `🎲 ${val}`
        isWin = isWin && val >= 4
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Rolled ${val}`
      } else if (name === 'Number Game') {
        const val = Math.floor(Math.random() * 10)
        display.textContent = `🔢 ${val}`
        isWin = isWin && val % 2 === 0
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Number ${val}`
      } else if (name === 'Coin Flip') {
        const val = Math.random() < 0.5 ? 'HEADS' : 'TAILS'
        display.textContent = val === 'HEADS' ? '🪙 H' : '🪙 T'
        isWin = isWin
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Result ${val}`
      } else {
        const vals = '1,2,5,10'.split(',').map(Number)
        const val = vals[Math.floor(Math.random() * vals.length)]
        display.textContent = `🎡 ${val}x`
        isWin = isWin && val >= 2
        winCoins = isWin ? miniBetAmt * val : 0
        outcome = `Multiplier ${val}x`
      }

      const user = getCurrentUser()
      if (isWin && winCoins > 0) {
        setBalance(getBalance() + winCoins)
        document.querySelector('#miniBalanceDisplay').textContent = `₹${getBalance().toLocaleString()}`
        result.innerHTML = `<span style="color:#00d26a;">WIN! +₹${winCoins} (${outcome})</span>`
        showToast(`Congratulations! You won ₹${winCoins}`, 'success')
        saveUserBetRecord(user.id, { game: name, bet: miniBetAmt, result: 'WIN', payout: winCoins, date: new Date().toLocaleString() })
      } else {
        result.innerHTML = `<span style="color:#ef4444;">LOSS! -₹${miniBetAmt} (${outcome})</span>`
        showToast(`Better luck next time!`, 'error')
        saveUserBetRecord(user.id, { game: name, bet: miniBetAmt, result: 'LOSS', payout: 0, date: new Date().toLocaleString() })
      }
    }, 800)
  }
}

/* =========================
   AVIATOR ENGINE
========================= */

function showAviator() {
  currentPage = 'aviator'
  stopAllSpecialTimers()

  const state = getAdminState()
  if (state.games?.aviator === false) {
    showToast('Aviator disabled hai', 'error')
    showHome()
    return
  }
  if (state.lockedGames?.aviator) {
    showToast('Aviator currently locked', 'error')
    showHome()
    return
  }

  let aviatorBet = 100
  let isPlaying = false
  let cashedOut = false
  let currentMultiplier = 1

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header">
        <div class="yw-top-row">
          <button id="aviatorBack" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">←</button>
          <span class="yw-logo">Aviator</span>
          <span>₹<span id="avBalance">${getBalance().toLocaleString()}</span></span>
        </div>
      </div>

      <section class="yw-card" style="text-align:center;">
        <div style="font-size:60px; margin:10px 0;">✈️</div>
        <div id="aviatorMultiplier" style="font-size:48px; font-weight:900; color:#3b82f6; margin:8px 0;">1.00x</div>
        <p id="aviatorStatus" style="font-weight:bold; color:#64748b; margin-bottom:15px;">Next round starting...</p>

        <div id="aviatorControls">
          <input id="avBetInput" type="number" value="100" min="10" placeholder="Bet Amount" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #e2e8f0; text-align:center;">
          <button id="avBetBtn" class="main-btn">Place Bet</button>
        </div>
      </section>

      <section class="yw-normal-card">
        <h4>Previous Multipliers</h4>
        <div id="aviatorHistory" style="margin-top:8px;"></div>
      </section>
    </div>
  `

  document.querySelector('#aviatorBack').onclick = () => {
    stopAllSpecialTimers()
    showHome()
  }

  renderAviatorHistory()

  const betBtn = document.querySelector('#avBetBtn')
  const betInput = document.querySelector('#avBetInput')

  betBtn.onclick = () => {
    const amt = Number(betInput.value)
    if (!amt || amt <= 0) {
      showToast('Valid bet amount dalein', 'error')
      return
    }
    if (amt > getBalance()) {
      showToast('Insufficient balance', 'error')
      return
    }

    if (!isPlaying && !cashedOut) {
      setBalance(getBalance() - amt)
      aviatorBet = amt
      isPlaying = true
      cashedOut = false
      document.querySelector('#avBalance').textContent = getBalance().toLocaleString()
      betBtn.style.background = '#00d26a'
      betBtn.textContent = 'Cash Out'
      showToast(`Aviator Bet of ₹${amt} placed!`, 'success')
    } else if (isPlaying && !cashedOut) {
      cashedOut = true
      isPlaying = false
      const winVal = Math.floor(aviatorBet * currentMultiplier)
      setBalance(getBalance() + winVal)
      document.querySelector('#avBalance').textContent = getBalance().toLocaleString()
      betBtn.style.background = '#94a3b8'
      betBtn.disabled = true
      betBtn.textContent = `Cashed Out @ ${currentMultiplier.toFixed(2)}x (+₹${winVal})`
      showToast(`Successfully Cashed Out! Won ₹${winVal}`, 'success')
      const user = getCurrentUser()
      if (user) saveUserBetRecord(user.id, { game: 'Aviator', bet: aviatorBet, result: 'WIN', payout: winVal, date: new Date().toLocaleString() })
    }
  }

  startAviatorRoundLive()
}

function startAviatorRoundLive() {
  if (currentPage !== 'aviator') return

  let multiplier = 1
  const state = getAdminState()
  const stopAt = state.modeForcedResults?.aviator ? Number(state.modeForcedResults.aviator) : Number((1.05 + Math.random() * 5).toFixed(2))
  const status = document.querySelector('#aviatorStatus')
  const display = document.querySelector('#aviatorMultiplier')

  if (status) status.textContent = 'Flying...'

  aviatorTimer = setInterval(() => {
    if (currentPage !== 'aviator') {
      clearInterval(aviatorTimer)
      return
    }

    multiplier += 0.04 + multiplier * 0.015
    currentMultiplier = multiplier

    if (display) {
      display.textContent = `${multiplier.toFixed(2)}x`
    }

    if (multiplier >= stopAt) {
      clearInterval(aviatorTimer)
      aviatorTimer = null

      const list = getAviatorHistory()
      list.unshift(stopAt.toFixed(2))
      saveAviatorHistory(list)
      renderAviatorHistory()

      if (status) status.textContent = `Flew away at ${stopAt.toFixed(2)}x`

      const betBtnEl = document.querySelector('#avBetBtn')
      if (betBtnEl && betBtnEl.textContent === 'Cash Out') {
        betBtnEl.style.background = '#ef4444'
        betBtnEl.disabled = true
        betBtnEl.textContent = 'Busted (Loss)'
        showToast('Plane flew away! You lost the bet.', 'error')
        const user = getCurrentUser()
        if (user) saveUserBetRecord(user.id, { game: 'Aviator', bet: 100, result: 'LOSS', payout: 0, date: new Date().toLocaleString() })
      }

      aviatorRestartTimer = setTimeout(() => {
        if (currentPage === 'aviator') {
          if (display) display.textContent = '1.00x'
          if (betBtnEl) {
            betBtnEl.style.background = '#00d26a'
            betBtnEl.disabled = false
            betBtnEl.textContent = 'Place Bet'
          }
          startAviatorRoundLive()
        }
      }, 3000)
    }
  }, 100)
}

function stopAviator() {
  if (aviatorTimer) {
    clearInterval(aviatorTimer)
    aviatorTimer = null
  }
  if (aviatorRestartTimer) {
    clearTimeout(aviatorRestartTimer)
    aviatorRestartTimer = null
  }
}

function renderAviatorHistory() {
  const box = document.querySelector('#aviatorHistory')
  if (!box) return
  const list = getAviatorHistory()
  if (list.length === 0) {
    box.innerHTML = '<p style="color:#64748b; font-size:12px;">No Aviator history yet.</p>'
    return
  }
  box.innerHTML = `<div style="display:flex; gap:6px; flex-wrap:wrap;">` + list.map(m => `
    <span style="background:#e2e8f0; color:#00d26a; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">${m}x</span>
  `).join('') + `</div>`
}

function getAviatorHistory() {
  try {
    const value = JSON.parse(
      localStorage.getItem('kivoro_aviator_history') || '[]'
    )
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function saveAviatorHistory(list) {
  localStorage.setItem(
    'kivoro_aviator_history',
    JSON.stringify(list.slice(0, 20))
  )
}

/* =========================
   ACCOUNT & PROFILE (91 Club Style UID & History)
========================= */

function showAccount() {
  stopAllSpecialTimers()
  currentPage = 'account'
  const user = getCurrentUser()

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:52px; height:52px; border-radius:50%; background:#fff; color:#00d26a; display:grid; place-items:center; font-weight:900; font-size:22px;">
            ${user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="display:flex; align-items:center; gap:6px;">
              <strong style="font-size:16px;">${escapeHtml(user.name)}</strong>
              <span style="background:rgba(255,255,255,0.2); font-size:10px; padding:2px 6px; border-radius:10px;">⭐ VIP1</span>
            </div>
            <div style="display:flex; align-items:center; gap:6px; margin-top:2px; font-size:12px;">
              <span>UID | ${escapeHtml(user.id)}</span>
              <button id="accCopyUid" style="background:none; border:none; color:#fff; cursor:pointer;">📋</button>
            </div>
            <small style="opacity:0.8; font-size:11px;">Last login: ${new Date().toLocaleDateString()}</small>
          </div>
        </div>
      </div>

      <div class="yw-card">
        <small style="color:#64748b;">Total balance</small>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <h2 style="font-size:28px; font-weight:900;">₹${getBalance().toFixed(2)}</h2>
          <button id="enterWalletBtn" style="background:#00d26a; color:#fff; border:none; padding:8px 18px; border-radius:20px; font-weight:bold; cursor:pointer;">Enter wallet</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:10px; margin-top:16px; text-align:center;">
          <div id="accDepBtn" style="cursor:pointer;"><span style="font-size:24px;">👛</span><br><small style="font-size:11px;">Deposit</small></div>
          <div id="accWdBtn" style="cursor:pointer;"><span style="font-size:24px;">🏧</span><br><small style="font-size:11px;">Withdraw</small></div>
          <div><span style="font-size:24px;">💎</span><br><small style="font-size:11px;">VIP</small></div>
          <div><span style="font-size:24px;">🔒</span><br><small style="font-size:11px;">Safe</small></div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 12px;">
        <div id="btnGameHist" class="yw-normal-card" style="margin:0; cursor:pointer;">
          <strong style="color:#3b82f6;">📊 Game History</strong><br>
          <small style="color:#64748b;">My game history</small>
        </div>
        <div id="btnTxnHist" class="yw-normal-card" style="margin:0; cursor:pointer;">
          <strong style="color:#10b981;">📋 Transaction</strong><br>
          <small style="color:#64748b;">My transaction history</small>
        </div>
        <div id="btnDepHist" class="yw-normal-card" style="margin:0; cursor:pointer;">
          <strong style="color:#ef4444;">📥 Deposit</strong><br>
          <small style="color:#64748b;">My deposit history</small>
        </div>
        <div id="btnWdHist" class="yw-normal-card" style="margin:0; cursor:pointer;">
          <strong style="color:#f59e0b;">📤 Withdraw</strong><br>
          <small style="color:#64748b;">My withdraw history</small>
        </div>
      </div>

      <div class="yw-normal-card" style="display:flex; justify-content:space-between; align-items:center;">
        <span>🔔 Notification</span>
        <span style="background:#ef4444; color:#fff; font-size:11px; padding:2px 8px; border-radius:10px;">25</span>
      </div>

      <div style="margin:16px 12px;">
        <button id="logoutBtn" style="width:100%; padding:12px; background:#e2e8f0; color:#ef4444; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">Log out</button>
      </div>

      ${navigation('account')}
    </div>
  `

  document.querySelector('#accCopyUid').onclick = () => {
    navigator.clipboard.writeText(user.id)
    showToast(`UID ${user.id} Copied!`, 'success')
  }

  document.querySelector('#enterWalletBtn').onclick = showWallet
  document.querySelector('#accDepBtn').onclick = showWallet
  document.querySelector('#accWdBtn').onclick = showWallet

  document.querySelector('#btnGameHist').onclick = showMyBetHistory
  document.querySelector('#btnTxnHist').onclick = showWallet
  document.querySelector('#btnDepHist').onclick = showWallet
  document.querySelector('#btnWdHist').onclick = showWallet

  document.querySelector('#logoutBtn').onclick = () => {
    logoutUser()
    showLogin()
  }

  connectNavigation()
}

function showMyBetHistory() {
  currentPage = 'myhistory'
  stopAllSpecialTimers()
  const user = getCurrentUser()
  const bets = getUserBetRecords(user.id)

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header">
        <div class="yw-top-row">
          <button id="histBackBtn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">←</button>
          <span class="yw-logo">Yaar Win</span>
          <span></span>
        </div>
      </div>

      <div style="padding:10px 12px;">
        <h3 style="margin-bottom:10px;">My Bet History</h3>
        ${bets.length === 0 ? '<p style="text-align:center; color:#64748b; margin-top:30px;">No bets placed yet.</p>' : bets.map(b => `
          <div class="yw-normal-card" style="margin:0 0 10px 0; display:flex; justify-content:space-between; align-items:center;">
            <div style="display:flex; align-items:center; gap:10px;">
              <div style="width:38px; height:38px; border-radius:8px; background:${b.choice === 'GREEN' ? '#00d26a' : b.choice === 'BIG' ? '#f59e0b' : '#ef4444'}; color:#fff; display:grid; place-items:center; font-weight:bold; font-size:13px;">
                ${b.choice}
              </div>
              <div>
                <strong style="font-size:13px;">#${b.period || 'Round'}</strong><br>
                <small style="color:#64748b;">${b.date}</small>
              </div>
            </div>
            <div style="text-align:right;">
              <span style="color:#00d26a; font-size:11px; font-weight:bold; border:1px solid #00d26a; padding:1px 6px; border-radius:4px;">${b.result}</span><br>
              <strong style="color:${b.result === 'WIN' ? '#00d26a' : '#64748b'}; font-size:13px;">${b.payout ? '+₹' + b.payout : '₹0.00'}</strong>
            </div>
          </div>
        `).join('')}
      </div>
      ${navigation('account')}
    </div>
  `

  document.querySelector('#histBackBtn').onclick = showAccount
  connectNavigation()
}

/* =========================
   PROMOTION AGENCY SCREEN
========================= */

function showPromotion() {
  stopAllSpecialTimers()
  currentPage = 'promotion'
  const user = getCurrentUser()
  const refDetails = getReferralDetails(user.id)
  const referralLink = window.location.origin + '?invite=' + user.referralCode

  const commissionEarned = refDetails.totalDeposit * 0.02

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header" style="text-align:center;">
        <h2 style="font-size:18px;">Agency</h2>
        <div style="margin-top:15px;">
          <h1 style="font-size:36px; font-weight:900;">₹${commissionEarned.toFixed(2)}</h1>
          <span style="background:rgba(255,255,255,0.2); padding:4px 12px; border-radius:20px; font-size:12px;">Yesterday's total commission</span>
        </div>
      </div>

      <div class="yw-card" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; text-align:center; margin-top:-16px;">
        <div style="border-right:1px solid #f1f5f9; padding-right:8px;">
          <small style="color:#64748b; font-weight:bold;">Direct subordinates</small>
          <h3 style="margin-top:6px;">${refDetails.totalRegister}</h3>
          <small style="color:#94a3b8;">Number of register</small>
          <h4 style="margin-top:6px;">₹${refDetails.totalDeposit}</h4>
          <small style="color:#94a3b8;">Deposit amount</small>
        </div>
        <div>
          <small style="color:#64748b; font-weight:bold;">Team subordinates</small>
          <h3 style="margin-top:6px;">${refDetails.totalRegister}</h3>
          <small style="color:#94a3b8;">Number of register</small>
          <h4 style="margin-top:6px;">₹${refDetails.totalDeposit}</h4>
          <small style="color:#94a3b8;">Deposit amount</small>
        </div>
      </div>

      <div style="margin:10px 12px;">
        <button id="copyInviteLinkBtn" style="width:100%; padding:14px; background:#00d26a; color:#fff; border:none; border-radius:25px; font-weight:bold; font-size:15px; cursor:pointer;">
          INVITATION LINK
        </button>
      </div>

      <div class="yw-normal-card">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span>Copy invitation code</span>
          <strong id="copyCodeOnly" style="color:#00d26a; cursor:pointer;">${escapeHtml(user.referralCode)} 📋</strong>
        </div>
      </div>

      <div class="yw-normal-card">
        <h4 style="margin-bottom:8px;">Subordinate Data (Team Records)</h4>
        <div style="font-size:13px; color:#64748b;">
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Deposit number:</span> <strong>${refDetails.totalDepositCount || 0}</strong></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Deposit amount:</span> <strong>₹${refDetails.totalDeposit || 0}</strong></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Number of bettors:</span> <strong>${refDetails.totalBettors || 0}</strong></div>
          <div style="display:flex; justify-content:space-between; padding:4px 0;"><span>Total bet:</span> <strong>₹${refDetails.totalBetAmount || 0}</strong></div>
        </div>
      </div>

      <div class="yw-normal-card">
        <h4>Claim Gift Code</h4>
        <input id="giftCodeInput" placeholder="Enter Gift Code" style="width:100%; padding:10px; border:1px solid #e2e8f0; border-radius:8px; margin:8px 0;">
        <button id="claimGiftBtn" style="width:100%; padding:10px; background:#00d26a; color:#fff; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Claim Gift Code</button>
      </div>

      ${navigation('promotion')}
    </div>
  `

  document.querySelector('#copyInviteLinkBtn').onclick = () => {
    navigator.clipboard.writeText(referralLink)
    showToast('Invitation link copied!', 'success')
  }
  document.querySelector('#copyCodeOnly').onclick = () => {
    navigator.clipboard.writeText(user.referralCode)
    showToast('Code copied!', 'success')
  }
  document.querySelector('#claimGiftBtn').onclick = () => {
    const res = claimGiftCode(document.querySelector('#giftCodeInput').value, user.id)
    if (!res.success) { showToast(res.message, 'error'); return; }
    setBalance(getBalance() + res.coins)
    showToast(`${res.coins} coins added!`, 'success')
    showPromotion()
  }

  connectNavigation()
}

/* =========================
   WALLET SCREEN
========================= */

function showWallet() {
  stopAllSpecialTimers()
  currentPage = 'wallet'
  const user = getCurrentUser()
  const upiStatus = getCurrentUserUpiStatus()

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header">
        <div class="yw-top-row">
          <button id="walletBackBtn" style="background:none; border:none; color:#fff; font-size:20px; cursor:pointer;">←</button>
          <span class="yw-logo">Wallet</span>
          <span></span>
        </div>
      </div>

      <div class="yw-card" style="text-align:center;">
        <small style="color:#64748b;">Available Balance</small>
        <h2 style="font-size:32px; color:#00d26a; font-weight:900; margin:4px 0;">₹${getBalance().toFixed(2)}</h2>
      </div>

      <div style="display:flex; gap:10px; margin:10px 12px;">
        <button id="depositBtn" style="flex:1; padding:12px; background:#00d26a; color:#fff; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">➕ Deposit</button>
        <button id="withdrawBtn" style="flex:1; padding:12px; background:#3b82f6; color:#fff; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">↗ Withdraw</button>
        <button id="historyBtn" style="flex:1; padding:12px; background:#e2e8f0; color:#1e293b; border:none; border-radius:10px; font-weight:bold; cursor:pointer;">📋 Records</button>
      </div>

      <div id="walletActionArea" class="yw-normal-card">
        <p style="text-align:center; color:#64748b;">Deposit, Withdrawal ya History ke liye upar buttons par click karein.</p>
      </div>

      ${navigation('wallet')}
    </div>
  `

  document.querySelector('#walletBackBtn').onclick = showHome

  document.querySelector('#depositBtn').onclick = () => {
    const area = document.querySelector('#walletActionArea')
    area.innerHTML = `
      <h3>Deposit Funds (10% Bonus)</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:8px;">Choose instant payment gateway or select channel below:</p>
      
      <button id="open91GatewayBtn" class="main-btn" style="background: linear-gradient(135deg, #00d26a, #047857); padding: 12px; margin-bottom: 12px; font-size: 14px; font-weight: 800;">
        ⚡ Open Yaar Win Payment Gateway (New Tab)
      </button>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
        <button class="dep-panel-btn mul-chip active" data-channel="Paytm">Paytm Gateway</button>
        <button class="dep-panel-btn mul-chip" data-channel="PhonePe">PhonePe Pay</button>
        <button class="dep-panel-btn mul-chip" data-channel="GooglePay">Google Pay</button>
        <button class="dep-panel-btn mul-chip" data-channel="QRDirect">Direct QR Scan</button>
        <button class="dep-panel-btn mul-chip" data-channel="FastUPI">Fast UPI Transfer</button>
        <button class="dep-panel-btn mul-chip" data-channel="UPICollect">UPI Collect</button>
      </div>

      <div style="background:#f8fafc; padding:12px; border-radius:8px; text-align:center; margin-bottom:12px; border:1px solid #e2e8f0;">
        <p style="font-size:13px; color:#00d26a; margin-bottom:6px; font-weight:bold;">Official QR Code</p>
        <div style="background:#fff; display:inline-block; padding:8px; border-radius:6px; margin-bottom:8px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" alt="QR">
        </div>
        <div>
          <a id="externalAppPayBtn" href="upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" target="_blank" class="main-btn" style="display:inline-block; padding:8px 16px; font-size:13px; text-decoration:none;">Pay via UPI App</a>
        </div>
      </div>

      <input id="depositAmountInput" type="number" placeholder="Enter Amount (Min 100)" value="100" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
      <input id="depositUtrInput" type="text" placeholder="Enter 12-digit UTR / Ref Number" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1; outline:none;">
      
      <button id="submitDepositReqBtn" class="main-btn">Submit Deposit for Approval</button>
    `

    document.querySelector('#open91GatewayBtn').onclick = () => {
      const amt = Number(document.querySelector('#depositAmountInput').value) || 100
      openDepositGateway(amt, 'UPI Express Gateway')
    }

    document.querySelectorAll('.dep-panel-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.dep-panel-btn').forEach(b => b.classList.remove('active'))
        e.target.classList.add('active')
        showToast(`Channel selected: ${e.target.dataset.channel}`, 'info')
      }
    })

    document.querySelector('#submitDepositReqBtn').onclick = () => {
      const amt = Number(document.querySelector('#depositAmountInput').value)
      const utr = document.querySelector('#depositUtrInput').value.trim()

      if (!amt || amt < 100) { showToast('Minimum deposit amount 100 ₹ hai!', 'error'); return; }
      if (!utr || utr.length < 8) { showToast('Kripya valid UTR / Ref number enter karein!', 'error'); return; }

      const deposits = getAllDeposits()
      if (deposits.some(d => d.utr === utr)) {
        showToast('Yeh UTR pehle hi use ho chuka hai!', 'error')
        return
      }

      const newDep = {
        id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
        uid: user.id,
        name: user.name,
        phone: user.phone,
        amount: amt,
        bonus: Math.floor(amt * 0.10),
        utr: utr,
        channel: 'UPI Direct',
        status: 'Pending',
        date: new Date().toLocaleString(),
        createdAt: new Date().toISOString()
      }

      deposits.unshift(newDep)
      localStorage.setItem('kivoro_deposits', JSON.stringify(deposits))

      showToast('Deposit request submitted! Waiting for Admin approval.', 'success')
      showWallet()
    }
  }

  document.querySelector('#withdrawBtn').onclick = () => {
    const area = document.querySelector('#walletActionArea')
    area.innerHTML = `
      <h3>Withdraw Funds</h3>
      <p style="font-size:12px; color:#64748b; margin-bottom:10px;">Enter your UPI ID to withdraw funds securely.</p>
      
      <input id="withdrawalUpiInput" type="text" placeholder="Enter UPI ID (e.g. user@paytm)" value="${escapeHtml(upiStatus.upiId)}" ${upiStatus.locked ? 'readonly style="width:100%; padding:10px; background:#f1f5f9; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px;"' : 'style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:8px;"'}>
      ${upiStatus.locked ? '<small style="color:#00d26a; display:block; margin-bottom:8px;">🔒 UPI is locked securely</small>' : ''}
      
      <input id="withdrawalAmountInput" type="number" placeholder="Enter amount to withdraw (Min 110)" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #cbd5e1;">
      <button id="submitWithdrawalBtn" class="main-btn">Withdraw</button>
    `

    document.querySelector('#submitWithdrawalBtn').onclick = () => {
      const upi = document.querySelector('#withdrawalUpiInput').value.trim()
      const amt = Number(document.querySelector('#withdrawalAmountInput').value)

      if (!upi || !upi.includes('@')) { showToast('Kripya valid UPI ID enter karein!', 'error'); return; }
      if (!amt || amt < 110) { showToast('Minimum withdrawal amount 110 coins hai!', 'error'); return; }
      if (amt > getBalance()) { showToast('Insufficient balance!', 'error'); return; }

      if (!upiStatus.locked) {
        saveUserUpiSecure(user.id, upi)
      }

      const res = requestUserWithdrawal(user.id, amt, upi)
      if (res.success) {
        showToast(res.message, 'success')
        showWallet()
      } else {
        showToast(res.message, 'error')
      }
    }
  }

  document.querySelector('#historyBtn').onclick = () => {
    const withdrawals = getAllWithdrawals().filter(w => String(w.uid) === String(user.id))
    const deposits = getAllDeposits().filter(d => String(d.uid) === String(user.id))

    const area = document.querySelector('#walletActionArea')
    area.innerHTML = `
      <h3>Transaction Records</h3>
      <div style="display:flex; gap:8px; margin:10px 0;">
        <button id="histWdBtn" style="flex:1; padding:8px; background:#00d26a; color:#fff; border:none; border-radius:6px; font-weight:bold; font-size:12px;">Withdrawals (${withdrawals.length})</button>
        <button id="histDepBtn" style="flex:1; padding:8px; background:#e2e8f0; color:#1e293b; border:none; border-radius:6px; font-weight:bold; font-size:12px;">Deposits (${deposits.length})</button>
      </div>
      <div id="historyListContainer" style="max-height:220px; overflow-y:auto; font-size:12px;"></div>
    `

    const renderWd = () => {
      const container = document.querySelector('#historyListContainer')
      if (!withdrawals.length) {
        container.innerHTML = '<p style="text-align:center; color:#888; padding:10px;">No withdrawals found.</p>'
        return
      }
      container.innerHTML = withdrawals.map(w => `
        <div style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:6px; border-left:3px solid ${w.status === 'Completed' ? '#00d26a' : w.status === 'Rejected' ? '#ef4444' : '#f59e0b'};">
          <strong>₹${w.amount}</strong> via UPI (${escapeHtml(w.upi)})<br>
          <span style="color:#64748b;">Status: <strong>${w.status}</strong></span><br>
          <small style="color:#94a3b8;">${w.date || w.createdAt}</small>
        </div>
      `).join('')
    }

    const renderDep = () => {
      const container = document.querySelector('#historyListContainer')
      if (!deposits.length) {
        container.innerHTML = '<p style="text-align:center; color:#888; padding:10px;">No deposits found.</p>'
        return
      }
      container.innerHTML = deposits.map(d => `
        <div style="background:#f8fafc; padding:8px; border-radius:6px; margin-bottom:6px; border-left:3px solid ${d.status === 'Completed' ? '#00d26a' : '#f59e0b'};">
          <strong>₹${d.amount}</strong> (+₹${d.bonus || 0} Bonus)<br>
          <span style="color:#64748b;">UTR: ${escapeHtml(d.utr)} | Status: <strong>${d.status}</strong></span><br>
          <small style="color:#94a3b8;">${d.date || d.createdAt}</small>
        </div>
      `).join('')
    }

    renderWd()

    document.querySelector('#histWdBtn').onclick = (e) => {
      e.target.style.background = '#00d26a'
      e.target.style.color = '#fff'
      document.querySelector('#histDepBtn').style.background = '#e2e8f0'
      document.querySelector('#histDepBtn').style.color = '#1e293b'
      renderWd()
    }

    document.querySelector('#histDepBtn').onclick = (e) => {
      e.target.style.background = '#00d26a'
      e.target.style.color = '#fff'
      document.querySelector('#histWdBtn').style.background = '#e2e8f0'
      document.querySelector('#histWdBtn').style.color = '#1e293b'
      renderDep()
    }
  }

  connectNavigation()
}

function showActivity() {
  stopAllSpecialTimers()
  currentPage = 'activity'

  app().innerHTML = `
    <div class="app-shell">
      <div class="yw-header"><h2>Activity & Record Center</h2></div>
      <section class="yw-normal-card">
        <h2>Wingo Results</h2>
        <div id="history"></div>
      </section>
      <section class="yw-normal-card">
        <h2>Aviator Results</h2>
        <div id="aviatorHistory"></div>
      </section>
      ${navigation('activity')}
    </div>
  `

  renderHistory()
  renderAviatorHistory()
  connectNavigation()
}

/* =========================
   FULL ADMIN PANEL (All Modes Connected)
========================= */

function showAdmin() {
  stopAllSpecialTimers()
  const user = getCurrentUser()

  if (!isAdmin(user)) {
    showHome()
    return
  }

  currentPage = 'admin'

  app().innerHTML = `
    <div class="admin-layout">
      <aside class="admin-menu">
        <h2>Yaar Win Admin</h2>
        <button id="aDashboard">📊 Dashboard</button>
        <button id="aWithdrawals">💳 Withdrawals</button>
        <button id="aDeposits">➕ Deposit Approvals</button>
        <button id="aControl">🎯 Win/Loss Control</button>
        <button id="aDemoId">🪪 Create Demo ID</button>
        <button id="aPlayers">👥 Players</button>
        <button id="aAgents">👔 Agents</button>
        <button id="aGames">🎮 Game Control</button>
        <button id="aGift">🎁 Gift Codes</button>
        <button id="aAnnouncement">📢 Announcement</button>
        <button id="aSite">🏠 Open Site</button>
        <button id="aLogout">🚪 Logout</button>
      </aside>

      <main id="adminContent" class="admin-content"></main>
    </div>
  `

  document.querySelector('#aDashboard').onclick = adminDashboard
  document.querySelector('#aWithdrawals').onclick = adminWithdrawalsPanel
  document.querySelector('#aDeposits').onclick = adminDepositsPanel
  document.querySelector('#aControl').onclick = adminWinLossControl
  document.querySelector('#aDemoId').onclick = adminDemoId
  document.querySelector('#aPlayers').onclick = adminPlayers
  document.querySelector('#aAgents').onclick = adminAgents
  document.querySelector('#aGames').onclick = adminGames
  document.querySelector('#aGift').onclick = adminGiftCodes
  document.querySelector('#aAnnouncement').onclick = adminAnnouncement
  document.querySelector('#aSite').onclick = showHome
  document.querySelector('#aLogout').onclick = () => {
    logoutUser()
    showLogin()
  }

  adminDashboard()
}

function adminDashboard() {
  const users = getAllUsers()
  const withdrawals = getAllWithdrawals()
  const pendingWd = withdrawals.filter(w => w.status === 'Pending').length
  const deposits = getAllDeposits()
  const pendingDep = deposits.filter(d => d.status === 'Pending').length

  document.querySelector('#adminContent').innerHTML = `
    <h1>Admin Dashboard</h1>
    <div class="admin-stats">
      <div><span>Total Players</span><strong>${users.length}</strong></div>
      <div><span>Pending Withdrawals</span><strong style="color:#facc15;">${pendingWd}</strong></div>
      <div><span>Pending Deposits</span><strong style="color:#facc15;">${pendingDep}</strong></div>
    </div>
  `
}

function adminWithdrawalsPanel() {
  const withdrawals = getAllWithdrawals()

  document.querySelector('#adminContent').innerHTML = `
    <h1>Withdrawal Control Panel</h1>
    <div style="margin-top:15px;">
      ${withdrawals.length === 0 ? '<p>No withdrawal requests found.</p>' : withdrawals.map(w => `
        <section class="yw-normal-card" style="margin-bottom:12px; border-left:4px solid ${w.status === 'Completed' ? '#00d26a' : w.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>ID: ${w.id}</strong> (User: ${w.uid})<br>
              Amount: <strong style="color:#00d26a;">₹${w.amount}</strong> | UPI: <strong>${escapeHtml(w.upi)}</strong><br>
              <small style="color:#64748b;">Date: ${w.date || w.createdAt}</small>
            </div>
            <div>
              <span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; background:${w.status === 'Completed' ? '#065f46' : w.status === 'Rejected' ? '#991b1b' : '#854d0e'}; color:#fff;">${w.status}</span>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#f59e0b; width:auto;" onclick="window.updateWd('${w.id}', 'Processing')">Mark Processing</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#00d26a; width:auto;" onclick="window.updateWd('${w.id}', 'Completed')">Mark Completed</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#ef4444; width:auto;" onclick="window.updateWd('${w.id}', 'Rejected')">Reject & Auto-Refund</button>
          </div>
        </section>
      `).join('')}
    </div>
  `
}

window.updateWd = function(id, status) {
  const res = updateAdminWithdrawalStatus(id, status)
  if (res.success) {
    showToast(res.message, 'success')
    adminWithdrawalsPanel()
  } else {
    showToast(res.message, 'error')
  }
}

function adminDepositsPanel() {
  const deposits = getAllDeposits()
  document.querySelector('#adminContent').innerHTML = `
    <h1>Deposit Approvals</h1>
    <div style="margin-top:15px;">
      ${deposits.length === 0 ? '<p>No deposit requests found.</p>' : deposits.map(d => `
        <section class="yw-normal-card" style="margin-bottom:12px; border-left:4px solid ${d.status === 'Completed' ? '#00d26a' : '#facc15'};">
          <div>
            <strong>ID: ${d.id}</strong> (User: ${d.uid} - ${escapeHtml(d.name || '')})<br>
            Amount: <strong style="color:#00d26a;">₹${d.amount}</strong> (+₹${d.bonus || 0} Bonus) | UTR: <strong>${escapeHtml(d.utr)}</strong><br>
            <small style="color:#64748b;">Date: ${d.date || d.createdAt} | Status: <strong>${d.status}</strong></small>
          </div>
          ${d.status === 'Pending' ? `
            <div style="margin-top:10px; display:flex; gap:8px;">
              <button class="main-btn" style="background:#00d26a; padding:6px 12px; font-size:12px; width:auto;" onclick="window.approveDep('${d.id}', 'Completed')">Approve & Add Balance</button>
              <button class="main-btn" style="background:#ef4444; padding:6px 12px; font-size:12px; width:auto;" onclick="window.approveDep('${d.id}', 'Rejected')">Reject Deposit</button>
            </div>
          ` : ''}
        </section>
      `).join('')}
    </div>
  `
}

window.approveDep = function(id, status) {
  const res = updateAdminDepositStatus(id, status)
  if (res.success) {
    showToast(res.message, 'success')
    adminDepositsPanel()
  } else {
    showToast(res.message, 'error')
  }
}

function adminWinLossControl() {
  const state = getAdminState()

  function getOptionsHtml(curVal) {
    let opts = `
      <option value="">Random (Normal Mode)</option>
      <option value="GREEN" ${curVal === 'GREEN' ? 'selected' : ''}>Force GREEN Win</option>
      <option value="RED" ${curVal === 'RED' ? 'selected' : ''}>Force RED Win</option>
      <option value="VIOLET" ${curVal === 'VIOLET' ? 'selected' : ''}>Force VIOLET Win</option>
      <option value="BIG" ${curVal === 'BIG' ? 'selected' : ''}>Force BIG Win</option>
      <option value="SMALL" ${curVal === 'SMALL' ? 'selected' : ''}>Force SMALL Win</option>
    `
    for (let n = 0; n <= 9; n++) {
      opts += `<option value="${n}" ${String(curVal) === String(n) ? 'selected' : ''}>Number ${n}</option>`
    }
    return opts
  }

  document.querySelector('#adminContent').innerHTML = `
    <h1>All Games Win / Loss Control</h1>
    
    <section class="yw-normal-card" style="margin-bottom:15px;">
      <h3 style="color:#00d26a;">🎯 Wingo 30 Sec Control</h3>
      <select id="ctrlWingo30" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px;">
        ${getOptionsHtml(state.modeForcedResults?.wingo30)}
      </select>
    </section>

    <section class="yw-normal-card" style="margin-bottom:15px;">
      <h3 style="color:#00d26a;">🎯 Wingo 1 Min Control</h3>
      <select id="ctrlWingo60" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px;">
        ${getOptionsHtml(state.modeForcedResults?.wingo60)}
      </select>
    </section>

    <section class="yw-normal-card" style="margin-bottom:15px;">
      <h3 style="color:#00d26a;">🎯 Wingo 3 Min Control</h3>
      <select id="ctrlWingo180" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px;">
        ${getOptionsHtml(state.modeForcedResults?.wingo180)}
      </select>
    </section>

    <section class="yw-normal-card" style="margin-bottom:15px;">
      <h3 style="color:#00d26a;">🎯 Wingo 5 Min Control</h3>
      <select id="ctrlWingo300" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px;">
        ${getOptionsHtml(state.modeForcedResults?.wingo300)}
      </select>
    </section>

    <section class="yw-normal-card" style="margin-bottom:15px;">
      <h3 style="color:#3b82f6;">✈️ Aviator Crash Point Control</h3>
      <input id="ctrlAviator" type="number" step="0.1" placeholder="Force Crash At (e.g. 1.2, 5.0) Leave empty for Random" value="${state.modeForcedResults?.aviator || ''}" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; margin-top:5px;">
    </section>

    <button id="saveAllModesBtn" class="main-btn" style="padding:14px; font-size:15px;">Save All Controls</button>
  `

  document.querySelector('#saveAllModesBtn').onclick = () => {
    const v30 = document.querySelector('#ctrlWingo30').value
    const v60 = document.querySelector('#ctrlWingo60').value
    const v180 = document.querySelector('#ctrlWingo180').value
    const v300 = document.querySelector('#ctrlWingo300').value
    const av = document.querySelector('#ctrlAviator').value

    setModeForcedResult('wingo30', v30 === '' ? null : v30)
    setModeForcedResult('wingo60', v60 === '' ? null : v60)
    setModeForcedResult('wingo180', v180 === '' ? null : v180)
    setModeForcedResult('wingo300', v300 === '' ? null : v300)
    setAviatorCrashPoint(av === '' ? null : av)

    showToast('All Game Controls Saved Successfully!', 'success')
  }
}

function adminDemoId() {
  document.querySelector('#adminContent').innerHTML = `
    <h1>Create Demo ID</h1>
    <section class="yw-normal-card">
      <input id="demoName" placeholder="Name" style="width:100%; padding:10px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <input id="demoPhone" maxlength="10" placeholder="Mobile number" style="width:100%; padding:10px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <input id="demoPassword" placeholder="Password" style="width:100%; padding:10px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <select id="demoRole" style="width:100%; padding:10px; margin-bottom:12px; border:1px solid #cbd5e1; border-radius:6px;">
        <option value="USER">Player</option>
        <option value="AGENT">Agent</option>
      </select>
      <button id="createDemoBtn" class="main-btn">Create ID</button>
      <p id="demoCreated" style="margin-top:10px; font-weight:bold; color:#00d26a;"></p>
    </section>
  `

  document.querySelector('#createDemoBtn').onclick = () => {
    const result = createDemoId(
      document.querySelector('#demoName').value,
      document.querySelector('#demoPhone').value,
      document.querySelector('#demoPassword').value,
      document.querySelector('#demoRole').value
    )

    if (!result.success) {
      showToast(result.message, 'error')
      return
    }

    document.querySelector('#demoCreated').innerHTML = `
      ID Created ✅<br>
      Phone: ${escapeHtml(result.user.phone)}<br>
      Password: ${escapeHtml(result.user.password)}
    `
  }
}

function adminPlayers() {
  const players = getAllUsers().filter(user => user.role === 'USER')

  document.querySelector('#adminContent').innerHTML = `
    <h1>Players</h1>
    ${
      players.length
        ? players
            .map(
              user => `
                <section class="yw-normal-card">
                  <h3>${escapeHtml(user.name)}</h3>
                  <p>${escapeHtml(user.phone)}</p>
                  <p>Balance: ₹${Number(user.balance || 0).toLocaleString()}</p>
                  <input id="adjust-${user.id}" type="number" placeholder="Balance change" style="width:100%; padding:8px; margin:8px 0; border:1px solid #cbd5e1; border-radius:6px;">
                  <button data-player="${user.id}" class="main-btn">Apply</button>
                </section>
              `
            )
            .join('')
        : '<p>No players.</p>'
    }
  `

  document.querySelectorAll('[data-player]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.player
      const change = Number(
        document.querySelector(`#adjust-${id}`).value
      )
      const result = adjustDemoBalance(id, change)

      if (!result.success) {
        showToast(result.message, 'error')
        return
      }
      adminPlayers()
    }
  })
}

function adminAgents() {
  const agents = getAllUsers().filter(user => user.role === 'AGENT')

  document.querySelector('#adminContent').innerHTML = `
    <h1>Agents</h1>
    ${
      agents.length
        ? agents
            .map(
              agent => `
                <section class="yw-normal-card">
                  <h3>${escapeHtml(agent.name)}</h3>
                  <p>${escapeHtml(agent.phone)}</p>
                  <p>Balance: ₹${Number(agent.balance || 0).toLocaleString()}</p>
                  <input id="salary-${agent.id}" type="number" placeholder="Salary coins" style="width:100%; padding:8px; margin:8px 0; border:1px solid #cbd5e1; border-radius:6px;">
                  <button data-agent="${agent.id}" class="main-btn">Add Salary</button>
                </section>
              `
            )
            .join('')
        : '<p>No agents.</p>'
    }
  `

  document.querySelectorAll('[data-agent]').forEach(button => {
    button.onclick = () => {
      const id = button.dataset.agent
      const amount = Number(
        document.querySelector(`#salary-${id}`).value
      )
      const result = payAgentDemoSalary(id, amount)

      if (!result.success) {
        showToast(result.message, 'error')
        return
      }
      adminAgents()
    }
  })
}

function adminGames() {
  const state = getAdminState()
  const games = [
    ...modes.map(mode => ({ key: mode.key, name: mode.name })),
    { key: 'aviator', name: 'Aviator' }
  ]

  document.querySelector('#adminContent').innerHTML = `
    <h1>Game Control</h1>
    ${games
      .map(
        game => `
          <section class="yw-normal-card">
            <h3>${game.name}</h3>
            <label style="display:block; margin:6px 0;">
              Enable Game
              <input type="checkbox" data-enable="${game.key}" ${
                state.games?.[game.key] !== false ? 'checked' : ''
              }>
            </label>
            <label style="display:block; margin:6px 0;">
              Lock Game
              <input type="checkbox" data-lock="${game.key}" ${
                state.lockedGames?.[game.key] === true ? 'checked' : ''
              }>
            </label>
          </section>
        `
      )
      .join('')}
  `

  document.querySelectorAll('[data-enable]').forEach(input => {
    input.onchange = () => {
      setGameEnabled(input.dataset.enable, input.checked)
    }
  })

  document.querySelectorAll('[data-lock]').forEach(input => {
    input.onchange = () => {
      setGameLocked(input.dataset.lock, input.checked)
    }
  })
}

function adminGiftCodes() {
  const state = getAdminState()

  document.querySelector('#adminContent').innerHTML = `
    <h1>Gift Codes</h1>
    <section class="yw-normal-card">
      <input id="giftAdminCode" placeholder="Gift code" style="width:100%; padding:8px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <input id="giftAdminCoins" type="number" placeholder="Coins" style="width:100%; padding:8px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <input id="giftAdminUses" type="number" placeholder="Maximum uses" style="width:100%; padding:8px; margin-bottom:8px; border:1px solid #cbd5e1; border-radius:6px;">
      <button id="createGiftBtn" class="main-btn">Create Gift Code</button>
    </section>

    ${state.giftCodes
      .map(
        gift => `
          <section class="yw-normal-card">
            <strong>${escapeHtml(gift.code)}</strong>
            <p>Reward: ${gift.coins} Coins</p>
            <p>Used: ${gift.used} / ${gift.maxUses}</p>
            <label>
              Enabled
              <input type="checkbox" data-gift="${gift.code}" ${
                gift.enabled ? 'checked' : ''
              }>
            </label>
          </section>
        `
      )
      .join('')}
  `

  document.querySelector('#createGiftBtn').onclick = () => {
    const result = createGiftCode(
      document.querySelector('#giftAdminCode').value,
      document.querySelector('#giftAdminCoins').value,
      document.querySelector('#giftAdminUses').value
    )

    if (!result.success) {
      showToast(result.message, 'error')
      return
    }
    adminGiftCodes()
  }

  document.querySelectorAll('[data-gift]').forEach(input => {
    input.onchange = () => {
      toggleGiftCode(input.dataset.gift, input.checked)
    }
  })
}

function adminAnnouncement() {
  const state = getAdminState()

  document.querySelector('#adminContent').innerHTML = `
    <h1>Announcement</h1>
    <section class="yw-normal-card">
      <textarea id="announcementText" rows="6" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:6px; margin-bottom:10px;">${escapeHtml(
        state.announcement || ''
      )}</textarea>
      <button id="saveAnnouncement" class="main-btn">Save Announcement</button>
    </section>
  `

  document.querySelector('#saveAnnouncement').onclick = () => {
    setAnnouncement(document.querySelector('#announcementText').value)
    showToast('Announcement saved', 'success')
  }
}

/* =========================
   INITIAL APP BOOTSTRAP
========================= */

setInterval(
  () => {
    if (currentPage !== 'wingo') return

    const timer = document.querySelector('#timer')
    if (!timer) return

    timeLeft--

    if (timeLeft <= 0) {
      finishRound()
    }

    const currentTimer = document.querySelector('#timer')
    if (currentTimer) {
      currentTimer.textContent = formatTime(timeLeft)
    }
  },
  1000
)

const currentUser = getCurrentUser()

if (!currentUser) {
  showLogin()
} else if (isAdmin(currentUser)) {
  showAdmin()
} else {
  showHome()
}