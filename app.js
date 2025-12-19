(function () {
  "use strict";

  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  /* ============================================================
     Tabs
  ============================================================ */
  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  function showTab(tab) {
    panels.forEach((t) => byId("panel-" + t)?.classList.add("hidden"));
    byId("panel-" + tab)?.classList.remove("hidden");

    $$(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add("is-active");

    ["team", "whitepaper", "news", "roadmap", "tournaments"].forEach((s) =>
      byId("side-" + s)?.classList.add("hidden")
    );
    byId("side-" + tab)?.classList.remove("hidden");

    location.hash = tab;

    if (tab === "tournaments") {
      setTimeout(() => {
        renderOpenMatches();
        loadMyOpenMatch();
        loadChat();
      }, 300);
    }
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));

  /* ============================================================
     Wallet
  ============================================================ */
  const walletBtn = byId("walletBtn");

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? address.toLowerCase() : "";
    window.connectedWalletAddress = addr;
    window.connectedChainId = chainId ?? null;
    walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
  }

  walletBtn?.addEventListener("click", () => window.ChainEsportWallet?.open?.());

  window.addEventListener("chainesport:wallet", (ev) => {
    setWalletUI(ev.detail?.address, ev.detail?.chainId);
    unlockTournamentsIfReady();
    renderOpenMatches();
    loadMyOpenMatch();
    loadChat();
  });

  function syncWallet() {
    setWalletUI(
      window.ChainEsportWallet?.getAddress?.(),
      window.ChainEsportWallet?.getChainId?.()
    );
  }

  syncWallet();

  /* ============================================================
     Supabase
  ============================================================ */
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";
  let sbClient;

  async function getSupabase() {
    if (sbClient) return sbClient;
    if (!window.supabase) {
      await new Promise((r) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
        s.onload = r;
        document.head.appendChild(s);
      });
    }
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sbClient;
  }

  const getWallet = () => window.connectedWalletAddress || "";

  /* ============================================================
     Player Registration
  ============================================================ */
  const playerForm = byId("playerForm");
  const createMatchBlock = byId("create-match-block");

  async function unlockTournamentsIfReady() {
    const wallet = getWallet();
    if (!wallet) return createMatchBlock.classList.add("hidden");

    const sb = await getSupabase();
    const { data } = await sb
      .from("players")
      .select("wallet_address")
      .eq("wallet_address", wallet)
      .maybeSingle();

    data ? createMatchBlock.classList.remove("hidden") : createMatchBlock.classList.add("hidden");
  }

  playerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const f = new FormData(playerForm);
    if (!byId("agreePlayer").checked) return alert("Accept rules");

    const { error } = await sb.from("players").upsert({
      wallet_address: wallet,
      nickname: f.get("nickname"),
      email: f.get("email"),
    });

    if (error) return alert(error.message);
    alert("Registered");
    unlockTournamentsIfReady();
  });

  /* ============================================================
     Create Match + Auto Join
  ============================================================ */
  byId("cm-create")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet");

    const game = byId("cm-game").value.trim();
    const conditions = byId("cm-conditions").value.trim();
    const entry = Number(byId("cm-entry").value);

    if (!game || !conditions || !entry) return alert("Fill all fields");

    const { data: match, error } = await sb
      .from("matches")
      .insert({
        creator_wallet: wallet,
        game,
        conditions,
        entry_fee: entry,
        status: "open",
      })
      .select("id")
      .single();

    if (error) return alert(error.message);

    await sb.from("match_participants").insert({
      match_id: match.id,
      wallet_address: wallet,
    });

    renderOpenMatches();
    loadMyOpenMatch();
  });

  /* ============================================================
     Matches List + Join
  ============================================================ */
  async function renderOpenMatches() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const list = byId("matches-list");

    const { data: matches } = await sb
      .from("matches")
      .select("*")
      .eq("status", "open");

    const { data: parts } = wallet
      ? await sb.from("match_participants").select("match_id").eq("wallet_address", wallet)
      : { data: [] };

    const joined = new Set((parts || []).map((p) => p.match_id));

    list.innerHTML = "";
    (matches || []).forEach((m) => {
      list.innerHTML += `
        <div class="card-2 p-4">
          <b>${m.game}</b><br/>
          ${m.conditions}<br/>
          ${m.entry_fee} USDC<br/>
          <button class="btn" data-join-id="${m.id}" ${joined.has(m.id) ? "disabled" : ""}>
            ${joined.has(m.id) ? "JOINED" : "JOIN"}
          </button>
        </div>`;
    });
  }

  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-join-id]");
    if (!btn || btn.disabled) return;

    const sb = await getSupabase();
    await sb.from("match_participants").insert({
      match_id: btn.dataset.joinId,
      wallet_address: getWallet(),
    });

    renderOpenMatches();
    loadMyOpenMatch();
  });

  /* ============================================================
     My Match
  ============================================================ */
  const myMatchBlock = byId("my-match-block");
  const myMatchDetails = byId("my-match-details");

  function getCurrentMatchId() {
    const t = myMatchDetails.textContent;
    return t.split("\n").find(l => l.startsWith("Match ID:"))?.replace("Match ID:", "").trim();
  }

  async function loadMyOpenMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return;

    const { data: parts } = await sb
      .from("match_participants")
      .select("match_id")
      .eq("wallet_address", wallet);

    if (!parts?.length) return myMatchBlock.classList.add("hidden");

    const { data } = await sb
      .from("matches")
      .select("*")
      .in("id", parts.map(p => p.match_id))
      .limit(1);

    if (!data?.length) return;

    const m = data[0];
    myMatchBlock.classList.remove("hidden");
    myMatchDetails.textContent =
      `Game: ${m.game}\nConditions: ${m.conditions}\nEntry: ${m.entry_fee} USDC\nStatus: ${m.status}\nMatch ID: ${m.id}`;
  }

  /* ============================================================
     Chat
  ============================================================ */
  const chatBox = byId("chat-messages");
  byId("chat-send")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const msg = byId("chat-text").value.trim();
    const matchId = getCurrentMatchId();
    if (!msg || !matchId) return;

    await sb.from("match_messages").insert({
      match_id: matchId,
      sender_wallet: getWallet(),
      message: msg,
    });

    byId("chat-text").value = "";
    loadChat();
  });

  async function loadChat() {
    const sb = await getSupabase();
    const matchId = getCurrentMatchId();
    if (!matchId) return;

    const { data } = await sb
      .from("match_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at");

    chatBox.innerHTML = "";
    (data || []).forEach(m => {
      chatBox.innerHTML += `<div>${m.sender_wallet.slice(0,6)}…: ${m.message}</div>`;
    });
  }

  /* ============================================================
     Proof Upload
  ============================================================ */
  byId("proof-upload")?.addEventListener("click", async () => {
    const sb = await getSupabase();
    const file = byId("proof-file").files[0];
    const matchId = getCurrentMatchId();
    const wallet = getWallet();

    if (!file || !matchId) return alert("Missing file or match");

    const path = `${matchId}/${wallet}.${file.name.split(".").pop()}`;
    await sb.storage.from("match-proofs").upload(path, file, { upsert: true });

    const url = sb.storage.from("match-proofs").getPublicUrl(path).data.publicUrl;

    await sb.from("match_proofs").upsert({
      match_id: matchId,
      wallet_address: wallet,
      image_url: url,
    });

    alert("Proof uploaded");
  });
