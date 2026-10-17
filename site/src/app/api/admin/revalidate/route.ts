import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getViewer } from "@/lib/viewer";
import { captureError } from "@/lib/errors";

/**
 * 手动让项目数据的跨请求缓存失效。
 *
 * 首页 / /projects / 项目详情三处都用 unstable_cache 兜住数据库,TTL 1 小时 ——
 * 这是为爬虫准备的(sitemap 731 个 URL,四家搜索引擎反复抓,曾把 Neon 月流量
 * 吃到 4.9GB)。代价是导入脚本改完数据后最多要等 1 小时才上线,所以留这个口子:
 * 导入完调一次,立刻生效。
 *
 *   curl -X POST https://provenstartups.com/api/admin/revalidate \
 *     -H "x-admin-token: $ADMIN_TOKEN"
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("x-admin-token");
    const tokenOk = !!token && token === process.env.ADMIN_TOKEN;
    if (!tokenOk) {
      const viewer = await getViewer();
      if (!viewer.isAdmin) return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    // 单参形式已废弃。这是外部脚本调的端点,要的是立刻失效而不是
    // stale-while-revalidate,所以按文档用 { expire: 0 }。
    revalidateTag("projects", { expire: 0 });
    return NextResponse.json({ ok: true, revalidated: "projects" });
  } catch (e) {
    await captureError(e, { route: "/api/admin/revalidate", side: "server" });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
