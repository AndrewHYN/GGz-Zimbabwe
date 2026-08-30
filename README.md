# GitHub Codespaces ♥️ Django

Welcome to your shiny new Codespace running Django! We've got everything fired up and running for you to explore Django.

You've got a blank canvas to work on from a git perspective as well. There's a single initial commit with what you're seeing right now - where you go from here is up to you!

Everything you do here is contained within this one codespace. There is no repository on GitHub yet. If and when you’re ready you can click "Publish Branch" and we’ll create your repository and push up your project. If you were just exploring then and have no further need for this code then you can simply delete your codespace and it's gone forever.

## installing dependancies

```python
pip install -r requirements.txt
```

## Production configuration

GGz is configured to run well with a local SQLite development database while allowing production settings to be supplied with environment variables.

Create a local .env file from .env.example before running the project in a non-default environment:

```bash
cp .env.example .env
```

Required environment variables:

- `SECRET_KEY`: a strong secret in production; local dev falls back to a safe placeholder when unset
- `DEBUG`: set to `True` for local development and `False` in production
- `ALLOWED_HOSTS`: comma-separated hostnames for the current environment
- `CSRF_TRUSTED_ORIGINS`: comma-separated origins for Django CSRF validation
- `DB_ENGINE`: defaults to SQLite for local development; set to `django.db.backends.postgresql` for production PostgreSQL
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: database settings for non-SQLite environments
- `STATIC_URL`, `STATIC_ROOT`, `MEDIA_URL`, `MEDIA_ROOT`: static/media configuration

Production-ready guidance:

- Keep `DEBUG=False` in deployed environments.
- Set `ALLOWED_HOSTS` to the real deployed hostnames instead of leaving it broad.
- Add the real HTTPS origin(s) to `CSRF_TRUSTED_ORIGINS`.
- Use PostgreSQL in production by setting `DB_ENGINE` and the PostgreSQL connection values.
- Run migrations before serving the app in a new environment.
- Run `python manage.py collectstatic` to generate static files for deployment.

## To run this application:

```bash
python manage.py runserver
```

For local Codespaces usage, this remains supported:

```bash
python manage.py runserver 0.0.0.0:8000
```

## To run migrations:

```bash
python manage.py migrate
```

## To generate static files:

```bash
python manage.py collectstatic
```

## To run the test suite:

```bash
python manage.py test
```

## Deployment smoke check

GGz exposes a lightweight health endpoint at `/health/` for deployment and infrastructure checks:

```bash
curl http://localhost:8000/health/
```

This endpoint returns a minimal JSON response and is intentionally public and non-sensitive.
