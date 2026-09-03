/**
 * Reverse-geocode GPS coordinates into a "neighborhood-level" label when possible.
 *
 * Shared by:
 *  - onboarding/profil location picker
 *  - MapPage GPS flow
 */
export const reverseGeocodeLocation = async (lat, lng) => {
  try {
    // Neighborhood-level granularity (subject: "down to their neighborhood")
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'en' } }
    );

    const data = await response.json();
    const addr = data.address || {};

    const neighbourhood =
      addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || '';

    const city =
      addr.city || addr.town || addr.village || addr.municipality || 'Unknown';

    return {
      // "Neighbourhood, City" when available, otherwise just the city.
      city: [neighbourhood, city].filter(Boolean).join(', '),
      country: addr.country || 'Unknown',
    };
  } catch {
    return { city: 'Unknown', country: 'Unknown' };
  }
};

