const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'photo2024';

// In-memory session store (cleared on server restart)
const sessions = new Map();

// ── Database setup ──────────────────────────────────────────────────────────

const db = new Database(path.join(__dirname, 'gallery.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS galleries (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    subtitle    TEXT NOT NULL DEFAULT '',
    cover       TEXT NOT NULL DEFAULT '',
    cover_thumb TEXT NOT NULL DEFAULT '',
    date_text   TEXT NOT NULL DEFAULT '',
    location    TEXT NOT NULL DEFAULT '',
    sort_order  INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sets (
    id          TEXT NOT NULL,
    gallery_id  TEXT NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
    label       TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id, gallery_id)
  );

  CREATE TABLE IF NOT EXISTS photos (
    id               TEXT PRIMARY KEY,
    gallery_id       TEXT NOT NULL,
    set_id           TEXT NOT NULL,
    src              TEXT NOT NULL,
    thumb            TEXT NOT NULL DEFAULT '',
    width            INTEGER NOT NULL DEFAULT 1200,
    height           INTEGER NOT NULL DEFAULT 900,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    exif_camera      TEXT NOT NULL DEFAULT '',
    exif_lens        TEXT NOT NULL DEFAULT '',
    exif_aperture    TEXT NOT NULL DEFAULT '',
    exif_shutter     TEXT NOT NULL DEFAULT '',
    exif_iso         TEXT NOT NULL DEFAULT '',
    exif_focal_length TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (gallery_id, set_id) REFERENCES sets(gallery_id, id) ON DELETE CASCADE
  );
`);

// ── Seed data ───────────────────────────────────────────────────────────────

function makePhotos(seeds, setLabel) {
  return seeds.map((seed, i) => ({
    id: `${setLabel}-${i}`,
    src: `https://picsum.photos/seed/${seed}/1200/900`,
    thumb: `https://picsum.photos/seed/${seed}/600/450`,
    w: seed % 3 === 0 ? 900 : 1200,
    h: seed % 3 === 0 ? 1200 : (seed % 2 === 0 ? 800 : 900),
  }));
}

const SEED_GALLERIES = [
  {
    id: 'meghan-desmond', title: 'Meghan & Desmond',
    subtitle: 'Wedding · September 2024 · Napa Valley, CA',
    cover: 'https://picsum.photos/seed/wed01/1600/900',
    coverThumb: 'https://picsum.photos/seed/wed01/800/600',
    date: 'September 14, 2024', location: 'Napa Valley, CA',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124], 'md') },
      { id: 'ceremony', label: 'Ceremony', photos: makePhotos([101,103,105,107,109,111,113,115], 'mdc') },
      { id: 'reception', label: 'Reception', photos: makePhotos([102,104,106,108,110,112,114,116,118,120], 'mdr') },
      { id: 'portraits', label: 'Portraits', photos: makePhotos([117,119,121,122,123,124], 'mdp') },
    ],
  },
  {
    id: 'sarah-james', title: 'Sarah & James',
    subtitle: 'Engagement · July 2024 · Marin Headlands, CA',
    cover: 'https://picsum.photos/seed/eng02/1600/900',
    coverThumb: 'https://picsum.photos/seed/eng02/800/600',
    date: 'July 6, 2024', location: 'Marin Headlands, CA',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([201,202,203,204,205,206,207,208,209,210,211,212,213,214,215,216], 'sj') },
      { id: 'golden-hour', label: 'Golden Hour', photos: makePhotos([201,203,205,207,209,211], 'sjg') },
      { id: 'beach', label: 'Beach', photos: makePhotos([202,204,206,208,210,212,214,216], 'sjb') },
    ],
  },
  {
    id: 'rodriguez-family', title: 'Rodriguez Family',
    subtitle: 'Family · October 2024 · Muir Woods, CA',
    cover: 'https://picsum.photos/seed/fam03/1600/900',
    coverThumb: 'https://picsum.photos/seed/fam03/800/600',
    date: 'October 12, 2024', location: 'Muir Woods, CA',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([301,302,303,304,305,306,307,308,309,310,311,312,313,314], 'rf') },
      { id: 'kids', label: 'Kids', photos: makePhotos([301,303,305,307,309,311], 'rfk') },
      { id: 'full-family', label: 'Full Family', photos: makePhotos([302,304,306,308,310,312,314], 'rff') },
    ],
  },
  {
    id: 'ava-portraits', title: 'Ava — Senior Portraits',
    subtitle: 'Portrait · August 2024 · San Francisco, CA',
    cover: 'https://picsum.photos/seed/por04/1600/900',
    coverThumb: 'https://picsum.photos/seed/por04/800/600',
    date: 'August 20, 2024', location: 'San Francisco, CA',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([401,402,403,404,405,406,407,408,409,410,411,412], 'av') },
      { id: 'urban', label: 'Urban', photos: makePhotos([401,403,405,407,409,411], 'avu') },
      { id: 'golden-gate', label: 'Golden Gate', photos: makePhotos([402,404,406,408,410,412], 'avg') },
    ],
  },
  {
    id: 'chen-wedding', title: 'Lily & Marcus',
    subtitle: 'Wedding · May 2024 · Carmel-by-the-Sea, CA',
    cover: 'https://picsum.photos/seed/wed05/1600/900',
    coverThumb: 'https://picsum.photos/seed/wed05/800/600',
    date: 'May 25, 2024', location: 'Carmel-by-the-Sea, CA',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([501,502,503,504,505,506,507,508,509,510,511,512,513,514,515,516,517,518,519,520], 'lm') },
      { id: 'ceremony', label: 'Ceremony', photos: makePhotos([501,503,505,507,509,511,513,515], 'lmc') },
      { id: 'reception', label: 'Reception', photos: makePhotos([502,504,506,508,510,512,514,516,518,520], 'lmr') },
      { id: 'portraits', label: 'Portraits', photos: makePhotos([517,519], 'lmp') },
    ],
  },
  {
    id: 'newborn-patel', title: 'Baby Patel',
    subtitle: 'Newborn · November 2024 · Studio, San Francisco',
    cover: 'https://picsum.photos/seed/new06/1600/900',
    coverThumb: 'https://picsum.photos/seed/new06/800/600',
    date: 'November 3, 2024', location: 'San Francisco Studio',
    sets: [
      { id: 'all', label: 'All Photos', photos: makePhotos([601,602,603,604,605,606,607,608,609,610], 'bp') },
      { id: 'baby', label: 'Baby', photos: makePhotos([601,603,605,607,609], 'bpb') },
      { id: 'family', label: 'With Family', photos: makePhotos([602,604,606,608,610], 'bpf') },
    ],
  },
];

