const express = require('express'), { Pool } = require('pg'), bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }), SECRET = process.env.JWT_SECRET;
if (!SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }
const app = express();
app.use(express.json({ limit: '1mb' }));

const STATUSES = ['wishlist', 'applied', 'interview', 'offered', 'rejected', 'ghosted', 'archived'];
const FIELDS = ['company', 'role', 'location', 'status', 'salary', 'rating', 'note', 'dream', 'why', 'skills', 'ghost_days', 'job_url', 'contact', 'deadline'];
// company, role, location, status, salary, rating, note, dream, why, skills, ghost_days, days ago
const SAMPLE = [
  ['Arbor Cloud', 'Cloud Engineer', 'Remote', 'wishlist', 'PKR 220k to 280k', 5, 'Apply by Fri', true, 'they run the infrastructure I want to learn from.', 78, null, 11],
  ['Kite Labs', 'Platform Engineer', 'Karachi', 'wishlist', null, 5, 'Needs K8s cert', true, 'Kubernetes at real scale, and a great team.', 64, null, 11],
  ['Nimbus Systems', 'DevOps Intern', 'Remote', 'applied', 'PKR 100k to 140k', 4, 'Follow up in 2 days', false, null, null, null, 1],
  ['Delta Works', 'SRE Trainee', 'Lahore', 'applied', null, 4, null, false, null, null, null, 2],
  ['Hollow Point', 'Linux Sysadmin', 'Remote', 'applied', 'USD 900 to 1.2k', 3, null, false, null, null, null, 3],
  ['Brightwave', 'Cloud Support Associate', 'Remote', 'interview', 'USD 700 to 950', 5, 'Call Tue 3 PM', false, null, null, null, 4],
  ['Orbit Soft', 'Junior DevOps', 'Islamabad', 'interview', 'PKR 150k to 190k', 4, null, false, null, null, null, 5],
  ['Tidal IO', 'DevOps Engineer', 'Remote', 'offered', 'USD 1.4k', 5, 'Reply by Mon', false, null, null, null, 6],
  ['Quill Tech', 'Backend Intern', 'Remote', 'rejected', 'PKR 70k', 3, null, false, null, null, null, 8],
  ['Mosaic Data', 'SRE Intern', 'Remote', 'ghosted', null, 3, null, false, null, null, 24, 10],
  ['Pixel Forge', 'DevOps Trainee', 'Lahore', 'ghosted', null, 3, null, false, null, null, 31, 11],
];

const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const sign = uid => jwt.sign({ uid }, SECRET, { expiresIn: '7d' });
const auth = (req, res, next) => {
  try { req.uid = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), SECRET).uid; next(); }
  catch { res.status(401).json({ error: 'Please log in' }); }
};

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.post('/api/auth/register', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!/^\S+@\S+\.\S+$/.test(email || '') || (password || '').length < 6)
    return res.status(400).json({ error: 'Enter a valid email and a password of 6+ characters' });
  let u;
  try {
    u = (await pool.query('INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id',
      [email.toLowerCase(), await bcrypt.hash(password, 10)])).rows[0];
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'That email is already registered' });
    throw e;
  }
  if (req.body.seed_samples === true) for (const s of SAMPLE) await pool.query(
    `INSERT INTO jobs(user_id,company,role,location,status,salary,rating,note,dream,why,skills,ghost_days,created_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()-$13*interval '1 day')`, [u.id, ...s]);
  res.status(201).json({ token: sign(u.id) });
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [(email || '').toLowerCase()]);
  if (!rows[0] || !(await bcrypt.compare(password || '', rows[0].password_hash)))
    return res.status(401).json({ error: 'Wrong email or password' });
  res.json({ token: sign(rows[0].id) });
}));

app.get('/api/jobs', auth, wrap(async (req, res) => {
  const { rows } = await pool.query(`SELECT * FROM jobs WHERE user_id=$1${req.query.all ? '' : " AND status<>'archived'"} ORDER BY created_at DESC`, [req.uid]);
  res.json(rows);
}));

