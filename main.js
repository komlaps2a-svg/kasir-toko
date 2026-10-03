// ==========================================
    // BAGIAN 4: ENGINE JAVASCRIPT & CLOUD SYNC
    // ==========================================

    const APP_VERSION = "4.20 LOCAL-FIRST";
    // --- KONFIGURASI SUPABASE ---
    const SUPABASE_URL = 'https://ytzkgfigcvdkdyxwsdbn.supabase.co'; 
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0emtnZmlnY3Zka2R5eHdzZGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyMTU4MjcsImV4cCI6MjA4Nzc5MTgyN30.jcreMZVPVSjq-piS0nnrxqd4FAME6qwDivIfOzksbqM';
    
    let sbClient = null;
    let currentUser = null;
    let APP_MODE = localStorage.getItem('pos_app_mode') || 'GUEST';
    let realtimeChannel = null;

    // --- DATABASE MEMORI ---
    let shopName = localStorage.getItem('pos_shop_name') || 'EDIT NAMA TOKO';
    let units = JSON.parse(localStorage.getItem('pos_units')) || ['Kg', 'Ons', 'Liter', 'Pcs', 'Bks', 'Satuan'];
    let inventory = []; let debts = []; let historyLog = []; let cart = []; let manualItemCounter = 1;

    // --- HELPER AUDIO & HAPTIC (FEEL PREMIUM) ---
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    let audioCtx;
    let isAppMuted = localStorage.getItem('pos_muted') === 'true';

    const svgVolumeOn = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
    const svgVolumeOff = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--danger)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`;

    function toggleMute() {
        isAppMuted = !isAppMuted;
        localStorage.setItem('pos_muted', isAppMuted);
        showToast(isAppMuted ? "Mode Senyap Aktif" : "Suara Aktif", "update");
        updateMuteUI();
    }

    function updateMuteUI() {
        const btn = document.getElementById('muteBtnIcon');
        if(btn) btn.innerHTML = isAppMuted ? svgVolumeOff : svgVolumeOn;
    }

    function initAudio() { 
        if (isAppMuted) return; 
        if (!audioCtx) { audioCtx = new AudioContext(); } 
        if (audioCtx.state === 'suspended') audioCtx.resume(); 
    }

    function playTick() {
        if (isAppMuted) return; 
        if (navigator.vibrate) navigator.vibrate(25); 
        initAudio();
        try {
            const osc = audioCtx.createOscillator(); const gainNode = audioCtx.createGain();
            osc.connect(gainNode); gainNode.connect(audioCtx.destination); osc.type = 'sine';
            osc.frequency.setValueAtTime(900, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.05);
            gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
        } catch(e) {}
    }

    function playCekring() {
        if (isAppMuted) return; 
        if (navigator.vibrate) navigator.vibrate([40, 80, 50]); 
        initAudio();
        try {
            setTimeout(() => {
                const osc1 = audioCtx.createOscillator(); const gain1 = audioCtx.createGain();
                osc1.connect(gain1); gain1.connect(audioCtx.destination); osc1.type = 'sine'; 
                osc1.frequency.setValueAtTime(600, audioCtx.currentTime);
                gain1.gain.setValueAtTime(0.3, audioCtx.currentTime);
                gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
                osc1.start(); osc1.stop(audioCtx.currentTime + 0.08);
            }, 0);
            setTimeout(() => {
                const osc2 = audioCtx.createOscillator(); const gain2 = audioCtx.createGain();
                osc2.connect(gain2); gain2.connect(audioCtx.destination); osc2.type = 'sine';
                osc2.frequency.setValueAtTime(2900, audioCtx.currentTime);
                gain2.gain.setValueAtTime(0.6, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                osc2.start(); osc2.stop(audioCtx.currentTime + 0.5);
            }, 120);
        } catch(e) {}
    }

    document.body.addEventListener('click', initAudio, { once: true });

    // --- FUNGSI LOAD & SAVE LOKAL ---
    function loadDB() {
        if (APP_MODE === 'CLOUD' && currentUser) {
            inventory = JSON.parse(localStorage.getItem(`pos_inv_${currentUser.id}`)) || [];
            debts = JSON.parse(localStorage.getItem(`pos_debt_${currentUser.id}`)) || [];
            historyLog = JSON.parse(localStorage.getItem(`pos_hist_${currentUser.id}`)) || [];
            let pic = localStorage.getItem(`pos_profpic_${currentUser.id}`);
            if(pic) { document.getElementById('headProfileImg').src = pic; document.getElementById('viewProfileImg').src = pic; }
        } else {
            inventory = JSON.parse(localStorage.getItem('pos_guest_inv')) || [];
            debts = JSON.parse(localStorage.getItem('pos_guest_debt')) || [];
            historyLog = JSON.parse(localStorage.getItem('pos_guest_hist')) || [];
            let pic = localStorage.getItem('pos_guest_profpic');
            if(pic) { document.getElementById('headProfileImg').src = pic; document.getElementById('viewProfileImg').src = pic; }
            else { document.getElementById('headProfileImg').src = 'icon-192.png'; document.getElementById('viewProfileImg').src = 'icon-192.png'; }
        }
    }

    function saveDB() {
    try {
        if (APP_MODE === 'CLOUD' && currentUser) {
            localStorage.setItem(`pos_inv_${currentUser.id}`, JSON.stringify(inventory));
            localStorage.setItem(`pos_debt_${currentUser.id}`, JSON.stringify(debts));
            localStorage.setItem(`pos_hist_${currentUser.id}`, JSON.stringify(historyLog));
            localStorage.setItem(`pos_pending_${currentUser.id}`, "true");
        } else {
            localStorage.setItem('pos_guest_inv', JSON.stringify(inventory));
            localStorage.setItem('pos_guest_debt', JSON.stringify(debts));
            localStorage.setItem('pos_guest_hist', JSON.stringify(historyLog));
        }
    } catch (err) {
        console.log('Gagal simpan lokal:', err);
        showToast("Memori HP penuh! Hapus riwayat lama.", "error");
    }
    if (APP_MODE === 'CLOUD' && currentUser) {
        scheduleCloudSync();
    }
}

function saveDBLama() {
        if (APP_MODE === 'CLOUD' && currentUser) {
            localStorage.setItem(`pos_inv_${currentUser.id}`, JSON.stringify(inventory));
            localStorage.setItem(`pos_debt_${currentUser.id}`, JSON.stringify(debts));
            localStorage.setItem(`pos_hist_${currentUser.id}`, JSON.stringify(historyLog));
            localStorage.setItem(`pos_pending_${currentUser.id}`, "true");
            pushToCloud();
        } else {
            localStorage.setItem('pos_guest_inv', JSON.stringify(inventory));
            localStorage.setItem('pos_guest_debt', JSON.stringify(debts));
            localStorage.setItem('pos_guest_hist', JSON.stringify(historyLog));
        }
    }

    // --- CLOUD SYNC & REALTIME ---
let syncTimer = null;
let localChangeCounter = 0;

function scheduleCloudSync() {
    localChangeCounter++;
    if (syncTimer) clearTimeout(syncTimer);
    const ns = document.getElementById('networkStatus');
    if (ns) { ns.innerText = "Tersimpan Lokal ✓ (sinkron nanti)"; ns.className = "status-sync sync-pending"; }
    // Kirim pelan-pelan di belakang: tunggu 4 detik, lalu saat HP senggang
    syncTimer = setTimeout(() => {
        const run = () => pushToCloud().catch(e => console.log('Gagal kirim cloud:', e));
        if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 5000 });
        else run();
    }, 4000);
}
    async function pushToCloud() {
    if (APP_MODE !== 'CLOUD' || !currentUser || !sbClient) return;
    const ns = document.getElementById('networkStatus');
    const setS = (t, c) => { if (ns) { ns.innerText = t; ns.className = "status-sync " + c; } };
    if (!navigator.onLine) return setS("Tersimpan Lokal (Tunggu Sinyal)", "sync-pending");
    setS("Menyinkronkan...", "sync-pending");

    const startCounter = localChangeCounter;
    const payload = { user_id: currentUser.id, inventory: inventory, debts: debts, history: historyLog, updated_at: new Date().toISOString() };
    try {
        const { error } = await sbClient.from('kasir_data').upsert(payload);
        if (error) throw error;
        if (startCounter === localChangeCounter) {
            localStorage.removeItem(`pos_pending_${currentUser.id}`);
            setS("Online Mode (Cloud)", "sync-online");
        } else {
            setTimeout(() => pushToCloud().catch(() => {}), 1500);
        }
    } catch (e) {
        console.log('Push gagal, data tetap aman di lokal:', e);
        setS("Tersimpan Lokal (Tunggu Sinyal)", "sync-pending");
        setTimeout(() => pushToCloud().catch(() => {}), 15000);
    }
}

    async function fetchCloudData() {
    if (!navigator.onLine || APP_MODE !== 'CLOUD' || !currentUser) return;
    if (localStorage.getItem(`pos_pending_${currentUser.id}`) === "true") { pushToCloud(); return; }

    const ns = document.getElementById('networkStatus');
    if (ns) ns.innerText = "Mengecek Cloud...";
    const startCounter = localChangeCounter;
    try {
        const { data, error } = await sbClient.from('kasir_data').select('*').eq('user_id', currentUser.id).single();
        // Jangan timpa data lokal kalau selama menunggu ada transaksi baru
        if (startCounter !== localChangeCounter || localStorage.getItem(`pos_pending_${currentUser.id}`) === "true") return;
        if (data) {
            inventory = data.inventory || []; debts = data.debts || []; historyLog = data.history || [];
            localStorage.setItem(`pos_inv_${currentUser.id}`, JSON.stringify(inventory));
            localStorage.setItem(`pos_debt_${currentUser.id}`, JSON.stringify(debts));
            localStorage.setItem(`pos_hist_${currentUser.id}`, JSON.stringify(historyLog));
            renderAllUI();
        }
        if (ns) { ns.innerText = "Online Mode (Cloud)"; ns.className = "status-sync sync-online"; }
    } catch (e) {
        if (ns) { ns.innerText = "Offline (Aman di Lokal)"; ns.className = "status-sync sync-offline"; }
    }
}
    function setupRealtimeSync() {
        if (!sbClient || !currentUser) return;
        if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); }
        realtimeChannel = sbClient.channel('custom-all-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'kasir_data', filter: `user_id=eq.${currentUser.id}` }, (payload) => {
                let isPending = localStorage.getItem(`pos_pending_${currentUser.id}`);
                if (isPending !== "true" && payload.new) {
                    if (payload.new.inventory) inventory = payload.new.inventory; if (payload.new.debts) debts = payload.new.debts; if (payload.new.history) historyLog = payload.new.history;
                    localStorage.setItem(`pos_inv_${currentUser.id}`, JSON.stringify(inventory));
                    localStorage.setItem(`pos_debt_${currentUser.id}`, JSON.stringify(debts));
                    localStorage.setItem(`pos_hist_${currentUser.id}`, JSON.stringify(historyLog));
                    renderInventory(); renderDebts(); renderHistory();
                    showToast("Database disinkronkan otomatis!", "update");
                }
            }).subscribe();
    }

    // --- BOOTING SUPER AMAN ---
    function bootApp() {
        const lblVer = document.getElementById('appVersionLabel');
        if (lblVer) lblVer.innerText = 'Versi ' + APP_VERSION;
        const lastVer = localStorage.getItem('pos_last_version');
        if (lastVer && lastVer !== APP_VERSION) {
            setTimeout(() => showToast('✅ Aplikasi sudah diperbarui ke versi ' + APP_VERSION, 'update'), 800);
        }
        localStorage.setItem('pos_last_version', APP_VERSION);
        updateMuteUI();
        document.getElementById('shopNameDisplay').innerText = shopName;
        if(units.length > 0) { 
            document.getElementById('itemUnitVal').value = units[0]; 
            document.getElementById('itemUnitText').innerText = units[0]; 
        }
        
        const netStatus = document.getElementById('networkStatus');
        if (APP_MODE === 'CLOUD') {
            const savedUser = JSON.parse(localStorage.getItem('sb-ytzkgfigcvdkdyxwsdbn-auth-token'));
            if(savedUser && savedUser.user) {
                currentUser = savedUser.user;
                document.getElementById('userNameDisplay').innerText = currentUser.user_metadata.full_name || "Kasir Cloud";
            }
            loadDB(); renderAllUI();
            if(netStatus) { netStatus.innerText = "Menghubungkan..."; netStatus.className = "status-sync sync-pending"; }
            setTimeout(initSupabaseBackground, 200); 
        } else {
            currentUser = null;
            if(netStatus) { netStatus.innerText = "Offline Mode (Guest)"; netStatus.className = "status-sync sync-offline"; }
            document.getElementById('userNameDisplay').innerText = "Kasir Lokal";
            loadDB(); renderAllUI();
            setTimeout(initSupabaseBackground, 200); 
        }
    }

    async function initSupabaseBackground() {
        const netStatus = document.getElementById('networkStatus');
        if (typeof window.supabase === 'undefined') {
            if(netStatus) { netStatus.innerText = APP_MODE === 'CLOUD' ? "Offline (Aman di Lokal)" : "Z-Offline (Lokal)"; netStatus.className = "status-sync sync-offline"; }
            return;
        }

        if (!sbClient) { sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }

        if (APP_MODE === 'CLOUD') {
            try {
                const { data: { session }, error } = await sbClient.auth.getSession();
                if (error) throw error;
                if (session && session.user) {
                    currentUser = session.user;
                    let cloudPic = localStorage.getItem(`pos_profpic_${currentUser.id}`);
                    if(!cloudPic && currentUser.user_metadata.avatar_url) {
                        localStorage.setItem(`pos_profpic_${currentUser.id}`, currentUser.user_metadata.avatar_url);
                        document.getElementById('headProfileImg').src = currentUser.user_metadata.avatar_url;
                        document.getElementById('viewProfileImg').src = currentUser.user_metadata.avatar_url;
                    }
                    if(navigator.onLine) { await fetchCloudData(); setupRealtimeSync(); } 
                    else { if(netStatus) { netStatus.innerText = "Offline (Aman di Lokal)"; netStatus.className = "status-sync sync-offline"; } }
                } else { 
                    APP_MODE = 'GUEST'; localStorage.setItem('pos_app_mode', 'GUEST'); loadDB(); renderAllUI();
                }
            } catch(err) {
                if(netStatus) { netStatus.innerText = "Offline (Aman di Lokal)"; netStatus.className = "status-sync sync-offline"; }
            }
        }

        if (!window.supabaseListenerAdded) {
            window.supabaseListenerAdded = true;
            sbClient.auth.onAuthStateChange(async (event, currentSession) => {
                if (event === 'SIGNED_OUT') { APP_MODE = 'GUEST'; localStorage.setItem('pos_app_mode', 'GUEST'); } 
                else if (event === 'SIGNED_IN' && currentSession) {
                    currentUser = currentSession.user; APP_MODE = 'CLOUD'; localStorage.setItem('pos_app_mode', 'CLOUD');
                    if(netStatus) { netStatus.innerText = navigator.onLine ? "Online Mode (Cloud)" : "Offline Mode (Cloud)"; netStatus.className = navigator.onLine ? "status-sync sync-online" : "status-sync sync-offline"; }
                    document.getElementById('userNameDisplay').innerText = currentUser.user_metadata.full_name || "Kasir Cloud";
                    await handleLoginMigration(currentUser); setupRealtimeSync();
                    closeModal('loginModal'); closeModal('profileViewModal');
                }
            });
        }
    }

    async function handleLoginMigration(user) {
        showToast("Memeriksa Cloud...", "syncing");
        let guestInv = JSON.parse(localStorage.getItem('pos_guest_inv')) || [];
        const { data, error } = await sbClient.from('kasir_data').select('*').eq('user_id', user.id).single();

        if (!data && guestInv.length > 0) {
            inventory = guestInv; debts = JSON.parse(localStorage.getItem('pos_guest_debt')) || []; historyLog = JSON.parse(localStorage.getItem('pos_guest_hist')) || [];
            saveDB(); showToast("Data Guest diangkat ke Cloud!", "success");
        } else if (data) {
            inventory = data.inventory || []; debts = data.debts || []; historyLog = data.history || [];
            localStorage.setItem(`pos_inv_${user.id}`, JSON.stringify(inventory));
            localStorage.setItem(`pos_debt_${user.id}`, JSON.stringify(debts));
            localStorage.setItem(`pos_hist_${user.id}`, JSON.stringify(historyLog));
            showToast("Data ditarik dari Cloud...", "success");
        }
        localStorage.removeItem('pos_guest_inv'); localStorage.removeItem('pos_guest_debt'); localStorage.removeItem('pos_guest_hist');
        renderAllUI();
    }

    async function forceLogoutToGuest() {
        closeModal('customConfirm'); closeModal('profileViewModal'); showToast("Memproses Logout...", "syncing");
        APP_MODE = 'GUEST'; currentUser = null; localStorage.setItem('pos_app_mode', 'GUEST');
        localStorage.removeItem('pos_guest_inv'); localStorage.removeItem('pos_guest_debt'); localStorage.removeItem('pos_guest_hist');
        if (realtimeChannel) { sbClient.removeChannel(realtimeChannel); realtimeChannel = null; }
        if (sbClient) { try { await sbClient.auth.signOut(); } catch (err) {} }
        setTimeout(() => { window.location.reload(); }, 800);
    }
    
    // LISTENER SINYAL OTOMATIS
    window.addEventListener('online', () => { 
        const netStatus = document.getElementById('networkStatus');
        if(APP_MODE === 'CLOUD' && currentUser) {
            if(netStatus) { netStatus.innerText = "Sinyal Balik! Menyinkronkan..."; netStatus.className = "status-sync sync-pending"; }
            let isPending = localStorage.getItem(`pos_pending_${currentUser.id}`);
            if (isPending === "true") { pushToCloud(); } else { fetchCloudData(); }
            setupRealtimeSync(); 
        }
    });
    window.addEventListener('offline', () => { 
        const netStatus = document.getElementById('networkStatus');
        if(netStatus) { netStatus.innerText = APP_MODE === 'CLOUD' ? "Offline (Aman di Lokal)" : "Offline Mode (Guest)"; netStatus.className = "status-sync sync-offline"; }
        showToast("Sinyal Putus! Kerja offline aman.", "warning");
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === 'visible' && navigator.onLine && APP_MODE === 'CLOUD' && currentUser) { 
            let isPending = localStorage.getItem(`pos_pending_${currentUser.id}`);
            if (isPending === "true") { pushToCloud(); } 
        }
    });

    // --- PROFIL & UPLOADER STORAGE ---
    function openProfileView() {
        if (APP_MODE === 'CLOUD' && currentUser) {
            document.getElementById('viewProfileName').innerText = currentUser.user_metadata.full_name || "Kasir Cloud";
            document.getElementById('viewLoginStatus').innerText = navigator.onLine ? "Online Mode (Cloud)" : "Offline Mode (Cloud)";
            document.getElementById('viewLoginStatus').style.color = "var(--success)";
            document.getElementById('viewGoogleEmail').innerText = currentUser.email || 'Cloud User';
            document.getElementById('textGoogleLink').innerText = "Logout";
            document.getElementById('btnGoogleLink').style.background = "var(--danger)";
        } else {
            document.getElementById('viewProfileName').innerText = "Kasir Lokal";
            document.getElementById('viewLoginStatus').innerText = "Offline Mode (Guest)";
            document.getElementById('viewLoginStatus').style.color = "var(--warning)";
            document.getElementById('viewGoogleEmail').innerText = "Tidak Terhubung";
            document.getElementById('textGoogleLink').innerText = "Login Cloud";
            document.getElementById('btnGoogleLink').style.background = "var(--accent)";
        }
        let omzet = 0, piutang = 0; historyLog.forEach(h => { if(!h.isDebtPayment && h.status !== 'CICIL') omzet += h.total; }); debts.forEach(d => piutang += d.amount);
        document.getElementById('viewTotalOmzet').innerText = `Rp ${formatRp(omzet)}`; document.getElementById('viewTotalPiutang').innerText = `Rp ${formatRp(piutang)}`;
        document.getElementById('profileViewModal').classList.add('active');
    }

    function handleGoogleAuthClick() {
        if (APP_MODE === 'CLOUD') { customConfirm('Logout Akun?', 'Keluar ke mode Guest? Data Cloud aman di server.', forceLogoutToGuest); } 
        else { 
            if(typeof window.supabase === 'undefined' || !sbClient || !navigator.onLine) { showToast("Offline! Login gagal.", "error"); return; }
            showToast("Membuka jalur ke Cloud...", "syncing"); 
            sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
        }
    }

    document.getElementById('profileUploader').addEventListener('change', async function(e) {
        const f = e.target.files[0]; if(!f) return;
        showToast("Memproses foto...", "syncing"); const reader = new FileReader();
        reader.onload = function(evt) {
            const img = new Image();
            img.onload = async function() {
                const canvas = document.createElement('canvas'); const MAX_WIDTH = 400; const MAX_HEIGHT = 400;
                let width = img.width; let height = img.height;
                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                
                if (APP_MODE === 'CLOUD' && currentUser && navigator.onLine && sbClient) {
                    showToast("Upload ke Cloud...", "syncing");
                    canvas.toBlob(async (blob) => {
                        const fileName = `${currentUser.id}_profile.jpg`;
                        const { data, error } = await sbClient.storage.from('avatars').upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
                        if (error) { showToast("Gagal unggah", "error"); } 
                        else {
                            const { data: pubData } = sbClient.storage.from('avatars').getPublicUrl(fileName);
                            const photoUrl = pubData.publicUrl + '?t=' + new Date().getTime();
                            document.getElementById('viewProfileImg').src = photoUrl; document.getElementById('headProfileImg').src = photoUrl;
                            localStorage.setItem(`pos_profpic_${currentUser.id}`, photoUrl); showToast("Foto masuk Cloud!", "success");
                        }
                    }, 'image/jpeg', 0.8);
                } else {
                    const base64Photo = canvas.toDataURL('image/jpeg', 0.6);
                    document.getElementById('viewProfileImg').src = base64Photo; document.getElementById('headProfileImg').src = base64Photo;
                    if(APP_MODE === 'CLOUD' && currentUser) { localStorage.setItem(`pos_profpic_${currentUser.id}`, base64Photo); } else { localStorage.setItem('pos_guest_profpic', base64Photo); }
                    showToast("Foto tersimpan Lokal", "success");
                }
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(f);
    });

    // --- UTILITIES & FORMATTER ---
    const formatRp = (n) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(n);
    const parseRp = (s) => parseFloat(s.toString().replace(/\./g, '').replace(/[^0-9]/g, '')) || 0;
    function formatRupiahUI(el) { let val = el.value.replace(/[^0-9]/g, ''); el.value = val ? formatRp(val) : ''; }
    function toggleUI(c, i) { const el = document.getElementById(c); el.classList.toggle('collapsed'); if(document.getElementById(i)) { document.getElementById(i).innerText = el.classList.contains('collapsed') ? "BUKA [+]" : "TUTUP [-]"; } }

    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
    function customAlert(title, message) { document.getElementById('alertTitle').innerText = title; document.getElementById('alertMsg').innerText = message; document.getElementById('customAlert').classList.add('active'); }
    function customConfirm(title, message, actionCallback) { document.getElementById('confirmTitle').innerText = title; document.getElementById('confirmMsg').innerText = message; document.getElementById('customConfirm').classList.add('active'); const btnYes = document.getElementById('confirmBtnYes'); const newBtnYes = btnYes.cloneNode(true); btnYes.parentNode.replaceChild(newBtnYes, btnYes); newBtnYes.addEventListener('click', () => { closeModal('customConfirm'); if(actionCallback) actionCallback(); }); }
    function customPrompt(title, message, defaultVal, actionCallback) { document.getElementById('promptTitle').innerText = title; document.getElementById('promptMsg').innerText = message; const input = document.getElementById('promptInput'); input.value = defaultVal || ''; document.getElementById('customPrompt').classList.add('active'); setTimeout(() => input.focus(), 100); const btnSave = document.getElementById('promptBtnSave'); const newBtnSave = btnSave.cloneNode(true); btnSave.parentNode.replaceChild(newBtnSave, btnSave); newBtnSave.addEventListener('click', () => { let val = document.getElementById('promptInput').value.trim(); closeModal('customPrompt'); if(actionCallback && val) actionCallback(val); }); }
    
    // FIX UPGRADE: Sistem Toast Cerdas (Strict 1 Toast, tidak menimpa berlapis-lapis)
    let currentToastTimeout;
    function showToast(msg, type = 'success') { 
        const box = document.getElementById('toastBox'); 
        box.innerHTML = ''; // Hapus toast sebelumnya secara paksa
        if (currentToastTimeout) clearTimeout(currentToastTimeout); // Reset timer animasi

        const t = document.createElement('div'); 
        t.className = `toast ${type}`; 
        t.innerText = msg; 
        box.appendChild(t); 
        
        setTimeout(() => t.classList.add('show'), 10); 
        currentToastTimeout = setTimeout(() => { 
            t.classList.remove('show'); 
            setTimeout(() => t.remove(), 300); 
        }, 2000); 
    }


    // ==========================================
    // LOGIKA BARU: EXPORT & IMPORT CSV (10 Kolom)
    // ==========================================

    function triggerDownloadCSV() {
        playTick();
        if (inventory.length === 0) return customAlert("Gagal", "Database barang masih kosong!");
        
        const fileName = `Data_Barang_Kasir_${new Date().getTime()}.csv`;
        customConfirm(
            "Unduh file .csv ini?", 
            fileName, 
            () => exportToCSV(fileName)
        );
    }

    function exportToCSV(fileName) {
        let csvContent = "ID,NamaBarang,Harga,Satuan,EceranNominal1,EceranQty1,EceranUnit1,EceranNominal2,EceranQty2,EceranUnit2\n";
        inventory.forEach(item => {
            let nameClean = item.name.replace(/,/g, ' '); 
            csvContent += `${item.id},${nameClean},${item.price},${item.unit},${item.eceranNominal || ""},${item.eceranQty || ""},${item.eceranUnit || ""},${item.eceranNominal2 || ""},${item.eceranQty2 || ""},${item.eceranUnit2 || ""}\n`;
        });
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        showToast("Berhasil Download Database (CSV)!");
    }

    function triggerCSVUpload() {
        playTick();
        document.getElementById('csvUploader').value = ""; 
        document.getElementById('csvUploader').click();
    }

    document.getElementById('csvUploader').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(evt) {
            
            const processCSV = () => {
                const textData = evt.target.result;
                const rows = textData.split('\n');
                let newInv = [];
                
                for (let i = 1; i < rows.length; i++) {
                    if (!rows[i].trim()) continue;
                    let cols = rows[i].split(',');
                    if (cols.length >= 4) {
                        newInv.push({
                            id: cols[0] ? parseInt(cols[0]) : Date.now() + i,
                            name: cols[1] ? cols[1].trim() : "Tanpa Nama",
                            price: parseFloat(cols[2]) || 0,
                            unit: cols[3] ? cols[3].trim() : "Pcs",
                            eceranNominal: cols[4] ? parseFloat(cols[4]) : null,
                            eceranQty: cols[5] ? parseFloat(cols[5]) : null,
                            eceranUnit: cols[6] ? cols[6].trim() : null,
                            eceranNominal2: cols[7] ? parseFloat(cols[7]) : null,
                            eceranQty2: cols[8] ? parseFloat(cols[8]) : null,
                            eceranUnit2: cols[9] ? cols[9].trim() : null
                        });
                    }
                }
                
                if (newInv.length > 0) {
                    inventory = newInv; 
                    saveDB(); 
                    renderInventory();
                    showToast("Data Barang CSV Berhasil Di-upload!");
                } else {
                    customAlert("Gagal Import", "Format file CSV kosong, tidak terbaca, atau salah format.");
                }
            };

            if (inventory.length > 0) {
                customConfirm(
                    "Timpa Data Barang?", 
                    "Database HP ini sudah ada isinya. Jika Upload CSV, data barang saat ini akan DITIMPA (hilang). Apakah Anda yakin?", 
                    processCSV
                );
            } else {
                processCSV();
            }
        };
        reader.readAsText(file);
    });

    // --- MANAJEMEN SATUAN & BARANG ---
    function openUnitSelectModal() { document.getElementById('unitSelectContainer').innerHTML = units.map(u => `<div class="unit-option-btn" onclick="selectUnitOption('${u}')">${u}</div>`).join(''); document.getElementById('unitSelectModal').classList.add('active'); }
    
    function selectUnitOption(selectedUnit) { 
        document.getElementById('itemUnitVal').value = selectedUnit; 
        document.getElementById('itemUnitText').innerText = selectedUnit; 
        
        let lblQty1 = document.getElementById('lblEceranQty');
        if (lblQty1) lblQty1.innerText = `Dapat (${selectedUnit})`;
        
        let lblQty2 = document.getElementById('lblEceranQty2');
        if (lblQty2) lblQty2.innerText = `Dapat (${selectedUnit})`;
        
        closeModal('unitSelectModal'); 
    }

    function addUnit() { const u = document.getElementById('unitName').value.trim(); if(!u) return; if(units.some(unit => unit.toLowerCase() === u.toLowerCase())) return customAlert("Gagal", "Satuan sudah ada!"); units.push(u); localStorage.setItem('pos_units', JSON.stringify(units)); renderUnits(); document.getElementById('unitName').value = ''; showToast("Satuan ditambahkan"); }
    function deleteUnit(unitName) { units = units.filter(u => u !== unitName); localStorage.setItem('pos_units', JSON.stringify(units)); renderUnits(); if(document.getElementById('itemUnitVal').value === unitName) { document.getElementById('itemUnitVal').value = units[0] || ''; document.getElementById('itemUnitText').innerText = units[0] || 'PILIH'; } showToast("Satuan dihapus"); }
    function renderUnits() { document.getElementById('unitTags').innerHTML = units.map(u => `<div class="unit-tag">${u} <span onclick="customConfirm('Hapus Satuan?', 'Yakin hapus satuan ${u}?', () => deleteUnit('${u}'))">X</span></div>`).join(''); }

    function addInventory() {
        const name = document.getElementById('itemName').value.trim(); const price = parseRp(document.getElementById('itemPrice').value); const unit = document.getElementById('itemUnitVal').value; 
        const eNominal1 = parseRp(document.getElementById('eceranNominal').value); const eQty1 = parseFloat(document.getElementById('eceranQty').value); const eUnit1 = document.getElementById('eceranUnit').value.trim();
        const eNominal2 = parseRp(document.getElementById('eceranNominal2').value); const eQty2 = parseFloat(document.getElementById('eceranQty2').value); const eUnit2 = document.getElementById('eceranUnit2').value.trim();
        
        if (!name || price <= 0) return customAlert("Error", "Nama dan Harga wajib diisi!");
        const existingItem = inventory.find(x => x.name.toLowerCase() === name.toLowerCase());
        
        let newItemData = { 
            id: Date.now(), name: name, price: price, unit: unit, 
            eceranNominal: eNominal1 > 0 ? eNominal1 : null, eceranQty: eQty1 > 0 ? eQty1 : null, eceranUnit: eUnit1 || null,
            eceranNominal2: eNominal2 > 0 ? eNominal2 : null, eceranQty2: eQty2 > 0 ? eQty2 : null, eceranUnit2: eUnit2 || null
        };

        if(existingItem) { 
            existingItem.price = price; existingItem.unit = unit; 
            existingItem.eceranNominal = newItemData.eceranNominal; existingItem.eceranQty = newItemData.eceranQty; existingItem.eceranUnit = newItemData.eceranUnit;
            existingItem.eceranNominal2 = newItemData.eceranNominal2; existingItem.eceranQty2 = newItemData.eceranQty2; existingItem.eceranUnit2 = newItemData.eceranUnit2;
            showToast(`Barang ${existingItem.name} di-update!`); 
        } else { inventory.push(newItemData); showToast("Barang baru disimpan!"); }
        
        saveDB(); renderInventory(); 
        document.getElementById('itemName').value = ''; document.getElementById('itemPrice').value = ''; 
        document.getElementById('eceranNominal').value = ''; document.getElementById('eceranQty').value = ''; document.getElementById('eceranUnit').value = '';
        document.getElementById('eceranNominal2').value = ''; document.getElementById('eceranQty2').value = ''; document.getElementById('eceranUnit2').value = '';
    }

    function renderInventory() {
        const q = document.getElementById('searchInventoryInput').value.toLowerCase(); const list = inventory.filter(x => x.name.toLowerCase().includes(q));
        document.getElementById('inventoryList').innerHTML = list.map(i => {
            let eceranBadge = '';
            if (i.eceranNominal && i.eceranQty) eceranBadge += `<br><span style="color:var(--warning); font-size:0.75rem; font-weight:800;">(Slot 1: Rp${formatRp(i.eceranNominal)} = ${i.eceranQty} ${i.eceranUnit || i.unit})</span>`;
            if (i.eceranNominal2 && i.eceranQty2) eceranBadge += `<br><span style="color:var(--accent); font-size:0.75rem; font-weight:800;">(Slot 2: Rp${formatRp(i.eceranNominal2)} = ${i.eceranQty2} ${i.eceranUnit2 || i.unit})</span>`;
            
            return `<tr>
                <td><b style="font-size:clamp(0.95rem, 3.5vw, 1.1rem); text-transform: capitalize;">${i.name}</b>${eceranBadge}</td>
                <td style="font-weight:700;">Rp ${formatRp(i.price)}</td>
                <td><span class="badge-unit">${i.unit}</span></td>
                <td style="width: 100px;">
                    <div class="action-cell-wrapper">
                        <button class="btn-primary btn-table" onclick="editItemPrice(${i.id})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                        <button class="btn-danger btn-table" onclick="customConfirm('Hapus Barang?', 'Yakin hapus ${i.name}?', () => deleteInventory(${i.id}))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function deleteInventory(id) { inventory = inventory.filter(x => x.id !== id); saveDB(); renderInventory(); showToast("Barang dihapus", "error"); }
    function editItemPrice(id) { const item = inventory.find(x => x.id === id); if(!item) return; customPrompt('Edit Harga', `Harga baru untuk ${item.name}:`, formatRp(item.price), (newVal) => { const newPrice = parseRp(newVal); if(newPrice > 0) { item.price = newPrice; saveDB(); renderInventory(); showToast(`Harga ${item.name} diubah!`); } }); }
    document.getElementById('searchInventoryInput').addEventListener('input', renderInventory);

    // --- PENCARIAN & SMART SCALE ---
    const searchInput = document.getElementById('searchInput'); const searchResults = document.getElementById('searchResults'); const nominalInput = document.getElementById('nominalInput');
    function setQuickQty(val) { document.getElementById('itemQty').value = val; playTick(); }

        searchInput.addEventListener('input', function() {
        const q = this.value.toLowerCase(); 
        if (q.length < 1) { searchResults.style.display = 'none'; resetSelection(); return; }
        
        const list = inventory.filter(i => i.name.toLowerCase().includes(q));
        
        searchResults.innerHTML = list.map(i => { 
            const safeQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const regex = new RegExp(`(${safeQ})`, 'gi');
            const highlightedName = i.name.replace(regex, `<span style="background: #2ecc71; color: #ffffff; border-radius: 4px; padding: 2px 6px; font-weight: 900; box-shadow: 0 2px 4px rgba(46,204,113,0.3);">$1</span>`); 
            
            // Logika untuk menampilkan Slot Eceran/Grosir di bawah nama barang
            let eceranBadge = '';
            if (i.eceranNominal && i.eceranQty) eceranBadge += `<span style="color:var(--warning); font-size:0.75rem; font-weight:800; display:block; margin-top:2px;">(Slot 1: Rp${formatRp(i.eceranNominal)} = ${i.eceranQty} ${i.eceranUnit || i.unit})</span>`;
            if (i.eceranNominal2 && i.eceranQty2) eceranBadge += `<span style="color:var(--accent); font-size:0.75rem; font-weight:800; display:block; margin-top:2px;">(Slot 2: Rp${formatRp(i.eceranNominal2)} = ${i.eceranQty2} ${i.eceranUnit2 || i.unit})</span>`;
            
            return `<div class="search-item" style="align-items: flex-start;" onclick="selectItem('${i.name.replace(/'/g, "\\'")}', ${i.price}, '${i.unit}')">
                <div style="display: flex; flex-direction: column;">
                    <span style="text-transform: capitalize;">${highlightedName}</span>
                    ${eceranBadge}
                </div>
                <span style="color:var(--success); white-space: nowrap; margin-left: 10px;">Rp ${formatRp(i.price)}/${i.unit}</span>
            </div>`; 
        }).join('');
        
        searchResults.style.display = list.length > 0 ? 'block' : 'none';
    });

    function selectItem(name, price, unit) {
        document.getElementById('searchInput').value = name; document.getElementById('selectedItemName').value = name; document.getElementById('selectedItemPrice').value = price; document.getElementById('selectedItemUnit').value = unit; searchResults.style.display = 'none';
        document.getElementById('scaleResultVal').innerText = `0`; document.getElementById('scaleResultUnit').innerText = unit; 
        
        const scaleDesc = document.getElementById('scaleResultDesc');
        if (unit.toLowerCase() !== 'kg') { scaleDesc.style.display = 'none'; } else { scaleDesc.style.display = 'block'; scaleDesc.innerText = `Timbangan: 0 Ons 0 Garis`; }
        nominalInput.value = ''; nominalInput.focus(); playTick();
    }

    function resetSelection() { 
        document.getElementById('selectedItemName').value = ''; document.getElementById('selectedItemPrice').value = ''; document.getElementById('selectedItemUnit').value = ''; document.getElementById('itemQty').value = '1'; document.getElementById('searchInput').value = ''; document.getElementById('scaleResultVal').innerText = `0`; document.getElementById('scaleResultUnit').innerText = 'Kg'; 
        document.getElementById('scaleResultDesc').innerText = `Timbangan: 0 Ons 0 Garis`; document.getElementById('scaleResultDesc').style.display = 'block';
        nominalInput.value = ''; 
    }

    function calculateScaleFromInput() {
        const nominal = parseRp(nominalInput.value); const pricePerUnit = parseFloat(document.getElementById('selectedItemPrice').value) || 0; const unit = document.getElementById('selectedItemUnit').value;
        const selectedItemName = document.getElementById('selectedItemName').value;
        const scaleDesc = document.getElementById('scaleResultDesc');
        
        if (pricePerUnit <= 0 || nominal <= 0) { 
            document.getElementById('itemQty').value = '1'; document.getElementById('scaleResultVal').innerText = '0'; document.getElementById('scaleResultUnit').innerText = unit;
            if(unit.toLowerCase() === 'kg') { scaleDesc.style.display = 'block'; scaleDesc.innerText = `Timbangan: 0 Ons 0 Garis`; } else { scaleDesc.style.display = 'none'; }
            return; 
        }
        
        const itemData = inventory.find(i => i.name === selectedItemName);
        if (itemData) {
            // Cek Slot 2 dulu (Misal: Pembelian Besar/Grosir)
            if (itemData.eceranNominal2 && itemData.eceranQty2 && nominal === itemData.eceranNominal2) {
                document.getElementById('itemQty').value = itemData.eceranQty2; document.getElementById('scaleResultVal').innerText = itemData.eceranQty2; 
                document.getElementById('scaleResultUnit').innerText = itemData.eceranUnit2 || unit; 
                scaleDesc.style.display = 'block'; scaleDesc.innerHTML = `<b style="color:var(--accent);">(Otomatis Paket Slot 2 Pas!)</b>`; return;
            }
            // Cek Slot 1 (Misal: Eceran Biasa)
            if (itemData.eceranNominal && itemData.eceranQty && nominal === itemData.eceranNominal) {
                document.getElementById('itemQty').value = itemData.eceranQty; document.getElementById('scaleResultVal').innerText = itemData.eceranQty; 
                document.getElementById('scaleResultUnit').innerText = itemData.eceranUnit || unit; 
                scaleDesc.style.display = 'block'; scaleDesc.innerHTML = `<b style="color:var(--warning);">(Otomatis Paket Slot 1 Pas!)</b>`; return;
            }
        }

        document.getElementById('scaleResultUnit').innerText = unit;

        if (unit.toLowerCase() !== 'kg') { 
            const qty = nominal / pricePerUnit; 
            document.getElementById('itemQty').value = parseFloat(qty.toFixed(3)); 
            document.getElementById('scaleResultVal').innerText = parseFloat(qty.toFixed(3)); 
            scaleDesc.style.display = 'none'; 
            return; 
        }
        
        const qtyKg = nominal / pricePerUnit; const totalGrams = qtyKg * 1000; 
        let ons = Math.floor(totalGrams / 100); let rawGaris = (totalGrams % 100) / 10; let garis = 0;

        if (rawGaris >= 9.5) { ons += 1; garis = 0; } 
        else if (rawGaris >= 8 && rawGaris < 9.5) { garis = 7; } 
        else { let frac = rawGaris - Math.floor(rawGaris); if (frac <= 0.5) { garis = Math.floor(rawGaris); } else { garis = Math.ceil(rawGaris); } }

        const finalKg = (ons * 100 + garis * 10) / 1000;
        document.getElementById('itemQty').value = finalKg.toFixed(3); document.getElementById('scaleResultVal').innerText = finalKg.toFixed(3); 
        scaleDesc.style.display = 'block'; scaleDesc.innerText = `Timbangan: ${ons} Ons ${garis} Garis`;
    }

    // --- ALGORITMA KERANJANG CERDAS (Deteksi Grosir Otomatis) ---
    function calculateSmartSubtotal(itemName, activeUnit, totalQty) {
        const dbItem = inventory.find(x => x.name === itemName);
        if (!dbItem) return 0;

        let tiers = [];
        
        // 1. Patokan Harga Dasar
        if (dbItem.unit === activeUnit) tiers.push({ qty: 1, price: dbItem.price });
        
        // 2. Patokan Slot 1 (Eceran Biasa)
        let u1 = dbItem.eceranUnit || dbItem.unit;
        if (dbItem.eceranQty && dbItem.eceranNominal && u1 === activeUnit) {
            tiers.push({ qty: dbItem.eceranQty, price: dbItem.eceranNominal });
        }
        
        // 3. Patokan Slot 2 (Grosir)
        let u2 = dbItem.eceranUnit2 || dbItem.unit;
        if (dbItem.eceranQty2 && dbItem.eceranNominal2 && u2 === activeUnit) {
            tiers.push({ qty: dbItem.eceranQty2, price: dbItem.eceranNominal2 });
        }

        // Urutkan tier dari Jumlah (Qty) terbesar ke terkecil
        tiers.sort((a, b) => b.qty - a.qty);

        // Jika satuan tidak dikenali di database, gunakan harga dasar
        if (tiers.length === 0) return totalQty * dbItem.price;

        let sisaQty = totalQty;
        let totalHarga = 0;

        for (let t of tiers) {
            if (sisaQty >= t.qty) {
                let jumlahPaket = Math.floor(sisaQty / t.qty);
                totalHarga += jumlahPaket * t.price;
                sisaQty = parseFloat((sisaQty % t.qty).toFixed(3));
            }
        }

        // Jika masih ada sisa (misal beli 4, sisa 1 dari patokan 3), kalikan secara proporsional dengan tier terkecil
        if (sisaQty > 0) {
            let tierTerkecil = tiers[tiers.length - 1];
            totalHarga += sisaQty * (tierTerkecil.price / tierTerkecil.qty);
        }

        return Math.round(totalHarga);
    }

    // --- KALKULATOR & KERANJANG ---
    let calcRaw = '0'; 
    function formatCalcDisplay(rawStr) { let parts = rawStr.split(/([*/+\-])/); for(let i=0; i<parts.length; i++) { if(!['*', '/', '+', '-'].includes(parts[i]) && parts[i] !== '') { if(!parts[i].includes('.')) parts[i] = formatRp(parseInt(parts[i])); } else if (parts[i] === '*') parts[i] = ' X '; else if (parts[i] === '/') parts[i] = ' : '; else parts[i] = ` ${parts[i]} `; } return parts.join('').trim(); }
    function calcAction(action) {
        playTick();
        const display = document.getElementById('calcDisplay');
        if (action === 'C') calcRaw = '0'; else if (action === 'DEL') calcRaw = calcRaw.length > 1 ? calcRaw.slice(0, -1) : '0';
        else if (action === '=') { try { let res = eval(calcRaw); calcRaw = Number.isInteger(res) ? res.toString() : res.toFixed(2).toString(); } catch { calcRaw = 'Err'; setTimeout(() => { calcRaw = '0'; display.innerText = '0'; }, 1000); } } 
        else if (action === '+') { try { let res = eval(calcRaw); if (res > 0) { cart.push({ id: Date.now(), name: `Barang Manual ${manualItemCounter}`, price: res, qty: 1, unit: 'Ls', subtotal: res, isManual: true }); manualItemCounter++; renderCart(); showToast(`Masuk Keranjang!`); } calcRaw = '0'; } catch { calcRaw = 'Err'; setTimeout(() => { calcRaw = '0'; display.innerText = '0'; }, 1000); } } 
        else { let sysAction = action; if (action === 'X') sysAction = '*'; if (action === ':') sysAction = '/'; if (calcRaw === '0') { if (['00', '000'].includes(sysAction)) return; if (sysAction === '.') calcRaw = '0.'; else if (['*', '/', '-'].includes(sysAction)) calcRaw = '0' + sysAction; else calcRaw = sysAction; } else calcRaw += sysAction; }
        if(calcRaw !== 'Err') display.innerText = formatCalcDisplay(calcRaw); else display.innerText = calcRaw;
    }

    function addToCart() {
        let name = document.getElementById('selectedItemName').value; 
        let basePrice = parseFloat(document.getElementById('selectedItemPrice').value); 
        let activeUnit = document.getElementById('scaleResultUnit').innerText; 
        let activeQty = parseQty(document.getElementById('itemQty').value);
        if (name && basePrice > 0 && !(activeQty > 0)) return customAlert("Gagal", "Qty harus lebih dari 0!");
        let nominalInputVal = parseRp(document.getElementById('nominalInput').value);
        
        if (name && basePrice > 0) {
            let existingItem = cart.find(x => x.name === name && !x.isManual && x.unit === activeUnit);
            
            if (existingItem) {
                existingItem.qty += activeQty;
                // Hitung ulang harga total dengan logika pintar
                existingItem.subtotal = calculateSmartSubtotal(existingItem.name, existingItem.unit, existingItem.qty);
                showToast(`Jumlah digabung & Harga dikalkulasi ulang!`);
            } else {
                let smartSub = calculateSmartSubtotal(name, activeUnit, activeQty);
                let finalSubtotal = nominalInputVal > 0 ? nominalInputVal : smartSub;
                
                cart.push({ id: Date.now(), name: name, price: basePrice, qty: activeQty, unit: activeUnit, subtotal: finalSubtotal, isManual: false });
                showToast(`Masuk keranjang!`);
            }
            resetSelection(); renderCart(); return;
        }
        customAlert("Gagal", "Pilih barang dari pencarian atau tekan (+) di Kalkulator untuk barang manual!");
    }

    function renderCart() {
        let total = 0;
        document.getElementById('cartList').innerHTML = cart.map(i => {
            total += i.subtotal; let qtyHtml = ''; let priceHtml = '';
            if (i.isManual) { qtyHtml = `<div style="text-align:center; font-weight:bold;">1 Ls</div>`; priceHtml = `<span style="font-weight:900; color:var(--primary); cursor:pointer; text-decoration:underline;" onclick="editManualPrice(${i.id}, ${i.price})">Rp ${formatRp(i.subtotal)}</span>`; } 
            else { qtyHtml = `<div class="qty-updater"><button class="btn-qty" onclick="updateCartQty(${i.id}, -1)">-</button><div class="cart-qty-val" onclick="openCartQtyModal(${i.id}, '${i.name.replace(/'/g, "\\'")}', '${i.unit}', ${i.qty})">${parseFloat(i.qty.toFixed(3))}<br><small style="font-size:0.65rem;">${i.unit}</small></div><button class="btn-qty" onclick="updateCartQty(${i.id}, 1)">+</button></div>`; priceHtml = `<span style="font-weight:900; color:var(--primary);">Rp ${formatRp(i.subtotal)}</span>`; }
            return `<tr><td><b style="font-size:clamp(0.95rem, 3.5vw, 1.1rem); text-transform: capitalize;">${i.name}</b></td><td>${qtyHtml}</td><td>${priceHtml}</td><td><button class="btn-danger btn-table" style="margin: 0 auto !important;" onclick="customConfirm('Batal Beli?', 'Hapus ${i.name}?', () => removeFromCart(${i.id}))"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2-2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button></td></tr>`;
        }).join('');
        total = Math.round(total); document.getElementById('grandTotal').innerText = `Rp ${formatRp(total)}`; document.getElementById('grandTotal').dataset.val = total; calculateChange();
    }

    function updateCartQty(id, delta) { 
        playTick(); 
        let item = cart.find(x => x.id === id); 
        if (item && !item.isManual) { 
            let newQty = item.qty + delta; 
            if (newQty <= 0) {
                customConfirm('Hapus Barang?', 'Jumlah 0. Hapus?', () => removeFromCart(id)); 
            } else { 
                item.qty = newQty; 
                // Lock harga Grosir/Eceran jika memenuhi syarat
                item.subtotal = calculateSmartSubtotal(item.name, item.unit, item.qty);
                renderCart(); 
            } 
        } 
    }
    
    function openCartQtyModal(id, name, unit, currentQty) { document.getElementById('cartQtyId').value = id; document.getElementById('cartQtyMsg').innerText = `Kuantitas ${name} (${unit})`; const input = document.getElementById('cartQtyInput'); input.value = parseFloat(currentQty.toFixed(3)); document.getElementById('cartQtyModal').classList.add('active'); setTimeout(() => input.focus(), 100); }
    
    function saveCartQty() { 
        let id = parseFloat(document.getElementById('cartQtyId').value); 
        let newQty = parseQty(document.getElementById('cartQtyInput').value);
        if (newQty > 0) { 
            let item = cart.find(x => x.id === id); 
            if (item) { 
                item.qty = newQty; 
                item.subtotal = calculateSmartSubtotal(item.name, item.unit, item.qty);
                renderCart(); 
            } 
        } 
        closeModal('cartQtyModal'); 
    }

    function editManualPrice(id, currentPrice) { customPrompt('Edit Barang Manual', 'Masukkan harga baru:', formatRp(currentPrice), (newVal) => { const newPrice = parseRp(newVal); if (newPrice > 0) { let item = cart.find(x => x.id === id); if (item && item.isManual) { item.price = newPrice; item.subtotal = newPrice; renderCart(); showToast("Harga diubah!"); } } }); }
    function removeFromCart(id) { cart = cart.filter(x => x.id !== id); renderCart(); }

    // --- HELPER BARU ---
