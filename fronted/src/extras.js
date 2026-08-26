/* =========================
   EXTRAS & UTILITIES (Kivoro Play)
========================= */

// 1. Toast Notification (91 Club Style Floating Popups)
export function showToast(message, type = 'info') {
  const existing = document.querySelector('.kivoro-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'kivoro-toast'
  
  let bg = '#1e293b'
  if (type === 'success') bg = '#16a34a'
  if (type === 'error') bg = '#dc2626'

  toast.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bg};
    color: #fff;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    z-index: 99999;
    transition: opacity 0.3s ease;
  `
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 2500)
}

// 2. Customer Service Modal / Dialog Component (91 Club Style Support)
export function openCustomerService() {
  document.querySelector('.support-modal')?.remove()

  const modal = document.createElement('div')
  modal.className = 'support-modal'
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    display: grid;
    place-items: center;
    z-index: 99999;
  `
  modal.innerHTML = `
    <div style="background:#1e293b; padding:25px; border-radius:14px; width:90%; max-width:350px; text-align:center; color:#fff; box-shadow:0 10px 25px rgba(0,0,0,0.5);">
      <h2 style="margin-bottom:10px;">🎧 Customer Support</h2>
      <p style="font-size:13px; color:#94a3b8; margin-bottom:20px;">Kisi bhi samasya ya deposit/withdrawal issue ke liye hamare official support se judein:</p>
      <a href="https://t.me/" target="_blank" style="display:block; background:#2563eb; color:#fff; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; margin-bottom:10px;">Telegram Support</a>
      <a href="https://wa.me/" target="_blank" style="display:block; background:#22c55e; color:#fff; padding:12px; border-radius:8px; text-decoration:none; font-weight:bold; margin-bottom:15px;">WhatsApp Support</a>
      <button id="closeSupport" style="background:#334155; color:#fff; border:none; padding:10px 20px; border-radius:8px; font-weight:bold; cursor:pointer; width:100%;">Close</button>
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
    console.error(e)
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
   KIVORO PLAY - DEPOSIT HISTORY UI & HELPERS
========================= */

// Deposit submit aur history display karne ka helper
window.handleUserDepositUI = function(userId, amount, utrNumber) {
  if (typeof verifyAndProcessDeposit === 'function') {
    const result = verifyAndProcessDeposit(userId, amount, utrNumber);
    alert(result.message);
    if (result.success) {
      renderDepositHistory(userId);
    }
  } else {
    console.log('Deposit verification module active');
  }
};

// 91 Club style history render karne ka function
window.renderDepositHistory = function(userId) {
  try {
    const container = document.getElementById('deposit-history-container');
    if (!container) return; // Agar element nahi hai toh chupchaap skip karega (purana code safe rahega)

    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');
    const myDeposits = deposits.filter(d => d.uid === userId);

    if (myDeposits.length === 0) {
      container.innerHTML = '<p style="text-align:center; color:#888; padding:10px;">No deposit records found</p>';
      return;
    }

    let html = '';
    myDeposits.forEach(item => {
      html += `
        <div style="background: #1a1a2e; padding: 12px; margin-bottom: 8px; border-radius: 8px; color: #fff; border-left: 4px solid #00E676;">
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span style="color: #00E676;">₹${item.amount}</span>
            <span style="background: rgba(0, 230, 118, 0.2); color: #00E676; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${item.status}</span>
          </div>
          <div style="font-size: 12px; color: #bbb; margin-top: 4px;">UTR ID: ${item.utr}</div>
          <div style="font-size: 10px; color: #777; margin-top: 2px;">Date: ${item.date}</div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (e) {
    console.error('History render error:', e);
  }
};
/* =========================
   KIVORO PLAY - WITHDRAWAL STATUS & PROMOTION DATA SYSTEM
========================= */

