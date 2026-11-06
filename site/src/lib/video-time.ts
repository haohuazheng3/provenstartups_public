/** 视频链接加 t=秒,点开就从那一句开始播(YouTube 的 watch / youtu.be / shorts 都认 t 参数) */
export function atSecond(url: string, t: number) {
  try {
    const u = new URL(url);
    u.searchParams.set("t", `${t}s`);
    return u.toString();
  } catch {
    return url;
  }
}

/** 秒 → "12:31" / "1:58:42" */
export function clock(t: number) {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
