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
    background: rgba(0,0,0,0.85); backdrop-filter: blur(5px);
    display: grid; place-items: center; z-index: 999999;
  `
  modal.innerHTML = `
    <div style="background: linear-gradient(145deg, #1e293b, #0f172a); border: 1px solid #f59e0b; padding: 25px; border-radius: 16px; width: 90%; max-width: 320px; text-align: center; color: #fff; box-shadow: 0 10px 25px rgba(245, 158, 11, 0.2);">
      <div style="font-size: 50px; margin-bottom: 10px;">⚠️</div>
      <h3 style="color: #facc15; margin-bottom: 8px; font-size: 20px;">Recharge Required</h3>
      <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5; margin-bottom: 20px;">
        Game me play karne ke liye minimum <strong>₹100</strong> ka deposit zaroori hai. Kripya pehle recharge karein.
      </p>
      <div style="display: flex; gap: 10px;">
        <button id="cancelPromptBtn" style="flex: 1; padding: 10px; background: #334155; border: none; border-radius: 8px; color: #fff; font-weight: bold; cursor: pointer;">Cancel</button>
        <button id="goToDepositBtn" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; border-radius: 8px; color: #fff; font-weight: bold; cursor: pointer;">Deposit ₹100</button>
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
   91 CLUB STYLE SEPARATE DEPOSIT GATEWAY (Opens in New Tab)
========================= */

