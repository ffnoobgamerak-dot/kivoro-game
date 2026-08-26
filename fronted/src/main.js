import './style.css'

import {
  registerUser,
  loginUser,
  getCurrentUser,
  logoutUser,
  updateCurrentUser,
  saveUserUpiSecure,
  getCurrentUserUpiStatus
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
  getReferralDetails,
  getAllWithdrawals,
  updateAdminWithdrawalStatus
} from './admin.js'

import {
  showToast,
  openCustomerService,
  saveUserBetRecord,
  getUserBetRecords
} from './extras.js'

/* =========================
   GLOBAL STATE
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
  localStorage.getItem('kivoro_period') || 10001
)

let history = []
let aviatorTimer = null
let aviatorRestartTimer = null
let wingoInterval = null

try {
  const savedHistory = JSON.parse(
    localStorage.getItem('kivoro_history') || '[]'
  )
  history = Array.isArray(savedHistory) ? savedHistory : []
} catch {
  history = []
}

/* =========================
   BASIC HELPERS
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
    balance: Math.max(
      0,
      Math.floor(Number(value) || 0)
    )
  })
}

function saveHistory() {
  localStorage.setItem(
    'kivoro_history',
    JSON.stringify(history.slice(0, 100))
  )
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
  return (
    modes.find(mode => mode.seconds === currentMode)?.name || 'Wingo'
  )
}

function stopAllSpecialTimers() {
  stopAviator()
  if (wingoInterval) {
    clearInterval(wingoInterval)
    wingoInterval = null
  }
}

// Check if user has deposited at least 100 Rs for Wingo lock
function hasUserDeposited100(userId) {
  try {
    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]')
    return deposits.some(d => String(d.uid) === String(userId) && d.status === 'Completed' && Number(d.amount) >= 100)
  } catch {
    return false
  }
}

/* =========================
   NAVIGATION
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
   LOGIN
========================= */

function showLogin() {
  currentPage = 'login'
  stopAllSpecialTimers()

  app().innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>Kivoro Play</h1>
        <p>Login to continue</p>
        <div class="phone-box">
          <span>+91</span>
          <input id="loginPhone" maxlength="10" inputmode="numeric" placeholder="Mobile number">
        </div>
        <input id="loginPassword" type="password" placeholder="Password">
        <button id="loginBtn" class="main-btn">Login</button>
        <p class="switch-text">
          New user? <button id="goRegister">Create Account</button>
        </p>
      </div>
    </div>
  `

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

  document.querySelector('#goRegister').onclick = showRegister
}

/* =========================
   REGISTER (91 Club Style Referral Check)
========================= */

function showRegister() {
  currentPage = 'register'
  stopAllSpecialTimers()

  // URL se invite code auto fetch karo (91 Club style)
  const urlParams = new URLSearchParams(window.location.search)
  const inviteFromUrl = urlParams.get('invite') || ''

  app().innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>Kivoro Play</h1>
        <p>Create Account</p>
        <input id="regName" placeholder="Your name">
        <div class="phone-box">
          <span>+91</span>
          <input id="regPhone" maxlength="10" inputmode="numeric" placeholder="Mobile number">
        </div>
        <input id="regPassword" type="password" placeholder="Password">
        <input id="regInvite" placeholder="Invite code" value="${escapeHtml(inviteFromUrl)}">
        <button id="registerBtn" class="main-btn">Register</button>
        <p class="switch-text">
          Already registered? <button id="goLogin">Login</button>
        </p>
      </div>
    </div>
  `

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

  document.querySelector('#goLogin').onclick = showLogin
}

/* =========================
   HOME
========================= */

