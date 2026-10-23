// ==========================================================
// keyboard.js (v4.21) - Mode Laptop / Tablet + Keyboard
// Dimuat SETELAH main.js. Tidak mengubah data/database apa pun.
// Di HP (tanpa keyboard fisik) semua perilaku lama tetap sama.
// ==========================================================
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);

    // Keyboard dianggap aktif otomatis di perangkat dengan mouse/touchpad (laptop/PC).
    // Di HP/tablet baru aktif setelah ada tombol keyboard fisik ditekan.
    const finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
    let kbOn = finePointer;
    let kbIdx = -1; // baris hasil pencarian yang sedang disorot

    function setKb() { kbOn = true; document.body.classList.add('kb-on'); }
    if (kbOn) document.body.classList.add('kb-on');

    // ---------- 1. SUSUN ULANG MEJA KASIR (kiri/kanan untuk layar lebar) ----------
    // Elemen hanya dipindah (id & fungsi tetap). Di HP wrapper = display: contents (tidak berefek).
    (function buildKasirColumns() {
        const kasir = document.querySelector('.main-container > .panel:nth-child(2)');
        if (!kasir || kasir.querySelector('.kasir-left')) return;
        const kids = Array.from(kasir.children);
        const table = kasir.querySelector(':scope > .table-responsive');
        const iT = kids.indexOf(table);
        if (iT < 1) return;
        // Di index.html lama, panel Piutang & Riwayat "nyangkut" di dalam panel Kasir (div kurang tertutup).
        const nested = kids.filter((n) => n.classList.contains('panel'));
        const left = document.createElement('div'); left.className = 'kasir-left';
        const right = document.createElement('div'); right.className = 'kasir-right';
        kids.slice(1, iT).forEach((n) => left.appendChild(n));
        kids.slice(iT).filter((n) => nested.indexOf(n) < 0).forEach((n) => right.appendChild(n));
        const hint = document.createElement('div');
        hint.className = 'kb-hint';
        hint.innerHTML = '⌨️ <b>↑ ↓</b> / <b>PgUp PgDn</b> pindah kotak &nbsp; <b>Enter</b> pilih / tambah &nbsp; <b>F2</b> cari &nbsp; <b>F3</b> kalkulator &nbsp; ' +
            '<b>F4</b> uang &nbsp; <b>F6</b> ubah qty terakhir &nbsp; <b>F7</b> hapus terakhir &nbsp; <b>F9</b> selesai &nbsp; <b>Esc</b> batal &nbsp; ' +
            '<b>P</b> uang pas &nbsp; <b>Shift+1…6</b> = +2rb/5rb/10rb/20rb/50rb/100rb (di kotak uang) &nbsp; <b>Y</b> = Ya di konfirmasi ' +
            '<br>📍 Kotak aktif: <b id="kbStatus">-</b>';
        kasir.appendChild(hint);
        kasir.insertBefore(hint, kasir.children[1] || null);
        kasir.appendChild(left);
        kasir.appendChild(right);
        nested.forEach((n) => kasir.appendChild(n));

        // Layar >= 768px: Piutang & Riwayat dipindah ke samping (jadi kolom sendiri).
        // HP (< 768px): tetap di tempat lama, tampilan HP tidak berubah.
        const mq = window.matchMedia('(min-width: 768px)');
        const placePanels = function () {
            if (mq.matches) { let ref = kasir; nested.forEach((n) => { ref.after(n); ref = n; }); }
            else { nested.forEach((n) => kasir.appendChild(n)); }
        };
        placePanels();
        if (mq.addEventListener) mq.addEventListener('change', placePanels); else mq.addListener(placePanels);
    })();

    // Kalkulator bisa difokuskan (untuk diketik dengan keyboard)
    const calcDisplay = $('calcDisplay');
    if (calcDisplay) calcDisplay.setAttribute('tabindex', '0');
    // Beri id pada tombol "Selesaikan Transaksi" supaya bisa ikut urutan PgUp/PgDn
    const btnProcess = Array.from(document.querySelectorAll('button')).find((b) => (b.getAttribute('onclick') || '').indexOf('processTransaction()') > -1);
    if (btnProcess && !btnProcess.id) btnProcess.id = 'btnProcess';

    // ---------- 2. PINDAH KOTAK DENGAN PgUp / PgDn ----------
    const ZONES = ['searchInput', 'itemQty', 'nominalInput', 'calcDisplay', 'cashInput', 'debtorName', 'btnProcess',
                   'itemName', 'searchInventoryInput', 'searchDebtInput'];
    const KASIR_IDS = ['searchInput', 'itemQty', 'nominalInput', 'calcDisplay', 'cashInput', 'debtorName', 'btnProcess'];

    const LABELS = { searchInput: 'Cari Barang', itemQty: 'Qty', nominalInput: 'Uang Pembeli (Hitung Otomatis)', calcDisplay: 'Kalkulator',
        cashInput: 'Uang Diterima', debtorName: 'Nama Penghutang', btnProcess: 'Tombol Selesaikan Transaksi', itemName: 'Nama Barang Baru',
        searchInventoryInput: 'Cari Database Barang', searchDebtInput: 'Cari Penghutang' };
    document.addEventListener('focusin', function (e) {
        const st = $('kbStatus'); if (st && e.target && LABELS[e.target.id]) st.textContent = LABELS[e.target.id];
    });
    function usable(el) {
        if (!el || el.disabled) return false;
        if (el.getClientRects().length === 0) return false;
        if (el.closest('.panel-wrapper.collapsed')) return false;
        return getComputedStyle(el).visibility !== 'hidden';
    }
    function focusEl(el) {
        if (!el) return;
        el.focus();
        if (el.tagName === 'INPUT' && typeof el.select === 'function') { try { el.select(); } catch (e) {} }
    }
    function hideResults() { const sr = $('searchResults'); if (sr) sr.style.display = 'none'; }
    function moveZone(dir) {
        const list = ZONES.map($).filter(usable);
        if (!list.length) return;
        let idx = list.indexOf(document.activeElement);
        if (idx === -1) idx = dir > 0 ? -1 : 0;
        const next = list[(idx + dir + list.length) % list.length];
        if (next !== $('searchInput')) hideResults();
        focusEl(next);
    }

    // ---------- 3. ALUR PENCARIAN BARANG ----------
    const searchItems = () => Array.from(document.querySelectorAll('#searchResults .search-item'));
    const resultsOpen = () => { const sr = $('searchResults'); return !!sr && getComputedStyle(sr).display !== 'none' && searchItems().length > 0; };
    function paint(items) {
        items.forEach((el, i) => el.classList.toggle('kb-active', i === kbIdx));
        if (items[kbIdx]) items[kbIdx].scrollIntoView({ block: 'nearest' });
    }
    function goAfterSelect() {
        const unit = ($('selectedItemUnit').value || '').toLowerCase();
        focusEl(unit === 'kg' ? $('nominalInput') : $('itemQty'));
    }

    if ($('searchInput')) {
        $('searchInput').addEventListener('input', function () {
            kbIdx = -1;
            if (!kbOn) return;
            const items = searchItems();
            if (resultsOpen()) { kbIdx = 0; paint(items); } // baris pertama langsung tersorot
        });
    }

    // Bungkus fungsi lama (isi fungsi lama tetap dipakai apa adanya)
    if (typeof window.selectItem === 'function') {
        const orig = window.selectItem;
        window.selectItem = function () {
            const r = orig.apply(this, arguments);
            kbIdx = -1;
            if (kbOn) setTimeout(goAfterSelect, 0); // Kg -> kotak uang, selain Kg -> kotak Qty
            return r;
        };
    }
    if (typeof window.addToCart === 'function') {
        const origAdd = window.addToCart;
        window.addToCart = function () {
            const r = origAdd.apply(this, arguments);
            // Berhasil masuk keranjang = pilihan dikosongkan -> balik ke kotak cari
            if (kbOn && !document.querySelector('.modal-overlay.active') && !$('selectedItemName').value) {
                setTimeout(() => focusEl($('searchInput')), 0);
            }
            return r;
        };
    }
    if (typeof window.closeModal === 'function') {
        const origClose = window.closeModal;
        window.closeModal = function () {
            const r = origClose.apply(this, arguments);
            if (kbOn) {
                setTimeout(() => {
                    const a = document.activeElement;
                    if (!document.querySelector('.modal-overlay.active') && (!a || a === document.body || !usable(a))) {
                        focusEl($('searchInput'));
                    }
                }, 280);
            }
            return r;
        };
    }

    // ---------- 4. SELESAIKAN TRANSAKSI ----------
    function finish() {
        if (cart.length === 0) { showToast('Keranjang masih kosong', 'warning'); focusEl($('searchInput')); return; }
        if ($('cashInput').value === '') {
            showToast('Isi uang diterima dulu (ketik 0 kalau hutang penuh)', 'warning');
            focusEl($('cashInput')); return;
        }
        const total = parseFloat($('grandTotal').dataset.val) || 0;
        const cash = parseRp($('cashInput').value);
        const ds = $('debtSection');
        if (cash < total && ds && ds.style.display !== 'none' && !$('debtorName').value.trim()) {
            showToast('Isi nama penghutang, lalu Enter', 'warning');
            focusEl($('debtorName')); return;
        }
        processTransaction();
    }

    // ---------- 5. KALKULATOR DENGAN KEYBOARD ----------
    function calcKeys(e) {
        const k = e.key; let a = null;
        if (/^[0-9]$/.test(k)) a = k;
        else if (k === '.' || k === ',') a = '.';
        else if (k === '+') a = '+';      // sama seperti tombol hijau (+): masukkan ke keranjang
        else if (k === '-') a = '-';
        else if (k === '*' || k === 'x' || k === 'X') a = 'X';
        else if (k === '/' || k === ':') a = ':';
        else if (k === '=') a = '=';
        else if (k === 'Enter') a = (calcRaw === '0') ? 'GOCASH' : '='; // kalkulator kosong + Enter = lanjut ke uang pembeli
        else if (k === 'Backspace') a = 'DEL';
        else if (k === 'Delete') a = 'C';
        if (!a) return;
        e.preventDefault();
        if (a === 'GOCASH') { focusEl($('cashInput')); return; }
        calcAction(a);
    }

    // ---------- 6. KOTAK UANG PEMBELI ----------
    function cashKeys(e) {
        const k = e.key;
        const bills = { Digit1: '+2000', Digit2: '+5000', Digit3: '+10000', Digit4: '+20000', Digit5: '+50000', Digit6: '+100000' };
        if (e.shiftKey && bills[e.code]) { e.preventDefault(); cashAction(bills[e.code]); return; }
        if (k === 'Enter') { if (!kbOn) return; e.preventDefault(); finish(); }
        else if (k === 'p' || k === 'P') { e.preventDefault(); cashAction('PAS'); }
        else if (k === 'Delete') { e.preventDefault(); cashAction('C'); }
    }

    // ---------- 7. KOTAK PENCARIAN ----------
    function searchKeys(e) {
        const k = e.key;
        if (k === 'ArrowDown' || k === 'ArrowUp') {
            const items = searchItems();
            if (!resultsOpen()) { e.preventDefault(); moveZone(k === 'ArrowDown' ? 1 : -1); return; }
            e.preventDefault();
            kbIdx = k === 'ArrowDown' ? (kbIdx + 1) % items.length : (kbIdx <= 0 ? items.length - 1 : kbIdx - 1);
            paint(items);
        } else if (k === 'Enter') {
            if (!kbOn) return;
            e.preventDefault();
            if (resultsOpen()) { const items = searchItems(); items[kbIdx >= 0 ? kbIdx : 0].click(); }
            else if ($('selectedItemName').value) { goAfterSelect(); }
            else if ($('searchInput').value.trim() === '') { focusEl($('calcDisplay')); }
            else { showToast('Barang tidak ditemukan', 'error'); }
        }
    }

    // ---------- 8. POP-UP (Enter = simpan, Esc = tutup) ----------
    function modalKeys(e, modal) {
        const k = e.key;
        if (modal.id === 'updateOverlay') return;
        if (k === 'Escape') { e.preventDefault(); window.closeModal(modal.id); return; }
        if (modal.id === 'customConfirm') {
            if (k === 'y' || k === 'Y') { e.preventDefault(); $('confirmBtnYes').click(); }
            else if (k === 'n' || k === 'N') { e.preventDefault(); window.closeModal('customConfirm'); }
            return;
        }
        if (k !== 'Enter') return;
        if (modal.id === 'customPrompt') { e.preventDefault(); $('promptBtnSave').click(); }
        else if (modal.id === 'cartQtyModal') { e.preventDefault(); saveCartQty(); }
        else if (modal.id === 'debtPaymentModal') { e.preventDefault(); processDebtPayment(); }
        else if (modal.id === 'customAlert') { e.preventDefault(); window.closeModal('customAlert'); }
    }

    // ---------- 9. PENGENDALI KEYBOARD UTAMA ----------
    const isPhysical = (e) =>
        ['Tab', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].indexOf(e.key) > -1 ||
        /^F\d+$/.test(e.key) || /^Key[A-Z]$/.test(e.code || '') || e.code === 'NumpadEnter';

    window.addEventListener('keydown', function (e) {
        if (!kbOn && isPhysical(e)) setKb();
        const k = e.key;
        const id = e.target && e.target.id;

        const modal = document.querySelector('.modal-overlay.active');
        if (modal) { modalKeys(e, modal); return; }

        if (k === 'PageDown' || k === 'PageUp') { e.preventDefault(); moveZone(k === 'PageDown' ? 1 : -1); return; }
        if (e.ctrlKey && k === 'Enter') { e.preventDefault(); finish(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;

        if (k === 'F2') { e.preventDefault(); focusEl($('searchInput')); return; }
        if (k === 'F3') { e.preventDefault(); hideResults(); focusEl($('calcDisplay')); return; }
        if (k === 'F4') { e.preventDefault(); hideResults(); focusEl($('cashInput')); return; }
        if (k === 'F9') { e.preventDefault(); finish(); return; }
        if (k === 'F6' || k === 'F7') {
            e.preventDefault();
            const last = cart[cart.length - 1];
            if (!last) { showToast('Keranjang masih kosong', 'warning'); return; }
            if (k === 'F6') {
                if (last.isManual) editManualPrice(last.id, last.price);
                else openCartQtyModal(last.id, last.name, last.unit, last.qty);
            } else {
                customConfirm('Batal Beli?', 'Hapus ' + last.name + '? (tekan Y untuk Ya)', () => removeFromCart(last.id));
            }
            return;
        }
        if ((k === 'ArrowDown' || k === 'ArrowUp') && id !== 'searchInput' && KASIR_IDS.concat(['itemName', 'searchInventoryInput', 'searchDebtInput']).indexOf(id) > -1) {
            e.preventDefault(); moveZone(k === 'ArrowDown' ? 1 : -1); return;
        }

        if (k === 'Escape') {
            const a = document.activeElement;
            if (!a || a === document.body || KASIR_IDS.indexOf(a.id) > -1) {
                e.preventDefault();
                resetSelection(); hideResults(); kbIdx = -1;
                focusEl($('searchInput'));
            }
            return;
        }

        if (id === 'searchInput') { searchKeys(e); return; }
        if (id === 'itemQty' || id === 'nominalInput') {
            if (k === 'Enter' && kbOn) { e.preventDefault(); window.addToCart(); }
            return;
        }
        if (id === 'calcDisplay') { calcKeys(e); return; }
        if (id === 'cashInput') { cashKeys(e); return; }
        if (id === 'debtorName') {
            if (k === 'Enter' && kbOn) { e.preventDefault(); finish(); }
            return;
        }

        // Ketik langsung dari mana saja -> otomatis masuk kotak cari barang
        if (kbOn && k.length === 1 && /[\p{L}\p{N}]/u.test(k)) {
            const a = document.activeElement;
            const tag = a ? a.tagName : '';
            const typing = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].indexOf(tag) > -1 || (a && a.isContentEditable);
            if (!typing) { const s = $('searchInput'); if (usable(s)) s.focus(); }
        }
    }, true);

    // ---------- 10. LAIN-LAIN ----------
    // HP kecil tetap dikunci tegak (seperti sebelumnya); tablet/laptop bebas.
    try {
        if (screen.orientation && screen.orientation.lock && Math.min(screen.width, screen.height) < 600) {
            screen.orientation.lock('portrait').catch(function () {});
        }
    } catch (e) {}

    window.addEventListener('load', function () {
        setTimeout(function () {
            const v = $('appVersionLabel');
            if (v) v.textContent = 'Versi ' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') + ' • Layar Besar & Keyboard 4.23';
            // Laptop/PC: kursor langsung di kotak cari barang
            if (finePointer && !document.querySelector('.modal-overlay.active')) { const s = $('searchInput'); if (usable(s)) s.focus(); }
        }, 500);
    });
})();