app.post('/api/jobs', auth, wrap(async (req, res) => {
  const b = req.body;
  if (!b.company || !b.role) return res.status(400).json({ error: 'Company and role are required' });
  if (b.status && !STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
  const cols = FIELDS.filter(f => b[f] !== undefined && b[f] !== '');
  const { rows } = await pool.query(
    `INSERT INTO jobs (user_id,${cols.join(',')}) VALUES ($1,${cols.map((_, i) => '$' + (i + 2)).join(',')}) RETURNING *`,
    [req.uid, ...cols.map(c => b[c])]);
  res.status(201).json(rows[0]);
}));

app.patch('/api/jobs/:id', auth, wrap(async (req, res) => {
  const b = req.body;
  if (b.status && !STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });
  if (b.company === '' || b.role === '') return res.status(400).json({ error: 'Company and role are required' });
  const cols = FIELDS.filter(f => b[f] !== undefined);
  if (!cols.length) return res.status(400).json({ error: 'Nothing to update' });
  const n = cols.length;
  const { rows } = await pool.query(
    `UPDATE jobs SET ${cols.map((c, i) => `${c}=$${i + 1}`).join(',')} WHERE id=$${n + 1} AND user_id=$${n + 2} RETURNING *`,
    [...cols.map(c => b[c]), req.params.id, req.uid]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
}));

app.delete('/api/jobs/:id', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM jobs WHERE id=$1 AND user_id=$2', [req.params.id, req.uid]);
  res.status(204).end();
}));

app.get('/api/me', auth, wrap(async (req, res) => {
  const { rows } = await pool.query('SELECT email, name, hunt_started_at FROM users WHERE id=$1', [req.uid]);
  rows[0] ? res.json(rows[0]) : res.status(404).json({ error: 'Not found' });
}));
app.patch('/api/me', auth, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim().slice(0, 60) || null;
  // Keep older clients compatible if they submit only the name.
  if (req.body.hunt_started_at === undefined) {
    const { rows } = await pool.query(
      'UPDATE users SET name=$1 WHERE id=$2 RETURNING email, name, hunt_started_at', [name, req.uid]);
    return res.json(rows[0]);
  }
  const date = req.body.hunt_started_at;
  const parsed = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(date + 'T00:00:00Z') : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date)
    return res.status(400).json({ error: 'Enter a valid hunt start date' });
  const { rows } = await pool.query(
    'UPDATE users SET name=$1, hunt_started_at=$2::date WHERE id=$3 RETURNING email, name, hunt_started_at',
    [name, date, req.uid]);
  res.json(rows[0]);
}));
app.post('/api/auth/password', auth, wrap(async (req, res) => {
  const { current, password } = req.body;
  if ((password || '').length < 6) return res.status(400).json({ error: 'New password must be 6+ characters' });
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.uid]);
  if (!rows[0] || !(await bcrypt.compare(current || '', rows[0].password_hash))) return res.status(400).json({ error: 'Current password is wrong' });
  await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [await bcrypt.hash(password, 10), req.uid]);
  res.json({ ok: true });
}));
app.post('/api/jobs/import', auth, wrap(async (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows.slice(0, 500) : [];
  let imported = 0;
  for (const b of rows) {
    b.status = (b.status || 'applied').toLowerCase();
    if (!b.company || !b.role || !STATUSES.includes(b.status)) continue;
    b.dream = b.status === 'wishlist';
    const cols = FIELDS.filter(f => b[f] !== undefined && b[f] !== '');
    try {
      await pool.query(`INSERT INTO jobs (user_id,${cols.join(',')}) VALUES ($1,${cols.map((_, i) => '$' + (i + 2)).join(',')})`, [req.uid, ...cols.map(c => b[c])]);
      imported++;
    } catch (e) { /* skip bad row */ }
  }
  res.json({ imported, skipped: rows.length - imported });
}));

const fs = require('fs');
(async () => {
  for (let i = 1; i <= 15; i++) {
    try {
      await pool.query(fs.readFileSync(__dirname + '/schema.sql', 'utf8'));
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT');
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS hunt_started_at DATE');
      await pool.query('UPDATE users SET hunt_started_at=created_at::date WHERE hunt_started_at IS NULL');
      await pool.query('ALTER TABLE users ALTER COLUMN hunt_started_at SET DEFAULT CURRENT_DATE');
      await pool.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_url TEXT, ADD COLUMN IF NOT EXISTS contact TEXT, ADD COLUMN IF NOT EXISTS deadline DATE');
      console.log('Database ready');
      break;
    } catch (e) {
      console.error(`DB not ready (attempt ${i}/15):`, e.message);
      if (i === 15) process.exit(1);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  app.listen(3000, () => console.log('API on :3000'));
})();