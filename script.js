// ↓↓↓ 這裡務必換成你剛剛「建立新版本」後拿到的新網址 ↓↓↓
const GOOGLE_API_URL = "https://script.google.com/macros/s/AKfycbzm0QpEeJ3ePv03LX3BxNNi-tGqkWg2S4Ib2ObLQh2vnwFErvcrEQhbOAUdSaSt3IY/exec";

let TARGET_SHEET = "個人記帳"; 
let PAGE_MODE = "PERSONAL";
let currentType = '支出';
let systemBalances = {}; 

document.getElementById('date').valueAsDate = new Date();

// --- 三合一分類選單庫 ---
const categoryConfigs = {
    'PERSONAL': {
        '支出': {
            '變動支出': ['娛樂費', '交通費', '線上購物', '實體購物', '早餐/午餐/晚餐', '點心/宵夜/飲料'],
            '固定支出': ['房租', '瓦斯費', '電信費', '燃料費', '債務還款', 'APP訂閱', '水費/電費', '保險(小孩)', '保險(大人)', '汽機車牌照稅'],
            '小孩支出': ['尿布', '健康', '娛樂', '學雜費']
        },
        '收入': {
            '個人收入': ['一般', '其他']
        }
    },
    'GROUP': {
        '支出': {
            '選品支出 (零售)': ['手續費', '選品進貨', '藍新沖銷', '國際運費', '國內運費', '斷貨退款', '活動購物金'],
            '代理支出 (批發)': ['成本', '代墊款', '斷貨退款', '國際運費', '國內運費', '批發儲值(台幣)'],
            '批發網(韓幣)': ['代理下單']
        },
        '收入': {
            '選品收入 (零售)': ['現貨出清', '記事本收款', 'EasyStore 訂單'],
            '代理收入 (批發)': ['倉庫整理費', '代墊款回收', '國際運費收回', '國內運費收回'],
            '批發網(韓幣)': ['儲值']
        }
    },
    'DESSERT': {
        '支出': {
            '甜點支出': ['運費', '手續費', '包材進貨', '材料進貨', '場地費', '教具購買']
        },
        '收入': {
            '甜點收入': ['實體門市', '私訊訂購', '表單訂購', 'PAYUNi 入帳'],
            '教學收入': ['沐光毓師資', '沐光毓小幫手']
        }
    }
};

// --- 切換主控台模式 ---
function setLedgerMode(mode, sheetName) {
    PAGE_MODE = mode;
    TARGET_SHEET = sheetName;

    // 按鈕樣式切換
    document.getElementById('mode-personal').classList.remove('active');
    document.getElementById('mode-group').classList.remove('active');
    document.getElementById('mode-dessert').classList.remove('active');
    
    if (mode === 'PERSONAL') document.getElementById('mode-personal').classList.add('active');
    if (mode === 'GROUP') document.getElementById('mode-group').classList.add('active');
    if (mode === 'DESSERT') document.getElementById('mode-dessert').classList.add('active');

    // 更新顯示文字
    document.getElementById('dash-income-label').innerText = `本月${sheetName}收入`;
    document.getElementById('dash-expense-label').innerText = `本月${sheetName}支出`;

    setType('支出'); 
    fetchDashboard(); 
}

async function fetchDashboard() {
    try {
        const res = await fetch(`${GOOGLE_API_URL}?action=getDashboard&targetSheet=${encodeURIComponent(TARGET_SHEET)}`);
        const data = await res.json();
        
        if (data.netCash === "錯") {
            document.getElementById('dash-netcash').innerText = '請檢查試算表分頁名稱';
            return;
        }

        systemBalances = data.accounts; 
        document.getElementById('dash-netcash').innerText = `$${data.netCash}`;
        document.getElementById('dash-assets').innerText = `$${data.totalAsset}`;
        document.getElementById('dash-debt').innerText = `$${data.debt}`;
        document.getElementById('dash-income').innerText = `$${data.monthIncome}`;
        document.getElementById('dash-expense').innerText = `$${data.monthExpense}`;
        calculateDiff();
    } catch (e) {
        document.getElementById('dash-netcash').innerText = '連線失敗';
    }
}

function calculateDiff() {
    const acc = document.getElementById('quickAccount').value;
    const actualInput = document.getElementById('quickAmount').value;
    const msg = document.getElementById('quick-msg');
    
    if (!actualInput) { msg.innerText = ""; return; }
    
    const diff = (parseFloat(actualInput) || 0) - (systemBalances[acc] || 0);
    if (diff === 0) {
        msg.innerHTML = "✅ 與系統相符，帳目正確！";
    } else {
        const color = diff > 0 ? "blue" : "red";
        msg.innerHTML = `⚠️ 差額：<span style="color:${color}; font-weight:bold;">${diff > 0 ? '+' : ''}${diff}</span>`;
    }
}

document.getElementById('quickAmount').addEventListener('input', calculateDiff);
document.getElementById('quickAccount').addEventListener('change', calculateDiff);

async function updateWaterBalance() {
    const acc = document.getElementById('quickAccount').value;
    const amt = document.getElementById('quickAmount').value;
    const msg = document.getElementById('quick-msg');
    if (!amt) return;
    
    msg.innerText = "同步更新中...";
    try {
        await fetch(`${GOOGLE_API_URL}?action=updateBalance&accountName=${encodeURIComponent(acc)}&amount=${amt}`);
        msg.innerText = "✅ 水位已校正完畢！";
        document.getElementById('quickAmount').value = '';
        fetchDashboard(); 
    } catch (e) { msg.innerText = "❌ 更新失敗"; }
}

