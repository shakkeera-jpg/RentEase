from django.contrib import admin
from .models import Asset, Category

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ["id", "name"]


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "owner", "category"]
    list_filter = ["category"]
    search_fields = ["title", "owner__email"]


