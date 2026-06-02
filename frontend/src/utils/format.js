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
