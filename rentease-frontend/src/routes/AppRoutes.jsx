import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Login from "../pages/login";
import Home from "../pages/Home";
import Register from "../pages/register";
import Agreement from "../pages/Agreement";
import AdminOtp from "../pages/adminOtp";
import Profile from "../pages/Profile";
import Verification from "../admin_pages/verification";
import ForgotPassword from "../pages/ForgotPassword";
import ResetPassword from "../pages/ResetPassword";
import useAuthStore from "../store/authStore";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import MyRentals from "../pages/MyRentals";
import ProfilePage from "../pages/ProfilePage";
import Products from "../pages/Products";
import VerifyMfaLogin from "../pages/VerifyMfaLogin";
import SetupMFA from "../pages/SetupMFA";
import PublicRoute from "../components/PublicRoute";
import Payment from "../pages/Payment";
import ProductDetail from "../pages/ProductDetails";
import Bookings from "../pages/Bookings";
import OwnerBankDetailsPage from "../pages/BankDetails";
import AdminSettlementPage from "../admin_pages/AdminSettlementPage";
import AdminUsersPage from "../admin_pages/AdminUsersPage";
import AdminLayout from "../components/AdminLayout";
import ChatPage from "../pages/ChatPage";
import ChatList from "../pages/ChatList";
import ProfileCompletionGate from "../components/ProfileCompletionGate";
import ChatWidget from "../components/ChatWidget";

const AppRoutes = () => {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  const hideSidebarRoutes = [
    "/",
    "/products",
    "/admin-verify-otp",
    "/agreement",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-mfa-login",
    "/profile",
  ];

  const isInternalAdminRoute =
    location.pathname.startsWith("/admin") || location.pathname === "/settlement";

  const shouldShowUserSidebar =
    isAuthenticated &&
    !hideSidebarRoutes.includes(location.pathname) &&
    !isInternalAdminRoute;

  return (
    <>
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" />
          ) : (
            <PublicRoute>
              <Login />
            </PublicRoute>
          )
        }
      />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/admin/verification" element={<AdminLayout><Verification /></AdminLayout>} />
      <Route path="/admin/settlement" element={<AdminLayout><AdminSettlementPage /></AdminLayout>} />
      <Route path="/admin/users" element={<AdminLayout><AdminUsersPage /></AdminLayout>} />

      <Route
        path="/*"
        element={
          <ProfileCompletionGate>
            <div className="app-shell">
              {shouldShowUserSidebar && <Sidebar />}

              <div className={`app-main ${shouldShowUserSidebar ? "lg:ml-[280px]" : ""}`}>
                <Navbar />
                <main className={isAuthenticated ? "app-content" : ""}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/my-rentals" element={<MyRentals />} />
                    <Route path="/agreement" element={<Agreement />} />
                    <Route path="/admin-verify-otp" element={<AdminOtp />} />
                    <Route path="/bankdetails" element={<OwnerBankDetailsPage />} />
                    <Route path="/profilepage" element={<ProfilePage />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/setupmfa" element={<SetupMFA />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/Bookings" element={<Navigate to="/bookings" replace />} />
                    <Route path="/chat/:conversationId" element={<ChatPage />} />
                    <Route path="/messages" element={<ChatList />} />
                    <Route path="/verify-mfa-login" element={<VerifyMfaLogin />} />
                  </Routes>
                </main>
              </div>
            </div>
          </ProfileCompletionGate>
        }
      />
    </Routes>
    <ChatWidget />
    </>
  );
};

export default AppRoutes;
