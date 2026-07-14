const METERS_PER_MILE = 1609.34;

// Server-side driving distance lookup via Google's Distance Matrix API.
// Uses GOOGLE_MAPS_SERVER_KEY — a separate, non-browser-restricted key from
// VITE_GOOGLE_MAPS_API_KEY (which is referrer-locked to the app's domain and
// cannot be called from Node).
async function getDrivingDistanceMiles(origin, destination) {
    const key = process.env.GOOGLE_MAPS_SERVER_KEY;
    if (!key) {
        throw new Error('Server-side mileage calculation is not configured (GOOGLE_MAPS_SERVER_KEY missing).');
    }

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Google Distance Matrix API request failed (HTTP ${res.status}).`);
    }

    const data = await res.json();
    if (data.status !== 'OK') {
        throw new Error(`Google Distance Matrix API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ''}`);
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
        throw new Error(`Could not find a driving route between "${origin}" and "${destination}" (${element?.status || 'no result'}).`);
    }

    return element.distance.value / METERS_PER_MILE;
}

module.exports = { getDrivingDistanceMiles };