function showHome() {
  stopAllSpecialTimers()
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
          <h2>Kivoro Play</h2>
          <small>Welcome ${escapeHtml(user.name)}</small>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <button id="supportBtn" style="background:#2563eb; border:none; padding:6px 12px; border-radius:6px; color:#fff; font-size:12px; font-weight:bold; cursor:pointer;">🎧 Support</button>
          <div class="balance-box">
            <span>Balance</span>
            <strong>${getBalance().toLocaleString()} Coins</strong>
          </div>
        </div>
      </header>

      ${
        admin.announcement
          ? `<div class="announcement">📢 ${escapeHtml(admin.announcement)}</div>`
          : ''
      }

      <section class="home-banner">
        <div>
          <h1>Game Center</h1>
          <p>Live-style game experience</p>
        </div>
        <span>🎮</span>
      </section>

      <h2 class="section-title">Wingo (Locked until ₹100 Deposit)</h2>

      <section class="game-grid">
        ${modes
          .map(mode => {
            const enabled = admin.games?.[mode.key] !== false
            const locked = admin.lockedGames?.[mode.key] === true
            const hasDeposited = hasUserDeposited100(user.id)

            return `
              <button class="game-card" data-mode="${mode.seconds}" data-key="${mode.key}" ${!enabled || !hasDeposited ? '' : ''}>
                <span>⏱️</span>
                <strong>${mode.name}</strong>
                <small>${!enabled ? 'Disabled' : locked ? 'Locked' : !hasDeposited ? '🔒 Dep. ₹100 to Unlock' : 'Play Now'}</small>
              </button>
            `
          })
          .join('')}
      </section>

      <h2 class="section-title">More Games</h2>

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

  document.querySelectorAll('[data-mode]').forEach(button => {
    button.onclick = () => {
      const modeSec = Number(button.dataset.mode)
      const modeKey = button.dataset.key
      
      // Wingo 100rs Deposit Restriction check
      if (!hasUserDeposited100(user.id)) {
        showToast('Wingo khelne ke liye pehle minimum ₹100 deposit karein!', 'error')
        showWallet()
        return
      }

      const state = getAdminState()
      if (state.lockedGames?.[modeKey]) {
        showToast('Game currently locked', 'error')
        return
      }

      currentMode = modeSec
      currentModeKey = modeKey
      timeLeft = currentMode
      selectedChoice = null
      lockedPrediction = null
      showWingo()
    }
  })

  document.querySelectorAll('[data-mini]').forEach(button => {
    button.onclick = () => {
      showMiniGame(button.dataset.mini)
    }
  })

  const avBtn = document.querySelector('#aviatorBtn')
  if (avBtn) {
    avBtn.onclick = (e) => {
      e.preventDefault()
      showAviator()
    }
  }

  connectNavigation()
}

