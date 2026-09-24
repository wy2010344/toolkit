/**
 * DFT 的“同声相应”算法库。
 *
 * 全篇只用一个动作:**点积** —— 拿一根“探针”逐帧相乘再求和。
 * 离散傅里叶变换不过就是把探针换成一个接一个的频道(k = 0,1,2,…,N−1),
 * 每个频道读出它同样收到多少信号:同频的分量“越长越响”,不同频的分量自动抵消。
 *
 * 约定:
 *   - 信号 = 长度 N 的 number[];演示统一用 N = 64(整段窗口).
 *   - “第 k 频” = 在整段窗口里恰好绕完 k 圈(完整周期)的频率。
 *   - 采样点 n 处、第 k 频的相位 = 2π k n / N。
 *
 * 归一约定(所有函数一致):
 *   - 纯正弦 A·cos(θ+φ) 在 bin k 的读数 = (N/2)·A·e^{+iφ}(复振幅)。
 *   - amplitudeOf(bin, k) = 纯正弦的真实振幅 A;k = 0 时 = 直流分量。
 *   - resynthesize 用它按振幅把每个频道加回去,能原样拼回信号。
 */

export interface Complex {
  re: number;
  im: number;
}

export const TAU = Math.PI * 2;

/** 默认窗口长度(采样点数)。所有演示共用,方便相互对照。 */
export const N = 64;

/** 第 k 频的余弦探针在第 n 个采样点的值。 */
export function probeCos(k: number, n: number, size = N): number {
  return Math.cos((TAU * k * n) / size);
}

/** 第 k 频的正弦探针在第 n 个采样点的值(比余弦晚到 90°)。 */
export function probeSin(k: number, n: number, size = N): number {
  return Math.sin((TAU * k * n) / size);
}

/** 生成第 k 频、振幅 amp、初相 phase(弧度)的纯正弦波,整段 size 点。 */
export function sineWave(k: number, amp: number, phase = 0, size = N): number[] {
  return Array.from({ length: size }, (_, n) => amp * Math.sin((TAU * k * n) / size + phase));
}

/** 若干正弦波逐帧相加,得到一段“混音”。 */
export function mixWaves(
  parts: ReadonlyArray<{ k: number; amp: number; phase?: number }>,
  size = N,
): number[] {
  const out = new Array<number>(size).fill(0);
  for (const p of parts) {
    const w = sineWave(p.k, p.amp, p.phase ?? 0, size);
    for (let n = 0; n < size; n++) out[n]! += w[n]!;
  }
  return out;
}

/** 第 k 频的方波(+1 / −1)—— 频谱呈现经典的奇次谐波阶梯。 */
export function squareWave(k: number, size = N): number[] {
  return Array.from({ length: size }, (_, n) => (Math.sin((TAU * k * n) / size) >= 0 ? 1 : -1));
}

/** 脉冲:只有第 0 帧是 1,其余全是 0 —— 频谱是一条近乎等高的平线。 */
export function impulse(size = N): number[] {
  const out = new Array<number>(size).fill(0);
  out[0] = 1;
  return out;
}

/** 随机噪声(±1),验证“没有固定频率的信号,频谱里也没有尖峰”。 */
export function noise(size = N, seed = 1): number[] {
  let s = seed;
  return Array.from({ length: size }, () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s / 0x40000000) - 1;
  });
}

/** 点积:一个数组与探针逐帧相乘再求和。共振实验/频道读数的原始动作。 */
export function dotProduct(signal: number[], probe: (n: number) => number): number {
  let acc = 0;
  for (let n = 0; n < signal.length; n++) acc += signal[n]! * probe(n);
  return acc;
}

/**
 * 第 k 频道的一对读数(复数):
 *   re = Σ x[n]·cos(kθ)     —— 余弦探针
 *   im = −Σ x[n]·sin(kθ)    —— 正弦探针(共轭方向,让重建时能干净加回来)
 */
export function correlate(signal: number[], k: number): Complex {
  const size = signal.length;
  let re = 0;
  let im = 0;
  for (let n = 0; n < size; n++) {
    re += signal[n]! * probeCos(k, n, size);
    im -= signal[n]! * probeSin(k, n, size);
  }
  return { re, im };
}

/** 把某频道的读数换算成“声量”(振幅)。k=0 是直流,除以 N;其余乘 2/N。 */
export function amplitudeOf(bin: Complex, k: number, size = N): number {
  return k === 0 ? bin.re / size : (Math.hypot(bin.re, bin.im) * 2) / size;
}

/** 相对余弦基准的相位(弧度,范围 −π..π)。纯正弦零相位会读作 −90°。 */
export function phaseOf(bin: Complex): number {
  return Math.atan2(bin.im, bin.re);
}

/** 完整离散傅里叶变换:第 k 个频道就是 correlate(signal, k)。 */
export function dft(signal: number[]): Complex[] {
  return signal.map((_, k) => correlate(signal, k));
}

/** 全部频道的振幅(画频谱图用):每个柱就是“这台收音机第 k 频道听到的声量”。 */
export function spectrumAmplitude(signal: number[]): number[] {
  const size = signal.length;
  return dft(signal).map((bin, k) => amplitudeOf(bin, k, size));
}

/**
 * 反变换:把每个频道按“振幅 × 各自的波”加回去,重建原信号。
 * 用标准逆变换的 1/N 刻度——镜像频道(k 与 N−k)各自都要加一遍,天然翻回原来的振幅。
 * 这一步的存在本身就是“信息没丢”的证明。
 */
export function resynthesize(bins: Complex[], size = N): number[] {
  return Array.from({ length: size }, (_, n) => {
    let v = 0;
    for (let k = 0; k < bins.length; k++) {
      const { re, im } = bins[k]!;
      v += (re * Math.cos((TAU * k * n) / size) - im * Math.sin((TAU * k * n) / size)) / size;
    }
    return v;
  });
}

/** 一次“共振实验”的完整轨迹:逐帧乘积 + 累积和。用于直观展示同频累加/异频相消。 */
export interface CorrelateTrace {
  products: number[];
  runningSum: number[];
  total: number;
}

/** 用相位对齐的 sin 探针测 signal 的第 k 频,返回逐帧乘积与累积和。 */
export function correlateTrace(signal: number[], k: number): CorrelateTrace {
  const size = signal.length;
  const products: number[] = [];
  const runningSum: number[] = [];
  let acc = 0;
  for (let n = 0; n < size; n++) {
    const p = signal[n]! * probeSin(k, n, size);
    products.push(p);
    acc += p;
    runningSum.push(acc);
  }
  return { products, runningSum, total: acc };
}

/** 数值容差内的近似相等(演示里判断“是不是约等于 0”)。 */
export function approxZero(v: number, eps = 1e-6): boolean {
  return Math.abs(v) < eps;
}