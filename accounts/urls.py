from django.urls import path
from accounts.views import RegisterView, VerifyEmailOTPView,LoginView, AdminOTPVerifyView,AcceptAgreementView,ForgotPasswordView, ResetPasswordView,LogoutView,google_login,generate_mfa_qr, verify_mfa, UserMFAVerifyView,DisableMFAView
 

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email-otp/", VerifyEmailOTPView.as_view(), name="verify-email-otp"),
    path("login/", LoginView.as_view(),name="login"),
    path("admin-verify-otp/", AdminOTPVerifyView.as_view()),
    path("auth/accept-agreement/", AcceptAgreementView.as_view()),
    path("forgot-password/", ForgotPasswordView.as_view(),name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view()),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("auth/google/", google_login),
    path('generate-qr/', generate_mfa_qr, name='generate-qr'),
    path('verify-setup/', verify_mfa, name='verify-mfa-setup'),
    path('verify-login/', UserMFAVerifyView.as_view(), name='verify-mfa-login'),  
    path('disable-mfa/', DisableMFAView.as_view(), name='disable_mfa'),

]

