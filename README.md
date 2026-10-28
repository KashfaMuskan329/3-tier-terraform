# Job Tracker (3-tier)
Presentation: nginx + vanilla JS (frontend/) -> Logic: Node/Express (backend/) -> Data: PostgreSQL (db/)

    docker compose up --build
    open http://localhost:8080

Reset data: docker compose down -v

Features: register/login (JWT + bcrypt), board view, table view (click headers to sort), edit/delete cards, archive + restore, status filter, job link / contact / follow-up date (overdue highlight), CSV export + import, stats dashboard, account page (name, change password).
Each new account starts with sample cards. Change JWT_SECRET in docker-compose.yml before deploying.
Upgrading from v1? Run `docker compose down -v` first so the new tables are created.
