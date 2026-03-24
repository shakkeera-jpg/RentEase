const getMediaBaseUrl = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://127.0.0.1";
};

export const resolveMediaUrl = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  if (raw.startsWith("//")) {
    const protocol =
      typeof window !== "undefined" && window.location?.protocol
        ? window.location.protocol
        : "http:";
    return `${protocol}${raw}`;
  }

  const base = getMediaBaseUrl();

  if (raw.startsWith("/")) {
    return `${base}${raw}`;
  }

  // Handle values like "127.0.0.1:8000/verification_docs/..."
  if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?\//.test(raw)) {
    return `http://${raw}`;
  }

  return `${base}/${raw}`;
};

export const addCacheBuster = (url, token) => {
  if (!url) return null;

  // Do not mutate pre-signed S3 URLs. Adding extra query params can invalidate signatures.
  if (
    /[?&](X-Amz-Algorithm|X-Amz-Signature|X-Amz-Credential|AWSAccessKeyId|Signature|Expires)=/i.test(
      url
    )
  ) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(token)}`;
};
