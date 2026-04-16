// ↓↓↓ 第一件事：把網址換成妳的！ ↓↓↓
const GOOGLE_API_URL = "妳的新_GAS_網址貼在這裡";

let TARGET_SHEET = "個人記帳"; 
let PAGE_MODE = "PERSONAL";
let currentType = '支出';
let systemBalances = {}; 

const categoryConfigs = {
    'PERSONAL': { 
        '支出': { '變動支出': ['早餐/午餐/晚餐', '點心/宵夜/飲料', '娛樂費', '交通費', '線上購物', '實體購物'], '固定支出': ['房租', '電信費', '瓦斯費', '債務還款', 'APP訂閱', '水費/電費', '保險(大人)'], '小孩支出': ['尿布', '健康', '娛樂', '學雜費', '保險(小孩)'] }, 
        '收入': { '個人收入': ['薪資', '一般', '其他'] } 
    },
    'GROUP': { 
        '支出': { '選品支出 (零售)': ['手續費', '選品進貨', '藍新沖銷', '國際運費', '國內運費', '斷貨退款'], '代理支出 (批發)': ['成本', '代墊款', '斷貨退款', '國際運費', '國內運費', '批發儲值(台幣)'], '批發網(韓幣)': ['代理下單'] }, 
        '收入': { '選品收入 (零售)': ['現貨出清', '記事本收款', 'EasyStore 訂單'], '代理收入 (批發)': ['代墊款回收', '運費收回'], '批發網(韓幣)': ['儲值'] } 
    },
    'DESSERT': { 
        '支出': { '甜點支出': ['材料進貨', '包材進貨', '運費', '手續費', '場地費', '教具購買'] }, 
        '收入': { '甜點收入': ['實體門市', '私訊訂購', '表單訂購', 'PAYUNi 入帳'], '教學收入': ['沐光毓師資', '沐光毓小幫手'] } 
    }
};

function setLedgerMode(mode, sheet) {
    PAGE_MODE = mode; TARGET_SHEET = sheet;
    
    // 切換按鈕顏色
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    if (document.getElementById(`mode-${mode.toLowerCase()}`)) {
        document.getElementById(`mode-${mode.toLowerCase()}`).classList.add('active');
    }
    
    // 改標題文字
    document.getElementById('dash-income-label').innerText = `本月${sheet.replace('記帳','')}收入`;
    document.getElementById('dash-expense-label').innerText = `本月${sheet.replace('記帳','')}支出`;
    
    // 【核心邏輯】控制韓幣區塊顯示：只有團購模式會出現
    const isGroup = (mode === 'GROUP');
    document.getElementById('krw-dashboard-section').style.display = isGroup ? 'flex' : 'none';
    document.getElementById('krw-rate-box').style.display = isGroup ? 'flex' : 'none';
    document.getElementById('opt-krw').style.display = isGroup ? 'block' : 'none';

    setType('支出'); 
    fetchDashboard(); 
}

async function fetchDashboard() {
    try {
        const res = await fetch(`${GOOGLE_API_URL}?action=getDashboard&targetSheet=${encodeURIComponent(TARGET_SHEET)}`);
        const data = await res.json();
        systemBalances = data.accounts; 
        
        const krwRate = data.krwRate || 40;
        document.getElementById('krwRateInput').value = krwRate;
        
        document.getElementById('dash-netcash').innerText = `$${data.netCash}`;
        document.getElementById('dash-assets').innerText = `$${data.totalAsset}`;
        document.getElementById('dash-debt').innerText = `$${data.debt}`;
        document.getElementById('dash-income').innerText = `$${data.monthIncome}`;
        document.getElementById('dash-expense').innerText = `$${data.monthExpense}`;
        
        // 算韓幣
        const krwBalance = data.accounts['批發網點數'] || 0;
        document.getElementById('dash-krw').innerText = `₩${krwBalance}`;
        document.getElementById('dash-krw-twd').innerText = `$${Math.round(krwBalance / krwRate)}`;

        calculateDiff();
    } catch (e) { document.getElementById('dash-netcash').innerText = '連線中...'; }
}

function calculateDiff() {
    const acc = document.getElementById('quickAccount').value;
    const actualInput = document.getElementById('quickAmount').value;
    const msg = document.getElementById('quick-msg');
    if (!actualInput) { msg.innerText = ""; return; }
    
    const actual = parseFloat(actualInput) || 0;
    const system = systemBalances[acc] || 0;
    const diff = actual - system;
    if (diff === 0) msg.innerHTML = "✅ 帳目正確";
    else msg.innerHTML = `⚠️ 差額：<span style="color:${diff>0?"#8FA684":"#D99C9C"}; font-weight:bold;">${diff>0?'+':''}${Math.round(diff)}</span>`;
}

