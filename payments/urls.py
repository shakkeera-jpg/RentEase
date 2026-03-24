from django.urls import path
from .views import CreatePaymentView, VerifyPaymentView

urlpatterns = [
    path('create/<int:booking_id>/', CreatePaymentView.as_view(), name='create-payment-order'),
    path('verify/', VerifyPaymentView.as_view(), name='verify-payment-signature'),
]