/* =========================
   MINI GAMES
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
          <small>Mini Game</small>
        </div>
        <div class="game-balance" id="miniBalanceDisplay">
          ${getBalance().toLocaleString()} 🪙
        </div>
      </header>

      <section class="normal-card" style="text-align:center;">
        <div id="miniDisplay" style="min-height:140px; display:grid; place-items:center; font-size:65px; margin-bottom:15px;">🎮</div>
        
        <h3>Select Amount</h3>
        <div class="amount-buttons" style="margin-bottom:10px;">
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
      let isWin = Math.random() < 0.5
      let outcome = ''
      let winCoins = 0

      if (name === 'Dice') {
        const val = Math.floor(Math.random() * 6) + 1
        display.textContent = `🎲 ${val}`
        isWin = val >= 4
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Rolled ${val}`
      } else if (name === 'Number Game') {
        const val = Math.floor(Math.random() * 10)
        display.textContent = `🔢 ${val}`
        isWin = val % 2 === 0
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Number ${val}`
      } else if (name === 'Coin Flip') {
        const val = Math.random() < 0.5 ? 'HEADS' : 'TAILS'
        display.textContent = val === 'HEADS' ? '🪙 H' : '🪙 T'
        isWin = val === 'HEADS'
        winCoins = isWin ? miniBetAmt * 2 : 0
        outcome = `Result ${val}`
      } else {
        const vals = [1, 2, 5, 10, 20]
        const val = vals[Math.floor(Math.random() * vals.length)]
        display.textContent = `🎡 ${val}x`
        isWin = val >= 5
        winCoins = isWin ? miniBetAmt * val : 0
        outcome = `Multiplier ${val}x`
      }

      const user = getCurrentUser()
      if (isWin) {
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
   WINGO
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
        <div id="wingoStatus" style="text-align:center; padding:15px; border-radius:14px; background:#16263b; margin-bottom:20px;">
          Round running
        </div>

        <h3>Choose Color</h3>
        <section class="color-buttons">
          <button class="choice green" data-choice="GREEN">Green</button>
          <button class="choice violet" data-choice="VIOLET">Violet</button>
          <button class="choice red" data-choice="RED">Red</button>
        </section>

        <h3>Choose Number</h3>
        <section class="number-grid">
          ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
            .map(number => `<button class="number" data-choice="${number}">${number}</button>`)
            .join('')}
        </section>

        <h3>Choose Size</h3>
        <section class="size-buttons">
          <button class="choice big" data-choice="BIG">Big</button>
          <button class="choice small" data-choice="SMALL">Small</button>
        </section>

        <h3>Select Amount</h3>
        <div class="amount-buttons">
          <button class="amount-choice selected" data-amount="10">10</button>
          <button class="amount-choice" data-amount="50">50</button>
          <button class="amount-choice" data-amount="100">100</button>
          <button class="amount-choice" data-amount="500">500</button>
          <button class="amount-choice" data-amount="1000">1000</button>
        </div>

        <div class="custom-amount">
          <button id="amountMinus">−</button>
          <input id="gameAmount" type="number" min="10" step="10" value="10">
          <button id="amountPlus">+</button>
        </div>

        <p id="amountStatus" style="text-align:center; font-weight:700;">Selected Amount: 10</p>

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

  document.querySelectorAll('[data-amount]').forEach(button => {
    button.onclick = () => {
      selectedAmount = Number(button.dataset.amount)
      document.querySelectorAll('[data-amount]').forEach(item => {
        item.classList.remove('selected')
      })
      button.classList.add('selected')
      const amountInput = document.querySelector('#gameAmount')
      if (amountInput) amountInput.value = selectedAmount
      const amountStatus = document.querySelector('#amountStatus')
      if (amountStatus) amountStatus.textContent = `Selected Amount: ${selectedAmount}`
    }
  })

  document.querySelector('#amountMinus').onclick = () => {
    selectedAmount = Math.max(10, selectedAmount - 10)
    document.querySelector('#gameAmount').value = selectedAmount
    document.querySelector('#amountStatus').textContent = `Selected Amount: ${selectedAmount}`
  }

  document.querySelector('#amountPlus').onclick = () => {
    selectedAmount += 10
    document.querySelector('#gameAmount').value = selectedAmount
    document.querySelector('#amountStatus').textContent = `Selected Amount: ${selectedAmount}`
  }

  document.querySelector('#gameAmount').oninput = (e) => {
    selectedAmount = Number(e.target.value) || 0
    document.querySelector('#amountStatus').textContent = `Selected Amount: ${selectedAmount}`
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

  if (selectedAmount <= 0) {
    showToast('Valid amount select karein!', 'error')
    return
  }

  if (selectedAmount > currentBalance) {
    showToast('Insufficient balance!', 'error')
    return
  }

  setBalance(currentBalance - selectedAmount)
  
  lockedPrediction = {
    choice: selectedChoice,
    amount: selectedAmount,
    period: period
  }

  const status = document.querySelector('#predictionStatus')
  if (status) {
    status.textContent = `Wait for results... Locked: ${selectedChoice} (${selectedAmount} Coins)`
  }

  showToast('Bet placed successfully! Wait for results.', 'success')
  updatePredictionButton()
}

function getResult(number) {
  let color = 'RED'
  if (number === 0 || number === 5) {
    color = 'VIOLET'
  } else if ([1, 3, 7, 9].includes(number)) {
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

/* =========================
   RESULT POPUP
========================= */

