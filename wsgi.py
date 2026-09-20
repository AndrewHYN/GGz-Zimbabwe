"""
Vercel Django entrypoint.

The Vercel Django framework preset locates a WSGI callable from a file named
``wsgi.py`` in the deployment root directory. This thin wrapper exposes the
same ``application`` as the project's own ``hello_world.wsgi`` module so the
serverless runtime serves GGz without extra configuration.
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "hello_world.settings")

application = get_wsgi_application()