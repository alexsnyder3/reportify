export async function geocodeAddress(address: string): Promise<{ lat: string; lon: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Reportify/1.0 (reportify.ca)' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    return { lat: parseFloat(data[0].lat).toFixed(6), lon: parseFloat(data[0].lon).toFixed(6) };
  } catch {
    return null;
  }
}
