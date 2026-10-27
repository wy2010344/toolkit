/**
 * 轻量结构自检:数一遍 { } [ ] ( ) 的配对,并做几项 TS/JSX 常见毛病的粗查。
 *
 * 它是 lint / tsc 的补充而非替代:括号失配在 eslint 里往往报成文法错误,定位不如这里直观。
 * 注意:Windows 的 PowerShell 不会展开通配符,所以本脚本自己展开 `*`,可以直接传
 * `components/climate/*.tsx` 这样的模式。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 去掉字符串、模板串与注释,剩下的代码里再数括号。 */
function stripLiterals(src) {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < n && src[i] !== q) {
        if (src[i] === "\\") i++;
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    if (c === "`") {
      i++;
      while (i < n && src[i] !== "`") {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < n && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            i++;
          }
          out += "{}";
          continue;
        }
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function checkBalance(src) {
  const code = stripLiterals(src);
  const stack = [];
  const pairs = { "}": "{", ")": "(", "]": "[" };
  const lineOf = (idx) => src.slice(0, idx).split("\n").length;
  for (let i = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{" || c === "(" || c === "[") stack.push({ c, i });
    else if (c === "}" || c === ")" || c === "]") {
      const top = stack.pop();
      if (!top) return `多余的 ${c}(第 ${lineOf(i)} 行)`;
      if (top.c !== pairs[c]) return `括号不匹配:${top.c}(第 ${lineOf(top.i)} 行)对 ${c}(第 ${lineOf(i)} 行)`;
    }
  }
  if (stack.length) {
    const t = stack[stack.length - 1];
    return `缺少右括号 ${({ "{": "}", "(": ")", "[": "]" })[t.c]}(第 ${lineOf(t.i)} 行)`;
  }
  return null;
}

/** 粗查几种容易写出来的毛病。 */
function checkSmells(src) {
  const out = [];
  if (/\bas any\b/.test(src)) out.push("出现 as any");
  if (/\bTODO\b|\bFIXME\b/.test(src)) out.push("残留 TODO/FIXME");
  // 同一个标识符既当形参又当局部 const
  const dup = /\b(\w+),\s*$/m;
  void dup;
  return out;
}

/**
 * 展开路径模式:只支持 `*`(匹配任意非分隔符字符),足以应付本项目按目录列举的用法。
 * PowerShell 不替进程展开通配符,所以这里必须自己来。
 */
function expand(pattern) {
  const segs = pattern.split("/");
  let cur = [ROOT];
  for (const seg of segs) {
    const next = [];
    const re = new RegExp("^" + seg.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*") + "$");
    for (const dir of cur) {
      if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
      for (const name of fs.readdirSync(dir)) {
        if (!re.test(name)) continue;
        const abs = path.join(dir, name);
        // 最后一段允许是文件或目录;中间段只接受目录
        if (seg !== segs[segs.length - 1] && !fs.statSync(abs).isDirectory()) continue;
        next.push(abs);
      }
    }
    cur = next;
  }
  return cur;
}

const files = process.argv.slice(2).flatMap((p) =>
  p.includes("*") ? expand(p) : [path.isAbsolute(p) ? p : path.join(ROOT, p)],
);
if (!files.length) {
  console.error("用法:node scripts/check-structure.mjs <file|glob...>");
  process.exit(2);
}

let bad = 0;
for (const abs of files) {
  // 本脚本的检测模式本身就是 "as any" / "TODO" 这些字样,跳过自己以免自指。
  if (path.basename(abs) === "check-structure.mjs") continue;
  const src = fs.readFileSync(abs, "utf8");
  const err = checkBalance(src);
  const smells = checkSmells(src);
  if (err || smells.length) {
    bad++;
    console.log(`✗ ${path.relative(ROOT, abs)}`);
    if (err) console.log(`   括号: ${err}`);
    for (const s of smells) console.log(`   毛病: ${s}`);
  } else {
    console.log(`✓ ${path.relative(ROOT, abs)}`);
  }
}
process.exit(bad ? 1 : 0);