function openDepositGateway(amount, channel = 'UPI Fast Pay') {
  const user = getCurrentUser()
  if (!user) {
    showToast('Please login first!', 'error')
    return
  }

  const bonus = Math.floor(amount * 0.10)
  const orderId = 'ORD-' + Date.now() + '-' + Math.floor(1000 + Math.random() * 9000)
  const upiId = 'ayush122312@ybl'
  const upiPayUrl = `upi://pay?pa=${upiId}&pn=YaarWinClub&am=${amount}&cu=INR&tn=Deposit_${orderId}`

  const gatewayHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Gateway - YaarWin / 91 Club</title>
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
          <h2 style="color:#00d26a; font-weight:900;">👑 YaarWin Secure Gateway</h2>
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
          <button id="submitUtrBtn" class="submit-btn">Submit UTR for Instant Credit</button>
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
    <nav class="bottom-nav">
      <button id="navHome" class="${active === 'home' ? 'active' : ''}">🏠 <span>Home</span></button>
      <button id="navActivity" class="${active === 'activity' ? 'active' : ''}">📋 <span>Activity</span></button>
      <button id="navPromotion" class="${active === 'promotion' ? 'active' : ''}">🎁 <span>Promotion</span></button>
      <button id="navWallet" class="${active === 'wallet' ? 'active' : ''}">👛 <span>Wallet</span></button>
      <button id="navAccount" class="${active === 'account' ? 'active' : ''}">👤 <span>Account</span></button>
    </nav>
  `
}

function connectNavigation() {
  setTimeout(() => {
    const h = document.querySelector('#navHome')
    const a = document.querySelector('#navActivity')
    const p = document.querySelector('#navPromotion')
    const w = document.querySelector('#navWallet')
    const acc = document.querySelector('#navAccount')

    if (h) h.onclick = showHome
    if (a) a.onclick = showActivity
    if (p) p.onclick = showPromotion
    if (w) w.onclick = showWallet
    if (acc) acc.onclick = showAccount
  }, 50)
}

/* =========================
   AUTHENTICATION VIEWS (91 Club Style)
========================= */

function showAuthTab(type = 'login') {
  currentPage = type
  stopAllSpecialTimers()

  const urlParams = new URLSearchParams(window.location.search)
  const inviteFromUrl = urlParams.get('invite') || ''

  app().innerHTML = `
    <div class="auth-wrap" style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at top, #1e293b, #090d16); padding: 15px;">
      <div class="auth-card" style="background: #111827; border: 1px solid #1f2937; border-radius: 20px; width: 100%; max-width: 380px; padding: 25px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="font-size: 38px; margin-bottom: 4px;">👑</div>
          <h1 style="color: #facc15; font-size: 24px; font-weight: 900; letter-spacing: 1px;">KIVORO CLUB</h1>
          <p style="color: #94a3b8; font-size: 13px;">Official Gaming & Earning Platform</p>
        </div>

        <div style="display: flex; background: #0f172a; border-radius: 12px; padding: 4px; margin-bottom: 20px; border: 1px solid #334155;">
          <button id="tabLoginBtn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.3s; background: ${type === 'login' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent'}; color: ${type === 'login' ? '#fff' : '#94a3b8'};">Login</button>
          <button id="tabRegBtn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.3s; background: ${type === 'register' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent'}; color: ${type === 'register' ? '#fff' : '#94a3b8'};">Register</button>
        </div>

        <div id="authFormArea">
          ${
            type === 'login'
              ? `
            <div class="phone-box" style="display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 0 12px; margin-bottom: 12px;">
              <span style="color: #facc15; font-weight: bold; margin-right: 8px;">+91</span>
              <input id="loginPhone" maxlength="10" inputmode="numeric" placeholder="Mobile Number" style="flex: 1; background: transparent; border: none; color: #fff; padding: 12px 0; outline: none; font-size: 14px;">
            </div>
            <input id="loginPassword" type="password" placeholder="Password" style="width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #fff; padding: 12px; margin-bottom: 18px; outline: none; font-size: 14px;">
            <button id="loginBtn" class="main-btn" style="width: 100%; padding: 12px; font-size: 16px; font-weight: bold; border-radius: 10px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; border: none; cursor: pointer;">Log in</button>
          `
              : `
            <input id="regName" placeholder="Full Name" style="width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #fff; padding: 12px; margin-bottom: 12px; outline: none; font-size: 14px;">
            <div class="phone-box" style="display: flex; align-items: center; background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 0 12px; margin-bottom: 12px;">
              <span style="color: #facc15; font-weight: bold; margin-right: 8px;">+91</span>
              <input id="regPhone" maxlength="10" inputmode="numeric" placeholder="Mobile Number" style="flex: 1; background: transparent; border: none; color: #fff; padding: 12px 0; outline: none; font-size: 14px;">
            </div>
            <input id="regPassword" type="password" placeholder="Set Password" style="width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #fff; padding: 12px; margin-bottom: 12px; outline: none; font-size: 14px;">
            <input id="regInvite" placeholder="Invite Code (Optional)" value="${escapeHtml(inviteFromUrl)}" style="width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 10px; color: #fff; padding: 12px; margin-bottom: 18px; outline: none; font-size: 14px;">
            <button id="registerBtn" class="main-btn" style="width: 100%; padding: 12px; font-size: 16px; font-weight: bold; border-radius: 10px; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; cursor: pointer;">Create Account</button>
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
   HOME SCREEN
========================= */

function showHome() {
  stopAllSpecialTimers()
  if (liveTickerInterval) clearInterval(liveTickerInterval)

  const user = getCurrentUser()

  if (!user) {
    showLogin()
    return
  }

  if (isAdmin(user)) {
    showAdmin()
    return
  }

  currentPage = 'home'
  const admin = getAdminState()

  app().innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div>
          <h2 style="color:#facc15; font-weight:900;">👑 Kivoro Club</h2>
          <small style="color:#94a3b8;">UID: ${escapeHtml(user.id)}</small>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="supportBtn" style="background:#2563eb; border:none; padding:6px 12px; border-radius:6px; color:#fff; font-size:12px; font-weight:bold; cursor:pointer;">🎧 Support</button>
          <div class="balance-box" style="background:#1e293b; padding:6px 12px; border-radius:8px; border:1px solid #334155;">
            <span style="font-size:10px; color:#94a3b8; display:block;">Balance</span>
            <strong style="color:#22c55e;">₹${getBalance().toLocaleString()}</strong>
          </div>
        </div>
      </header>

      ${
        admin.announcement
          ? `<div class="announcement">📢 ${escapeHtml(admin.announcement)}</div>`
          : ''
      }

      <!-- Live 91 Club Style Winning Marquee -->
      <section style="background:#0f172a; padding:8px 12px; border-radius:10px; margin:10px 0; border-left:4px solid #f59e0b; display:flex; align-items:center; gap:8px; font-size:12px; overflow:hidden;">
        <span style="color:#f59e0b; font-weight:bold; white-space:nowrap;">🔥 LIVE WINS:</span>
        <div id="liveWinnerTicker" style="color:#cbd5e1; white-space:nowrap; transition: all 0.5s ease;">
          User 98***71 won ₹450 in Wingo 30s
        </div>
      </section>

      <section class="home-banner" style="background: linear-gradient(135deg, #1e3a8a, #0f172a); border-radius:14px; padding:15px; margin-bottom:15px; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <h1 style="font-size:20px; color:#facc15; margin-bottom:4px;">Lottery & Casino</h1>
          <p style="font-size:12px; color:#cbd5e1;">Fair, Secure & Instant Payouts</p>
          <button id="quickRechargeHome" style="margin-top:8px; background:#10b981; border:none; color:#fff; padding:6px 12px; border-radius:6px; font-size:12px; font-weight:bold; cursor:pointer;">➕ Quick Deposit</button>
        </div>
        <span style="font-size:45px;">🎰</span>
      </section>

      <h2 class="section-title">Wingo Color Prediction</h2>

      <section class="game-grid">
        ${modes
          .map(mode => {
            const enabled = admin.games?.[mode.key] !== false
            const locked = admin.lockedGames?.[mode.key] === true

            return `
              <button class="game-card" data-mode="${mode.seconds}" data-key="${mode.key}">
                <span>⏱️</span>
                <strong>${mode.name}</strong>
                <small>${!enabled ? 'Disabled' : locked ? 'Locked' : 'Play Now'}</small>
              </button>
            `
          })
          .join('')}
      </section>

      <h2 class="section-title">Casino & Mini Games</h2>

      <section class="more-games">
        <button class="mini-game" data-mini="Dice">🎲 <strong>Dice</strong></button>
        <button class="mini-game" data-mini="Number Game">🔢 <strong>Number Game</strong></button>
        <button class="mini-game" data-mini="Coin Flip">🪙 <strong>Coin Flip</strong></button>
        <button class="mini-game" data-mini="Lucky Wheel">🎡 <strong>Lucky Wheel</strong></button>
        <button id="aviatorBtn" class="mini-game">✈️ <strong>Aviator</strong></button>
      </section>

      ${navigation('home')}
    </div>
  `

  document.querySelector('#supportBtn').onclick = openCustomerService
  document.querySelector('#quickRechargeHome').onclick = () => {
    showWallet()
    setTimeout(() => {
      document.querySelector('#depositBtn')?.click()
    }, 100)
  }

  // Wingo Entry with ₹100 balance check
  document.querySelectorAll('[data-mode]').forEach(button => {
    button.onclick = () => {
      const modeSec = Number(button.dataset.mode)
      const modeKey = button.dataset.key

      const state = getAdminState()
      if (state.lockedGames?.[modeKey]) {
        showToast('Game currently locked', 'error')
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

  // Mini Games Entry with ₹100 balance check
  document.querySelectorAll('[data-mini]').forEach(button => {
    button.onclick = () => {
      const gName = button.dataset.mini
      checkGameEntry(() => {
        showMiniGame(gName)
      })
    }
  })

  // Aviator Entry with ₹100 balance check
  const avBtn = document.querySelector('#aviatorBtn')
  if (avBtn) {
    avBtn.onclick = (e) => {
      e.preventDefault()
      checkGameEntry(() => {
        showAviator()
      })
    }
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
        el.innerHTML = `User <strong style="color:#facc15;">${u}</strong> won <strong style="color:#22c55e;">₹${p}</strong> in ${g}`
        el.style.opacity = '1'
      }, 300)
    }
  }, 3500)
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
      <header class="game-header">
        <button id="miniBack">←</button>
        <div>
          <strong>${escapeHtml(name)}</strong>
          <small>Mini Game Center</small>
        </div>
        <div class="game-balance" id="miniBalanceDisplay">
          ${getBalance().toLocaleString()} 🪙
        </div>
      </header>

      <section class="normal-card" style="text-align:center;">
        <div id="miniDisplay" style="min-height:140px; display:grid; place-items:center; font-size:65px; margin-bottom:15px;">🎮</div>
        
        <h3>Select Amount</h3>
        <div class="amount-buttons" style="margin-bottom:10px; display:flex; justify-content:center; gap:6px; flex-wrap:wrap;">
          <button class="amount-choice m-amt" data-amount="10">10</button>
          <button class="amount-choice m-amt" data-amount="50">50</button>
          <button class="amount-choice m-amt selected" data-amount="100">100</button>
          <button class="amount-choice m-amt" data-amount="500">500</button>
          <button class="amount-choice m-amt" data-amount="1000">1000</button>
        </div>

        <button id="miniPlayBtn" class="main-btn" style="margin-bottom:15px;">Play & Win</button>
        <h2 id="miniResult" style="font-size:18px; font-weight:bold;">Ready to Play</h2>
      </section>
    </div>
  `

  document.querySelector('#miniBack').onclick = showHome

  document.querySelectorAll('.m-amt').forEach(btn => {
    btn.onclick = (e) => {
      document.querySelectorAll('.m-amt').forEach(b => b.classList.remove('selected'))
      e.target.classList.add('selected')
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
    document.querySelector('#miniBalanceDisplay').textContent = `${getBalance().toLocaleString()} 🪙`

    const display = document.querySelector('#miniDisplay')
    const result = document.querySelector('#miniResult')
    
    display.textContent = '🎲 ...'
    result.textContent = 'Wait for results...'

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
        const vals = new Array(1, 2, 5, 10)
        const val = vals[Math.floor(Math.random() * vals.length)]
        display.textContent = `🎡 ${val}x`
        isWin = isWin && val >= 2
        winCoins = isWin ? miniBetAmt * val : 0
        outcome = `Multiplier ${val}x`
      }

      const user = getCurrentUser()
      if (isWin && winCoins > 0) {
        setBalance(getBalance() + winCoins)
        document.querySelector('#miniBalanceDisplay').textContent = `${getBalance().toLocaleString()} 🪙`
        result.innerHTML = `<span style="color:#22c55e;">WIN! +${winCoins} Coins (${outcome})</span>`
        showToast(`Congratulations! You won ${winCoins} coins`, 'success')
        saveUserBetRecord(user.id, { game: name, bet: miniBetAmt, result: 'WIN', payout: winCoins, date: new Date().toLocaleString() })
      } else {
        result.innerHTML = `<span style="color:#ef4444;">LOSS! -${miniBetAmt} Coins (${outcome})</span>`
        showToast(`Better luck next time!`, 'error')
        saveUserBetRecord(user.id, { game: name, bet: miniBetAmt, result: 'LOSS', payout: 0, date: new Date().toLocaleString() })
      }
    }, 800)
  }
}

/* =========================
   WINGO ENGINE (With 0-9 Colored Circular Balls)
========================= */

function showWingo() {
  currentPage = 'wingo'
  stopAllSpecialTimers()

  app().innerHTML = `
    <div class="app-shell">
      <header class="game-header">
        <button id="backBtn">←</button>
        <div>
          <strong>${getModeName()}</strong>
          <small>Live round</small>
        </div>
        <div class="game-balance" id="topBalanceDisplay">
          ${getBalance().toLocaleString()} 🪙
        </div>
      </header>

      <section class="round-panel">
        <div>
          <span>Period</span>
          <strong id="period">${period}</strong>
        </div>
        <div class="timer-area">
          <span>Time Remaining</span>
          <strong id="timer">${formatTime(timeLeft)}</strong>
        </div>
      </section>

      <section class="normal-card">
        <div id="wingoStatus" style="text-align:center; padding:12px; border-radius:14px; background:#16263b; margin-bottom:15px; font-weight:bold; border:1px solid #334155;">
          Round running
        </div>

        <h3>Choose Color</h3>
        <section class="color-buttons">
          <button class="choice green" data-choice="GREEN">Green</button>
          <button class="choice violet" data-choice="VIOLET">Violet</button>
          <button class="choice red" data-choice="RED">Red</button>
        </section>

        <h3>Choose Number</h3>
        <section class="number-grid" style="display:grid; grid-template-columns:repeat(5, 1fr); gap:8px; margin:10px 0;">
          <button class="number num-ball dual-violet-red" data-choice="0">0</button>
          <button class="number num-ball green" data-choice="1">1</button>
          <button class="number num-ball red" data-choice="2">2</button>
          <button class="number num-ball green" data-choice="3">3</button>
          <button class="number num-ball red" data-choice="4">4</button>
          <button class="number num-ball dual-violet-green" data-choice="5">5</button>
          <button class="number num-ball red" data-choice="6">6</button>
          <button class="number num-ball green" data-choice="7">7</button>
          <button class="number num-ball red" data-choice="8">8</button>
          <button class="number num-ball green" data-choice="9">9</button>
        </section>

        <h3>Choose Size</h3>
        <section class="size-buttons">
          <button class="choice big" data-choice="BIG">Big</button>
          <button class="choice small" data-choice="SMALL">Small</button>
        </section>

        <h3>Select Multiplier</h3>
        <div class="multiplier-row" style="display:flex; gap:6px; overflow-x:auto; padding:6px 0; margin-bottom:10px;">
          <button class="mul-chip active" data-mul="1">X1</button>
          <button class="mul-chip" data-mul="5">X5</button>
          <button class="mul-chip" data-mul="10">X10</button>
          <button class="mul-chip" data-mul="20">X20</button>
          <button class="mul-chip" data-mul="50">X50</button>
          <button class="mul-chip" data-mul="100">X100</button>
        </div>

        <h3>Select Base Amount</h3>
        <div class="amount-buttons" style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="amount-choice selected" data-amount="10">10</button>
          <button class="amount-choice" data-amount="50">50</button>
          <button class="amount-choice" data-amount="100">100</button>
          <button class="amount-choice" data-amount="500">500</button>
          <button class="amount-choice" data-amount="1000">1000</button>
        </div>

        <div class="custom-amount" style="margin-top:10px; display:flex; gap:8px;">
          <button id="amountMinus" style="padding:8px 14px; background:#334155; border:none; color:#fff; border-radius:6px;">−</button>
          <input id="gameAmount" type="number" min="10" step="10" value="10" style="flex:1; padding:8px; background:#0f172a; border:1px solid #334155; color:#fff; border-radius:6px; text-align:center;">
          <button id="amountPlus" style="padding:8px 14px; background:#334155; border:none; color:#fff; border-radius:6px;">+</button>
        </div>

        <p id="amountStatus" style="text-align:center; font-weight:700; margin-top:8px;">Selected Amount: 10 (Total: ₹10)</p>

        <div class="bet-summary">
          <span>Selected</span>
          <strong id="selection">${selectedChoice ? selectedChoice : 'Choose option'}</strong>
        </div>

        <button id="lockPredictionBtn" class="main-btn">Lock Prediction</button>
        <p id="predictionStatus" style="text-align:center; font-weight:700;"></p>
      </section>

      <section class="history-panel">
        <h2>Bet History & Previous Results</h2>
        <div id="history"></div>
      </section>
    </div>
  `

  selectedAmount = 10
  selectedMultiplier = 1

  document.querySelector('#backBtn').onclick = () => {
    stopAllSpecialTimers()
    showHome()
  }

  document.querySelectorAll('[data-choice]').forEach(button => {
    button.onclick = () => {
      if (timeLeft <= 5) {
        showToast('Round Locked!', 'error')
        return
      }
      if (lockedPrediction) return

      selectedChoice = String(button.dataset.choice)
      document.querySelectorAll('[data-choice]').forEach(item => {
        item.classList.remove('selected')
      })
      button.classList.add('selected')
      updateSelection()
    }
  })

  document.querySelectorAll('[data-mul]').forEach(button => {
    button.onclick = () => {
      selectedMultiplier = Number(button.dataset.mul)
      document.querySelectorAll('[data-mul]').forEach(item => item.classList.remove('active'))
      button.classList.add('active')
      updateAmountStatus()
    }
  })

  document.querySelectorAll('[data-amount]').forEach(button => {
    button.onclick = () => {
      selectedAmount = Number(button.dataset.amount)
      document.querySelectorAll('[data-amount]').forEach(item => {
        item.classList.remove('selected')
      })
      button.classList.add('selected')
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
    selectedAmount = Number(e.target.value) || 0
    updateAmountStatus()
  }

  function updateAmountStatus() {
    const total = selectedAmount * selectedMultiplier
    const amountStatus = document.querySelector('#amountStatus')
    if (amountStatus) amountStatus.textContent = `Selected Amount: ${selectedAmount} x ${selectedMultiplier} (Total: ₹${total})`
  }

  const lockBtn = document.querySelector('#lockPredictionBtn')
  if (lockBtn) {
    lockBtn.onclick = lockPrediction
  }

  updateSelection()
  updatePredictionButton()
  renderHistory()

  wingoInterval = setInterval(() => {
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

    const balDisplay = document.querySelector('#topBalanceDisplay')
    if (balDisplay) {
      balDisplay.textContent = `${getBalance().toLocaleString()} 🪙`
    }

    updatePredictionButton()
  }, 1000)
}

function lockPrediction() {
  if (timeLeft <= 5) {
    showToast('Round Locked!', 'error')
    return
  }

  if (!selectedChoice) {
    showToast('Pehle Color, Number ya Size select karein!', 'error')
    return
  }

  if (lockedPrediction) {
    showToast('Prediction already locked for this round!', 'error')
    return
  }

  const currentBalance = getBalance()
  const totalBet = selectedAmount * selectedMultiplier

  if (totalBet <= 0) {
    showToast('Valid amount select karein!', 'error')
    return
  }

  if (totalBet > currentBalance) {
    showToast('Insufficient balance!', 'error')
    return
  }

  setBalance(currentBalance - totalBet)
  
  lockedPrediction = {
    choice: selectedChoice,
    amount: totalBet,
    period: period
  }

  const status = document.querySelector('#predictionStatus')
  if (status) {
    status.textContent = `Wait for results... Locked: ${selectedChoice} (${totalBet} Coins)`
  }

  showToast('Bet placed successfully! Wait for results.', 'success')
  updatePredictionButton()
}

function getResult(number) {
  let color = 'RED'
  if (number === 0 || number === 5) {
    color = 'VIOLET'
  } else if (number === 1 || number === 3 || number === 7 || number === 9) {
    color = 'GREEN'
  }

  return {
    color,
    size: number >= 5 ? 'BIG' : 'SMALL'
  }
}

function checkMatch(choice, number, result) {
  if (String(choice) === String(number)) {
    return true
  }
  if (choice === result.color) {
    return true
  }
  if (choice === result.size) {
    return true
  }
  return false
}

function finishRound() {
  const adminState = getAdminState()
  let number

  let forced = null
  if (currentMode === 30) forced = adminState.modeForcedResults?.wingo30
  else if (currentMode === 60) forced = adminState.modeForcedResults?.wingo60
  else if (currentMode === 180) forced = adminState.modeForcedResults?.wingo180
  else if (currentMode === 300) forced = adminState.modeForcedResults?.wingo300

  if (forced === null || forced === undefined || forced === '') {
    forced = adminState.forcedResult
  }

  if (forced !== null && forced !== undefined && forced !== '') {
    const fStr = String(forced).toUpperCase()
    if (!isNaN(fStr)) {
      number = Number(fStr)
    } else if (fStr === 'GREEN') {
      number = 1
    } else if (fStr === 'RED') {
      number = 2
    } else if (fStr === 'VIOLET') {
      number = 0
    } else if (fStr === 'BIG') {
      number = 5
    } else if (fStr === 'SMALL') {
      number = 2
    } else {
      number = Math.floor(Math.random() * 10)
    }
  } else {
    number = Math.floor(Math.random() * 10)
  }

  const result = getResult(number)
  let matched = null
  let winAmount = 0
  const user = getCurrentUser()

  if (lockedPrediction) {
    matched = checkMatch(lockedPrediction.choice, number, result)

    if (matched) {
      let multiplier = 2
      if (!isNaN(lockedPrediction.choice) && String(lockedPrediction.choice).trim() !== '') {
        multiplier = 9
      }
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

  history.unshift({
    period,
    number,
    color: result.color,
    size: result.size,
    matched
  })

  saveHistory()

  const currentResult = {
    number,
    color: result.color,
    size: result.size
  }

  const status = document.querySelector('#wingoStatus')
  if (status) {
    status.textContent = `Result: ${number} • ${result.color} • ${result.size}`
  }

  if (lockedPrediction) {
    showResultPopup(matched, currentResult, winAmount)
  }

  period++
  savePeriod()
  timeLeft = currentMode
  selectedChoice = null
  lockedPrediction = null

  const periodBox = document.querySelector('#period')
  if (periodBox) {
    periodBox.textContent = period
  }

  document.querySelectorAll('[data-choice]').forEach(item => {
    item.classList.remove('selected')
  })

  const predictionStatus = document.querySelector('#predictionStatus')
  if (predictionStatus) {
    predictionStatus.textContent = ''
  }

  updateSelection()
  updatePredictionButton()
  renderHistory()
}

function updateSelection() {
  const box = document.querySelector('#selection')
  if (!box) return
  box.textContent = selectedChoice ? selectedChoice : 'Choose option'
}

function updatePredictionButton() {
  const button = document.querySelector('#lockPredictionBtn')
  if (!button) return

  const roundLocked = timeLeft <= 5

  document.querySelectorAll('[data-choice]').forEach(item => {
    item.disabled = roundLocked || !!lockedPrediction
  })

  if (roundLocked) {
    button.disabled = true
    button.textContent = 'Round Locked'
    return
  }

  if (lockedPrediction) {
    button.disabled = true
    button.textContent = 'Wait for results...'
    return
  }

  button.disabled = false
  button.textContent = 'Lock Prediction'
}

function renderHistory() {
  const box = document.querySelector('#history')
  if (!box) return

  const user = getCurrentUser()
  const userBets = user ? getUserBetRecords(user.id) : []

  let html = ''

  if (userBets.length > 0) {
    html += `<h4 style="margin:10px 0 5px 0; color:#38bdf8;">Your Recent Bets</h4>`
    html += userBets.slice(0, 5).map(b => `
      <div style="background:#111; padding:8px 12px; margin-bottom:6px; border-radius:6px; display:flex; justify-content:space-between; align-items:center; font-size:12px;">
        <div>
          <strong>${b.game}</strong> (#${b.period || '—'})<br>
          <span style="color:#aaa;">Choice: ${b.choice || '—'} | Bet: ${b.bet} Coins</span>
        </div>
        <div style="text-align:right;">
          <strong style="color:${b.result === 'WIN' ? '#22c55e' : '#ef4444'};">${b.result}</strong><br>
          <small style="color:#888;">${b.payout ? '+' + b.payout : '0'} Coins</small>
        </div>
      </div>
    `).join('')
  }

  html += `<h4 style="margin:15px 0 5px 0; color:#94a3b8;">Game Result History</h4>`
  if (history.length === 0) {
    html += `<p class="empty-history">Abhi koi previous result nahi hai.</p>`
  } else {
    html += history.slice(0, 15).map(round => `
      <div class="history-row">
        <span>#${round.period}</span>
        <strong>${round.number}</strong>
        <span>${round.color}</span>
        <span>${round.size}</span>
        <span style="font-weight:bold; color:${round.matched === true ? '#22c55e' : round.matched === false ? '#ef4444' : '#aaa'};">${
          round.matched === null || round.matched === undefined
            ? '—'
            : round.matched
            ? 'WIN'
            : 'LOSS'
        }</span>
      </div>
    `).join('')
  }

  box.innerHTML = html
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
    <div class="result-popup-card" style="background:#1e293b; border: 2px solid ${won ? '#22c55e' : '#ef4444'}; padding:30px; border-radius:20px; text-align:center; width:90%; max-width:320px; color:#fff; box-shadow:0 20px 40px rgba(0,0,0,0.8);">
      <div style="font-size:65px; margin-bottom:10px;">${won ? '🎉' : '💀'}</div>
      <h2 style="color:${won ? '#22c55e' : '#ef4444'}; font-size:26px; font-weight:900; margin-bottom:10px;">${won ? 'CONGRATULATIONS!' : 'GAME OVER'}</h2>
      <div style="font-size:42px; font-weight:900; margin:12px 0; background:#0f172a; padding:12px; border-radius:12px; border:1px solid #334155; color:#facc15;">
        ${result.number}
      </div>
      <p style="color:#cbd5e1; font-weight:bold; margin-bottom:15px;">${result.color} • ${result.size}</p>
      ${won ? `<p style="color:#22c55e; font-weight:900; font-size:18px; margin-bottom:18px; background:rgba(34,197,94,0.1); padding:8px; border-radius:8px;">+₹${payout} Won</p>` : `<p style="color:#ef4444; font-weight:bold; margin-bottom:18px;">Try Again In Next Round</p>`}
      <button id="closeResultPopup" class="main-btn" style="width:100%; padding:12px; font-size:15px; font-weight:bold; background:${won ? '#22c55e' : '#334155'};">Continue</button>
    </div>
  `

  document.body.appendChild(popup)

  document.querySelector('#closeResultPopup').onclick = () => {
    popup.remove()
  }

  setTimeout(() => {
    popup.remove()
  }, 4000)
}

/* =========================
   AVIATOR ENGINE
========================= */

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
      <header class="game-header">
        <button id="aviatorBack">←</button>
        <div>
          <strong>Aviator</strong>
          <small>Balance: <span id="avBalance">${getBalance().toLocaleString()}</span> 🪙</small>
        </div>
      </header>

      <section class="normal-card" style="text-align:center;">
        <div style="font-size:70px; margin:15px 0;">✈️</div>
        <div id="aviatorMultiplier" style="font-size:52px; font-weight:900; color:#38bdf8;">1.00x</div>
        <p id="aviatorStatus" style="font-weight:bold; color:#aaa; margin-bottom:15px;">Next round starting...</p>

        <div id="aviatorControls">
          <input id="avBetInput" type="number" value="100" min="10" placeholder="Bet Amount" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; background:#111; color:#fff; border:1px solid #333; text-align:center;">
          <button id="avBetBtn" class="main-btn" style="background:#2563eb;">Place Bet</button>
        </div>
      </section>

      <section class="history-panel">
        <h2>Previous Multipliers</h2>
        <div id="aviatorHistory"></div>
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
      betBtn.style.background = '#22c55e'
      betBtn.textContent = 'Cash Out'
      showToast(`Aviator Bet of ${amt} coins placed!`, 'success')
    } else if (isPlaying && !cashedOut) {
      cashedOut = true
      isPlaying = false
      const winVal = Math.floor(aviatorBet * currentMultiplier)
      setBalance(getBalance() + winVal)
      document.querySelector('#avBalance').textContent = getBalance().toLocaleString()
      betBtn.style.background = '#334155'
      betBtn.disabled = true
      betBtn.textContent = `Cashed Out @ ${currentMultiplier.toFixed(2)}x (+${winVal})`
      showToast(`Successfully Cashed Out! Won ${winVal} Coins`, 'success')
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
            betBtnEl.style.background = '#2563eb'
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
    box.innerHTML = '<p class="empty-history">No Aviator history yet.</p>'
    return
  }
  box.innerHTML = `<div style="display:flex; gap:8px; flex-wrap:wrap;">` + list.map(m => `
    <span style="background:#1e293b; color:#38bdf8; padding:4px 8px; border-radius:6px; font-size:12px; font-weight:bold;">${m}x</span>
  `).join('') + `</div>`
}

