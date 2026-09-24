/**
 * DFT 听音室主界面:左侧大纲 + 右侧课程视图。
 * 从「同声相应」这个直觉出发,七章走完离散傅里叶变换。
 */
"use client";

import { useState } from "react";
import { DftSidebar } from "./Sidebar";
import { DftIntro } from "./sections/Intro";
import { DftWaveFactory } from "./sections/WaveFactory";
import { DftResonate } from "./sections/Resonate";
import { DftCancel } from "./sections/Cancel";
import { DftMixer } from "./sections/Mixer";
import { DftPhase } from "./sections/Phase";
import { DftSpectrum } from "./sections/Spectrum";

const VIEWS = [
  DftIntro,
  DftWaveFactory,
  DftResonate,
  DftCancel,
  DftMixer,
  DftPhase,
  DftSpectrum,
];

export function DftLabApp() {
  const [active, setActive] = useState(0);
  const View = VIEWS[active]!;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-canvas">
      <DftSidebar active={active} onSet={setActive} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <View key={active} />
      </main>
    </div>
  );
}