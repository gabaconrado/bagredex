"""Django admin registration for Bagredex accounts."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User

admin.site.site_header = "Bagredex administration"
admin.site.site_title = "Bagredex administration"
admin.site.index_title = "Administration"
admin.site.register(User, UserAdmin)
