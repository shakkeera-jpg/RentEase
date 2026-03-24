import { Navigate } from "react-router-dom";
import useProfileStore from "../store/ProfileStore";

const VerificationGuard = ({ children }) => {
  const { profile } = useProfileStore();

  if (!profile) return null; 

 
  if (profile.verification_status !== "APPROVED") {
    return <Navigate to="/profile" replace />;
  }

  return children;
};

export default VerificationGuard;