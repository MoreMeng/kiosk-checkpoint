(() => {
  const idleEl = document.getElementById('idle');
  const loadingEl = document.getElementById('loading');
  const resultEl = document.getElementById('result');
  const errorEl = document.getElementById('error');
  const scanInput = document.getElementById('scanInput');

  const qnoEl = document.getElementById('qno');
  const qstnEl = document.getElementById('qstn');
  const locationEl = document.getElementById('location');
  const qdateEl = document.getElementById('qdate');
  const ostEl = document.getElementById('ost_name');
  const errMsgEl = document.getElementById('errMsg');

  let scanBuffer = '';
  let idleTimer = null;
  const AUTO_RETURN_MS = 15000;

  function show(el){
    [idleEl,loadingEl,resultEl,errorEl].forEach(e=>e.classList.add('hidden'));
    el.classList.remove('hidden');
    if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    if (el !== idleEl) idleTimer = setTimeout(()=>show(idleEl), AUTO_RETURN_MS);
    if (el === idleEl) { focusHiddenInput(); }
  }

  function focusHiddenInput(){
    try { scanInput.focus(); } catch(e){}
  }

  function showResult(item){
    qnoEl.textContent = item.qno || item.qid || '--';
    qstnEl.textContent = 'สถานะ: ' + (item.qstn || '-');
    locationEl.textContent = 'สถานที่: ' + (item.location || '-');
    qdateEl.textContent = 'วันที่: ' + (item.qdate || '-');
    ostEl.textContent = 'ผล: ' + (item.ost_name || '-');
    show(resultEl);
  }

  function showError(msg){
    errMsgEl.textContent = msg || 'เกิดข้อผิดพลาด';
    show(errorEl);
  }

  // Determine backend base for production vs local testing.
  // Production: http://192.168.88.8:6601
  // Local test: if running on localhost use http://localhost:6601 (mock server)
  const PROD_BACKEND = 'http://192.168.88.8:6601';
  const LOCAL_MOCK = 'http://localhost:6601';
  function getBackendBase(){
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return LOCAL_MOCK;
    // allow explicit override via query param ?mock=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === '1') return LOCAL_MOCK;
    return PROD_BACKEND;
  }

  async function fetchById(id){
    show(loadingEl);
    try {
      const base = getBackendBase();
      const url = `${base.replace(/\/$/, '')}/rxqueue/${encodeURIComponent(id)}`;
      const r = await fetch(url);
      if (!r.ok) throw new Error('Network response not ok: ' + r.status);
      const data = await r.json();
      if (!Array.isArray(data) || data.length === 0) {
        showError('ไม่พบข้อมูลคิวของ HN นี้');
        return;
      }
      showResult(data[0]);
    } catch (err) {
      console.error('fetch error', err);
      showError('ไม่สามารถติดต่อเซิร์ฟเวอร์ได้');
    }
  }

  // Handle HID scanner: scanners usually send characters then Enter
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      const scanned = scanBuffer.trim();
      scanBuffer = '';
      if (scanned) fetchById(scanned);
      ev.preventDefault();
      return;
    }
    // ignore control keys
    if (ev.key.length === 1) {
      scanBuffer += ev.key;
    }
  });

  // Also support hidden input (for some scanners)
  scanInput.addEventListener('change', (e) => {
    const v = scanInput.value.trim();
    scanInput.value = '';
    if (v) fetchById(v);
  });

  // On load, show idle and focus input
  window.addEventListener('load', () => {
    show(idleEl);
    // Try to focus periodically for touchscreens
    setInterval(focusHiddenInput, 2000);
    // Try to connect to serial WebSocket bridge when available (localhost)
    try {
      const wsHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'ws://localhost:8765' : null;
      if (wsHost) {
        const ws = new WebSocket(wsHost);
        ws.addEventListener('open', () => console.info('WS connected to serial bridge'));
        ws.addEventListener('message', (ev) => {
          const scanned = ev.data && ev.data.toString().trim();
          if (scanned) fetchById(scanned);
        });
        ws.addEventListener('close', () => console.info('WS closed'));
        ws.addEventListener('error', (e) => console.warn('WS error', e));
      }
    } catch (e) { console.warn('WS init failed', e); }
  });

})();