function showResultPopup(won, result, payout) {
  document.querySelector('.result-popup')?.remove()

  const popup = document.createElement('div')
  popup.className = 'result-popup'
  popup.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.8); display: grid; place-items:center; z-index:99999;
  `
  popup.innerHTML = `
    <div class="result-popup-card" style="background:#1e293b; padding:30px; border-radius:16px; text-align:center; width:90%; max-width:320px; color:#fff; box-shadow:0 15px 35px rgba(0,0,0,0.6);">
      <div style="font-size:65px; margin-bottom:10px;">${won ? '🏆' : '🎯'}</div>
      <h2 style="color:${won ? '#22c55e' : '#ef4444'}; font-size:24px; margin-bottom:10px;">${won ? 'WIN' : 'LOSS'}</h2>
      <div style="font-size:38px; font-weight:900; margin:10px 0; background:#0f172a; padding:10px; border-radius:10px;">${result.number}</div>
      <p style="color:#94a3b8; margin-bottom:15px;">${result.color} • ${result.size}</p>
      ${won ? `<p style="color:#22c55e; font-weight:bold; font-size:16px; margin-bottom:15px;">Won: +${payout} Coins</p>` : ''}
      <button id="closeResultPopup" class="main-btn" style="width:100%;">Continue</button>
    </div>
  `

  document.body.appendChild(popup)

  document.querySelector('#closeResultPopup').onclick = () => {
    popup.remove()
  }

  setTimeout(() => {
    popup.remove()
  }, 5000)
}

/* =========================
   AVIATOR
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
  const stopAt = Number((1.05 + Math.random() * 5).toFixed(2))
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

/* =========================
   ACTIVITY
========================= */

function showActivity() {
  stopAllSpecialTimers()
  currentPage = 'activity'

  app().innerHTML = `
    <div class="app-shell">
      <h1>Activity</h1>
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
   PROMOTION (91 Club Style Referral & History)
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
      <h1>Promotion Center</h1>

      <section class="wallet-card" style="background: linear-gradient(135deg, #2563eb, #1e40af);">
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
        
        <div style="background:#111; padding:10px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:12px; color:#38bdf8; word-break:break-all; margin-right:10px;">${referralLink}</span>
          <button id="copyLinkBtn" class="main-btn" style="padding:6px 12px; font-size:12px; white-space:nowrap;">Copy Link</button>
        </div>

        <div style="display:flex; gap:10px;">
          <div style="flex:1; background:#111; padding:10px; border-radius:8px; text-align:center;">
            <small style="color:#aaa;">Code</small><br>
            <strong style="color:#22c55e;">${escapeHtml(user.referralCode)}</strong>
          </div>
          <button id="copyCodeBtn" class="main-btn" style="flex:1; padding:8px; font-size:13px;">Copy Code</button>
        </div>
      </section>

      <section class="normal-card">
        <h2>Claim Gift Code</h2>
        <input id="giftCode" placeholder="Enter Gift Code" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333; background:#111; color:#fff;">
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
   WALLET (5-6 Deposit Channels & External Apps with ayush122312@ybl)
========================= */

