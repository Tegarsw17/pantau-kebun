import { Link, useRouterState } from "@tanstack/react-router";
import { Cloud, CloudFog, CloudLightning, CloudRain, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  WORKSPACE_MODULES,
  WORKSPACE_NAV_ITEMS,
} from "../data/workspaceModules.js";

const KAJEN_WEATHER_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=-7.007842&longitude=109.602456&current=temperature_2m,weather_code,is_day&timezone=Asia%2FJakarta";

function resolveWeatherPresentation(weatherCode, isDay) {
  if (weatherCode === 0 || weatherCode === 1) {
    return {
      Icon: Sun,
      label: isDay ? "Sunny" : "Clear",
      toneClassName: "app-sidebar__weather-icon--sunny",
    };
  }

  if (weatherCode === 45 || weatherCode === 48) {
    return {
      Icon: CloudFog,
      label: "Foggy",
      toneClassName: "app-sidebar__weather-icon--foggy",
    };
  }

  if (
    [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)
  ) {
    return {
      Icon: CloudRain,
      label: "Rainy",
      toneClassName: "app-sidebar__weather-icon--rainy",
    };
  }

  if ([95, 96, 99].includes(weatherCode)) {
    return {
      Icon: CloudLightning,
      label: "Stormy",
      toneClassName: "app-sidebar__weather-icon--stormy",
    };
  }

  return {
    Icon: Cloud,
    label: "Cloudy",
    toneClassName: "app-sidebar__weather-icon--cloudy",
  };
}

function normalizeBasePath(basePath) {
  if (basePath == null || basePath === "" || basePath === "/") {
    return "";
  }

  return `/${basePath.replace(/^\/+|\/+$/g, "")}`;
}

function resolveItemPath(item, basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);

  if (normalizedBasePath === "") {
    return item.to;
  }

  if (item.id === "monitoring") {
    return normalizedBasePath;
  }

  return `${normalizedBasePath}/${item.to.replace(/^\/+/, "")}`;
}

function SidebarWeatherCard() {
  const [weatherState, setWeatherState] = useState({
    isDay: true,
    loadState: "loading",
    temperatureLabel: "--°C",
    weatherCode: 3,
  });

  useEffect(() => {
    let isMounted = true;

    const loadWeather = async () => {
      try {
        const response = await fetch(KAJEN_WEATHER_URL);

        if (!response.ok) {
          throw new Error("Weather request failed.");
        }

        const payload = await response.json();
        const currentWeather = payload?.current;
        const temperature = Number(currentWeather?.temperature_2m);
        const weatherCode = Number(currentWeather?.weather_code);
        const isDay = Number(currentWeather?.is_day) === 1;

        if (!Number.isFinite(temperature) || !Number.isFinite(weatherCode)) {
          throw new Error("Weather payload is incomplete.");
        }

        if (!isMounted) {
          return;
        }

        setWeatherState({
          isDay,
          loadState: "ready",
          temperatureLabel: `${Math.round(temperature)}°C`,
          weatherCode,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setWeatherState({
          isDay: true,
          loadState: "error",
          temperatureLabel: "--°C",
          weatherCode: 3,
        });
      }
    };

    loadWeather();
    const intervalId = window.setInterval(loadWeather, 600000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const presentation =
    weatherState.loadState === "error"
      ? {
          Icon: Cloud,
          label: "Unavailable",
          toneClassName: "app-sidebar__weather-icon--cloudy",
        }
      : weatherState.loadState === "loading"
        ? {
            Icon: Cloud,
            label: "Loading",
            toneClassName: "app-sidebar__weather-icon--cloudy",
          }
        : resolveWeatherPresentation(weatherState.weatherCode, weatherState.isDay);

  const ResolvedIcon = presentation.Icon;

  return (
    <section className="app-sidebar__weather" aria-label="Kajen weather">
      <div className="app-sidebar__weather-header">
        <span className="app-sidebar__weather-label">Kajen, Pekalongan</span>
        <strong className="app-sidebar__weather-temperature">{weatherState.temperatureLabel}</strong>
      </div>

      <div className="app-sidebar__weather-body">
        <span className={`app-sidebar__weather-icon ${presentation.toneClassName}`} aria-hidden="true">
          <ResolvedIcon size={18} strokeWidth={2} />
        </span>
        <span className="app-sidebar__weather-condition">{presentation.label}</span>
      </div>
    </section>
  );
}

export function WorkspaceSidebar({ basePath = "" }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <aside className="app-sidebar" aria-label="Primary navigation">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-mark" aria-hidden="true">
          PK
        </div>
        <div className="app-sidebar__brand-copy">
          <p className="eyebrow">Pantau Kebun</p>
          <strong className="app-sidebar__title">Farm Workspace</strong>
        </div>
      </div>

      <nav className="app-sidebar__nav">
        {WORKSPACE_NAV_ITEMS.map((itemId) => {
          const item = WORKSPACE_MODULES[itemId];
          const Icon = item.icon;
          const itemPath = resolveItemPath(item, basePath);
          const isMonitoringPath = item.id === "monitoring";
          const isActive =
            itemPath === "/"
              ? pathname === "/"
              : isMonitoringPath
                ? pathname === itemPath
                : pathname === itemPath || pathname.startsWith(`${itemPath}/`);

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`app-sidebar__nav-button ${
                isActive ? "app-sidebar__nav-button--active" : ""
              }`}
              key={item.id}
              to={itemPath}
            >
              <span className="app-sidebar__nav-button-main">
                <span className="app-sidebar__nav-glyph" aria-hidden="true">
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="app-sidebar__nav-button-label">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>

      <SidebarWeatherCard />
    </aside>
  );
}
