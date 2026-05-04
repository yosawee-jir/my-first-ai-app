const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = 3001;

app.use(cors({ exposedHeaders: ['Content-Disposition'] }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/equipment',   require('./routes/equipment'));
app.use('/api/checkouts',   require('./routes/checkouts'));
app.use('/api/history',     require('./routes/history'));
app.use('/api/master-data', require('./routes/masterData'));
app.use('/api/users',       require('./routes/users'));

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Backend → http://localhost:${PORT}`));
