export const VERIFICATION_STATUS = {
  NOT_SUBMITTED: "NOT_SUBMITTED",
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
};

export const isProfileCompleted = (profile) => Boolean(profile?.is_completed);

export const getVerificationStatus = (profile) =>
  profile?.verification_status || VERIFICATION_STATUS.NOT_SUBMITTED;

export const isVerificationApproved = (profile) =>
  getVerificationStatus(profile) === VERIFICATION_STATUS.APPROVED;

export const isVerificationPending = (profile) =>
  getVerificationStatus(profile) === VERIFICATION_STATUS.PENDING;

export const isVerificationRejected = (profile) =>
  getVerificationStatus(profile) === VERIFICATION_STATUS.REJECTED;

export const needsVerificationUpload = (profile) => {
  const status = getVerificationStatus(profile);
  return (
    isProfileCompleted(profile) &&
    (status === VERIFICATION_STATUS.NOT_SUBMITTED ||
      status === VERIFICATION_STATUS.REJECTED)
  );
};

export const canAccessGeneralRoutes = (profile) =>
  isProfileCompleted(profile) &&
  (isVerificationPending(profile) || isVerificationApproved(profile));

export const canPerformVerifiedActions = (profile) =>
  isProfileCompleted(profile) && isVerificationApproved(profile);