const parseQty = (s) => parseFloat(String(s).replace(',', '.')) || 0;
function loginGoogle() { handleGoogleAuthClick(); }

// --- KALKULATOR UANG PEMBELI ---
function cashAction(a) {
    playTick();
    const inp = document.getElementById('cashInput');
    let raw = inp.value.replace(/[^0-9]/g, '');

    if (a === 'C') raw = '';
    else if (a === 'DEL') raw = raw.slice(0, -1);
    else if (a === 'PAS') raw = String(parseFloat(document.getElementById('grandTotal').dataset.val) || 0);
    else if (a.startsWith('+')) raw = String((parseInt(raw) || 0) + parseInt(a.slice(1)));
    else { if (raw === '' && /^0+$/.test(a)) return; raw += a; }

    if (raw.length > 10) return;
    inp.value = (raw && raw !== '0') ? formatRp(raw) : '';
    calculateChange();
}

// --- CHECKOUT ---
    function calculateChange() {
    const $ = (id) => document.getElementById(id);
    const total = parseFloat($('grandTotal').dataset.val) || 0;
    const cashInputVal = $('cashInput').value;
    const cash = parseRp(cashInputVal);
    const box = $('changeDisplayBox'), label = $('changeLabelText'),
          val = $('changeDue'), debtSec = $('debtSection');
    if (!box || !label || !val || !debtSec) return;

    if (total === 0 || cashInputVal === '') {
        box.classList.remove('kurang'); label.innerText = "Status / Kembalian";
        val.innerText = "Rp 0"; debtSec.style.display = 'none'; return;
    }
    const diff = cash - total;
    if (diff < 0) {
        box.classList.add('kurang'); label.innerText = "KURANG (HUTANG)";
        val.innerText = "- Rp " + formatRp(Math.abs(diff)); debtSec.style.display = 'block';
    } else {
        box.classList.remove('kurang'); label.innerText = "KEMBALIAN";
        val.innerText = "Rp " + formatRp(diff); debtSec.style.display = 'none';
    }
}

    function processTransactionLama() {
        if (cart.length === 0) return customAlert("Transaksi Gagal", "Keranjang kosong!");
        const total = parseFloat(document.getElementById('grandTotal').dataset.val); const cash = parseRp(document.getElementById('cashInput').value);
        let status = "LUNAS"; let borrower = ""; let itemsFormatted = cart.map(x => `${x.name} (${parseFloat(x.qty.toFixed(3))} ${x.unit}) - Rp ${formatRp(x.subtotal)}`).join("<br>");

        if (cash < total) {
            borrower = document.getElementById('debtorName').value.trim();
            if (!borrower) return customAlert("Peringatan", "Wajib catat nama untuk hutang!");
            status = "HUTANG"; itemsFormatted += `<br><b style="color:var(--danger);">A.N: ${borrower}</b>`;
            debts.push({ id: Date.now(), date: new Date().toLocaleDateString('id-ID'), name: borrower, amount: (total - cash) });
        }

        const txData = { id: Date.now(), date: new Date().toLocaleString('id-ID'), items: itemsFormatted, cartSnapshot: JSON.parse(JSON.stringify(cart)), total: total, cash: cash, status: status, borrower: borrower };
        historyLog.unshift(txData); 
        
        saveDB(); 
        cart = []; manualItemCounter = 1; document.getElementById('cashInput').value = ''; document.getElementById('debtorName').value = ''; document.getElementById('changeDisplayBox').classList.remove('kurang'); document.getElementById('changeLabelText').innerText = "Status / Kembalian"; document.getElementById('changeDue').innerText = "Rp 0"; document.getElementById('debtSection').style.display = 'none';
        
        playCekring();
        renderCart(); renderDebts(); renderHistory(); document.getElementById('searchInput').focus(); showToast("Transaksi Berhasil Disimpan!");
    }

    function processTransaction() {
    if (cart.length === 0) return customAlert("Transaksi Gagal", "Keranjang kosong!");

    const total = parseFloat(document.getElementById('grandTotal').dataset.val) || 0;
    const cash = parseRp(document.getElementById('cashInput').value);
    const debtorEl = document.getElementById('debtorName');
    let status = "LUNAS", borrower = "";
    let itemsFormatted = cart.map(x => `${x.name} (${parseFloat(Number(x.qty).toFixed(3))} ${x.unit}) - Rp ${formatRp(x.subtotal)}`).join("<br>");

    if (cash < total) {
        borrower = debtorEl ? debtorEl.value.trim() : '';
        if (!borrower) return customAlert("Peringatan", "Wajib catat nama untuk hutang!");
        status = "HUTANG";
        itemsFormatted += `<br><b style="color:var(--danger);">A.N: ${borrower}</b>`;
        debts.push({ id: Date.now(), date: new Date().toLocaleDateString('id-ID'), name: borrower, amount: (total - cash) });
    }

    historyLog.unshift({
        id: Date.now() + 1,
        date: new Date().toLocaleString('id-ID'),
        items: itemsFormatted,
        cartSnapshot: JSON.parse(JSON.stringify(cart)),
        total: total, cash: cash, status: status, borrower: borrower
    });

    // 1) SIMPAN LOKAL DULU (instan). Cloud dijadwalkan pelan-pelan di dalam saveDB.
    try { saveDB(); } catch (e) { console.log('saveDB error:', e); }

    // 2) Kosongkan keranjang & form (null-safe)
    cart = []; manualItemCounter = 1;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    setVal('cashInput', ''); setVal('debtorName', '');
    const ds = document.getElementById('debtSection'); if (ds) ds.style.display = 'none';
    try { resetSelection(); } catch (e) {}

    // 3) Render (satu gagal tidak menghentikan yang lain)
    [renderCart, renderDebts, renderHistory].forEach(fn => { try { fn(); } catch (e) { console.log(fn.name, e); } });

    try { playCekring(); } catch (e) {}
    try { document.getElementById('searchInput').focus(); } catch (e) {}
    if (window.checkPendingUpdate) setTimeout(window.checkPendingUpdate, 2500);
    showToast("Transaksi Berhasil Disimpan!");
}

