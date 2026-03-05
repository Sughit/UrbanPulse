export async function fetchWeatherAlerts(lat, lng) {
    console.log("Cheie", import.meta.env.VITE_OPENWEATHER_KEY);
  const key = import.meta.env.VITE_OPENWEATHER_KEY;
  if (!key) return { alerts: [], severeAlert: null };

  const url =
    `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lng}` +
    `&exclude=minutely,hourly,daily&appid=${key}`;

  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.warn("OWM error:", res.status, txt);
    return { alerts: [], severeAlert: null };
  }

  const data = await res.json();
  const alerts = Array.isArray(data.alerts) ? data.alerts : [];

  const severeAlert =
    alerts.find((a) => {
      const t = `${a.event || ""} ${(a.tags || []).join(" ")}`.toLowerCase();
      return (
        t.includes("severe") ||
        t.includes("warning") ||
        t.includes("watch") ||
        t.includes("storm") ||
        t.includes("extreme")
      );
    }) || null;

  return { alerts, severeAlert };
}