function showActivity() {
  stopAllSpecialTimers()
  currentPage = 'activity'

  app().innerHTML = `
    <div class="app-shell">
      <h1>Activity & Record Center</h1>
      <section class="history-panel">
        <h2>Wingo Results</h2>
        <div id="history"></div>
      </section>
      <section class="history-panel">
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
   PROMOTION & SUBORDINATE DATA (YaarWin / 91 Club Style)
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
      <h1>Promotion Center (Agency)</h1>

      <section class="wallet-card" style="background: linear-gradient(135deg, #10b981, #047857);">
        <span>Total Commission Earned</span>
        <strong id="subnode-commission-amount">₹${commissionEarned.toFixed(2)}</strong>
        <div style="display:flex; justify-content:space-around; margin-top:15px; border-top:1px solid rgba(255,255,255,0.2); padding-top:10px;">
          <div><small>Total Register</small><br><strong id="subnode-register-count">${refDetails.totalRegister}</strong></div>
          <div><small>Team Deposit</small><br><strong id="subnode-deposit-amount">₹${refDetails.totalDeposit}</strong></div>
        </div>
      </section>

      <section class="normal-card">
        <h2>Invite Friends & Earn</h2>
        <p style="font-size:13px; color:#aaa; margin-bottom:10px;">Apna referral link share karein aur dosto ki deposit ka commission paye:</p>
        
        <div style="background:#0f172a; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:12px; color:#38bdf8; word-break:break-all; margin-right:10px;">${referralLink}</span>
          <button id="copyLinkBtn" class="main-btn" style="padding:6px 12px; font-size:12px; white-space:nowrap;">Copy Link</button>
        </div>

        <div style="display:flex; gap:10px;">
          <div style="flex:1; background:#0f172a; padding:10px; border-radius:8px; text-align:center;">
            <small style="color:#aaa;">Code</small><br>
            <strong style="color:#10b981;">${escapeHtml(user.referralCode)}</strong>
          </div>
          <button id="copyCodeBtn" class="main-btn" style="flex:1; padding:8px; font-size:13px;">Copy Code</button>
        </div>
      </section>

      <section class="normal-card">
        <h2>Subordinate Data (Team Records)</h2>
        <div style="background:#0f172a; padding:12px; border-radius:8px; font-size:13px;">
          <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;">
            <span>Deposit number:</span> <strong>${refDetails.totalDepositCount || 0}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;">
            <span>Deposit amount:</span> <strong>₹${refDetails.totalDeposit || 0}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #334155;">
            <span>Number of bettors:</span> <strong>${refDetails.totalBettors || 0}</strong>
          </div>
          <div style="display:flex; justify-content:space-between; padding:6px 0;">
            <span>Total bet:</span> <strong>₹${refDetails.totalBetAmount || 0}</strong>
          </div>
        </div>
      </section>

      <section class="normal-card">
        <h2>Claim Gift Code</h2>
        <input id="giftCode" placeholder="Enter Gift Code" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#fff;">
        <button id="claimGiftBtn" class="main-btn">Claim Gift Code</button>
      </section>

      ${navigation('promotion')}
    </div>
  `

  document.querySelector('#copyLinkBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      showToast('Referral link copied successfully!', 'success')
    } catch {
      showToast(referralLink, 'info')
    }
  }

  document.querySelector('#copyCodeBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(user.referralCode)
      showToast('Referral code copied successfully!', 'success')
    } catch {
      showToast(user.referralCode, 'info')
    }
  }

  document.querySelector('#claimGiftBtn').onclick = () => {
    const result = claimGiftCode(
      document.querySelector('#giftCode').value,
      user.id
    )

    if (!result.success) {
      showToast(result.message, 'error')
      return
    }

    setBalance(getBalance() + result.coins)
    showToast(`${result.coins} coins added successfully!`, 'success')
    showPromotion()
  }

  connectNavigation()
}

