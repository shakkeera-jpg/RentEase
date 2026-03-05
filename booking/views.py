from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Booking
from payments.services import refund_payment
from rest_framework.views import APIView
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import Booking
from .serializers import CreateBookingSerializer
from payments.services import refund_payment, transfer_to_owner
import razorpay
from django.conf import settings


class OwnerActionView(APIView):

    def post(self, request, booking_id):

        booking = Booking.objects.get(id=booking_id)

        if booking.asset.owner != request.user:
            return Response({"error": "Not allowed"}, status=403)

        action = request.data.get("action")

        if action == "approve":
            booking.status = "APPROVED"
            booking.save()
            return Response({"message": "Approved"})

        if action == "reject":
            refund_payment(booking.razorpay_payment_id)
            booking.status = "REFUNDED"
            booking.save()
            return Response({"message": "Rejected & Refunded"})

        return Response({"error": "Invalid action"}, status=400)

class CreateBookingView(APIView):
    def post(self, request):
        serializer = CreateBookingSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
           
            booking = serializer.save()

           
            client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

           
            total_amount_paise = int(booking.get_total_paid() * 100)

           
            data = {
                "amount": total_amount_paise,
                "currency": "INR",
                "receipt": f"booking_rcpt_{booking.id}",
                "notes": {
                    "booking_id": booking.id,
                    "asset_title": booking.asset.title
                }
            }

            try:
                razorpay_order = client.order.create(data=data)
                
                
                booking.razorpay_order_id = razorpay_order['id']
                booking.save()

               
                return Response({
                    "success": True,
                    "booking_id": booking.id,
                    "orderData": {
                        "order_id": razorpay_order['id'],
                        "amount": razorpay_order['amount'], 
                        "currency": razorpay_order['currency']
                    }
                }, status=status.HTTP_201_CREATED)

            except Exception as e:
                
                booking.delete() 
                return Response({"error": f"Payment gateway error: {str(e)}"}, status=500)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RenterCancelView(APIView):
    def post(self, request, booking_id):
        booking = Booking.objects.get(id=booking_id, renter=request.user)
        if booking.status not in ["OWNER_PENDING", "APPROVED"]:
            return Response({"error": "Cannot cancel now"}, status=400)

       
        time_elapsed = timezone.now() - booking.paid_at
        if time_elapsed <= timedelta(hours=24):
            refund_payment(booking.razorpay_payment_id) 
        else:
            partial_amount = float(booking.get_total_paid()) * 0.80
            refund_payment(booking.razorpay_payment_id, amount=partial_amount)

        booking.status = "CANCELLED"
        booking.save()
        return Response({"message": "Refund initiated"})

class FinalizeReturnView(APIView):
    def post(self, request, booking_id):
        booking = Booking.objects.get(id=booking_id)
        if booking.asset.owner != request.user:
            return Response({"error": "Unauthorized"}, status=403)

        penalty = float(request.data.get("penalty", 0))
        booking.penalty_deducted = penalty
        
        # Calculate how much to capture from the authorized funds
        # Capture Amount = total_rent + commission + penalty
        # The deposit (minus penalty) will be automatically released by Razorpay
        capture_amount = float(booking.total_rent + booking.commission) + penalty
        
        from payments.services import capture_payment
        from payments.models import Payout
        
        try:
            # Finalize the transaction by capturing only the required part
            capture_payment(booking.razorpay_payment_id, capture_amount)
            
            # Record the payout that needs to be made to the owner
            # Owner gets: Total Rent - Commission + Penalty
            owner_payout_amount = float(booking.total_rent - booking.commission) + penalty
            
            Payout.objects.create(
                booking=booking,
                amount=owner_payout_amount,
                recipient=booking.asset.owner,
                status="PENDING",
                payout_type="OWNER_RENT"
            )

            booking.status = "COMPLETED"
            booking.is_settled = True
            booking.save()
            
            return Response({
                "message": "Funds captured. Remaining deposit released to renter.",
                "owner_payout_due": owner_payout_amount
            })

        except Exception as e:
            return Response({"error": f"Capture failed: {str(e)}"}, status=500)