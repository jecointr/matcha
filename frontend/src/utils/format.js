import { API_URL } from '../config';

// Build a full URL for an uploaded photo. Absolute URLs are passed through;
// relative ones (e.g. /uploads/x.jpg) are prefixed with the API host.
export const getPhotoUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
};

// Age in whole years from a birth date (ISO string or Date). null if missing.
export const calculateAge = (birthDate) => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Relative "time ago" label (Just now / Xm / Xh / Xd ago), falling back to a
// date once older than a week.
export const timeAgo = (date) => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};