function seedDatabase() {
  const count = db.prepare('SELECT COUNT(*) as c FROM galleries').get().c;
  if (count > 0) return;

  const insertGallery = db.prepare(
    'INSERT INTO galleries (id, title, subtitle, cover, cover_thumb, date_text, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  const insertSet = db.prepare(
    'INSERT INTO sets (id, gallery_id, label, sort_order) VALUES (?, ?, ?, ?)'
  );
  const insertPhoto = db.prepare(
    'INSERT INTO photos (id, gallery_id, set_id, src, thumb, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );

  db.transaction(() => {
    SEED_GALLERIES.forEach((g, gi) => {
      insertGallery.run(g.id, g.title, g.subtitle, g.cover, g.coverThumb, g.date, g.location, gi);
      g.sets.forEach((s, si) => {
        insertSet.run(s.id, g.id, s.label, si);
        s.photos.forEach((p, pi) => {
          insertPhoto.run(p.id, g.id, s.id, p.src, p.thumb, p.w, p.h, pi);
        });
      });
    });
  })();

  console.log('Database seeded with default galleries.');
}

seedDatabase();

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname)));

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { username, createdAt: Date.now() });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  sessions.delete(token);
  res.json({ success: true });
});

// ── Gallery helpers ─────────────────────────────────────────────────────────

function buildGallery(row) {
  const sets = db.prepare('SELECT * FROM sets WHERE gallery_id = ? ORDER BY sort_order').all(row.id);
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    cover: row.cover,
    coverThumb: row.cover_thumb,
    date: row.date_text,
    location: row.location,
    sets: sets.map(s => {
      const photos = db
        .prepare('SELECT * FROM photos WHERE gallery_id = ? AND set_id = ? ORDER BY sort_order')
        .all(row.id, s.id);
      return {
        id: s.id,
        label: s.label,
        photos: photos.map(p => ({
          id: p.id,
          src: p.src,
          thumb: p.thumb || p.src,
          w: p.width,
          h: p.height,
          exif: (p.exif_camera || p.exif_lens || p.exif_aperture || p.exif_shutter || p.exif_iso || p.exif_focal_length)
            ? { camera: p.exif_camera, lens: p.exif_lens, aperture: p.exif_aperture, shutter: p.exif_shutter, iso: p.exif_iso, focalLength: p.exif_focal_length }
            : null,
        })),
      };
    }),
  };
}

// ── Gallery CRUD ────────────────────────────────────────────────────────────

app.get('/api/galleries', (req, res) => {
  const rows = db.prepare('SELECT * FROM galleries ORDER BY sort_order').all();
  res.json(rows.map(buildGallery));
});