function showWallet() {
  stopAllSpecialTimers()
  currentPage = 'wallet'
  const user = getCurrentUser()
  const upiStatus = getCurrentUserUpiStatus()

  app().innerHTML = `
    <div class="app-shell">
      <h1>Wallet</h1>
      <section class="wallet-card">
        <span>Available Balance</span>
        <strong>${getBalance().toLocaleString()} Coins</strong>
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
      
      <!-- 5-6 Deposit Panels (91 Club Style) -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">
        <button class="dep-panel-btn main-btn" data-channel="Paytm" style="background:#2563eb; font-size:12px; padding:8px;">Paytm Gateway</button>
        <button class="dep-panel-btn main-btn" data-channel="PhonePe" style="background:#334155; font-size:12px; padding:8px;">PhonePe Pay</button>
        <button class="dep-panel-btn main-btn" data-channel="GooglePay" style="background:#334155; font-size:12px; padding:8px;">Google Pay</button>
        <button class="dep-panel-btn main-btn" data-channel="QRDirect" style="background:#334155; font-size:12px; padding:8px;">Direct QR Scan</button>
        <button class="dep-panel-btn main-btn" data-channel="FastUPI" style="background:#334155; font-size:12px; padding:8px;">Fast UPI Transfer</button>
        <button class="dep-panel-btn main-btn" data-channel="UPICollect" style="background:#334155; font-size:12px; padding:8px;">UPI Collect Request</button>
      </div>

      <div style="background:#0f172a; padding:12px; border-radius:8px; text-align:center; margin-bottom:12px; border:1px solid #333;">
        <p style="font-size:13px; color:#38bdf8; margin-bottom:6px;">Official UPI ID: <strong>ayush122312@ybl</strong></p>
        <div style="background:#fff; display:inline-block; padding:8px; border-radius:6px; margin-bottom:8px;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" alt="QR">
        </div>
        <div>
          <a id="externalAppPayBtn" href="upi://pay?pa=ayush122312@ybl&pn=KivoroPlay" target="_blank" class="main-btn" style="display:inline-block; background:#22c55e; padding:8px 16px; font-size:13px; text-decoration:none; color:#fff;">Pay via External UPI App (PhonePe/GPay)</a>
        </div>
      </div>

      <input id="depositAmountInput" type="number" placeholder="Enter Amount (Min 100)" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333; background:#111; color:#fff;">
      <input id="depositUtrInput" type="text" placeholder="Enter 12-digit UTR / Ref Number" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333; background:#111; color:#fff;">
      
      <button id="submitDepositReqBtn" class="main-btn">Submit Deposit for Approval</button>
    `

    // Panel Selection Logic
    document.querySelectorAll('.dep-panel-btn').forEach(btn => {
      btn.onclick = (e) => {
        document.querySelectorAll('.dep-panel-btn').forEach(b => b.style.background = '#334155')
        e.target.style.background = '#2563eb'
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
        amount: amt,
        bonus: Math.floor(amt * 0.10),
        utr: utr,
        status: 'Pending',
        date: new Date().toLocaleString()
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
      
      <input id="withdrawalUpiInput" type="text" placeholder="Enter UPI ID (e.g. user@paytm)" value="${escapeHtml(upiStatus.upiId)}" ${upiStatus.locked ? 'readonly style="background:#222; color:#888; width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333;"' : 'style="background:#111; color:#fff; width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333;"'}>
      ${upiStatus.locked ? '<small style="color:#22c55e; display:block; margin-bottom:10px;">🔒 UPI is locked securely (Cannot be changed)</small>' : ''}
      
      <input id="withdrawalAmountInput" type="number" placeholder="Enter amount to withdraw (Min 110)" style="width:100%; padding:10px; margin-bottom:10px; border-radius:8px; border:1px solid #333; background:#111; color:#fff;">
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

      setBalance(getBalance() - amt)

      const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]')
      const newWd = {
        id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
        uid: user.id,
        amount: amt,
        status: 'Pending',
        upi: upi,
        date: new Date().toLocaleString()
      }

      withdrawals.unshift(newWd)
      localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals))

      showToast('Withdrawal request submitted successfully! Status: Pending', 'success')
      showWallet()
    }
  }

  document.querySelector('#historyBtn').onclick = () => {
    const withdrawals = getAllWithdrawals().filter(w => String(w.uid) === String(user.id))
    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]').filter(d => String(d.uid) === String(user.id))

    const actionArea = document.querySelector('#walletActionArea')
    actionArea.innerHTML = `
      <h3>Transaction Records</h3>
      <div style="display:flex; gap:10px; margin-bottom:10px;">
        <button id="histWdBtn" class="main-btn" style="flex:1; background:#2563eb; font-size:12px;">Withdrawals (${withdrawals.length})</button>
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
        <div style="background:#111; padding:8px; margin-bottom:6px; border-radius:6px; border-left:3px solid ${w.status === 'Completed' ? '#22c55e' : w.status === 'Rejected' ? '#ef4444' : '#facc15'};">
          <strong>${w.amount} Coins</strong> via UPI (${escapeHtml(w.upi)})<br>
          <span style="color:#aaa;">Status: <strong>${w.status}</strong></span><br>
          <small style="color:#666;">${w.date}</small>
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
        <div style="background:#111; padding:8px; margin-bottom:6px; border-radius:6px; border-left:3px solid ${d.status === 'Completed' ? '#22c55e' : '#facc15'};">
          <strong>₹${d.amount}</strong> (+₹${d.bonus || 0} Bonus)<br>
          <span style="color:#aaa;">UTR: ${escapeHtml(d.utr)} | Status: <strong>${d.status}</strong></span><br>
          <small style="color:#666;">${d.date}</small>
        </div>
      `).join('')
    }

    renderWd()

    document.querySelector('#histWdBtn').onclick = (e) => {
      e.target.style.background = '#2563eb'
      document.querySelector('#histDepBtn').style.background = '#334155'
      renderWd()
    }

    document.querySelector('#histDepBtn').onclick = (e) => {
      e.target.style.background = '#2563eb'
      document.querySelector('#histWdBtn').style.background = '#334155'
      renderDep()
    }
  }

  connectNavigation()
}

