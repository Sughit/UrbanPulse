import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

function browserGetCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocația nu este suportată de browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (err) => {
        reject(err || new Error("Nu am putut obține geolocația."));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options,
      }
    );
  });
}

export async function getAppLocation(options = {}) {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    const perm = await Geolocation.requestPermissions();

    const granted =
      perm.location === "granted" || perm.coarseLocation === "granted";

    if (!granted) {
      throw new Error("Permisiunea pentru locație a fost refuzată.");
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
      ...options,
    });

    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
    };
  }

  return browserGetCurrentPosition(options);
}