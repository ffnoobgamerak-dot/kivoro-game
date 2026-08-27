/* =========================
   EXTRAS & UTILITIES (YaarWin / Kivoro Club)
   + Toast Notification (91 Club Style Floating Popups)
   + Customer Service Modal (Telegram / WhatsApp)
   + User Bet Records Storage
   + Deposit & Withdrawal UI Helpers
   + Promotion Sub-Node Data Calculator
========================= */

// 1. Toast Notification (91 Club Style Floating Popups)
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.kivoro-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'kivoro-toast'
  
  let bg = '#1e293b'
  if (type === 'success') bg = '#00d26a'
  if (type === 'error') bg = '#ef4444'

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bg};
    color: #fff;
    padding: 12px 24px;
    border-radius: 25px;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 6px 20px rgba(0,0,0,0.3);
    z-index: 999999;
    transition: opacity 0.3s ease;
    text-align: center;
    white-space: nowrap;
  `
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 2500)
}

// 2. Customer Service Modal / Dialog Component (YaarWin Style Support)
export function openCustomerService() {
  document.querySelector('.support-modal')?.remove()

  const modal = document.createElement('div')
  modal.className = 'support-modal'
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(4px);
    display: grid;
    place-items: center;
    z-index: 999999;
  `
  modal.innerHTML = `
    <div style="background:#fff; padding:25px; border-radius:18px; width:90%; max-width:340px; text-align:center; color:#1e293b; box-shadow:0 15px 35px rgba(0,0,0,0.25);">
      <div style="font-size:45px; margin-bottom:8px;">🎧</div>
      <h2 style="margin-bottom:6px; font-size:20px; color:#00d26a; font-weight:800;">24/7 Customer Support</h2>
      <p style="font-size:13px; color:#64748b; margin-bottom:20px; line-height:1.4;">Kisi bhi recharge, withdrawal ya game samasya ke liye official helpline se judein:</p>
      
      <a href="https://t.me/" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#0088cc; color:#fff; padding:12px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:14px; margin-bottom:10px;">
        <span>✈️</span> Telegram Live Chat
      </a>
      
      <a href="https://wa.me/" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:8px; background:#25d366; color:#fff; padding:12px; border-radius:10px; text-decoration:none; font-weight:bold; font-size:14px; margin-bottom:15px;">
        <span>💬</span> WhatsApp Official Support
      </a>
      
      <button id="closeSupport" style="background:#e2e8f0; color:#475569; border:none; padding:10px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">Close</button>
    </div>
  `
  document.body.appendChild(modal)
  document.querySelector('#closeSupport').onclick = () => modal.remove()
}

// 3. User Bet History Storage Helper
export function saveUserBetRecord(userId, record) {
  try {
    const key = `kivoro_bets_${userId}`
    const bets = JSON.parse(localStorage.getItem(key) || '[]')
    bets.unshift(record)
    localStorage.setItem(key, JSON.stringify(bets.slice(0, 50)))
  } catch (e) {
    console.error('Error saving bet record:', e)
  }
}

export function getUserBetRecords(userId) {
  try {
    return JSON.parse(localStorage.getItem(`kivoro_bets_${userId}`) || '[]')
  } catch {
    return []
  }
}

/* =========================
   DEPOSIT HISTORY UI & HELPERS
========================= */

window.handleUserDepositUI = function(userId, amount, utrNumber) {
  if (typeof verifyAndProcessDeposit === 'function') {
    const result = verifyAndProcessDeposit(userId, amount, utrNumber);
    alert(result.message);
    if (result.success) {
      window.renderDepositHistory(userId);
    }
  } else {
    console.log('Deposit verification module active');
  }
};

window.renderDepositHistory = function(userId) {
  try {
    const container = document.getElementById('deposit-history-container');
    if (!container) return;

    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');
    const myDeposits = deposits.filter(d => String(d.uid) === String(userId));

    if (myDeposits.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#888; padding:10px;">No deposit records found</p>';
      return;
    }

    let html = '';
    myDeposits.forEach(item => {
      html += `
        <div style="background: #ffffff; padding: 12px; margin-bottom: 8px; border-radius: 8px; border-left: 4px solid #00d26a; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span style="color: #00d26a;">₹${item.amount}</span>
            <span style="background: rgba(0, 210, 106, 0.15); color: #00d26a; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${item.status}</span>
          </div>
          <div style="font-size: 12px; color: #64748b; margin-top: 4px;">UTR: ${item.utr}</div>
          <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Date: ${item.date || item.createdAt}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (e) {
    console.error('History render error:', e);
  }
};

/* =========================
   WITHDRAWAL STATUS & PROMOTION DATA SYSTEM
========================= */

window.requestUserWithdrawal = function(amount, upiId) {
  const currentUser = JSON.parse(localStorage.getItem('kivoro_current_user') || 'null');
  
  if (!currentUser) {
    alert('Please login first!');
    return { success: false, message: 'Not logged in' };
  }

  const cleanUpi = String(upiId || '').trim();
  const withdrawAmount = Number(amount);

  if (!cleanUpi || !cleanUpi.includes('@')) {
    alert('Kripya ek valid UPI ID enter karein (jaise user@paytm)');
    return { success: false, message: 'Invalid UPI' };
  }

  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    alert('Invalid withdrawal amount!');
    return { success: false, message: 'Invalid amount' };
  }

  if (Number(currentUser.balance) < withdrawAmount) {
    alert('Insufficient balance for withdrawal!');
    return { success: false, message: 'Insufficient balance' };
  }

  currentUser.balance = Number(currentUser.balance) - withdrawAmount;
  
  const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
  const uIndex = users.findIndex(u => u.id === currentUser.id);
  if (uIndex !== -1) {
    users[uIndex].balance = currentUser.balance;
    localStorage.setItem('kivoro_users', JSON.stringify(users));
  }
  localStorage.setItem('kivoro_current_user', JSON.stringify(currentUser));

  const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]');
  const newWd = {
    id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
    uid: currentUser.id,
    amount: withdrawAmount,
    status: 'Pending',
    upi: cleanUpi,
    date: new Date().toLocaleString(),
    createdAt: new Date().toISOString()
  };

  withdrawals.unshift(newWd);
  localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals));

  alert('Withdrawal request submitted successfully! Status: Pending');
  return { success: true, message: 'Withdrawal submitted', data: newWd };
};

window.loadPromotionSubNodeData = function(userReferralCode) {
  try {
    const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');

    const invitedUsers = users.filter(u => u.inviteCode === userReferralCode);
    const totalRegister = invitedUsers.length;

    let totalDeposit = 0;

    invitedUsers.forEach(invUser => {
      const userDeps = deposits.filter(d => d.uid === invUser.id && d.status === 'Completed');
      userDeps.forEach(d => { totalDeposit += Number(d.amount) || 0; });
    });

    const commissionEarned = totalDeposit * 0.02;

    return {
      totalRegister,
      totalDeposit,
      totalBetting: totalDeposit * 1.5,
      commissionEarned: commissionEarned.toFixed(2)
    };
  } catch (e) {
    console.error('Promotion data error:', e);
    return { totalRegister: 0, totalDeposit: 0, totalBetting: 0, commissionEarned: 0 };
  }
};