/* =========================
   ACCOUNT
========================= */

function showAccount() {
  stopAllSpecialTimers()
  currentPage = 'account'
  const user = getCurrentUser()

  app().innerHTML = `
    <div class="app-shell">
      <h1>My Account</h1>
      <section class="normal-card">
        <div class="profile-row">
          <div class="avatar">
            ${escapeHtml(user.name.charAt(0).toUpperCase())}
          </div>
          <div>
            <h2>${escapeHtml(user.name)}</h2>
            <p>+91 ${escapeHtml(user.phone)}</p>
          </div>
        </div>

        <div class="account-row">
          <span>User ID</span>
          <strong>${escapeHtml(user.id)}</strong>
        </div>

        <div class="account-row">
          <span>Referral</span>
          <strong>${escapeHtml(user.referralCode)}</strong>
        </div>

        <div class="account-row">
          <span>Balance</span>
          <strong>${getBalance().toLocaleString()}</strong>
        </div>
      </section>

      <button id="supportAccountBtn" class="main-btn" style="background:#2563eb; margin-bottom:10px;">🎧 Customer Support</button>
      <button id="logoutBtn" class="logout-btn">Logout</button>
      ${navigation('account')}
    </div>
  `

  document.querySelector('#supportAccountBtn').onclick = openCustomerService

  document.querySelector('#logoutBtn').onclick = () => {
    logoutUser()
    showLogin()
  }

  connectNavigation()
}