/* =========================
   WALLET & DEPOSIT / WITHDRAWAL (6 Channels + 91 Club Gateway)
========================= */

function showWallet() {
  stopAllSpecialTimers()
  currentPage = 'wallet'
  const user = getCurrentUser()
  const upiStatus = getCurrentUserUpiStatus()

  app().innerHTML = `
    <div class="app-shell">
      <h1>Wallet</h1>
      <section class="wallet-card" style="background: linear-gradient(135deg, #1e293b, #0f172a); border: 1px solid #334155;">
        <span>Available Balance</span>
        <strong style="color: #22c55e; font-size: 28px;">₹${getBalance().toLocaleString()}</strong>
      </section>

      <section class="wallet-buttons">
        <button id="depositBtn">➕ <strong>Deposit</strong> <small>+10% Bonus</small></button>
        <button id="withdrawBtn">↗ <strong>Withdrawal</strong> <small>Secure</small></button>
        <button id="historyBtn">📋 <strong>History</strong> <small>Records</small></button>
      </section>

      <section class="normal-card" id="walletActionArea">
        <p>Deposit, Withdrawal ya History dekhne ke liye upar buttons par click karein.</p>
      </section>

      ${navigation('wallet')}
    </div>
  `

  document.querySelector('#depositBtn').onclick = () => {
    const actionArea = document.querySelector('#walletActionArea')
    actionArea.innerHTML = `
      <h3>Deposit Funds (10% Extra Bonus)</h3>
      <p style="font-size:12px; color:#aaa; margin-bottom:8px;">Select payment channel & pay using external UPI app, then submit UTR:</p>
      
      <!-- 91 Club Instant Gateway Button -->
      <button id="open91GatewayBtn" class="main-btn" style="background: linear-gradient(135deg, #00d26a, #047857); padding: 12px; margin-bottom: 12px; font-size: 14px; font-weight: 800;">
        ⚡ Open 91 Club Payment Gateway (New Tab)
      </button>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
        <button class="dep-panel-btn main-btn" data-channel="Paytm" style="background:#10b981; font-size:12px; padding:8px;">Paytm Gateway</button>
        <button class="dep-panel-btn main-btn" data-channel="PhonePe" style="background:#334155; font-size:12px; padding:8px;">PhonePe Pay</button>
        <button class="dep-panel-btn main-btn" data-channel="GooglePay" style="background:#334155; font-size:12px; padding:8px;">Google Pay</button>
        <button class="dep-panel-btn main-btn" data-channel="QRDirect" style="background:#334155; font-size:12px; padding:8px;">Direct QR Scan</button>
        <button class="dep-panel-btn main-btn" data-channel="FastUPI" style="background:#334155; font-size:12px; padding:8px;">Fast UPI Transfer</button>
        <button class="dep-panel-btn main-btn" data-channel="UPICollect" style="background:#334155; font-size:12px; padding:8px;">UPI Collect Request</button>
      </div>

      <div style="background:#0f172a; padding:12px; border-radius:8px; text-align:center; margin-bottom:12px; border:1px solid #334155;">
        <p style="font-size:13px; color:#38bdf8; margin-bottom:6px;">Official UPI QR Code</p>
        <div style="background:#fff; display:inline-block; padding:8px; border-radius:6px; margin-bottom:8px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" alt="QR">
        </div>
        <div>
          <a id="externalAppPayBtn" href="upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" target="_blank" class="main-btn" style="display:inline-block; background:#10b981; padding:8px 16px; font-size:13px; text-decoration:none; color:#fff;">Pay via External UPI App (PhonePe/GPay)</a>
        </div>
      </div>

      <input id="depositAmountInput" type="number" placeholder="Enter Amount (Min 100)" value="100" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#fff;">
      <input id="depositUtrInput" type="text" placeholder="Enter 12-digit UTR / Ref Number" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#fff;">
      
      <button id="submitDepositReqBtn" class="main-btn">Submit Deposit for Approval</button>
    `

    document.querySelector('#open91GatewayBtn').onclick = () => {
      const amt = Number(document.querySelector('#depositAmountInput').value) || 100
      openDepositGateway(amt, 'UPI Express Gateway')
    }

    document.querySelectorAll('.dep-panel-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.dep-panel-btn').forEach(b => b.style.background = '#334155')
        e.target.style.background = '#10b981'
        showToast(`Channel selected: ${e.target.dataset.channel}`, 'info')
      }
    })

    document.querySelector('#submitDepositReqBtn').onclick = () => {
      const amt = Number(document.querySelector('#depositAmountInput').value)
      const utr = document.querySelector('#depositUtrInput').value.trim()

      if (!amt || amt < 100) { showToast('Minimum deposit amount 100 ₹ hai!', 'error'); return; }
      if (!utr || utr.length < 8) { showToast('Kripya valid UTR / Ref number enter karein!', 'error'); return; }

      const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]')
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
    const actionArea = document.querySelector('#walletActionArea')
    actionArea.innerHTML = `
      <h3>Withdrawal</h3>
      <p style="font-size:12px; color:#aaa; margin-bottom:10px;">Enter your UPI ID to withdraw funds securely.</p>
      
      <input id="withdrawalUpiInput" type="text" placeholder="Enter UPI ID (e.g. user@paytm)" value="${escapeHtml(upiStatus.upiId)}" ${upiStatus.locked ? 'readonly style="background:#1e293b; color:#888; width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155;"' : 'style="background:#0f172a; color:#fff; width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155;"'}>
      ${upiStatus.locked ? '<small style="color:#22c55e; display:block; margin-bottom:10px;">🔒 UPI is locked securely (Cannot be changed)</small>' : ''}
      
      <input id="withdrawalAmountInput" type="number" placeholder="Enter amount to withdraw (Min 110)" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #334155; background:#0f172a; color:#fff;">
      <button id="submitWithdrawalBtn" class="main-btn">Withdraw</button>
    `

    document.querySelector('#submitWithdrawalBtn').onclick = () => {
      const upi = document.querySelector('#withdrawalUpiInput').value.trim()
      const amt = Number(document.querySelector('#withdrawalAmountInput').value)

      if (!upi || !upi.includes('@')) { showToast('Kripya valid UPI ID enter karein!', 'error'); return; }
      if (!amt || amt < 110) { showToast('Minimum withdrawal amount 110 coins hai!', 'error'); return; }
      if (amt > getBalance()) { showToast('Insufficient balance!', 'error'); return; }

      if (!upiStatus.locked) {
        const upiRes = saveUserUpiSecure(user.id, upi)
        if (!upiRes.success) {
          showToast(upiRes.message, 'error')
          return
        }
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

    const actionArea = document.querySelector('#walletActionArea')
    actionArea.innerHTML = `
      <h3>Transaction Records</h3>
      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <button id="histWdBtn" class="main-btn" style="flex:1; background:#22c55e; font-size:12px;">Withdrawals (${withdrawals.length})</button>
        <button id="histDepBtn" class="main-btn" style="flex:1; background:#334155; font-size:12px;">Deposits (${deposits.length})</button>
      </div>
      <div id="historyListContainer" style="max-height:220px; overflow-y:auto; text-align:left; font-size:12px;"></div>
    `

    const renderWd = () => {
      const container = document.querySelector('#historyListContainer')
      if (!withdrawals.length) {
        container.innerHTML = '<p style="text-align:center; color:#888; padding:10px;">No withdrawals found.</p>'
        return
      }
      container.innerHTML = withdrawals.map(w => `
        <div style="background:#0f172a; padding:8px; margin-bottom:6px; border-radius:6px; border-left:3px solid ${w.status === 'Completed' ? '#22c55e' : w.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <strong>₹${w.amount}</strong> via UPI (${escapeHtml(w.upi)})<br>
          <span style="color:#aaa;">Status: <strong>${w.status}</strong></span><br>
          <small style="color:#666;">${w.date || w.createdAt}</small>
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
        <div style="background:#0f172a; padding:8px; margin-bottom:6px; border-radius:6px; border-left:3px solid ${d.status === 'Completed' ? '#22c55e' : d.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <strong>₹${d.amount}</strong> (+₹${d.bonus || 0} Bonus)<br>
          <span style="color:#aaa;">UTR: ${escapeHtml(d.utr)} | Status: <strong>${d.status}</strong></span><br>
          <small style="color:#666;">${d.date || d.createdAt}</small>
        </div>
      `).join('')
    }

    renderWd()

    document.querySelector('#histWdBtn').onclick = (e) => {
      e.target.style.background = '#22c55e'
      document.querySelector('#histDepBtn').style.background = '#334155'
      renderWd()
    }

    document.querySelector('#histDepBtn').onclick = (e) => {
      e.target.style.background = '#22c55e'
      document.querySelector('#histWdBtn').style.background = '#334155'
      renderDep()
    }
  }

  connectNavigation()
}

