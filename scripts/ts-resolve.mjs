/**
 * 让构建脚本能直接 import 项目里的 .ts 数据模块。
 *
 * Node 的类型剥离只去掉类型标注,不会替我们补全省略的扩展名(源码里写的是 "./data")。
 * 这里把相对路径且无扩展名的导入补成 .ts 再交给 Node 解析,避免数据在脚本里再抄一份。
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.(ts|tsx|mts|js|mjs|json)$/.test(specifier)) {
    try {
      return await next(`${specifier}.ts`, context);
    } catch {
      // 落到下面走默认解析
    }
  }
  return next(specifier, context);
}
