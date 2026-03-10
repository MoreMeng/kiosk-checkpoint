const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 6601;

// Allow CORS for testing (production should configure CORS on backend)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Simple mock endpoint for /rxqueue/:id
app.get('/rxqueue/:id', (req, res) => {
  const id = req.params.id || 'unknown';
  // Return a deterministic but clear mock response
  const qno = (parseInt(id.replace(/\D/g, '') || '0') % 100) || 50;
  const resp = [
    {
      source: 'คิวห้องตรวจ',
      ref_id: 3812185,
      qid: `AS${String(qno).padStart(3,'0')}`,
      qno: String(qno),
      qstn: 'รอเรียกซักประวัติ',
      queue_priority: 1,
      qdate: new Date().toISOString().slice(0,10),
      cdate: null,
      location: '172 จุดซักประวัติศัลยกรรม (ชั้น 3)',
      department_code: '330',
      ost_name: 'ตรวจแล้ว'
    }
  ];
  res.json(resp);
});

// Serve the public folder optionally (useful for quick local hosting)
app.use('/', express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => console.log(`mock server listening on http://localhost:${PORT}`));
