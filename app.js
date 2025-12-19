(function () {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const byId = (id) => document.getElementById(id);

  // ----------------------------
  // Tabs
  // ----------------------------
  const panels = ["news", "tournaments", "whitepaper", "roadmap", "team", "contacts", "node-login"];

  function showTab(tab) {
    panels.forEach((t) => byId("panel-" + t)?.classList.add("hidden"));
    byId("panel-" + tab)?.classList.remove("hidden");

    $$(".tab-btn").forEach((b) => b.classList.remove("is-active"));
    $(`.tab-btn[data-tab="${tab}"]`)?.classList.add("is-active");

    // sidebars
    byId("side-team")?.classList.add("hidden");
    byId("side-whitepaper")?.classList.add("hidden");
    byId("side-news")?.classList.add("hidden");
    byId("side-roadmap")?.classList.add("hidden");
    byId("side-tournaments")?.classList.add("hidden");

    if (tab === "team") byId("side-team")?.classList.remove("hidden");
    if (tab === "whitepaper") byId("side-whitepaper")?.classList.remove("hidden");
    if (tab === "news") byId("side-news")?.classList.remove("hidden");
    if (tab === "roadmap") byId("side-roadmap")?.classList.remove("hidden");

    if (tab === "tournaments") {
      const hasWallet = !!(window.connectedWalletAddress || "").trim();
      if (hasWallet) byId("side-tournaments")?.classList.remove("hidden");
      setTimeout(renderOpenMatches, 300);
    }

    location.hash = tab;
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));

  // ----------------------------
  // Wallet connect
  // ----------------------------
  let walletConnected = false;
  const walletBtn = byId("walletBtn");
  const walletModal = byId("walletModal");

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? String(address) : "";
    walletConnected = !!addr;
    window.connectedWalletAddress = addr.toLowerCase();

    if (walletBtn) {
      walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
    }

    document.querySelectorAll(".wallet-address-field").forEach((el) => (el.value = addr));
    document.querySelectorAll(".wallet-chainid-field").forEach((el) => (el.value = String(chainId ?? "")));

    const walletDisplay = byId("playerWalletDisplay");
    if (walletDisplay) walletDisplay.value = addr || "—";

    // 🔑 show Player Registration immediately if on tournaments
    if ((location.hash || "#news") === "#tournaments") {
      byId("side-tournaments")?.classList.toggle("hidden", !walletConnected);
    }

    walletModal?.classList.add("hidden");
  }

  walletBtn?.addEventListener("click", () => {
    window.ChainEsportWallet?.open?.();
  });

  window.addEventListener("chainesport:wallet", (ev) => {
    setWalletUI(ev?.detail?.address, ev?.detail?.chainId);
    if (ev?.detail?.address) renderOpenMatches();
  });

  setWalletUI(
    window.ChainEsportWallet?.getAddress?.() || null,
    window.ChainEsportWallet?.getChainId?.() || null
  );

  // ----------------------------
  // Supabase (read-only for matches)
  // ----------------------------
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";
  let sbClient = null;

  async function getSupabase() {
    if (sbClient) return sbClient;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    await new Promise((r) => (s.onload = r));
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sbClient;
  }

  function getWallet() {
    return (window.connectedWalletAddress || "").toLowerCase();
  }

  async function isRegistered(wallet) {
    return !!wallet; // KYC-controlled later
  }

  // ----------------------------
  // Tournaments
  // ----------------------------
  let currentMatchId = null;

  function show(el, yes) {
    el?.classList.toggle("hidden", !yes);
  }

  async function renderOpenMatches() {
    const sb = await getSupabase();
    if (!sb) return;

    const list = byId("matches-list");
    if (!list) return;

    const wallet = getWallet();
    const registered = wallet && (await isRegistered(wallet));
    show(byId("create-match-block"), registered);

    const { data } = await sb
      .from("matches")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (!data || !data.length) {
      list.innerHTML = `<div class="text-sm text-muted">No open matches yet.</div>`;
      return;
    }

    list.innerHTML = "";
    data.forEach((m, i) => {
      const card = document.createElement("article");
      card.className = "card-2 p-4";
      card.innerHTML = `
        <div class="flex justify-between">
          <div>
            <h3 class="font-bold">Match #${i + 1} — ${m.game}</h3>
            <p>Entry: ${m.entry_fee} USDC</p>
          </div>
          <button class="btn" data-join-id="${m.id}">JOIN</button>
        </div>`;
      list.appendChild(card);
    });
  }

  document.addEventListener("click", (e) => {
    const j = e.target.closest("[data-join-id]");
    if (j) joinMatch(j.dataset.joinId);
  });

  async function joinMatch(id) {
    alert("Join match (demo)");
  }

})();
