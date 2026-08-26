/* =========================
   KIVORO PLAY - AUTH & USER DATA
   Existing functionality preserved
   + UPI Lock
   + Transaction Ledger
   + Referral Tracking
========================= */


/* =========================
   BASIC USER STORAGE
========================= */

export function getAllUsersAuth() {
  try {
    const users = JSON.parse(
      localStorage.getItem('kivoro_users') || '[]'
    );

    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('Error reading users:', error);
    return [];
  }
}


export function saveAllUsersAuth(users) {
  try {
    localStorage.setItem(
      'kivoro_users',
      JSON.stringify(Array.isArray(users) ? users : [])
    );
  } catch (error) {
    console.error('Error saving users:', error);
  }
}


export function getCurrentUser() {
  try {
    return JSON.parse(
      localStorage.getItem('kivoro_current_user') || 'null'
    );
  } catch {
    return null;
  }
}


/* =========================
   CURRENT USER UPDATE
========================= */

export function updateCurrentUser(updatedFields) {
  try {
    const currentUser = getCurrentUser();

    if (!currentUser) return false;

    const merged = {
      ...currentUser,
      ...updatedFields
    };

    localStorage.setItem(
      'kivoro_current_user',
      JSON.stringify(merged)
    );

    const users = getAllUsersAuth();

    const index = users.findIndex(
      u => u.id === merged.id
    );

    if (index !== -1) {
      users[index] = {
        ...users[index],
        ...merged
      };

      saveAllUsersAuth(users);
    }

    return true;

  } catch (error) {
    console.error(
      'Error updating current user:',
      error
    );

    return false;
  }
}


/* =========================
   TRANSACTION LEDGER
   Existing data is preserved.
========================= */

export function getUserTransactions(userId) {
  try {
    if (!userId) return [];

    const transactions = JSON.parse(
      localStorage.getItem('kivoro_transactions') || '[]'
    );

    if (!Array.isArray(transactions)) return [];

    return transactions
      .filter(tx => String(tx.uid) === String(userId))
      .sort((a, b) => {
        return (
          new Date(b.createdAt || b.date || 0) -
          new Date(a.createdAt || a.date || 0)
        );
      });

  } catch (error) {
    console.error(
      'Error loading transaction history:',
      error
    );

    return [];
  }
}


export function saveUserTransaction(userId, transaction = {}) {
  try {
    if (!userId) {
      return {
        success: false,
        message: 'User ID missing'
      };
    }

    const transactions = JSON.parse(
      localStorage.getItem('kivoro_transactions') || '[]'
    );

    const list = Array.isArray(transactions)
      ? transactions
      : [];

    const record = {
      id:
        transaction.id ||
        'TX-' +
          Date.now() +
          '-' +
          Math.floor(Math.random() * 10000),

      uid: userId,

      type:
        transaction.type ||
        'Other',

      amount:
        Number(transaction.amount) || 0,

      status:
        transaction.status ||
        'Completed',

      description:
        transaction.description ||
        '',

      reference:
        transaction.reference ||
        '',

      createdAt:
        transaction.createdAt ||
        new Date().toISOString(),

      date:
        transaction.date ||
        new Date().toLocaleString(),

      ...transaction,

      uid: userId
    };

    list.unshift(record);

    localStorage.setItem(
      'kivoro_transactions',
      JSON.stringify(list)
    );

    return {
      success: true,
      transaction: record
    };

  } catch (error) {
    console.error(
      'Error saving transaction:',
      error
    );

    return {
      success: false,
      message: 'Transaction save failed'
    };
  }
}


/* =========================
   USER TRANSACTION SUMMARY
========================= */

export function getUserTransactionSummary(userId) {
  const transactions = getUserTransactions(userId);

  let totalDeposit = 0;
  let totalWithdrawal = 0;
  let totalCredit = 0;
  let totalDebit = 0;

  transactions.forEach(tx => {
    const amount = Number(tx.amount) || 0;

    const type = String(
      tx.type || ''
    ).toLowerCase();

    if (
      type === 'deposit' &&
      tx.status !== 'Rejected'
    ) {
      totalDeposit += amount;
    }

    if (
      type === 'withdrawal' &&
      tx.status !== 'Rejected'
    ) {
      totalWithdrawal += amount;
    }

    if (
      ['credit', 'bonus', 'commission', 'deposit']
        .includes(type)
    ) {
      totalCredit += amount;
    }

    if (
      ['debit', 'withdrawal']
        .includes(type)
    ) {
      totalDebit += amount;
    }
  });

  return {
    totalDeposit,
    totalWithdrawal,
    totalCredit,
    totalDebit,
    transactionCount: transactions.length
  };
}