app.post('/api/galleries', requireAuth, (req, res) => {
  const { id, title, subtitle, cover, coverThumb, date, location } = req.body;
  if (!id || !title) return res.status(400).json({ error: 'id and title are required' });
  const exists = db.prepare('SELECT id FROM galleries WHERE id = ?').get(id);
  if (exists) return res.status(409).json({ error: 'Gallery id already exists' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM galleries').get().m;
  db.transaction(() => {
    db.prepare(
      'INSERT INTO galleries (id, title, subtitle, cover, cover_thumb, date_text, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title, subtitle || '', cover || '', coverThumb || cover || '', date || '', location || '', maxOrder + 1);
    // Default "All Photos" set
    db.prepare('INSERT INTO sets (id, gallery_id, label, sort_order) VALUES (?, ?, ?, ?)').run('all', id, 'All Photos', 0);
  })();
  const row = db.prepare('SELECT * FROM galleries WHERE id = ?').get(id);
  res.status(201).json(buildGallery(row));
});

app.put('/api/galleries/:gid', requireAuth, (req, res) => {
  const { title, subtitle, cover, coverThumb, date, location } = req.body;
  const info = db.prepare(
    'UPDATE galleries SET title=?, subtitle=?, cover=?, cover_thumb=?, date_text=?, location=? WHERE id=?'
  ).run(title, subtitle || '', cover || '', coverThumb || cover || '', date || '', location || '', req.params.gid);
  if (info.changes === 0) return res.status(404).json({ error: 'Gallery not found' });
  const row = db.prepare('SELECT * FROM galleries WHERE id = ?').get(req.params.gid);
  res.json(buildGallery(row));
});

app.delete('/api/galleries/:gid', requireAuth, (req, res) => {
  // Cascading deletes handle sets and photos via FK constraints
  const info = db.prepare('DELETE FROM galleries WHERE id = ?').run(req.params.gid);
  if (info.changes === 0) return res.status(404).json({ error: 'Gallery not found' });
  res.json({ success: true });
});

// ── Set CRUD ────────────────────────────────────────────────────────────────

app.post('/api/galleries/:gid/sets', requireAuth, (req, res) => {
  const { id, label } = req.body;
  if (!id || !label) return res.status(400).json({ error: 'id and label are required' });
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM sets WHERE gallery_id = ?').get(req.params.gid).m;
  db.prepare('INSERT INTO sets (id, gallery_id, label, sort_order) VALUES (?, ?, ?, ?)').run(id, req.params.gid, label, maxOrder + 1);
  res.status(201).json({ success: true });
});

app.put('/api/galleries/:gid/sets/:sid', requireAuth, (req, res) => {
  const { label } = req.body;
  const info = db.prepare('UPDATE sets SET label=? WHERE id=? AND gallery_id=?').run(label, req.params.sid, req.params.gid);
  if (info.changes === 0) return res.status(404).json({ error: 'Set not found' });
  res.json({ success: true });
});

app.delete('/api/galleries/:gid/sets/:sid', requireAuth, (req, res) => {
  db.transaction(() => {
    db.prepare('DELETE FROM photos WHERE gallery_id=? AND set_id=?').run(req.params.gid, req.params.sid);
    db.prepare('DELETE FROM sets WHERE id=? AND gallery_id=?').run(req.params.sid, req.params.gid);
  })();
  res.json({ success: true });
});

// ── Photo CRUD ──────────────────────────────────────────────────────────────

app.post('/api/galleries/:gid/sets/:sid/photos', requireAuth, (req, res) => {
  const { src, thumb, width, height, exif } = req.body;
  if (!src) return res.status(400).json({ error: 'src is required' });
  const id = `${req.params.gid}-${req.params.sid}-${Date.now()}`;
  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as m FROM photos WHERE gallery_id=? AND set_id=?'
  ).get(req.params.gid, req.params.sid).m;
  db.prepare(
    `INSERT INTO photos (id, gallery_id, set_id, src, thumb, width, height, sort_order,
      exif_camera, exif_lens, exif_aperture, exif_shutter, exif_iso, exif_focal_length)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, req.params.gid, req.params.sid, src, thumb || src,
    width || 1200, height || 900, maxOrder + 1,
    exif?.camera || '', exif?.lens || '', exif?.aperture || '',
    exif?.shutter || '', exif?.iso || '', exif?.focalLength || ''
  );
  res.status(201).json({ success: true, id });
});

app.put('/api/galleries/:gid/sets/:sid/photos/:pid', requireAuth, (req, res) => {
  const { src, thumb, width, height, exif } = req.body;
  const info = db.prepare(
    `UPDATE photos SET src=?, thumb=?, width=?, height=?,
      exif_camera=?, exif_lens=?, exif_aperture=?, exif_shutter=?, exif_iso=?, exif_focal_length=?
     WHERE id=? AND gallery_id=? AND set_id=?`
  ).run(
    src, thumb || src, width || 1200, height || 900,
    exif?.camera || '', exif?.lens || '', exif?.aperture || '',
    exif?.shutter || '', exif?.iso || '', exif?.focalLength || '',
    req.params.pid, req.params.gid, req.params.sid
  );
  if (info.changes === 0) return res.status(404).json({ error: 'Photo not found' });
  res.json({ success: true });
});

app.delete('/api/galleries/:gid/sets/:sid/photos/:pid', requireAuth, (req, res) => {
  db.prepare('DELETE FROM photos WHERE id=? AND gallery_id=? AND set_id=?')
    .run(req.params.pid, req.params.gid, req.params.sid);
  res.json({ success: true });
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Gallery server running at http://localhost:${PORT}`);
  console.log(`Admin login: ${ADMIN_USER} / ${ADMIN_PASS}`);
});