/* ============================================================
   Match Result Confirmation (WON / LOST / DISPUTE)
============================================================ */
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-result]");
  if (!btn) return;

  const result = btn.dataset.result; // won | lost | dispute
  const wallet = getWallet();
  const matchId = getCurrentMatchId();
  if (!wallet || !matchId) return alert("No active match");

  const sb = await getSupabase();

  // 1) Save my result
  const { error } = await sb
    .from("match_participants")
    .update({
      result,
      confirmed: true
    })
    .eq("match_id", matchId)
    .eq("wallet_address", wallet);

  if (error) {
    console.error(error);
    return alert("Failed to save result");
  }

  // 2) Check both players
  const { data: parts } = await sb
    .from("match_participants")
    .select("result, confirmed")
    .eq("match_id", matchId);

  if (!parts || parts.length < 2) {
    alert("Result saved. Waiting for opponent.");
    return;
  }

  const results = parts.map(p => p.result);

  // 3) Decide match status
  let newStatus = "locked";

  if (results.includes("dispute")) {
    newStatus = "disputed";
  } else if (results.includes("won") && results.includes("lost")) {
    newStatus = "finished";
  }

  await sb
    .from("matches")
    .update({ status: newStatus })
    .eq("id", matchId);

  alert(`Match status: ${newStatus.toUpperCase()}`);
  loadMyOpenMatch();
});

})();