/* =========================
   UPI / BANK ACCOUNT LOCK
   Once saved, user cannot
   change/delete it.
========================= */

export function saveUserUpiSecure(userId, upiId) {
  try {
    const cleanUpi = String(
      upiId || ''
    ).trim();

    if (
      !cleanUpi ||
      !cleanUpi.includes('@')
    ) {
      return {
        success: false,
        message:
          'Kripya valid UPI ID enter karein!'
      };
    }

    const users = getAllUsersAuth();

    const user = users.find(
      u => u.id === userId
    );

    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    /*
      Existing locked UPI:
      Do not modify or delete it.
    */

    if (
      user.lockedUpi === true ||
      (
        user.upiId &&
        String(user.upiId).trim()
      )
    ) {
      return {
        success: false,
        message:
          'UPI account pehle se locked hai. Ab change ya delete nahi ho sakta!'
      };
    }

    user.upiId = cleanUpi;
    user.lockedUpi = true;
    user.upiLockedAt =
      new Date().toISOString();

    saveAllUsersAuth(users);

    const currentUser = getCurrentUser();

    if (
      currentUser &&
      currentUser.id === userId
    ) {
      currentUser.upiId = cleanUpi;
      currentUser.lockedUpi = true;
      currentUser.upiLockedAt =
        user.upiLockedAt;

      localStorage.setItem(
        'kivoro_current_user',
        JSON.stringify(currentUser)
      );
    }

    return {
      success: true,
      message:
        'UPI ID successfully saved and locked!'
    };

  } catch (error) {
    console.error(
      'Error saving UPI:',
      error
    );

    return {
      success: false,
      message: 'Failed to save UPI'
    };
  }
}


/* =========================
   UPI STATUS HELPER
========================= */

export function isUserUpiLocked(userId) {
  try {
    const users = getAllUsersAuth();

    const user = users.find(
      u => u.id === userId
    );

    if (!user) return false;

    return Boolean(
      user.lockedUpi === true ||
      (
        user.upiId &&
        String(user.upiId).trim()
      )
    );

  } catch {
    return false;
  }
}


export function getUserUpi(userId) {
  try {
    const users = getAllUsersAuth();

    const user = users.find(
      u => u.id === userId
    );

    return user?.upiId || '';

  } catch {
    return '';
  }
}


/* =========================
   REGISTER
========================= */

export function registerUser(
  name,
  phone,
  password,
  inviteCode
) {
  const trimmedName =
    String(name || '').trim();

  const trimmedPhone =
    String(phone || '').trim();

  const trimmedPass =
    String(password || '').trim();

  const trimmedInvite =
    String(inviteCode || '').trim();

  if (!trimmedName) {
    return {
      success: false,
      message:
        'Kripya apna naam enter karein'
    };
  }

  if (
    !trimmedPhone ||
    trimmedPhone.length !== 10
  ) {
    return {
      success: false,
      message:
        'Kripya valid 10-digit mobile number enter karein'
    };
  }

  if (
    !trimmedPass ||
    trimmedPass.length < 4
  ) {
    return {
      success: false,
      message:
        'Password kam se kam 4 characters ka hona chahiye'
    };
  }

  const users = getAllUsersAuth();

  if (
    users.some(
      u => u.phone === trimmedPhone
    )
  ) {
    return {
      success: false,
      message:
        'Yeh mobile number pehle se registered hai!'
    };
  }

  /*
    Referral validation/tracking.
    Existing inviteCode behaviour is preserved.
  */

  const referrer = trimmedInvite
    ? users.find(
        u =>
          u.referralCode ===
          trimmedInvite
      )
    : null;

  const referralCode =
    'REF-' +
    Math.floor(
      1000 + Math.random() * 9000
    );

  const userId =
    'USR-' +
    Math.floor(
      100000 +
      Math.random() * 900000
    );

  const newUser = {
    id: userId,

    name: trimmedName,

    phone: trimmedPhone,

    password: trimmedPass,

    role: 'USER',

    balance: 28,

    needToBet: 50,

    referralCode: referralCode,

    inviteCode: trimmedInvite,

    referredBy:
      referrer?.id || null,

    upiId: '',

    lockedUpi: false,

    upiLockedAt: null,

    createdAt:
      new Date().toISOString()
  };

  users.push(newUser);

  saveAllUsersAuth(users);

  localStorage.setItem(
    'kivoro_current_user',
    JSON.stringify(newUser)
  );

  /*
    Referral registration record.
    This only records the relationship;
    it does not automatically credit money.
  */

  if (referrer) {
    const referralRecords =
      JSON.parse(
        localStorage.getItem(
          'kivoro_referrals'
        ) || '[]'
      );

    const records =
      Array.isArray(referralRecords)
        ? referralRecords
        : [];

    records.unshift({
      id:
        'REFLOG-' +
        Date.now() +
        '-' +
        Math.floor(
          Math.random() * 10000
        ),

      referrerId: referrer.id,

      referredUserId: userId,

      referralCode:
        referrer.referralCode,

      status: 'Registered',

      createdAt:
        new Date().toISOString(),

      date:
        new Date().toLocaleString()
    });

    localStorage.setItem(
      'kivoro_referrals',
      JSON.stringify(records)
    );
  }

  return {
    success: true,
    user: newUser
  };
}


