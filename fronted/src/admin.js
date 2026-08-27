/* =========================
   KIVORO PLAY - ADMIN PANEL LOGIC (Enhanced 91 Club / YaarWin Edition)
   + All Modes Wingo Control (30s, 1m, 3m, 5m)
   + Aviator & Mini Games Outcome Control
   + Full Deposit & Withdrawal Flow Control (Pending / Processing / Completed / Rejected)
   + Detailed Subordinate Data & Agency Ledger
   + Zero Deletions: All Existing Functions Preserved
========================= */

const ADMIN_PHONE = '9999999999';

/* =========================
   ADMIN AUTH & AUTO-INIT
========================= */

export function isAdmin(user) {
  if (!user) return false;
  return user.phone === ADMIN_PHONE || user.role === 'ADMIN';
}

function ensureAdminExists() {
  try {
    const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
    const adminExists = users.some(u => u.phone === ADMIN_PHONE || u.role === 'ADMIN');
    if (!adminExists) {
      users.unshift({
        id: 'ADMIN-001',
        name: 'Super Admin',
        phone: ADMIN_PHONE,
        password: 'admin',
        role: 'ADMIN',
        balance: 999999,
        referralCode: 'ADMINREF'
      });
      localStorage.setItem('kivoro_users', JSON.stringify(users));
    }
  } catch (e) {
    console.error('Admin init error:', e);
  }
}
ensureAdminExists();

/* =========================
   ADMIN STATE
========================= */

export function getAdminState() {
  try {
    const defaultState = {
      games: {
        wingo30: true,
        wingo60: true,
        wingo180: true,
        wingo300: true,
        aviator: true,
        dice: true,
        coinflip: true,
        luckywheel: true,
        numbergame: true
      },
      lockedGames: {},
      announcement: 'Welcome to YaarWin / Kivoro Club! Live lottery & fair gameplay.',
      forcedResult: null,
      modeForcedResults: {
        wingo30: null,
        wingo60: null,
        wingo180: null,
        wingo300: null,
        aviator: null,
        dice: null,
        coinflip: null,
        luckywheel: null,
        numbergame: null
      },
      giftCodes: [],
      promotion: {
        enabled: true,
        commissionRate: 2,
        commissionDelayDays: 1
      }
    };

    const saved = localStorage.getItem('kivoro_admin_state');
    if (!saved) {
      localStorage.setItem('kivoro_admin_state', JSON.stringify(defaultState));
      return defaultState;
    }

    const parsed = JSON.parse(saved);
    return {
      ...defaultState,
      ...parsed,
      games: { ...defaultState.games, ...(parsed.games || {}) },
      lockedGames: { ...(parsed.lockedGames || {}) },
      modeForcedResults: { ...defaultState.modeForcedResults, ...(parsed.modeForcedResults || {}) },
      promotion: { ...defaultState.promotion, ...(parsed.promotion || {}) }
    };
  } catch (error) {
    console.error('Error fetching admin state:', error);
    return {
      games: { wingo30: true, wingo60: true, wingo180: true, wingo300: true, aviator: true },
      lockedGames: {},
      announcement: '',
      forcedResult: null,
      modeForcedResults: { wingo30: null, wingo60: null, wingo180: null, wingo300: null, aviator: null },
      giftCodes: [],
      promotion: { enabled: true, commissionRate: 2, commissionDelayDays: 1 }
    };
  }
}

export function saveAdminState(state) {
  try {
    localStorage.setItem('kivoro_admin_state', JSON.stringify(state));
    return true;
  } catch (error) {
    console.error('Error saving admin state:', error);
    return false;
  }
}

/* =========================
   GAME CONTROLS (ALL GAMES)
========================= */

export function setGameEnabled(gameKey, enabled) {
  try {
    const state = getAdminState();
    if (!state.games) state.games = {};
    state.games[gameKey] = Boolean(enabled);
    saveAdminState(state);
  } catch (error) {
    console.error('Error setting game enabled status:', error);
  }
}

export function setGameLocked(gameKey, locked) {
  try {
    const state = getAdminState();
    if (!state.lockedGames) state.lockedGames = {};
    state.lockedGames[gameKey] = Boolean(locked);
    saveAdminState(state);
  } catch (error) {
    console.error('Error setting game lock status:', error);
  }
}

export function setAnnouncement(text) {
  try {
    const state = getAdminState();
    state.announcement = String(text || '');
    saveAdminState(state);
  } catch (error) {
    console.error('Error updating announcement:', error);
  }
}

