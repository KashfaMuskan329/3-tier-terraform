CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  hunt_started_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  location TEXT DEFAULT 'Remote',
  status TEXT NOT NULL DEFAULT 'applied', -- wishlist|applied|interview|offered|rejected|ghosted|archived
  salary TEXT,
  rating INT DEFAULT 3,
  note TEXT,
  dream BOOLEAN DEFAULT FALSE,
  why TEXT,
  skills INT,
  ghost_days INT,
  job_url TEXT,
  contact TEXT,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS jobs_user_idx ON jobs(user_id);