/* =========================
   LOGIN
========================= */

export function loginUser(
  phone,
  password
) {
  const trimmedPhone =
    String(phone || '').trim();

  const trimmedPass =
    String(password || '').trim();

  if (
    !trimmedPhone ||
    !trimmedPass
  ) {
    return {
      success: false,
      message:
        'Mobile number aur password dono enter karein'
    };
  }

  const users = getAllUsersAuth();

  const user = users.find(
    u =>
      u.phone === trimmedPhone &&
      u.password === trimmedPass
  );

  if (!user) {
    return {
      success: false,
      message:
        'Galat mobile number ya password hai!'
    };
  }

  localStorage.setItem(
    'kivoro_current_user',
    JSON.stringify(user)
  );

  return {
    success: true,
    user
  };
}


/* =========================
   LOGOUT
========================= */

export function logoutUser() {
  localStorage.removeItem(
    'kivoro_current_user'
  );
}


/* =========================
   GIFT CODE CLAIM
   Existing behaviour preserved
========================= */

export function claimGiftCodeSecure(
  userId,
  code
) {
  const trimmedCode =
    String(code || '')
      .trim()
      .toUpperCase();

  if (!trimmedCode) {
    return {
      success: false,
      message:
        'Kripya valid gift code dalein'
    };
  }

  let usedCodes;

  try {
    usedCodes = JSON.parse(
      localStorage.getItem(
        'kivoro_used_gift_codes'
      ) || '{}'
    );
  } catch {
    usedCodes = {};
  }

  if (!usedCodes[userId]) {
    usedCodes[userId] = [];
  }

  if (
    usedCodes[userId].includes(
      trimmedCode
    )
  ) {
    return {
      success: false,
      message:
        'Aap yeh gift code pehle hi claim kar chuke hain!'
    };
  }

  const bonusAmount = 50;

  usedCodes[userId].push(
    trimmedCode
  );

  localStorage.setItem(
    'kivoro_used_gift_codes',
    JSON.stringify(usedCodes)
  );

  const currentUser =
    getCurrentUser();

  if (
    currentUser &&
    currentUser.id === userId
  ) {
    currentUser.balance =
      (Number(currentUser.balance) || 0) +
      bonusAmount;

    updateCurrentUser(
      currentUser
    );

    saveUserTransaction(
      userId,
      {
        type: 'Bonus',
        amount: bonusAmount,
        status: 'Completed',
        description:
          'Gift code bonus',
        reference:
          trimmedCode
      }
    );
  }

  return {
    success: true,
    message:
      `Successfully claimed Rs.${bonusAmount}!`
  };
}


/* =========================
   DEPOSIT RECORD / VALIDATION
   Existing deposit behaviour
   preserved.
========================= */

export function verifyAndProcessDeposit(
  userId,
  amount,
  utrNumber
) {
  const cleanUtr =
    String(utrNumber || '').trim();

  const depAmount =
    Number(amount);

  if (
    !cleanUtr ||
    cleanUtr.length < 8
  ) {
    return {
      success: false,
      message:
        'Invalid UTR / Transaction ID! Fake deposit allow nahi hai.'
    };
  }

  if (
    isNaN(depAmount) ||
    depAmount <= 0
  ) {
    return {
      success: false,
      message:
        'Invalid deposit amount!'
    };
  }

  const allUtRs =
    JSON.parse(
      localStorage.getItem(
        'kivoro_all_utrs'
      ) || '[]'
    );

  if (
    !Array.isArray(allUtRs)
  ) {
    return {
      success: false,
      message:
        'Deposit data error'
    };
  }

  if (
    allUtRs.includes(cleanUtr)
  ) {
    return {
      success: false,
      message:
        'Yeh UTR/Transaction ID already use ho chuka hai! Duplicate entry rejected.'
    };
  }

  allUtRs.push(cleanUtr);

  localStorage.setItem(
    'kivoro_all_utrs',
    JSON.stringify(allUtRs)
  );

  const currentUser =
    getCurrentUser();

  if (
    currentUser &&
    currentUser.id === userId
  ) {
    currentUser.balance =
      (Number(currentUser.balance) || 0) +
      depAmount;

    updateCurrentUser(
      currentUser
    );

    saveUserTransaction(
      userId,
      {
        type: 'Deposit',
        amount: depAmount,
        status: 'Completed',
        description:
          'Deposit',
        reference:
          cleanUtr
      }
    );
  }

  const history =
    JSON.parse(
      localStorage.getItem(
        'kivoro_deposits'
      ) || '[]'
    );

  const depositHistory =
    Array.isArray(history)
      ? history
      : [];

  depositHistory.unshift({
    uid: userId,

    utr: cleanUtr,

    amount: depAmount,

    status: 'Completed',

    date:
      new Date().toLocaleString(),

    createdAt:
      new Date().toISOString()
  });

  localStorage.setItem(
    'kivoro_deposits',
    JSON.stringify(
      depositHistory
    )
  );

  return {
    success: true,
    message:
      'Deposit verified and added successfully!'
  };
}