export function setForcedResult(result) {
  try {
    const state = getAdminState();
    state.forcedResult = result;
    saveAdminState(state);
  } catch (error) {
    console.error('Error setting forced result:', error);
  }
}

export function setModeForcedResult(modeKey, result) {
  try {
    const state = getAdminState();
    if (!state.modeForcedResults) state.modeForcedResults = {};
    state.modeForcedResults[modeKey] = result;
    saveAdminState(state);
    return { success: true, message: `${modeKey} result set to ${result || 'RANDOM'}` };
  } catch (error) {
    console.error('Error setting mode forced result:', error);
    return { success: false, message: 'Failed to update control' };
  }
}

// 🎯 Quick helper for Aviator crash control
export function setAviatorCrashPoint(multiplier) {
  return setModeForcedResult('aviator', multiplier ? Number(multiplier) : null);
}

// 🎯 Quick helper for Mini-Game outcome
export function setMiniGameControl(gameName, outcome) {
  return setModeForcedResult(String(gameName).toLowerCase().replace(/\s+/g, ''), outcome);
}

/* =========================
   USER MANAGEMENT
========================= */

export function getAllUsers() {
  try {
    const users = JSON.parse(localStorage.getItem('kivoro_users') || '[]');
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

export function saveAllUsers(users) {
  try {
    localStorage.setItem('kivoro_users', JSON.stringify(Array.isArray(users) ? users : []));
    return true;
  } catch (error) {
    console.error('Error saving all users:', error);
    return false;
  }
}

export function getUserById(userId) {
  const users = getAllUsers();
  return users.find(u => String(u.id) === String(userId)) || null;
}

/* =========================
   BALANCE ADJUSTMENT
========================= */

export function adjustDemoBalance(userId, amountChange) {
  try {
    const users = getAllUsers();
    const user = users.find(u => u.id === userId);
    if (!user) {
      return { success: false, message: 'User not found in database' };
    }

    const currentBal = Number(user.balance || 0);
    const change = Number(amountChange) || 0;
    user.balance = Math.max(0, currentBal + change);
    
    saveAllUsers(users);

    const currentSessionUser = JSON.parse(localStorage.getItem('kivoro_current_user') || '{}');
    if (currentSessionUser && currentSessionUser.id === userId) {
      currentSessionUser.balance = user.balance;
      localStorage.setItem('kivoro_current_user', JSON.stringify(currentSessionUser));
    }

    saveAdminTransaction({
      uid: userId,
      type: change >= 0 ? 'Admin Credit' : 'Admin Debit',
      amount: Math.abs(change),
      status: 'Completed',
      description: 'Balance adjusted by admin'
    });

    return { success: true, newBalance: user.balance };
  } catch (error) {
    console.error('Error adjusting demo balance:', error);
    return { success: false, message: 'Internal error updating balance' };
  }
}

/* =========================
   ADMIN TRANSACTION LEDGER
========================= */

export function getAllTransactions() {
  try {
    const data = JSON.parse(localStorage.getItem('kivoro_transactions') || '[]');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function getUserTransactions(userId) {
  return getAllTransactions().filter(tx => String(tx.uid) === String(userId));
}

export function saveAdminTransaction(transaction = {}) {
  try {
    const transactions = getAllTransactions();
    const record = {
      id: transaction.id || 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      uid: transaction.uid || '',
      type: transaction.type || 'Admin',
      amount: Number(transaction.amount) || 0,
      status: transaction.status || 'Completed',
      description: transaction.description || '',
      reference: transaction.reference || '',
      createdAt: transaction.createdAt || new Date().toISOString(),
      date: transaction.date || new Date().toLocaleString(),
      ...transaction
    };

    transactions.unshift(record);
    localStorage.setItem('kivoro_transactions', JSON.stringify(transactions));
    return { success: true, transaction: record };
  } catch (error) {
    console.error('Error saving admin transaction:', error);
    return { success: false, message: 'Transaction save failed' };
  }
}

/* =========================
   USER SEARCH
========================= */

export function searchUsers(searchTerm) {
  const term = String(searchTerm || '').trim().toLowerCase();
  if (!term) return getAllUsers();

  return getAllUsers().filter(user =>
    String(user.id || '').toLowerCase().includes(term) ||
    String(user.uid || '').toLowerCase().includes(term) ||
    String(user.name || '').toLowerCase().includes(term) ||
    String(user.phone || '').toLowerCase().includes(term) ||
    String(user.referralCode || '').toLowerCase().includes(term)
  );
}

/* =========================
   DEMO / AGENT CREATION
========================= */

export function createDemoId(name, phone, password, role) {
  try {
    if (!phone || String(phone).trim().length !== 10) {
      return { success: false, message: 'Kripya valid 10-digit mobile number enter karein' };
    }

    const users = getAllUsers();
    if (users.some(u => String(u.phone) === String(phone))) {
      return { success: false, message: 'Yeh phone number pehle se registered hai' };
    }

    const newUser = {
      id: 'USR-' + Math.floor(100000 + Math.random() * 900000),
      name: String(name).trim() || 'Valued User',
      phone: String(phone).trim(),
      password: String(password).trim() || '123456',
      role: role === 'AGENT' ? 'AGENT' : 'USER',
      balance: 1000,
      needToBet: 0,
      referralCode: 'REF-' + Math.floor(1000 + Math.random() * 9000),
      inviteCode: '',
      referredBy: null,
      upiId: '',
      lockedUpi: false,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveAllUsers(users);
    return { success: true, user: newUser };
  } catch (error) {
    console.error('Error creating demo ID:', error);
    return { success: false, message: 'Failed to create demo ID' };
  }
}

export function payAgentDemoSalary(agentId, amount) {
  try {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return { success: false, message: 'Valid salary amount enter karein' };
    }
    return adjustDemoBalance(agentId, amt);
  } catch (error) {
    console.error('Error paying agent salary:', error);
    return { success: false, message: 'Failed to process salary payment' };
  }
}

/* =========================
   GIFT CODES
========================= */

export function createGiftCode(code, coins, maxUses) {
  try {
    const trimmedCode = String(code || '').trim().toUpperCase();
    const rewardCoins = Number(coins);
    const usesLimit = Number(maxUses);

    if (!trimmedCode) return { success: false, message: 'Gift code string zaroori hai' };
    if (!rewardCoins || rewardCoins <= 0) return { success: false, message: 'Valid reward coin amount dalein' };
    if (!usesLimit || usesLimit <= 0) return { success: false, message: 'Valid maximum uses limit dalein' };

    const state = getAdminState();
    if (!state.giftCodes) state.giftCodes = [];

    if (state.giftCodes.some(g => g.code === trimmedCode)) {
      return { success: false, message: 'Yeh gift code pehle se exist karta hai' };
    }

    state.giftCodes.push({
      code: trimmedCode,
      coins: rewardCoins,
      maxUses: usesLimit,
      used: 0,
      enabled: true,
      createdAt: new Date().toISOString()
    });

    saveAdminState(state);
    return { success: true, message: 'Gift code successfully created' };
  } catch (error) {
    console.error('Error creating gift code:', error);
    return { success: false, message: 'Error saving gift code' };
  }
}

export function toggleGiftCode(code, enabled) {
  try {
    const state = getAdminState();
    if (!state.giftCodes) return;
    const gift = state.giftCodes.find(g => g.code === code);
    if (gift) {
      gift.enabled = Boolean(enabled);
      saveAdminState(state);
    }
  } catch (error) {
    console.error('Error toggling gift code:', error);
  }
}

export function claimGiftCode(code, userId) {
  try {
    const trimmedCode = String(code || '').trim().toUpperCase();
    if (!trimmedCode) return { success: false, message: 'Kripya gift code enter karein' };

    const state = getAdminState();
    if (!state.giftCodes) state.giftCodes = [];

    const gift = state.giftCodes.find(g => g.code === trimmedCode);
    if (!gift || !gift.enabled) return { success: false, message: 'Invalid ya expired gift code hai' };
    if (gift.used >= gift.maxUses) return { success: false, message: 'Is gift code ki maximum use limit khatam ho chuki hai' };

    let userClaims = [];
    try {
      userClaims = JSON.parse(localStorage.getItem('kivoro_claimed_' + userId) || '[]');
    } catch {
      userClaims = [];
    }

    if (userClaims.includes(trimmedCode)) {
      return { success: false, message: 'Aap yeh gift code pehle hi claim kar chuke hain' };
    }

    userClaims.push(trimmedCode);
    localStorage.setItem('kivoro_claimed_' + userId, JSON.stringify(userClaims));

    gift.used += 1;
    saveAdminState(state);

    return { success: true, coins: gift.coins, message: `Successfully claimed ${gift.coins} coins!` };
  } catch (error) {
    console.error('Error claiming gift code:', error);
    return { success: false, message: 'Error processing gift code claim' };
  }
}

/* =========================
   WITHDRAWAL MANAGEMENT (Full 4-Way Status Control)
========================= */

export function getAllWithdrawals() {
  try {
    const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]');
    return Array.isArray(withdrawals) ? withdrawals : [];
  } catch {
    return [];
  }
}

export function getUserWithdrawals(userId) {
  return getAllWithdrawals().filter(w => String(w.uid) === String(userId));
}

const WITHDRAWAL_STATUSES = ['Pending', 'Processing', 'Completed', 'Rejected'];

export function updateAdminWithdrawalStatus(withdrawalId, newStatus) {
  try {
    if (!WITHDRAWAL_STATUSES.includes(newStatus)) {
      return { success: false, message: 'Invalid withdrawal status' };
    }

    const withdrawals = getAllWithdrawals();
    const index = withdrawals.findIndex(w => w.id === withdrawalId);
    if (index === -1) {
      return { success: false, message: 'Withdrawal request not found' };
    }

    const item = withdrawals[index];
    const oldStatus = item.status;

    if (oldStatus === 'Completed' && newStatus !== 'Completed') {
      return { success: false, message: 'Completed withdrawal status cannot be reversed' };
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();
    item.updatedDate = new Date().toLocaleString();

    // 🔄 Auto-refund balance if rejected
    if (newStatus === 'Rejected' && oldStatus !== 'Rejected') {
      const users = getAllUsers();
      const user = users.find(u => u.id === item.uid);
      if (user) {
        user.balance = Number(user.balance || 0) + Number(item.amount || 0);
        saveAllUsers(users);

        const curr = JSON.parse(localStorage.getItem('kivoro_current_user') || '{}');
        if (curr && curr.id === item.uid) {
          curr.balance = user.balance;
          localStorage.setItem('kivoro_current_user', JSON.stringify(curr));
        }
      }
    }

    localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals));

    saveAdminTransaction({
      uid: item.uid,
      type: 'Withdrawal',
      amount: Number(item.amount) || 0,
      status: newStatus,
      description: `Withdrawal status: ${oldStatus} → ${newStatus}`,
      reference: item.id
    });

    return { success: true, message: `Withdrawal status updated to ${newStatus}`, withdrawal: item };
  } catch (error) {
    console.error('Error updating withdrawal status:', error);
    return { success: false, message: 'Failed to update withdrawal status' };
  }
}

/* =========================
   DEPOSIT MANAGEMENT (Admin Approval & Rejection)
========================= */

export function getAllDeposits() {
  try {
    const deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');
    return Array.isArray(deposits) ? deposits : [];
  } catch {
    return [];
  }
}

export function updateAdminDepositStatus(depositId, newStatus) {
  try {
    const deposits = getAllDeposits();
    const index = deposits.findIndex(d => d.id === depositId);
    if (index === -1) {
      return { success: false, message: 'Deposit request not found' };
    }

    const item = deposits[index];
    const oldStatus = item.status;
    if (oldStatus === 'Completed' && newStatus !== 'Completed') {
      return { success: false, message: 'Already approved deposit cannot be changed' };
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();

    if (newStatus === 'Completed' && oldStatus !== 'Completed') {
      const users = getAllUsers();
      const user = users.find(u => u.id === item.uid);
      if (user) {
        const totalCredited = Number(item.amount || 0) + Number(item.bonus || 0);
        user.balance = Number(user.balance || 0) + totalCredited;
        saveAllUsers(users);

        const curr = JSON.parse(localStorage.getItem('kivoro_current_user') || '{}');
        if (curr && curr.id === item.uid) {
          curr.balance = user.balance;
          localStorage.setItem('kivoro_current_user', JSON.stringify(curr));
        }

        saveAdminTransaction({
          uid: item.uid,
          type: 'Deposit',
          amount: totalCredited,
          status: 'Completed',
          description: `Deposit Approved (₹${item.amount} + ₹${item.bonus || 0} Bonus)`,
          reference: item.id
        });
      }
    }

    localStorage.setItem('kivoro_deposits', JSON.stringify(deposits));
    return { success: true, message: `Deposit marked as ${newStatus}` };
  } catch (error) {
    console.error('Error updating deposit status:', error);
    return { success: false, message: 'Failed to update deposit status' };
  }
}

/* =========================
   UPI MANAGEMENT & LOCK
========================= */

export function getUserUpiDetails(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  return {
    uid: user.id,
    upiId: user.upiId || '',
    locked: Boolean(user.lockedUpi || user.upiId),
    lockedAt: user.upiLockedAt || null
  };
}

export function isUserUpiLocked(userId) {
  const user = getUserById(userId);
  if (!user) return false;
  return Boolean(user.lockedUpi || user.upiId);
}

/* =========================
   REFERRAL & SUBORDINATE DATA (YaarWin / 91 Club Full)
========================= */

export function getAllReferralRecords() {
  try {
    const records = JSON.parse(localStorage.getItem('kivoro_referrals') || '[]');
    return Array.isArray(records) ? records : [];
  } catch {
    return [];
  }
}

export function getUserReferrals(userId) {
  const user = getUserById(userId);
  if (!user) return [];
  return getAllUsers().filter(u => u.inviteCode === user.referralCode);
}

export function getReferralDetails(userId) {
  const referrer = getUserById(userId);
  if (!referrer) {
    return {
      totalRegister: 0,
      totalDeposit: 0,
      totalDepositCount: 0,
      totalBettors: 0,
      totalBetAmount: 0,
      firstDepositCount: 0,
      firstDepositAmount: 0,
      referrals: []
    };
  }

  const referrals = getUserReferrals(userId);
  let deposits = [];
  try {
    deposits = JSON.parse(localStorage.getItem('kivoro_deposits') || '[]');
  } catch {
    deposits = [];
  }
  if (!Array.isArray(deposits)) deposits = [];

  let totalDeposit = 0;
  let totalDepositCount = 0;
  let firstDepositCount = 0;
  let firstDepositAmount = 0;

  const referralData = referrals.map(referral => {
    const userDeps = deposits.filter(
      d => String(d.uid) === String(referral.id) && d.status === 'Completed'
    );
    const depositTotal = userDeps.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
    totalDeposit += depositTotal;
    totalDepositCount += userDeps.length;

    if (userDeps.length > 0) {
      firstDepositCount += 1;
      firstDepositAmount += Number(userDeps[userDeps.length - 1].amount || 0);
    }

    return {
      uid: referral.id,
      name: referral.name,
      phone: referral.phone,
      level: 1,
      registeredAt: referral.createdAt || new Date().toISOString().split('T')[0],
      totalDeposit: depositTotal,
      commission: (depositTotal * 0.02).toFixed(2),
      referralCode: referral.referralCode
    };
  });

  return {
    totalRegister: referrals.length,
    totalDeposit,
    totalDepositCount,
    totalBettors: referrals.length,
    totalBetAmount: totalDeposit * 1.5,
    firstDepositCount,
    firstDepositAmount,
    referrals: referralData
  };
}

/* =========================
   PROMOTION SETTINGS
========================= */

export function getPromotionSettings() {
  const state = getAdminState();
  return {
    enabled: state.promotion?.enabled !== false,
    commissionRate: Number(state.promotion?.commissionRate) || 0,
    commissionDelayDays: Number(state.promotion?.commissionDelayDays) || 1
  };
}

export function setPromotionSettings(settings = {}) {
  try {
    const state = getAdminState();
    state.promotion = {
      ...(state.promotion || {}),
      enabled: settings.enabled !== undefined ? Boolean(settings.enabled) : true,
      commissionRate: Math.max(0, Number(settings.commissionRate) || 0),
      commissionDelayDays: Math.max(0, Number(settings.commissionDelayDays) || 1)
    };

    saveAdminState(state);
    return { success: true, promotion: state.promotion };
  } catch (error) {
    console.error('Error updating promotion settings:', error);
    return { success: false, message: 'Promotion settings update failed' };
  }
}

/* =========================
   ADMIN DASHBOARD SUMMARY
========================= */

export function getAdminDashboardSummary() {
  const users = getAllUsers();
  const withdrawals = getAllWithdrawals();
  const deposits = getAllDeposits();
  const transactions = getAllTransactions();

  let pendingWithdrawals = 0;
  let processingWithdrawals = 0;
  let completedWithdrawals = 0;
  let pendingDeposits = 0;

  withdrawals.forEach(w => {
    if (w.status === 'Pending') pendingWithdrawals += 1;
    if (w.status === 'Processing') processingWithdrawals += 1;
    if (w.status === 'Completed') completedWithdrawals += 1;
  });

  deposits.forEach(d => {
    if (d.status === 'Pending') pendingDeposits += 1;
  });

  return {
    totalUsers: users.length,
    totalTransactions: transactions.length,
    totalWithdrawals: withdrawals.length,
    pendingWithdrawals,
    processingWithdrawals,
    completedWithdrawals,
    pendingDeposits
  };
}