/* =========================
   ADMIN PANEL
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
        <button id="aDemoId">🪪 Create Demo ID</button>
        <button id="aPlayers">👥 Players</button>
        <button id="aAgents">👔 Agents</button>
        <button id="aGames">🎮 Game Control</button>
        <button id="aControl">🎯 Win/Loss Control</button>
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
  document.querySelector('#aDemoId').onclick = adminDemoId
  document.querySelector('#aPlayers').onclick = adminPlayers
  document.querySelector('#aAgents').onclick = adminAgents
  document.querySelector('#aGames').onclick = adminGames
  document.querySelector('#aControl').onclick = adminWinLossControl
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
  const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]')
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
              Amount: <strong style="color:#38bdf8;">${w.amount} Coins</strong> | UPI: <strong>${escapeHtml(w.upi)}</strong><br>
              <small style="color:#aaa;">Date: ${w.date}</small>
            </div>
            <div>
              <span style="padding:4px 8px; border-radius:4px; font-size:12px; font-weight:bold; background:${w.status === 'Completed' ? '#065f46' : w.status === 'Rejected' ? '#991b1b' : '#854d0e'}; color:#fff;">${w.status}</span>
            </div>
          </div>
          <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#f59e0b;" onclick="window.updateWd('${w.id}', 'Processing')">Mark Processing</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#22c55e;" onclick="window.updateWd('${w.id}', 'Completed')">Mark Completed</button>
            <button class="main-btn" style="padding:6px 12px; font-size:12px; background:#ef4444;" onclick="window.updateWd('${w.id}', 'Rejected')">Reject & Refund</button>
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
  const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]')
  document.querySelector('#adminContent').innerHTML = `
    <h1>Deposit Approvals</h1>
    <div style="margin-top:15px;">
      ${deposits.length === 0 ? '<p>No deposit requests found.</p>' : deposits.map(d => `
        <section class="normal-card" style="margin-bottom:12px; border-left:4px solid ${d.status === 'Completed' ? '#22c55e' : '#facc15'};">
          <div>
            <strong>ID: ${d.id}</strong> (User: ${d.uid})<br>
            Amount: <strong style="color:#38bdf8;">₹${d.amount}</strong> (+₹${d.bonus} Bonus) | UTR: <strong>${escapeHtml(d.utr)}</strong><br>
            <small style="color:#aaa;">Date: ${d.date} | Status: <strong>${d.status}</strong></small>
          </div>
          ${d.status === 'Pending' ? `
            <div style="margin-top:10px;">
              <button class="main-btn" style="background:#22c55e; padding:6px 12px; font-size:12px;" onclick="window.approveDep('${d.id}')">Approve & Add Balance</button>
            </div>
          ` : ''}
        </section>
      `).join('')}
    </div>
  `
}

window.approveDep = function(id) {
  const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]')
  const dep = deposits.find(d => d.id === id)
  if (!dep || dep.status !== 'Pending') return

  dep.status = 'Completed'
  localStorage.setItem('kivoro_deposits', JSON.stringify(deposits))

  const users = getAllUsers()
  const user = users.find(u => u.id === dep.uid)
  if (user) {
    user.balance = Number(user.balance || 0) + Number(dep.amount) + Number(dep.bonus)
    saveAllUsers(users)
  }

  showToast('Deposit approved and balance credited!', 'success')
  adminDepositsPanel()
}

function adminWinLossControl() {
  const state = getAdminState()
  document.querySelector('#adminContent').innerHTML = `
    <h1>Game Win / Loss Control</h1>
    <section class="normal-card" style="margin-bottom:20px;">
      <h3>🎯 Wingo Mode-Wise Result Control</h3>
      <div style="margin-bottom:12px;">
        <label style="font-size:13px; color:#38bdf8; font-weight:bold;">⏱️ Wingo 30 Sec Mode:</label>
        <select id="ctrlWingo30" style="width:100%; padding:10px; margin-top:5px; border-radius:8px; background:#111; color:#fff; border:1px solid #333;">
          <option value="">Random (Normal Mode)</option>
          <option value="GREEN" ${state.modeForcedResults?.wingo30 === 'GREEN' ? 'selected' : ''}>Force GREEN Win</option>
          <option value="RED" ${state.modeForcedResults?.wingo30 === 'RED' ? 'selected' : ''}>Force RED Win</option>
          <option value="VIOLET" ${state.modeForcedResults?.wingo30 === 'VIOLET' ? 'selected' : ''}>Force VIOLET Win</option>
          <option value="BIG" ${state.modeForcedResults?.wingo30 === 'BIG' ? 'selected' : ''}>Force BIG Win</option>
          <option value="SMALL" ${state.modeForcedResults?.wingo30 === 'SMALL' ? 'selected' : ''}>Force SMALL Win</option>
          ${[0,1,2,3,4,5,6,7,8,9].map(n => `<option value="${n}" ${String(state.modeForcedResults?.wingo30) === String(n) ? 'selected' : ''}>Number ${n}</option>`).join('')}
        </select>
      </div>
      <button id="saveAllModesBtn" class="main-btn" style="background:#22c55e;">Save Wingo Controls</button>
    </section>
  `

  document.querySelector('#saveAllModesBtn').onclick = () => {
    const v30 = document.querySelector('#ctrlWingo30').value
    setModeForcedResult('wingo30', v30 === '' ? null : v30)
    showToast('Wingo Control saved successfully!', 'success')
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
   WINGO TIMER
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

/* =========================
   START APP
========================= */

const currentUser = getCurrentUser()

if (!currentUser) {
  showLogin()
} else if (isAdmin(currentUser)) {
  showAdmin()
} else {
  showHome()
}