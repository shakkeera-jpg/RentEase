export const getFingerprint = () => {
  let fp = localStorage.getItem("fingerprint");

  if (!fp) {
    fp = crypto.randomUUID();
    localStorage.setItem("fingerprint", fp);
  }

  return fp;
};
