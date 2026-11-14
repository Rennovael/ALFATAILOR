/* ALFA TAILOR
   - Data layanan dan nomor WhatsApp ada di bagian KONFIGURASI (ubah sesuai usaha).
   - Alamat (provinsi, kabupaten, kecamatan) diambil dari API Wilayah Indonesia.
   - Buku pesanan disimpan di localStorage browser. */

/* ========== KONFIGURASI ========== */
const TOKO = { nama: 'ALFA TAILOR', wa: '6281234567890' }; // nomor WA format 62...
const LAYANAN = [
    { id: 'kebaya', nama: 'Kebaya', ikon: '👘', harga: 250000, desc: 'Kebaya modern dan tradisional, kutubaru, kartini, sampai brokat.' },
    { id: 'gamis', nama: 'Gamis & Dress', ikon: '👗', harga: 200000, desc: 'Gamis, dress, dan setelan wanita sesuai model pilihanmu.' },
    { id: 'kemeja', nama: 'Kemeja & Batik', ikon: '👔', harga: 150000, desc: 'Kemeja dan batik pria atau wanita dengan potongan pas.' },
    { id: 'bawahan', nama: 'Celana & Rok', ikon: '✂️', harga: 100000, desc: 'Celana kain, rok span, rok lilit, dan sejenisnya.' },
    { id: 'seragam', nama: 'Seragam', ikon: '🎓', harga: 120000, desc: 'Seragam sekolah, kantor, dan keluarga. Terima pesanan banyak.' },
    { id: 'permak', nama: 'Permak', ikon: '📏', harga: 30000, desc: 'Potong, kecilkan, ganti resleting, dan perbaikan lainnya.' }
];

const KEY = 'jahit:orders';
const STATUS = ['Baru', 'Dijahit', 'Selesai', 'Diambil'];

const $ = id => document.getElementById(id);
const state = { filter: 'Semua' };

/* ========== Helper ========== */
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}
const rupiah = n => 'Rp ' + Number(n).toLocaleString('id-ID');
const titleCase = s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
const todayISO = () => new Date().toLocaleDateString('en-CA');
const formatDate = iso => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

function daysLeft(iso) {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.round((new Date(iso + 'T00:00:00') - t) / 86400000);
}

function normalizeWA(num) {
    const d = num.replace(/\D/g, '');
    return d.startsWith('0') ? '62' + d.slice(1) : d;
}
const findLayanan = id => LAYANAN.find(l => l.id === id);

/* ========== Penyimpanan ========== */
function loadOrders() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

function saveOrders(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* abaikan */ }
}

/* ========== Layanan ========== */
function renderServices() {
    $('serviceGrid').replaceChildren(...LAYANAN.map(l => {
        const card = el('article', 'service');
        const price = el('p', 'price');
        price.append(document.createTextNode(rupiah(l.harga) + ' '), el('small', '', '/ potong, mulai dari'));
        card.append(el('div', 'icon', l.ikon), el('h3', '', l.nama), el('p', '', l.desc), price);
        return card;
    }));

    const select = $('layanan-select');
    LAYANAN.forEach(l => {
        const opt = el('option', '', `${l.nama} (mulai ${rupiah(l.harga)})`);
        opt.value = l.id;
        select.append(opt);
    });
}

function updateEstimate() {
    const l = findLayanan($('layanan-select').value);
    const qty = Math.max(1, parseInt($('jumlah').value, 10) || 1);
    $('estimate').textContent = rupiah(l ? l.harga * qty : 0);
}

/* ========== API Wilayah Indonesia ========== */
// Beberapa alamat sumber untuk data yang sama. Dicoba bersamaan, yang tercepat dipakai.
// Jika satu diblokir (misalnya oleh jaringan), yang lain masih bisa dipakai.
const SUMBER_API = [
    'https://emsifa.github.io/api-wilayah-indonesia/api',
    'https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/gh-pages/api',
    'https://cdn.jsdelivr.net/gh/emsifa/api-wilayah-indonesia@gh-pages/api'
];

function fetchJSON(url, ms = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { signal: controller.signal })
        .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
        .finally(() => clearTimeout(timer));
}

// Cadangan offline (js/wilayah-data.js) hanya untuk provinsi dan kabupaten/kota
function dariCadangan(path) {
    if (typeof WILAYAH_CADANGAN === 'undefined') return null;
    if (path === 'provinces') return WILAYAH_CADANGAN.provinces;
    if (path.startsWith('regencies/')) return WILAYAH_CADANGAN.regencies[path.split('/')[1]] || null;
    return null;
}

async function getList(path) {
    try {
        return await Promise.any(SUMBER_API.map(base => fetchJSON(`${base}/${path}.json`)));
    } catch (err) {
        const cadangan = dariCadangan(path);
        if (cadangan) return cadangan;
        throw err;
    }
}

