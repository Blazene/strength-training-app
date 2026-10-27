export type AccountUser = { id: string; name: string; email: string };
export async function accountRequest(path: string, body?: Record<string, string>, signal?: AbortSignal) {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(path, {
      method: body ? "POST" : "GET", credentials: "same-origin", cache: "no-store", signal: controller.signal,
      ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {})
    });
    if (path === "/api/me" && response.status === 401) return null;
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : "Account request failed. Try again.");
    return data as { user?: AccountUser } | null;
  } catch (error) {
    if (error instanceof Error && error.name !== "AbortError" && !(error instanceof TypeError)) throw error;
    throw new Error("Account service is unavailable. You can keep logging on this device.", { cause: error });
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", cancel); }
}
