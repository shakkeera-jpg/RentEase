from django.core.management.base import BaseCommand
from assets.models import Asset
from booking.models import Booking
from utils.ai_indexing import index_asset, index_booking
class Command(BaseCommand):
    help = "Index all existing Assets and Bookings into the AI service"

    def handle(self, *args, **options):
        self.stdout.write("Indexing Assets...")
        assets = Asset.objects.all()
        for i, asset in enumerate(assets):
            try:
                index_asset(asset)
                if i % 10 == 0:
                    self.stdout.write(f"Indexed {i} assets...")
            except Exception as e:
                self.stderr.write(f"Failed to index asset {asset.id}: {e}")

        self.stdout.write("Indexing Bookings...")
        bookings = Booking.objects.all()
        for i, booking in enumerate(bookings):
            try:
                index_booking(booking)
                if i % 10 == 0:
                    self.stdout.write(f"Indexed {i} bookings...")
            except Exception as e:
                self.stderr.write(f"Failed to index booking {booking.id}: {e}")

        self.stdout.write(self.style.SUCCESS("Successfully indexed all data"))
