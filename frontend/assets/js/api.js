// api.js

export async function fetchHeight() {
  const res = await fetch("/api/height");
  const data = await res.json();
  return data;
}

export async function startImport({ viewKey, birthday, walletName }) {
  const res = await fetch("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      view_key: viewKey,
      birthday: Number(birthday),
      wallet_name: walletName,
    }),
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export async function pollJob(jobId) {
  const res = await fetch(`/api/job/${jobId}`);
  const data = await res.json();
  return { ok: res.ok, data };
}