/* =========================
   91 CLUB STYLE ACCOUNT & PROFILE (UID Copy, VIP Badge & History)
========================= */

function showAccount() {
  stopAllSpecialTimers()
  currentPage = 'account'
  const user = getCurrentUser()

  const userBets = getUserBetRecords(user.id)
  const deposits = getAllDeposits().filter(d => String(d.uid) === String(user.id))
  const withdrawals = getAllWithdrawals().filter(w => String(w.uid) === String(user.id))

  app().innerHTML = `
    <div class="app-shell" style="padding-bottom: 75px;">
      
      <!-- Profile Avatar Card -->
      <section style="background: linear-gradient(135deg, #1e3a8a, #0f172a); border-radius: 16px; padding: 18px; margin-bottom: 15px; border: 1px solid #334155;">
        <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 15px;">
          <div style="width: 55px; height: 55px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #d97706); display: grid; place-items: center; font-size: 24px; font-weight: 900; color: #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.4);">
            ${escapeHtml(user.name.charAt(0).toUpperCase())}
          </div>
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-size: 18px; color: #fff; margin: 0;">${escapeHtml(user.name)}</h2>
              <span style="background: #f59e0b; color: #000; font-size: 10px; font-weight: 900; padding: 2px 6px; border-radius: 4px;">VIP 1</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
              <span style="color: #94a3b8; font-size: 12px;">UID: <strong style="color: #fff;">${escapeHtml(user.id)}</strong></span>
              <button id="copyUidBtn" style="background: #334155; border: none; color: #38bdf8; font-size: 11px; padding: 2px 6px; border-radius: 4px; cursor: pointer;">📋 Copy</button>
            </div>
            <span style="color: #64748b; font-size: 11px; display: block; margin-top: 2px;">Phone: +91 ${escapeHtml(user.phone)}</span>
          </div>
        </div>

        <div style="background: rgba(15, 23, 42, 0.75); border-radius: 12px; padding: 14px; border: 1px solid #1e293b;">
          <span style="font-size: 12px; color: #94a3b8; display: block;">Total Wallet Balance</span>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 4px;">
            <strong style="font-size: 26px; color: #22c55e;">₹${getBalance().toLocaleString()}</strong>
            <div style="display: flex; gap: 8px;">
              <button id="accDepositBtn" style="background: linear-gradient(135deg, #10b981, #059669); border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">Deposit</button>
              <button id="accWithdrawBtn" style="background: #334155; border: none; color: #fff; padding: 6px 14px; border-radius: 6px; font-weight: bold; font-size: 12px; cursor: pointer;">Withdraw</button>
            </div>
          </div>
        </div>
      </section>

      <!-- 91 Club Transaction History Section with Tabs -->
      <section class="normal-card" style="margin-bottom: 15px;">
        <h3 style="margin-bottom: 12px; font-size: 16px; color: #facc15;">📊 Transaction & Game History</h3>
        
        <div style="display: flex; background: #0f172a; border-radius: 8px; padding: 3px; margin-bottom: 12px;">
          <button id="tabBetHistory" class="acc-tab-btn active" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: #2563eb; color: #fff; font-size: 12px; font-weight: bold; cursor: pointer;">Game Bets</button>
          <button id="tabDepHistory" class="acc-tab-btn" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: transparent; color: #94a3b8; font-size: 12px; font-weight: bold; cursor: pointer;">Deposits</button>
          <button id="tabWdHistory" class="acc-tab-btn" style="flex: 1; padding: 8px; border: none; border-radius: 6px; background: transparent; color: #94a3b8; font-size: 12px; font-weight: bold; cursor: pointer;">Withdrawals</button>
        </div>

        <div id="accHistoryContent" style="max-height: 240px; overflow-y: auto;"></div>
      </section>

      <section class="normal-card" style="margin-bottom: 15px;">
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155;">
          <span>Invitation Code</span>
          <strong style="color: #38bdf8;">${escapeHtml(user.referralCode)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; padding: 8px 0;">
          <span>Security Status</span>
          <strong style="color: #22c55e;">Verified ✅</strong>
        </div>
      </section>

      <button id="supportAccountBtn" class="main-btn" style="background:#2563eb; margin-bottom:10px;">🎧 24/7 Customer Support</button>
      <button id="logoutBtn" class="logout-btn">Log out Account</button>
      ${navigation('account')}
    </div>
  `

  document.querySelector('#copyUidBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(user.id)
      showToast(`UID ${user.id} copied!`, 'success')
    } catch {
      showToast(user.id, 'info')
    }
  }

  document.querySelector('#accDepositBtn').onclick = () => {
    showWallet()
    setTimeout(() => {
      document.querySelector('#depositBtn')?.click()
    }, 100)
  }

  document.querySelector('#accWithdrawBtn').onclick = () => {
    showWallet()
    setTimeout(() => {
      document.querySelector('#withdrawBtn')?.click()
    }, 100)
  }

  const renderAccBets = () => {
    const container = document.querySelector('#accHistoryContent')
    if (!userBets.length) {
      container.innerHTML = '<p style="text-align:center; color:#64748b; padding:15px; font-size:12px;">No game bets yet.</p>'
      return
    }
    container.innerHTML = userBets.map(b => `
      <div style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid ${b.result === 'WIN' ? '#22c55e' : '#ef4444'}; font-size: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="color:#fff;">${b.game}</strong> (#${b.period || 'Round'})<br>
          <span style="color:#94a3b8;">Choice: ${b.choice || '—'} | Bet: ₹${b.bet}</span><br>
          <small style="color:#64748b;">${b.date}</small>
        </div>
        <div style="text-align: right;">
          <strong style="color:${b.result === 'WIN' ? '#22c55e' : '#ef4444'}; font-size:13px;">${b.result}</strong><br>
          <small style="color:#cbd5e1; font-weight:bold;">${b.payout ? '+₹' + b.payout : '₹0'}</small>
        </div>
      </div>
    `).join('')
  }

  const renderAccDeps = () => {
    const container = document.querySelector('#accHistoryContent')
    if (!deposits.length) {
      container.innerHTML = '<p style="text-align:center; color:#64748b; padding:15px; font-size:12px;">No deposit records found.</p>'
      return
    }
    container.innerHTML = deposits.map(d => `
      <div style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid ${d.status === 'Completed' ? '#22c55e' : d.status === 'Rejected' ? '#ef4444' : '#facc15'}; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <strong style="color: #fff;">₹${d.amount}</strong>
          <span style="color: ${d.status === 'Completed' ? '#22c55e' : d.status === 'Rejected' ? '#ef4444' : '#facc15'}; font-weight: bold;">${d.status}</span>
        </div>
        <div style="color: #94a3b8; margin: 2px 0;">UTR: ${escapeHtml(d.utr)}</div>
        <small style="color: #64748b;">${d.date || d.createdAt}</small>
      </div>
    `).join('')
  }

  const renderAccWds = () => {
    const container = document.querySelector('#accHistoryContent')
    if (!withdrawals.length) {
      container.innerHTML = '<p style="text-align:center; color:#64748b; padding:15px; font-size:12px;">No withdrawal records found.</p>'
      return
    }
    container.innerHTML = withdrawals.map(w => `
      <div style="background: #0f172a; padding: 10px; border-radius: 8px; margin-bottom: 6px; border-left: 3px solid ${w.status === 'Completed' ? '#22c55e' : w.status === 'Rejected' ? '#ef4444' : '#facc15'}; font-size: 12px;">
        <div style="display: flex; justify-content: space-between;">
          <strong style="color: #fff;">₹${w.amount}</strong>
          <span style="color: ${w.status === 'Completed' ? '#22c55e' : w.status === 'Rejected' ? '#ef4444' : '#facc15'}; font-weight: bold;">${w.status}</span>
        </div>
        <div style="color: #94a3b8; margin: 2px 0;">UPI: ${escapeHtml(w.upi)}</div>
        <small style="color: #64748b;">${w.date || w.createdAt}</small>
      </div>
    `).join('')
  }

  renderAccBets()

  document.querySelector('#tabBetHistory').onclick = (e) => {
    document.querySelectorAll('.acc-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#94a3b8'; })
    e.target.style.background = '#2563eb'
    e.target.style.color = '#fff'
    renderAccBets()
  }

  document.querySelector('#tabDepHistory').onclick = (e) => {
    document.querySelectorAll('.acc-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#94a3b8'; })
    e.target.style.background = '#2563eb'
    e.target.style.color = '#fff'
    renderAccDeps()
  }

  document.querySelector('#tabWdHistory').onclick = (e) => {
    document.querySelectorAll('.acc-tab-btn').forEach(b => { b.style.background = 'transparent'; b.style.color = '#94a3b8'; })
    e.target.style.background = '#2563eb'
    e.target.style.color = '#fff'
    renderAccWds()
  }

  document.querySelector('#supportAccountBtn').onclick = openCustomerService
  document.querySelector('#logoutBtn').onclick = () => {
    logoutUser()
    showLogin()
  }

  connectNavigation()
}

