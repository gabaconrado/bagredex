"""Bagredex application and operational routes."""

from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import path

from . import views
from .damage_calculator import views as damage_calculator_views
from .teams import views as team_views

urlpatterns = [
    path("", views.home, name="home"),
    path(
        "damage-calculator/",
        damage_calculator_views.damage_calculator_page,
        name="damage-calculator-page",
    ),
    path(
        "damage-calculator/data/<str:version>/<str:regulation>/",
        damage_calculator_views.damage_calculator_data,
        name="damage-calculator-data",
    ),
    path("teams/", team_views.teams_page, name="teams-page"),
    path(
        "teams/data/<str:version>/<str:regulation>/",
        team_views.teams_data,
        name="teams-data",
    ),
    path("teams/<uuid:team_id>/", team_views.teams_detail, name="teams-detail"),
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
