"""Authentication models owned by Bagredex."""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """Bagredex user, retaining Django's standard username-based fields."""

    pass
