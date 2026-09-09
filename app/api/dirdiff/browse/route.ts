import { NextResponse } from "next/server";
import { pickFolder } from "@/lib/dirdiff/server/browse";

export async function POST() {
  try {
    const picked = await pickFolder("选择要对比的文件夹");
    return NextResponse.json({ path: picked });
  } catch (err) {
    return NextResponse.json({
      error: process.platform === "linux"
        ? "当前系统未找到可用的文件夹选择器(需要 kdialog 或 zenity),请在输入框中手动填写路径"
        : `无法打开文件夹选择器: ${(err as Error).message}`,
    });
  }
}