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
     Wallet (Reown AppKit)
  ============================================================ */
  const walletBtn = byId("walletBtn");
  let walletConnected = false;

  function shortAddr(a) {
    return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
  }

  function setWalletUI(address, chainId) {
    const addr = address ? address.toLowerCase() : "";
    walletConnected = !!addr;
    window.connectedWalletAddress = addr;
    window.connectedChainId = chainId ?? null;
    if (walletBtn) walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
  }

  walletBtn?.addEventListener("click", () => {
    window.ChainEsportWallet?.open?.();
  });

  window.addEventListener("chainesport:wallet", (ev) => {
    const { address, chainId } = ev.detail || {};
    setWalletUI(address, chainId);
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
  let tries = 0;
  const syncInt = setInterval(() => {
    syncWallet();
    if (window.connectedWalletAddress || ++tries > 20) clearInterval(syncInt);
  }, 250);

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
    if (!wallet) return createMatchBlock?.classList.add("hidden");

    const sb = await getSupabase();
    const { data } = await sb.from("players").select("wallet_address").eq("wallet_address", wallet).maybeSingle();
    data ? createMatchBlock?.classList.remove("hidden") : createMatchBlock?.classList.add("hidden");
  }

  playerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first");

    const f = new FormData(playerForm);
    const nickname = f.get("nickname");
    const email = f.get("email");
    if (!nickname || !email || !byId("agreePlayer")?.checked) return alert("Fill form & accept rules");

    const sb = await getSupabase();
    const { error } = await sb.from("players").upsert({ wallet_address: wallet, nickname, email });
    if (error) return alert(error.message);

    alert("Registered");
    unlockTournamentsIfReady();
  });

  /* ============================================================
     Matches (list + join)
  ============================================================ */
  async function renderOpenMatches() {
    const sb = await getSupabase();
    const wallet = getWallet();
    const list = byId("matches-list");
    if (!list) return;

    const { data: matches } = await sb.from("matches").select("*").eq("status", "open").order("created_at", { ascending: false });
    const { data: parts } = wallet ? await sb.from("match_participants").select("match_id").eq("wallet_address", wallet) : { data: [] };
    const joined = new Set((parts || []).map(p => p.match_id));

    list.innerHTML = "";
    (matches || []).forEach((m, i) => {
      list.innerHTML += `
        <div class="card-2 p-4">
          <b>${i + 1}. ${m.game}</b><br/>
          ${m.conditions}<br/>
          Entry: ${m.entry_fee} USDC<br/>
          <button class="btn" data-join-id="${m.id}" ${joined.has(m.id) ? "disabled" : ""}>
            ${joined.has(m.id) ? "JOINED" : "JOIN"}
          </button>
        </div>`;
    });
  }

  async function joinMatch(id) {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet");

    const { error } = await sb.from("match_participants").insert({ match_id: id, wallet_address: wallet });
    if (error) return alert(error.message);
    loadMyOpenMatch();
    renderOpenMatches();
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-join-id]");
    if (b && !b.disabled) joinMatch(b.dataset.joinId);
  });

  /* ============================================================
     My Match panel
  ============================================================ */
  const myMatchBlock = byId("my-match-block");
  const myMatchDetails = byId("my-match-details");

  async function loadMyOpenMatch() {
    const sb = await getSupabase();
    const wallet = getWallet();
    if (!wallet) return;

    const { data: parts } = await sb.from("match_participants").select("match_id").eq("wallet_address", wallet);
    const ids = (parts || []).map(p => p.match_id);
    if (!ids.length) return myMatchBlock?.classList.add("hidden");

    const { data: matches } = await sb.from("matches").select("*").in("id", ids).in("status", ["open", "locked"]).limit(1);
    const m = matches?.[0];
    if (!m) return myMatchBlock?.classList.add("hidden");

    myMatchBlock.classList.remove("hidden");
    myMatchDetails.textContent =
      `Game: ${m.game}\nConditions: ${m.conditions}\nEntry: ${m.entry_fee} USDC\nStatus: ${m.status}\nMatch ID: ${m.id}`;
  }

  /* ============================================================
     Chat (PERMANENT)
  ============================================================ */
  const chatSend = byId("chat-send");
  const chatText = byId("chat-text");
  const chatBox = byId("chat-messages");

  function currentMatchId() {
    const t = myMatchDetails?.textContent || "";
    const l = t.split("\n").find(x => x.startsWith("Match ID:"));
    return l ? l.replace("Match ID:", "").trim() : "";
  }

  async function loadChat() {
    const id = currentMatchId();
    if (!id) return;
    const sb = await getSupabase();
    const { data } = await sb.from("match_messages").select("*").eq("match_id", id).order("created_at");
    chatBox.innerHTML = "";
    (data || []).forEach(m => {
      chatBox.innerHTML += `<div>${m.sender_wallet.slice(0,6)}…: ${m.message}</div>`;
    });
  }

  chatSend?.addEventListener("click", async () => {
    const msg = chatText.value.trim();
    const id = currentMatchId();
    if (!msg || !id) return;
    const sb = await getSupabase();
    await sb.from("match_messages").insert({ match_id: id, sender_wallet: getWallet(), message: msg });
    chatText.value = "";
    loadChat();
  });

})();