function fillSelect(select, list, placeholder) {
    select.replaceChildren(new Option(placeholder, ''));
    list.forEach(item => select.append(new Option(titleCase(item.name), item.id)));
    select.disabled = false;
}

function resetSelect(select, text) {
    select.replaceChildren(new Option(text, ''));
    select.disabled = true;
}

async function initWilayah() {
    const prov = $('prov'),
        kab = $('kab'),
        kec = $('kec');
    const gagal = 'Gagal memuat (tulis di alamat lengkap)';

    prov.addEventListener('change', async() => {
        resetSelect(kec, 'Pilih kabupaten dulu');
        if (!prov.value) return resetSelect(kab, 'Pilih provinsi dulu');
        resetSelect(kab, 'Memuat...');
        try { fillSelect(kab, await getList(`regencies/${prov.value}`), 'Pilih kabupaten / kota'); } catch { resetSelect(kab, gagal); }
    });

    kab.addEventListener('change', async() => {
        if (!kab.value) return resetSelect(kec, 'Pilih kabupaten dulu');
        resetSelect(kec, 'Memuat...');
        try { fillSelect(kec, await getList(`districts/${kab.value}`), 'Pilih kecamatan'); } catch { resetSelect(kec, gagal); }
    });

    try {
        fillSelect(prov, await getList('provinces'), 'Pilih provinsi');
    } catch {
        prov.replaceChildren(new Option(gagal, ''));
    }
}

const selectedText = select => select.value ? select.options[select.selectedIndex].textContent : '';

/* ========== Form pesanan ========== */
function buildWAMessage(o) {
    const l = findLayanan(o.layanan);
    const ukuran = Object.entries(o.ukuran).filter(([, v]) => v).map(([k, v]) => `${k} ${v} cm`).join(', ');
    const alamat = [o.alamat, o.kecamatan, o.kabupaten, o.provinsi].filter(Boolean).join(', ');
    const detail = [
        `Nama: ${o.nama}`,
        `Jenis: ${l.nama} x ${o.jumlah}`,
        `Dibutuhkan: ${formatDate(o.tanggal)}`,
        ukuran && `Ukuran: ${ukuran}`,
        alamat && `Alamat: ${alamat}`,
        o.catatan && `Catatan: ${o.catatan}`,
        `Perkiraan biaya: mulai ${rupiah(o.total)}`
    ].filter(Boolean);
    return `Halo ${TOKO.nama}, saya ingin memesan jahitan.\n\n` + detail.join('\n');
}

