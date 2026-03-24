from django.contrib import admin

from .models import District, Panchayat, Taluk


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ("name",)


@admin.register(Taluk)
class TalukAdmin(admin.ModelAdmin):
    list_display = ("name", "district")
    list_filter = ("district",)


@admin.register(Panchayat)
class PanchayatAdmin(admin.ModelAdmin):
    list_display = ("name", "taluk")
    list_filter = ("taluk__district", "taluk")
