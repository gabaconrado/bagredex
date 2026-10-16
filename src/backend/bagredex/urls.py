"""Bagredex application and operational routes."""

from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path(
        "pokedex/data/<str:regulation>/index/",
        views.pokedex_index,
        name="pokedex-index",
    ),
    path(
        "pokedex/data/<str:regulation>/details/",
        views.pokedex_details,
        name="pokedex-details",
    ),
    path(
        "pokedex/data/<str:regulation>/pokemon/<str:form>/details/",
        views.pokedex_form_detail,
        name="pokedex-form-detail",
    ),
    path(
        "pokedex/sprites/<str:version>/<str:form>/<str:variant>.webp",
        views.pokedex_sprite,
        name="pokedex-sprite",
    ),
    path(
        "login/",
        auth_views.LoginView.as_view(
            template_name="registration/login.html",
            redirect_authenticated_user=True,
        ),
        name="login",
    ),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
    path("admin/", admin.site.urls),
    path("health/live", views.live, name="health-live"),
    path("health/ready", views.ready, name="health-ready"),
]