/* =========================
   FULL ADMIN PANEL & ALL GAMES CONTROLS
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
        <h2>Kivoro Admin</h2>
        <button id="aDashboard">📊 Dashboard</button>
        <button id="aWithdrawals">💳 Withdrawals</button>
        <button id="aDeposits">➕ Deposit Approvals</button>
        <button id="aControl">🎯 All Games Win/Loss Control</button>
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
        <section class="normal-card" style="margin-bottom:12px; border-left:4px solid ${w.status === 'Completed' ? '#22c55e' : w.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>ID: ${w.id}</strong> (User: ${w.uid})<br>
              Amount: <strong style="color:#38bdf8;">₹${w.amount}</strong> | UPI: <strong>${escapeHtml(w.upi)}</strong><br>
              <small style="color:#aaa;">Date: ${w.date || w.createdAt}</small>
            </div>
            <div>
              <span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; background:${w.status === 'Completed' ? '#065f46' : w.status === 'Rejected' ? '#991b1b' : '#854d0e'}; color:#fff;">${w.status}</span>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#f59e0b;" onclick="window.updateWd('${w.id}', 'Processing')">Mark Processing</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#22c55e;" onclick="window.updateWd('${w.id}', 'Completed')">Mark Completed</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#ef4444;" onclick="window.updateWd('${w.id}', 'Rejected')">Reject & Auto-Refund</button>
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
        <section class="normal-card" style="margin-bottom:12px; border-left:4px solid ${d.status === 'Completed' ? '#22c55e' : d.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <div>
            <strong>ID: ${d.id}</strong> (User: ${d.uid} - ${escapeHtml(d.name || '')})<br>
            Amount: <strong style="color:#38bdf8;">₹${d.amount}</strong> (+₹${d.bonus || 0} Bonus) | UTR: <strong>${escapeHtml(d.utr)}</strong><br>
            <small style="color:#aaa;">Date: ${d.date || d.createdAt} | Status: <strong>${d.status}</strong></small>
          </div>
          ${d.status === 'Pending' ? `
            <div style="margin-top:10px; display:flex; gap:8px;">
              <button class="main-btn" style="background:#22c55e; padding:6px 12px; font-size:12px;" onclick="window.approveDep('${d.id}', 'Completed')">Approve & Add Balance</button>
              <button class="main-btn" style="background:#ef4444; padding:6px 12px; font-size:12px;" onclick="window.approveDep('${d.id}', 'Rejected')">Reject Deposit</button>
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

// 🎯 ALL MODES WIN/LOSS CONTROL (Wingo 30s, 60s, 180s, 300s + Aviator)
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
    
    <section class="normal-card" style="margin-bottom:15px;">
      <h3>🎯 Wingo 30 Sec Control</h3>
      <select id="ctrlWingo30" style="width:100%; padding:10px; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #334155;">
        ${getOptionsHtml(state.modeForcedResults?.wingo30)}
      </select>
    </section>

    <section class="normal-card" style="margin-bottom:15px;">
      <h3>🎯 Wingo 1 Min Control</h3>
      <select id="ctrlWingo60" style="width:100%; padding:10px; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #334155;">
        ${getOptionsHtml(state.modeForcedResults?.wingo60)}
      </select>
    </section>

    <section class="normal-card" style="margin-bottom:15px;">
      <h3>🎯 Wingo 3 Min Control</h3>
      <select id="ctrlWingo180" style="width:100%; padding:10px; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #334155;">
        ${getOptionsHtml(state.modeForcedResults?.wingo180)}
      </select>
    </section>

    <section class="normal-card" style="margin-bottom:15px;">
      <h3>🎯 Wingo 5 Min Control</h3>
      <select id="ctrlWingo300" style="width:100%; padding:10px; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #334155;">
        ${getOptionsHtml(state.modeForcedResults?.wingo300)}
      </select>
    </section>

    <section class="normal-card" style="margin-bottom:15px;">
      <h3>✈️ Aviator Crash Multiplier Control</h3>
      <input id="ctrlAviator" type="number" step="0.1" placeholder="Force Crash At (e.g. 1.2, 5.0) Leave empty for Random" value="${state.modeForcedResults?.aviator || ''}" style="width:100%; padding:10px; border-radius:8px; background:#0f172a; color:#fff; border:1px solid #334155;">
    </section>

    <button id="saveAllModesBtn" class="main-btn" style="background:#22c55e; padding:14px; font-size:15px;">Save All Controls</button>
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
    <section class="normal-card">
      <input id="demoName" placeholder="Name">
      <input id="demoPhone" maxlength="10" placeholder="Mobile number">
      <input id="demoPassword" placeholder="Password">
      <select id="demoRole">
        <option value="USER">Player</option>
        <option value="AGENT">Agent</option>
      </select>
      <button id="createDemoBtn" class="main-btn">Create ID</button>
      <p id="demoCreated"></p>
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
                <section class="normal-card">
                  <h3>${escapeHtml(user.name)}</h3>
                  <p>${escapeHtml(user.phone)}</p>
                  <p>Balance: ${Number(user.balance || 0).toLocaleString()}</p>
                  <input id="adjust-${user.id}" type="number" placeholder="Balance change">
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
                <section class="normal-card">
                  <h3>${escapeHtml(agent.name)}</h3>
                  <p>${escapeHtml(agent.phone)}</p>
                  <p>Balance: ${Number(agent.balance || 0).toLocaleString()}</p>
                  <input id="salary-${agent.id}" type="number" placeholder="Salary coins">
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
          <section class="normal-card">
            <h3>${game.name}</h3>
            <label>
              Enable Game
              <input type="checkbox" data-enable="${game.key}" ${
                state.games?.[game.key] !== false ? 'checked' : ''
              }>
            </label>
            <br><br>
            <label>
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
    <section class="normal-card">
      <input id="giftAdminCode" placeholder="Gift code">
      <input id="giftAdminCoins" type="number" placeholder="Coins">
      <input id="giftAdminUses" type="number" placeholder="Maximum uses">
      <button id="createGiftBtn" class="main-btn">Create Gift Code</button>
    </section>

    ${state.giftCodes
      .map(
        gift => `
          <section class="normal-card">
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
    <section class="normal-card">
      <textarea id="announcementText" rows="6">${escapeHtml(
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

    updatePredictionButton()
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