/* =========================
   REFERRAL HELPERS
========================= */

export function getUserReferrals(
  userId
) {
  try {
    const users =
      getAllUsersAuth();

    const currentUser =
      users.find(
        u => u.id === userId
      );

    if (!currentUser) return [];

    return users.filter(
      u =>
        u.inviteCode ===
        currentUser.referralCode
    );

  } catch (error) {
    console.error(
      'Referral loading error:',
      error
    );

    return [];
  }
}


export function getReferralSummary(
  userId
) {
  const referrals =
    getUserReferrals(userId);

  const deposits =
    JSON.parse(
      localStorage.getItem(
        'kivoro_deposits'
      ) || '[]'
    );

  const depositList =
    Array.isArray(deposits)
      ? deposits
      : [];

  let totalDeposit = 0;

  referrals.forEach(user => {
    depositList
      .filter(
        d =>
          d.uid === user.id &&
          d.status === 'Completed'
      )
      .forEach(d => {
        totalDeposit +=
          Number(d.amount) || 0;
      });
  });

  return {
    totalRegister:
      referrals.length,

    totalDeposit,

    referrals
  };
}


/* =========================
   UPI DISPLAY HELPERS
========================= */

export function getCurrentUserUpiStatus() {
  const user =
    getCurrentUser();

  if (!user) {
    return {
      exists: false,
      locked: false,
      upiId: ''
    };
  }

  return {
    exists: Boolean(
      user.upiId
    ),

    locked: Boolean(
      user.lockedUpi ||
      user.upiId
    ),

    upiId:
      user.upiId || ''
  };
}
/* =========================
   KIVORO PLAY - SECURE WITHDRAWAL REQUEST LOGIC
========================= */

export function requestUserWithdrawal(userId, amount, upiId) {
  try {
    const users = getAllUsersAuth();
    const user = users.find(u => u.id === userId);

    if (!user) {
      return { success: false, message: 'User not found!' };
    }

    const cleanUpi = String(upiId || user.upiId || '').trim();
    const withdrawAmount = Number(amount);

    if (!cleanUpi || !cleanUpi.includes('@')) {
      return { success: false, message: 'Kripya valid UPI ID enter karein!' };
    }

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return { success: false, message: 'Valid withdrawal amount enter karein!' };
    }

    const currentBal = Number(user.balance || 0);
    if (currentBal < withdrawAmount) {
      return { success: false, message: 'Insufficient balance for withdrawal!' };
    }

    // Balance deduct karo
    user.balance = currentBal - withdrawAmount;
    saveAllUsersAuth(users);

    // Current session user update karo agar wahi logged-in hai
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      currentUser.balance = user.balance;
      localStorage.setItem('kivoro_current_user', JSON.stringify(currentUser));
    }

    // Withdrawals array mein 'Pending' status ke sath save karo (Direct success block!)
    const withdrawals = JSON.parse(localStorage.getItem('kivoro_withdrawals') || '[]');
    const newWithdrawal = {
      id: 'WD-' + Math.floor(100000 + Math.random() * 900000),
      uid: userId,
      amount: withdrawAmount,
      status: 'Pending', // Ab yahan hamesha Pending aayega!
      upi: cleanUpi,
      date: new Date().toLocaleString(),
      createdAt: new Date().toISOString()
    };

    withdrawals.unshift(newWithdrawal);
    localStorage.setItem('kivoro_withdrawals', JSON.stringify(withdrawals));

    // Transaction ledger mein bhi entry daal do
    saveUserTransaction(userId, {
      type: 'Withdrawal',
      amount: withdrawAmount,
      status: 'Pending',
      description: 'Withdrawal request submitted',
      reference: newWithdrawal.id
    });

    return { 
      success: true, 
      message: 'Withdrawal request submitted successfully! Status: Pending', 
      withdrawal: newWithdrawal 
    };

  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return { success: false, message: 'Internal error processing withdrawal' };
  }
}