function setType(t) { 
    currentType = t; 
    document.getElementById('btn-expense').className = t==='支出'?'radio-btn active-expense':'radio-btn';
    document.getElementById('btn-income').className = t==='收入'?'radio-btn active-income':'radio-btn';
    
    const subs = Object.keys(categoryConfigs[PAGE_MODE][t]);
    document.getElementById('subType').innerHTML = subs.map(s => `<option value="${s}">${s}</option>`).join('');
    updateCategories(); 
}

function updateCategories() {
    const sub = document.getElementById('subType').value;
    const cats = categoryConfigs[PAGE_MODE][currentType][sub];
    document.getElementById('category').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    updateAccounts();
}

function updateAccounts() {
    const sub = document.getElementById('subType').value;
    const cat = document.getElementById('category').value;
    let list = ['現金', '信用卡', 'Line Pay', 'iPass Money', '銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)', '其他/現金'];
    
    if (cat === 'PAYUNi 入帳') list = ['銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    else if (cat === 'EasyStore 訂單') list = ['Line Pay', '藍新待撥款', '銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    else if (cat === '記事本收款') list = ['Line Pay', 'iPass Money', '銀行轉帳 (台新銀行)'];
    else if (cat === '藍新沖銷') list = ['銀行轉帳 (中國信託)'];
    else if (cat === '活動購物金') list = ['ES購物金'];
    else if (sub === '批發網(韓幣)') list = ['批發網點數']; // 自動對應韓幣批發邏輯
    
    if (currentType === '收入' || sub.includes('代理')) list = list.filter(i => i !== '信用卡');
    list.sort((a, b) => a.length - b.length);
    document.getElementById('account').innerHTML = list.map(a => `<option value="${a}">${a}</option>`).join('');
    updateFields();
}

function updateFields() {
    const cat = document.getElementById('category').value;
    document.getElementById('esFields').style.display = (cat === 'EasyStore 訂單') ? 'block' : 'none';
    document.getElementById('payuniAutoFields').style.display = (cat === 'PAYUNi 入帳') ? 'block' : 'none';
    document.getElementById('logisticsGroup').style.display = (currentType === '支出' && (cat === '國內運費' || cat === '運費')) ? 'block' : 'none';
    document.getElementById('mainAmountLabel').innerText = (cat === 'PAYUNi 入帳') ? "銀行實收金額" : (cat === 'EasyStore 訂單' ? "商品原價" : "金額");
}

document.getElementById('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const mainAmt = parseInt(document.getElementById('amount').value.replace(/\D/g,'')) || 0;
    const creditAmt = parseInt(document.getElementById('creditAmount').value.replace(/\D/g,'')) || 0;
    const shipAmt = parseInt(document.getElementById('shippingAmount').value.replace(/\D/g,'')) || 0;
    const pShip = parseInt(document.getElementById('payuniShip').value.replace(/\D/g,'')) || 0;
    let note = document.getElementById('note').value;
    
    const sub = document.getElementById('subType').value;
    const cat = document.getElementById('category').value;
    const acc = document.getElementById('account').value;
    const date = document.getElementById('date').value;
    
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; document.getElementById('loading').style.display = 'block';
    
    const send = async (d, t, st, c, a, am, n) => { 
        await fetch(`${GOOGLE_API_URL}?action=add&targetSheet=${encodeURIComponent(TARGET_SHEET)}&date=${d}&type=${t}&subType=${st}&category=${c}&account=${a}&amount=${am}&note=${encodeURIComponent(n)}`); 
    };
    
    try {
        if (cat === 'PAYUNi 入帳') {
            const estFee = Math.round(mainAmt * 0.02);
            const totalIncome = mainAmt + pShip + estFee;
            await send(date, '收入', sub, cat, acc, totalIncome, `[PAYUNi實結: 實收${mainAmt}/扣運${pShip}/估手續${estFee}] ${note}`);
            if (pShip > 0) await send(date, '支出', '甜點支出', '運費', acc, pShip, `(PAYUNi扣運)${note}`);
            await send(date, '支出', '甜點支出', '手續費', acc, estFee, `(PAYUNi估手續)${note}`);
        } else if (cat === 'EasyStore 訂單') {
            const paidAmt = mainAmt + shipAmt - creditAmt;
            const esNote = `[商${mainAmt}/運${shipAmt}${creditAmt?'/折'+creditAmt:''}] ${note}`;
            await send(date, '收入', sub, cat, acc, paidAmt, esNote);
            if (creditAmt > 0) await send(date, '收入', sub, cat, 'ES購物金', creditAmt, `(點數)${esNote}`);
            if (acc === '藍新待撥款') await send(date, '支出', '選品支出 (零售)', '手續費', acc, Math.round(paidAmt * 0.028), `(2.8%手續費)`);
        } else {
            let finalNote = note;
            if (document.getElementById('logisticsGroup').style.display === 'block') finalNote = `[${document.getElementById('logistics').value}] ${note}`;
            await send(date, currentType, sub, cat, acc, mainAmt, finalNote);
        }
        
        alert("記帳完畢！"); 
        fetchDashboard(); 
        document.getElementById('amount').value = ''; document.getElementById('note').value = '';
    } catch (err) { alert("失敗"); } finally { btn.disabled = false; document.getElementById('loading').style.display = 'none'; }
});

// 初始化載入預設為「個人記帳」
window.addEventListener('DOMContentLoaded', () => {
    setLedgerMode('PERSONAL', '個人記帳');
});
