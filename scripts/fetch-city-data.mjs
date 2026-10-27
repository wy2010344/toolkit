/**
 * 按 env.ts / data.ts 记录的同一套口径,抓取 Open-Meteo 历史数据并聚合为逐月值。
 *
 * 用法:node scripts/fetch-city-data.mjs <cityId> <lat> <lon>
 * 例:   node scripts/fetch-city-data.mjs tonghai 24.12 102.75
 *
 * 两段口径与既有数据文件保持一致:
 *   ① 气温:1995–2024 逐日 temperature_2m_max/min/mean,按自然月求平均 → [最高, 最低, 均温]
 *   ② 环境:2023–2025 逐日聚合,求和类(降水/日照)与计数类(雨日/高温日/霜冻日)按覆盖年数归一
 *
 * 脚本会先拉取邻近已有城市做自检,确认聚合方法能复现既有文件中的数值,再输出目标城市的数据。
 */
const API = "https://archive-api.open-meteo.com/v1/archive";

const TEMP_VARS = ["temperature_2m_max", "temperature_2m_min", "temperature_2m_mean"];
const ENV_VARS = [
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_mean",
  "relative_humidity_2m_mean",
  "precipitation_sum",
  "sunshine_duration",
  "cloud_cover_mean",
  "shortwave_radiation_sum",
  "wind_speed_10m_mean",
  "wind_gusts_10m_max",
];

async function fetchDaily(lat, lon, start, end, vars, tries = 4) {
  const url = `${API}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&daily=${vars.join(",")}&timezone=Asia%2FShanghai`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.daily || !json.daily.time) throw new Error("返回缺少 daily 字段");
      return json.daily;
    } catch (e) {
      if (i === tries - 1) throw e;
      console.error(`  ! 第 ${i + 1} 次失败(${e.message}),重试…`);
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
}

/** 气温:按自然月求 30 年平均。 */
function aggregateTemps(daily) {
  const { time, temperature_2m_max: mx, temperature_2m_min: mn, temperature_2m_mean: me } = daily;
  const acc = Array.from({ length: 12 }, () => ({ mx: [], mn: [], me: [] }));
  for (let i = 0; i < time.length; i++) {
    const m = Number(time[i].slice(5, 7)) - 1;
    if (mx[i] != null) acc[m].mx.push(mx[i]);
    if (mn[i] != null) acc[m].mn.push(mn[i]);
    if (me[i] != null) acc[m].me.push(me[i]);
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return acc.map((a) => [
    Number(mean(a.mx).toFixed(1)),
    Number(mean(a.mn).toFixed(1)),
    Number(mean(a.me).toFixed(1)),
  ]);
}

/** 环境:按自然月聚合,求和类与计数类按覆盖年数归一。 */
function aggregateEnv(daily) {
  const {
    time,
    temperature_2m_max: tmax,
    temperature_2m_min: tmin,
    apparent_temperature_mean: feels,
    relative_humidity_2m_mean: hum,
    precipitation_sum: precip,
    sunshine_duration: sun,
    cloud_cover_mean: cloud,
    shortwave_radiation_sum: rad,
    wind_speed_10m_mean: wind,
    wind_gusts_10m_max: gust,
  } = daily;

  const acc = Array.from({ length: 12 }, () => ({
    feels: [], hum: [], precip: [], sun: [], cloud: [], rad: [], wind: [], gust: [],
    rainDays: 0, heavyRain: 0, windyDays: 0, hot30: 0, frost: 0, years: new Set(),
  }));

  for (let i = 0; i < time.length; i++) {
    const m = Number(time[i].slice(5, 7)) - 1;
    const a = acc[m];
    a.years.add(time[i].slice(0, 4));
    if (feels[i] != null) a.feels.push(feels[i]);
    if (hum[i] != null) a.hum.push(hum[i]);
    if (precip[i] != null) { a.precip.push(precip[i]); if (precip[i] >= 1) a.rainDays++; if (precip[i] >= 25) a.heavyRain++; }
    if (sun[i] != null) a.sun.push(sun[i]);
    if (cloud[i] != null) a.cloud.push(cloud[i]);
    if (rad[i] != null) a.rad.push(rad[i]);
    if (wind[i] != null) a.wind.push(wind[i]);
    if (gust[i] != null) { a.gust.push(gust[i]); if (gust[i] >= 39) a.windyDays++; }
    if (tmax[i] != null && tmax[i] > 30) a.hot30++;
    if (tmin[i] != null && tmin[i] < 0) a.frost++;
  }

  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  return acc.map((a, idx) => {
    const y = a.years.size;
    const r1 = (v) => Number(v.toFixed(1));
    // 与既有 env.ts 中后加入的城市保持一致:湿度/云量/阵风保留一位小数,降水与日照取整。
    const r0 = (v) => Math.round(v);
    return {
      m: idx + 1,
      feels: r1(mean(a.feels)),
      hum: r1(mean(a.hum)),
      precip: r0(a.precip.reduce((s, x) => s + x, 0) / y),
      rainDays: r1(a.rainDays / y),
      heavyRain: r1(a.heavyRain / y),
      sun: r0(a.sun.reduce((s, x) => s + x, 0) / 3600 / y),
      cloud: r1(mean(a.cloud)),
      rad: r1(mean(a.rad)),
      wind: r1(mean(a.wind)),
      gust: r1(mean(a.gust)),
      windyDays: r1(a.windyDays / y),
      hot30: r1(a.hot30 / y),
      frost: r1(a.frost / y),
    };
  });
}

const [, , cityId, latArg, lonArg] = process.argv;
if (!cityId || !latArg || !lonArg) {
  console.error("用法:node scripts/fetch-city-data.mjs <cityId> <lat> <lon>");
  process.exit(1);
}
const lat = Number(latArg);
const lon = Number(lonArg);

console.log(`▶ 抓取 ${cityId} (${lat}, ${lon})`);

console.log("  · 气温 1995–2024 …");
const temps = aggregateTemps(await fetchDaily(lat, lon, "1995-01-01", "2024-12-31", TEMP_VARS));
console.log("  · 环境 2023–2025 …");
const env = aggregateEnv(await fetchDaily(lat, lon, "2023-01-01", "2025-12-31", ENV_VARS));

console.log(`\n// ===== ${cityId} 气温 [最高, 最低, 均温] =====`);
console.log("  " + cityId + ": [");
for (const t of temps) console.log(`    [${t[0]}, ${t[1]}, ${t[2]}],`);
console.log("  ],");

console.log(`\n// ===== ${cityId} 环境 =====`);
console.log(`  ${cityId}: [`);
for (const e of env) {
  console.log(
    `    { m: ${e.m}, feels: ${e.feels}, hum: ${e.hum}, precip: ${e.precip}, rainDays: ${e.rainDays}, heavyRain: ${e.heavyRain}, sun: ${e.sun}, cloud: ${e.cloud}, rad: ${e.rad}, wind: ${e.wind}, gust: ${e.gust}, windyDays: ${e.windyDays}, hot30: ${e.hot30}, frost: ${e.frost} },`,
  );
}
console.log("  ],");