function showResult(order) {
    const box = $('formResult');
    const link = el('a', 'btn btn-wa', 'Kirim ke WhatsApp');
    link.href = `https://wa.me/${TOKO.wa}?text=${encodeURIComponent(buildWAMessage(order))}`;
    link.target = '_blank';
    link.rel = 'noopener';
    box.replaceChildren(
        el('p', '', `Pesanan atas nama ${order.nama} sudah dicatat. Kirim detailnya lewat WhatsApp agar segera diproses.`),
        link
    );
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

$('orderForm').addEventListener('submit', e => {
    e.preventDefault();
    const err = $('formError');
    const nama = $('nama').value.trim();
    const wa = normalizeWA($('wa').value);
    const layanan = $('layanan-select').value;
    const tanggal = $('tanggal').value;
    const jumlah = Math.max(1, parseInt($('jumlah').value, 10) || 1);

    if (!nama) return (err.textContent = 'Nama wajib diisi.');
    if (wa.length < 10 || wa.length > 15) return (err.textContent = 'Nomor WhatsApp tidak valid.');
    if (!layanan) return (err.textContent = 'Pilih jenis jahitan dulu.');
    if (!tanggal) return (err.textContent = 'Isi tanggal kamu membutuhkan jahitan.');
    if (tanggal < todayISO()) return (err.textContent = 'Tanggal tidak boleh sebelum hari ini.');
    err.textContent = '';

    const order = {
        id: Date.now(),
        nama,
        wa,
        layanan,
        jumlah,
        tanggal,
        catatan: $('catatan').value.trim(),
        ukuran: { 'Dada': $('m-dada').value, 'Pinggang': $('m-pinggang').value, 'Pinggul': $('m-pinggul').value, 'Panjang': $('m-panjang').value },
        provinsi: selectedText($('prov')),
        kabupaten: selectedText($('kab')),
        kecamatan: selectedText($('kec')),
        alamat: $('alamat').value.trim(),
        total: findLayanan(layanan).harga * jumlah,
        status: 'Baru'
    };

    const list = loadOrders();
    list.push(order);
    saveOrders(list);
    renderOrders();
    showResult(order);

    e.target.reset();
    $('jumlah').value = 1;
    resetSelect($('kab'), 'Pilih provinsi dulu');
    resetSelect($('kec'), 'Pilih kabupaten dulu');
    updateEstimate();
});

['layanan-select', 'jumlah'].forEach(id => $(id).addEventListener('input', updateEstimate));

/* ========== Buku pesanan ========== */
const isActive = o => o.status === 'Baru' || o.status === 'Dijahit';

function renderStats(all) {
    const aktif = all.filter(isActive);
    const mepet = aktif.filter(o => daysLeft(o.tanggal) <= 3);
    const siap = all.filter(o => o.status === 'Selesai');
    const stats = [
        ['Pesanan aktif', aktif.length, ''],
        ['Deadline ≤ 3 hari', mepet.length, mepet.length ? 'warn' : ''],
        ['Siap diambil', siap.length, ''],
        ['Perkiraan pendapatan aktif', rupiah(aktif.reduce((s, o) => s + o.total, 0)), '']
    ];
    $('stats').replaceChildren(...stats.map(([label, value, cls]) => {
        const box = el('div', 'stat ' + cls);
        box.append(el('small', '', label), el('strong', '', String(value)));
        return box;
    }));
}

function renderFilters(all) {
    const names = ['Semua', ...STATUS];
    $('filters').replaceChildren(...names.map(name => {
        const count = name === 'Semua' ? all.length : all.filter(o => o.status === name).length;
        const li = el('li');
        const btn = el('button', 'filter' + (state.filter === name ? ' active' : ''), `${name} (${count})`);
        btn.type = 'button';
        btn.addEventListener('click', () => {
            state.filter = name;
            renderOrders();
        });
        li.append(btn);
        return li;
    }));
}

function deadlineBadge(o) {
    if (o.status === 'Selesai' || o.status === 'Diambil') return el('span', 'badge done', o.status);
    const d = daysLeft(o.tanggal);
    if (d < 0) return el('span', 'badge late', `Terlambat ${-d} hari`);
    if (d === 0) return el('span', 'badge late', 'Hari ini');
    if (d <= 3) return el('span', 'badge soon', `H-${d}`);
    return el('span', 'badge', `H-${d}`);
}

function orderCard(o) {
    const l = findLayanan(o.layanan);
    const card = el('article', 'order');

    const head = el('div', 'order-head');
    const title = el('div');
    title.append(el('h3', '', o.nama), el('p', 'sub', `${l ? l.nama : o.layanan} × ${o.jumlah}`));
    head.append(title, deadlineBadge(o));

    const dl = el('dl');
    const rows = [
        ['Butuh', formatDate(o.tanggal)],
        ['Total', 'mulai ' + rupiah(o.total)]
    ];
    const ukuran = Object.entries(o.ukuran).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(' · ');
    if (ukuran) rows.push(['Ukuran', ukuran + ' cm']);
    const alamat = [o.alamat, o.kecamatan, o.kabupaten, o.provinsi].filter(Boolean).join(', ');
    if (alamat) rows.push(['Alamat', alamat]);
    if (o.catatan) rows.push(['Catatan', o.catatan]);
    rows.forEach(([k, v]) => dl.append(el('dt', '', k), el('dd', '', v)));

    const actions = el('div', 'order-actions');
    const sel = el('select');
    sel.setAttribute('aria-label', 'Ubah status');
    STATUS.forEach(s => {
        const opt = new Option(s, s);
        opt.selected = s === o.status;
        sel.append(opt);
    });
    sel.addEventListener('change', () => {
        const list = loadOrders();
        const target = list.find(x => x.id === o.id);
        if (target) {
            target.status = sel.value;
            saveOrders(list);
            renderOrders();
        }
    });

    const wa = el('a', 'btn btn-sm btn-wa', 'WhatsApp');
    wa.href = `https://wa.me/${o.wa}`;
    wa.target = '_blank';
    wa.rel = 'noopener';

    const del = el('button', 'btn-del', 'Hapus');
    del.type = 'button';
    del.addEventListener('click', () => {
        if (!confirm(`Hapus pesanan ${o.nama}?`)) return;
        saveOrders(loadOrders().filter(x => x.id !== o.id));
        renderOrders();
    });

    actions.append(sel, wa, del);
    card.append(head, dl, actions);
    return card;
}

function renderOrders() {
    const all = loadOrders();
    renderStats(all);
    renderFilters(all);

    const shown = all
        .filter(o => state.filter === 'Semua' || o.status === state.filter)
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal));

    if (shown.length === 0) {
        $('orders').replaceChildren(el('p', 'empty',
            all.length === 0 ? 'Belum ada pesanan. Pesanan dari form di atas akan muncul di sini.' : `Tidak ada pesanan berstatus "${state.filter}".`));
        return;
    }
    $('orders').replaceChildren(...shown.map(orderCard));
}

/* ========== Mulai ========== */
$('tanggal').min = todayISO();
renderServices();
updateEstimate();
renderOrders();
initWilayah();