// 1. Withdrawal Request with Pending -> Processing -> Completed Flow
window.requestUserWithdrawal = function(userId, amount, bankDetails) {
  const user = JSON.parse(localStorage.getItem('kivoro_current_user') || '{}');
  const withdrawAmount = Number(amount);

  if (!user || user.id !== userId) {
    alert('Please login first!');
    return { success: false, message: 'Not logged in' };
  }

  // Need to Bet check (Aapka rule)
  if (user.needToBet && user.balance < withdrawAmount) {
    alert('Withdrawal failed: Minimum betting requirement or insufficient balance!');
    return { success: false, message: 'Insufficient balance or betting requirement pending' };
  }

  // Save withdrawal with 'Pending' status (jaise 91 Club mein hota hai)
  const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]');
  const newWithdrawal = {
    id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
    uid: userId,
    amount: withdrawAmount,
    status: 'Pending', // Start with Pending
    bank: bankDetails || 'Bank Account',
    date: new Date().toLocaleString(),
    loginDate: user.createdAt || new Date().toLocaleString()
  };

  withdrawals.unshift(newWithdrawal);
  localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals));

  alert('Withdrawal request submitted successfully! Status: Pending');
  return { success: true, message: 'Withdrawal request submitted', data: newWithdrawal };
};

// 2. Promotion & Sub-Node Data Calculator (Invited users, Deposit, Betting, Commission)
window.loadPromotionSubNodeData = function(userReferralCode) {
  try {
    const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');

    // Find users invited by this referral code
    const invitedUsers = users.filter(u => u.inviteCode === userReferralCode);
    const totalRegister = invitedUsers.length;

    let totalDeposit = 0;
    let totalBetting = 0;

    invitedUsers.forEach(invUser => {
      // Calculate total deposits of invited users
      const userDeps = deposits.filter(d => d.uid === invUser.id && d.status === 'Completed');
      userDeps.forEach(d => { totalDeposit += Number(d.amount) || 0; });
    });

    // Commission calculation (e.g., 2% of total deposit/betting)
    const commissionEarned = totalDeposit * 0.02;

    return {
      totalRegister,
      totalDeposit,
      totalBetting: totalDeposit * 1.5, // Estimated turnover/betting
      commissionEarned: commissionEarned.toFixed(2)
    };
  } catch (e) {
    console.error('Promotion data error:', e);
    return { totalRegister: 0, totalDeposit: 0, totalBetting: 0, commissionEarned: 0 };
  }
};
/* =========================
   KIVORO PLAY - OVERRIDE FIX FOR WITHDRAWAL & UPI
========================= */

// Purane wale galat/direct success function ko override karke Pending status lagane ke liye
window.requestUserWithdrawal = function(amount, upiId) {
  const currentUser = JSON.parse(localStorage.getItem('kivoro_current_user') || 'null');
  
  if (!currentUser) {
    alert('Please login first!');
    return;
  }

  const cleanUpi = String(upiId || '').trim();
  const withdrawAmount = Number(amount);

  // UPI validation (fake ya khali UPI rokne ke liye)
  if (!cleanUpi || !cleanUpi.includes('@')) {
    alert('Kripya ek valid UPI ID enter karein (jaise user@paytm)');
    return;
  }

  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    alert('Invalid withdrawal amount!');
    return;
  }

  // Balance check
  if (Number(currentUser.balance) < withdrawAmount) {
    alert('Insufficient balance for withdrawal!');
    return;
  }

  // Balance cut karo aur save karo
  currentUser.balance = Number(currentUser.balance) - withdrawAmount;
  
  // Local storage aur current user update
  const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
  const uIndex = users.findIndex(u => u.id === currentUser.id);
  if (uIndex !== -1) {
    users[uIndex].balance = currentUser.balance;
    localStorage.setItem('kivoro_users', JSON.stringify(users));
  }
  localStorage.setItem('kivoro_current_user', JSON.stringify(currentUser));

  // 91 Club Style: Pending Status (Direct success nahi hoga!)
  const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]');
  const newWd = {
    id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
    uid: currentUser.id,
    amount: withdrawAmount,
    status: 'Pending', // Ab yahan Pending dikhega!
    upi: cleanUpi,
    date: new Date().toLocaleString()
  };

  withdrawals.unshift(newWd);
  localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals));

  // UI ko turant update karne ke liye
  alert('Withdrawal request submitted successfully! Status: Pending');
  window.location.reload(); 
};