async function updateWaterBalance() {
    const acc = document.getElementById('quickAccount').value;
    const amt = document.getElementById('quickAmount').value;
    if (!amt) return;
    
    // 防呆：不能改批發網
    if (acc === '批發網點數') {
        document.getElementById('quick-msg').innerText = "❌ 批發網由系統自動計算，不開放手動校正！";
        return;
    }
    
    document.getElementById('quick-msg').innerText = "校正同步中...";
    try {
        await fetch(`${GOOGLE_API_URL}?action=updateBalance&accountName=${encodeURIComponent(acc)}&amount=${amt}`);
        document.getElementById('quickAmount').value = ''; 
        document.getElementById('quick-msg').innerText = "✅ 餘額校正成功";
        fetchDashboard();
    } catch (e) { document.getElementById('quick-msg').innerText = "連線失敗"; }
}

async function updateRate() {
    const rate = document.getElementById('krwRateInput').value;
    if (!rate) return;
    document.getElementById('quick-msg').innerText = "匯率更新中...";
    try {
        await fetch(`${GOOGLE_API_URL}?action=updateRate&rate=${rate}`);
        document.getElementById('quick-msg').innerText = "✅ 匯率更新成功";
        fetchDashboard();
    } catch (e) { document.getElementById('quick-msg').innerText = "連線失敗"; }
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
    const cats = categoryConfigs[PAGE_MODE][currentType][document.getElementById('subType').value];
    document.getElementById('category').innerHTML = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    updateAccounts();
}

function updateAccounts() {
    const sub = document.getElementById('subType').value;
    const cat = document.getElementById('category').value;
    let list = ['現金', '信用卡', 'Line Pay', 'iPass Money', '銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)', '其他/現金'];
    
    if (cat === 'PAYUNi 入帳') list = ['銀行轉帳 (中國信託)', '銀行轉帳 (台新銀行)'];
    else if (cat === 'EasyStore 訂單') list = ['Line Pay', '藍新待撥款', '銀行轉帳 (台新銀行)'];
    else if (sub === '批發網(韓幣)') list = ['批發網點數'];
    
    if (currentType === '收入' || sub.includes('代理')) list = list.filter(i => i !== '信用卡');
    list.sort((a, b) => a.length - b.length);
    document.getElementById('account').innerHTML = list.map(a => `<option value="${a}">${a}</option>`).join('');
    updateFields();
}

function updateFields() {
    const cat = document.getElementById('category').value;
    document.getElementById('esFields').style.display = (cat === 'EasyStore 訂單') ? 'block' : 'none';
    document.getElementById('payuniAutoFields').style.display = (cat === 'PAYUNi 入帳') ? 'block' : 'none';
    document.getElementById('logisticsGroup').style.display = (cat.includes('運費')) ? 'block' : 'none';
    document.getElementById('mainAmountLabel').innerText = (cat === 'PAYUNi 入帳') ? "實收金額" : (cat === 'EasyStore 訂單' ? "商品原價" : "金額");
}

document.getElementById('form').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn'); btn.disabled = true; document.getElementById('loading').style.display = 'block';
    const amt = parseInt(document.getElementById('amount').value.replace(/\D/g,'')) || 0;
    const note = document.getElementById('note').value;
    const dateValue = document.getElementById('date').value;
    const subValue = document.getElementById('subType').value;
    const catValue = document.getElementById('category').value;
    const accValue = document.getElementById('account').value;

    const send = async (a, n, t=currentType, st=subValue, c=catValue, ac=accValue) => {
        await fetch(`${GOOGLE_API_URL}?action=add&targetSheet=${encodeURIComponent(TARGET_SHEET)}&date=${dateValue}&type=${t}&subType=${encodeURIComponent(st)}&category=${encodeURIComponent(c)}&account=${encodeURIComponent(ac)}&amount=${a}&note=${encodeURIComponent(n)}`);
    };

    try {
        if (catValue === 'EasyStore 訂單' && accValue === '藍新待撥款') {
            await send(amt, note); 
            await send(Math.round(amt * 0.028), '(2.8%手續費)', '支出', '選品支出 (零售)', '手續費');
        } else if (catValue === 'PAYUNi 入帳') {
            const ship = parseInt(document.getElementById('payuniShip').value) || 0;
            const fee = Math.round(amt * 0.02);
            await send(amt + ship + fee, `[實收${amt}/扣運${ship}/估手續${fee}] ${note}`);
            if (ship > 0) await send(ship, `(扣運)${note}`, '支出', '甜點支出', '運費');
            await send(fee, `(估手續)${note}`, '支出', '甜點支出', '手續費');
        } else { 
            await send(amt, note); 
        }
        alert("記帳成功！"); 
        fetchDashboard();
        document.getElementById('amount').value = ''; 
        document.getElementById('note').value = '';
    } catch (e) { alert("連線失敗"); } finally { btn.disabled = false; document.getElementById('loading').style.display = 'none'; }
});

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('date').valueAsDate = new Date();
    document.getElementById('quickAmount').addEventListener('input', calculateDiff);
    document.getElementById('quickAccount').addEventListener('change', calculateDiff);
    
    // 一進來直接鎖定在「個人」頁面，保證韓幣藏得死死的
    setLedgerMode('PERSONAL', '個人記帳'); 
});
