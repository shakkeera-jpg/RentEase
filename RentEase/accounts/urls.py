from django.urls import path

from accounts.views import (
    AcceptAgreementView,
    AdminOTPVerifyView,
    DisableMFAView,
    DocumentedTokenRefreshView,
    ForgotPasswordView,
    LoginView,
    LogoutView,
    OwnerBankDetailsView,
    RegisterView,
    ResetPasswordView,
    UserMFAVerifyView,
    VerifyEmailOTPView,
    generate_mfa_qr,
    google_login,
    verify_mfa,
)

urlpatterns = [
    path("token/refresh/", DocumentedTokenRefreshView.as_view(), name="token_refresh"),
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-email-otp/", VerifyEmailOTPView.as_view(), name="verify-email-otp"),
    path("login/", LoginView.as_view(), name="login"),
    path("admin-verify-otp/", AdminOTPVerifyView.as_view()),
    path("auth/accept-agreement/", AcceptAgreementView.as_view()),
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view()),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("auth/google/", google_login),
    path("generate-qr/", generate_mfa_qr, name="generate-qr"),
    path("verify-setup/", verify_mfa, name="verify-mfa-setup"),
    path("verify-login/", UserMFAVerifyView.as_view(), name="verify-mfa-login"),
    path("disable-mfa/", DisableMFAView.as_view(), name="disable_mfa"),
    path("owner/bank-details/", OwnerBankDetailsView.as_view(), name="bank-details"),
]
