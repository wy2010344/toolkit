/**
 * 按 air.ts 记录的口径,抓取 Open-Meteo Air Quality API(CAMS)逐时 PM2.5 并按自然月求平均。
 *
 * 用法:node scripts/fetch-city-air.mjs <cityId> <lat> <lon>
 * 例:   node scripts/fetch-city-air.mjs tonghai 24.12 102.75
 *
 * 口径:2023–2025 逐时 pm2_5,timezone=Asia/Shanghai,按自然月对全部小时样本求平均,单位 μg/m³。
 */
const API = "https://air-quality-api.open-meteo.com/v1/air-quality";

async function fetchHourly(lat, lon, start, end, tries = 4) {
  const url = `${API}?latitude=${lat}&longitude=${lon}&start_date=${start}&end_date=${end}&hourly=pm2_5&timezone=Asia%2FShanghai`;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.hourly || !json.hourly.time) throw new Error("返回缺少 hourly 字段");
      return json.hourly;
    } catch (e) {
      if (i === tries - 1) throw e;
      console.error(`  ! 第 ${i + 1} 次失败(${e.message}),重试…`);
      await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
    }
  }
}

const [, , cityId, latArg, lonArg] = process.argv;
if (!cityId || !latArg || !lonArg) {
  console.error("用法:node scripts/fetch-city-air.mjs <cityId> <lat> <lon>");
  process.exit(1);
}

const { time, pm2_5 } = await fetchHourly(Number(latArg), Number(lonArg), "2023-01-01", "2025-12-31");

const acc = Array.from({ length: 12 }, () => []);
for (let i = 0; i < time.length; i++) {
  if (pm2_5[i] != null) acc[Number(time[i].slice(5, 7)) - 1].push(pm2_5[i]);
}

const monthly = acc.map((a) => (a.length ? Number((a.reduce((s, x) => s + x, 0) / a.length).toFixed(1)) : 0));
console.log(`  ${cityId}: [${monthly.join(", ")}],`);
