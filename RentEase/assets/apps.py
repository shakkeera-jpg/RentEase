from django.apps import AppConfig


class AssetConfig(AppConfig):
    name = "assets"

    def ready(self):
        import utils.ai_indexing