// --- CETAK STRUK THERMAL ---
    function printReceipt(id) {
        const tx = historyLog.find(x => x.id === id); if (!tx) return;
        let itemsHtml = '';
        if(tx.cartSnapshot && tx.cartSnapshot.length > 0) { itemsHtml = tx.cartSnapshot.map(item => `<tr><td style="text-align:left;">${item.name}<br><small>${parseFloat(item.qty.toFixed(3))} ${item.unit} x ${formatRp(item.price)}</small></td><td style="text-align:right;">${formatRp(item.subtotal)}</td></tr>`).join(''); } 
        else if (tx.isDebtPayment) { itemsHtml = `<tr><td style="text-align:left;">Pembayaran Piutang<br><small>A.N: ${tx.borrower}</small></td><td style="text-align:right;">${formatRp(tx.cash)}</td></tr>`; } 
        else { itemsHtml = `<tr><td colspan="2" style="text-align:left;">${tx.items.replace(/<br>/g, '<br>')}</td></tr>`; }
        let changeOrDebt = tx.cash - tx.total; let changeLabel = changeOrDebt >= 0 ? 'Kembali' : 'Kurang/Hutang';
        let borrowerHtml = tx.borrower ? `<div class="receipt-row"><span>Pelanggan:</span><span>${tx.borrower}</span></div>` : '';
        const html = `<div class="receipt-header"><div style="font-size:16px;">${shopName}</div><div style="font-size:11px; font-weight:normal; margin-top:5px;">${tx.date}</div><div style="font-size:11px; font-weight:normal;">ID: TRX-${tx.id.toString().slice(-6)}</div></div><table class="receipt-table">${itemsHtml}</table><div class="receipt-total"><div class="receipt-row"><span>Total:</span><span>Rp ${formatRp(tx.total)}</span></div><div class="receipt-row"><span>Tunai:</span><span>Rp ${formatRp(tx.cash)}</span></div><div class="receipt-row"><span>${changeLabel}:</span><span>Rp ${formatRp(Math.abs(changeOrDebt))}</span></div>${borrowerHtml}</div><div class="receipt-footer">Terima Kasih<br>Barang yang dibeli boleh ditukar dengan syarat masih utuh.</div>`;
        document.getElementById('receiptArea').innerHTML = html; document.getElementById('receiptModal').classList.add('active');
    }

    // --- PIUTANG ---
    function renderDebts() {
        const q = document.getElementById('searchDebtInput').value.toLowerCase(); const list = debts.filter(x => x.name.toLowerCase().includes(q));
        document.getElementById('debtList').innerHTML = list.map(d => `<tr><td style="font-size:clamp(0.75rem, 2.5vw, 0.85rem);">${d.date}</td><td style="text-transform: capitalize;"><b style="font-size:clamp(0.95rem, 3.5vw, 1.1rem);">${d.name}</b></td><td style="color:var(--danger); font-weight:900; font-size:clamp(0.95rem, 3.5vw, 1.1rem);">Rp ${formatRp(d.amount)}</td><td style="text-align:center;"><button class="btn-success" style="padding: clamp(8px, 2.5vw, 10px); width: 100%; font-size:clamp(0.75rem, 2.5vw, 0.85rem);" onclick="openDebtPaymentModal(${d.id})">BAYAR</button></td></tr>`).join('');
    }

    function openDebtPaymentModal(id) { const debtIdx = debts.findIndex(x => x.id === id); if(debtIdx > -1) { const d = debts[debtIdx]; document.getElementById('debtPaymentId').value = id; document.getElementById('debtMaxAmount').value = d.amount; document.getElementById('debtPaymentMsg').innerHTML = `Sisa Hutang: <b>Rp ${formatRp(d.amount)}</b><br>Atas Nama: <b>${d.name}</b>`; document.getElementById('debtPaymentInput').value = ''; document.getElementById('debtPaymentModal').classList.add('active'); } }
    function setLunasAmount() { const maxAmount = document.getElementById('debtMaxAmount').value; const inputElem = document.getElementById('debtPaymentInput'); inputElem.value = maxAmount; formatRupiahUI(inputElem); showToast("Nominal Full Diisi!"); playTick(); }

    function processDebtPayment() {
        const id = parseInt(document.getElementById('debtPaymentId').value); const payAmount = parseRp(document.getElementById('debtPaymentInput').value); const debtIdx = debts.findIndex(x => x.id === id);
        if(debtIdx > -1 && payAmount > 0) {
            const d = debts[debtIdx]; let statusStr = ""; let msgStr = "";
            if(payAmount >= d.amount) { statusStr = "LUNAS"; msgStr = `PELUNASAN PIUTANG:<br><b style="color:var(--success);">A.N: ${d.name}</b>`; debts.splice(debtIdx, 1); showToast(`Piutang ${d.name} LUNAS!`); } 
            else { statusStr = "CICIL"; msgStr = `CICILAN PIUTANG:<br><b style="color:var(--warning);">A.N: ${d.name}</b>`; debts[debtIdx].amount -= payAmount; showToast(`Cicilan dari ${d.name} diterima!`); }
            const logData = { id: Date.now(), date: new Date().toLocaleString('id-ID'), items: msgStr, total: d.amount, cash: payAmount, status: statusStr, isDebtPayment: true, borrower: d.name };
            historyLog.unshift(logData); saveDB(); renderDebts(); renderHistory(); closeModal('debtPaymentModal'); playCekring();
        } else { customAlert("Input Tidak Valid", "Masukkan nominal pembayaran!"); }
    }

    function toggleHistoryDetail(id, btn, count) { const detailDiv = document.getElementById('hist-detail-' + id); if(detailDiv.classList.contains('active')) { detailDiv.classList.remove('active'); btn.innerText = `Lihat ${count} ..`; } else { detailDiv.classList.add('active'); btn.innerText = `Tutup Detail [-]`; } }

        // --- RIWAYAT PINTAR & FILTER WAKTU ---
    function selectHistoryFilter(val, textLabel) {
        document.getElementById('historyFilterVal').value = val;
        document.getElementById('historyFilterText').innerText = textLabel;
        closeModal('filterTimeModal');
        playTick(); 
        renderHistory();
    }

    function getFilteredHistory() {
        const filterVal = document.getElementById('historyFilterVal').value;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const btnLabel = document.getElementById('deleteBtnLabel');
        const dashLabel = document.getElementById('deleteDashLabel');
        let labelText = "SEMUA";
        if(filterVal === 'today') labelText = "HARI INI";
        else if(filterVal === '3days') labelText = "3 HARI";
        else if(filterVal === '7days') labelText = "7 HARI";
        
        if (btnLabel) btnLabel.innerText = labelText;
        if (dashLabel) dashLabel.innerText = labelText;

        return historyLog.filter(h => {
            if (filterVal === 'all') return true;
            const txTime = h.id; 
            if (filterVal === 'today') return txTime >= startOfToday;
            if (filterVal === '3days') return txTime >= (startOfToday - (2 * 24 * 60 * 60 * 1000));
            if (filterVal === '7days') return txTime >= (startOfToday - (6 * 24 * 60 * 60 * 1000)); 
            return true;
        });
    }

    function renderHistory() {
        const timeFilteredLog = getFilteredHistory();
        let omzet = 0, tunai = 0, piutang = 0;
        let historyHTML = '';

        timeFilteredLog.forEach(h => {
            // Hitung dasbor HANYA JIKA dashboardDeleted belum true
            if (!h.dashboardDeleted) {
                if (h.isDebtPayment) tunai += h.cash;
                if(!h.isDebtPayment) { 
                    omzet += h.total; 
                    tunai += Math.min(h.total, h.cash); 
                    if (h.status === "HUTANG") piutang += (h.total - h.cash); 
                }
            }

            // Tampilkan di tabel HANYA JIKA historyDeleted belum true
            if (!h.historyDeleted) {
                let badgeColor = "var(--primary)"; 
                if (h.status === "LUNAS") badgeColor = "var(--success)"; 
                if (h.status === "HUTANG") badgeColor = "var(--danger)"; 
                if (h.status === "CICIL") badgeColor = "var(--warning)";
                
                let itemsArr = String(h.items || '').split('<br>').filter(x => x.trim() !== ''); 
                let visibleItems = [itemsArr[0]]; let hiddenItems = [];
                for(let i = 1; i < itemsArr.length; i++) { 
                    if(itemsArr[i].includes("A.N:")) visibleItems.push(itemsArr[i]); 
                    else hiddenItems.push(itemsArr[i]); 
                }
                let displayItems = `<div style="font-weight: bold;">${visibleItems.join('<br>')}</div>`;
                if (hiddenItems.length > 0) { displayItems += `<div id="hist-detail-${h.id}" class="history-full">${hiddenItems.join('<br>')}</div><div class="history-toggle-btn" onclick="toggleHistoryDetail(${h.id}, this, ${hiddenItems.length})">Lihat ${hiddenItems.length} ..</div>`; }
                
                historyHTML += `<tr><td style="font-size:clamp(0.7rem, 2.5vw, 0.85rem);">${h.date}</td><td style="text-transform: capitalize; line-height:1.4; font-size:clamp(0.85rem, 3vw, 0.95rem);">${displayItems}</td><td style="font-size:clamp(0.8rem, 3vw, 0.9rem);"><b>Total:</b> Rp ${formatRp(h.total)}<br><b>Tunai:</b> Rp ${formatRp(h.cash)}</td><td style="text-align: center; vertical-align: middle;"><div style="display:flex; flex-direction:column; gap:6px; align-items:center;"><span class="badge-status" style="background: ${badgeColor}; padding: 4px 0; width: 100%; border-radius: 4px;">${h.status}</span><button class="btn-primary btn-table" style="width: 100%; border-radius:4px; height: clamp(28px, 8vw, 32px);" onclick="printReceipt(${h.id})"><svg class="icon-svg" style="margin-right:0; width:16px; height:16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2-2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg></button></div></td></tr>`;
            }
        });
        
        document.getElementById('historyList').innerHTML = historyHTML;
        document.getElementById('dailyOmzet').innerText = `Rp ${formatRp(omzet)}`; 
        document.getElementById('dailyCash').innerText = `Rp ${formatRp(tunai)}`; 
        document.getElementById('dailyDebt').innerText = `Rp ${formatRp(piutang)}`;
    }

    function confirmClearHistory() {
        const filterVal = document.getElementById('historyFilterVal').value;
        let msg = "";
        if(filterVal === 'today') msg = "Yakin sembunyikan riwayat tabel HARI INI? (Angka Dasbor Omzet tidak akan hilang)";
        else if(filterVal === '3days') msg = "Yakin sembunyikan riwayat tabel 3 HARI TERAKHIR?";
        else if(filterVal === '7days') msg = "Yakin sembunyikan riwayat tabel 7 HARI TERAKHIR?";
        else msg = "Yakin bersihkan SEMUA riwayat tabel dari awal?";
        customConfirm('Bersihkan Riwayat', msg, clearHistory);
    }

    function clearHistory() {
        processDeletion('history');
        showToast("Riwayat tabel berhasil dibersihkan!"); 
    }

    function confirmClearDashboard() {
        const filterVal = document.getElementById('historyFilterVal').value;
        let msg = "";
        if(filterVal === 'today') msg = "Yakin RESET ANGKA DASBOR (Omzet, Tunai, Piutang) untuk HARI INI? Angka akan jadi 0.";
        else if(filterVal === '3days') msg = "Yakin RESET ANGKA DASBOR untuk 3 HARI TERAKHIR?";
        else if(filterVal === '7days') msg = "Yakin RESET ANGKA DASBOR untuk 7 HARI TERAKHIR?";
        else msg = "Yakin RESET SEMUA ANGKA DASBOR dari awal? Ini tidak bisa dikembalikan.";
        customConfirm('Reset Dasbor', msg, clearDashboard);
    }

    function clearDashboard() {
        processDeletion('dashboard');
        showToast("Angka Dasbor berhasil di-reset!"); 
    }

    function processDeletion(target) {
        const filterVal = document.getElementById('historyFilterVal').value;
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        let cutoffTime = 0;
        
        if (filterVal === 'today') cutoffTime = startOfToday;
        else if (filterVal === '3days') cutoffTime = startOfToday - (2 * 24 * 60 * 60 * 1000);
        else if (filterVal === '7days') cutoffTime = startOfToday - (6 * 24 * 60 * 60 * 1000);

        // Update JSON file berdasarkan target yang dihapus
        historyLog = historyLog.map(h => {
            if (filterVal === 'all' || h.id >= cutoffTime) {
                if (target === 'history') h.historyDeleted = true;
                if (target === 'dashboard') h.dashboardDeleted = true;
            }
            return h;
        });

        // Pembersihan sampah: Jika sudah dihapus dari tabel DAN dasbor, hapus permanen dari memori
        historyLog = historyLog.filter(h => !(h.historyDeleted && h.dashboardDeleted));
        
        saveDB(); 
        renderHistory(); 
    }

    function requestShopNameEdit() { 
        customPrompt('Ubah Nama Toko', 'Masukkan nama toko baru:', shopName, (newName) => { 
            shopName = newName.toUpperCase(); 
            localStorage.setItem('pos_shop_name', shopName); 
            document.getElementById('shopNameDisplay').innerText = shopName; 
            scheduleCloudSync();
            showToast("Nama Toko Berhasil Diubah!");
        }); 
    }

    // RENDER SEMUA UI SAAT AWAL MUAT
    function renderAllUI() { renderUnits(); renderInventory(); renderDebts(); renderHistory(); }

    // --- EKSEKUSI AWAL ---
    window.addEventListener('load', () => { bootApp(); });

    // --- UPDATE OTOMATIS + LAYAR LOADING ---
if ('serviceWorker' in navigator) {
    let refreshing = false;
    let updatePending = false;
    const hadController = !!navigator.serviceWorker.controller;

    const applyUpdate = () => {
        if (refreshing) return;
        // Jangan reload kalau kasir sedang melayani pembeli
        if (cart.length > 0) {
            updatePending = true;
            showToast("Update siap! Dipasang setelah transaksi selesai.", "update");
            return;
        }
        refreshing = true;
        const o = document.getElementById('updateOverlay');
        if (o) o.classList.add('active');
        setTimeout(() => window.location.reload(), 2000);
    };

    window.checkPendingUpdate = () => {
        if (updatePending) { updatePending = false; applyUpdate(); }
    };

    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
        .then(reg => {
            reg.update();
            reg.onupdatefound = () => {
                const w = reg.installing;
                if (!w) return;
                w.onstatechange = () => {
                    if (w.state === 'installed' && navigator.serviceWorker.controller) applyUpdate();
                };
            };
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') reg.update();
            });
        })
        .catch(err => console.log('Service Worker Gagal!', err));
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController) applyUpdate();
    });
}
