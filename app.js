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

    // sidebars visibility
    byId("side-team")?.classList.add("hidden");
    byId("side-whitepaper")?.classList.add("hidden");
    byId("side-news")?.classList.add("hidden");
    byId("side-roadmap")?.classList.add("hidden");
    byId("side-tournaments")?.classList.add("hidden");

    if (tab === "team") byId("side-team")?.classList.remove("hidden");
    if (tab === "whitepaper") byId("side-whitepaper")?.classList.remove("hidden");
    if (tab === "news") byId("side-news")?.classList.remove("hidden");
    if (tab === "roadmap") byId("side-roadmap")?.classList.remove("hidden");
    if (tab === "tournaments") byId("side-tournaments")?.classList.remove("hidden");

    location.hash = tab;

    // Load matches when tournaments opens
    if (tab === "tournaments") {
      setTimeout(renderOpenMatches, 400);
    }
  }

  $$(".tab-btn").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
  window.addEventListener("hashchange", () => showTab((location.hash || "#news").slice(1)));
  showTab((location.hash || "#news").slice(1));
// ----------------------------
// Wallet connect (Reown AppKit)
// ----------------------------
let walletConnected = false;

const walletBtn = byId("walletBtn");
const walletModal = byId("walletModal"); // fallback only (should stay hidden)
const walletClose = byId("walletClose");

function shortAddr(a) {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function setWalletUI(address, chainId) {
  const addr = address ? String(address) : "";
  const cid = chainId ?? "";

  walletConnected = !!addr;
  window.connectedWalletAddress = addr ? addr.toLowerCase() : "";

  // ✅ Update top button text
  if (walletBtn) {
    walletBtn.textContent = addr ? `Connected: ${shortAddr(addr)}` : "Connect Wallet";
  }

  // ✅ Fill hidden fields in all forms
  document.querySelectorAll(".wallet-address-field").forEach((el) => (el.value = addr));
  document.querySelectorAll(".wallet-chainid-field").forEach((el) => (el.value = String(cid)));

  // ✅ keep old modal hidden
  walletModal?.classList.add("hidden");
}

// keep old modal hidden always
walletModal?.classList.add("hidden");

// clicking button opens Reown
walletBtn?.addEventListener("click", () => {
  if (window.ChainEsportWallet?.open) {
    window.ChainEsportWallet.open();
  } else {
    console.error("ChainEsportWallet is missing. wallet.bundle.js not loaded?");
    alert("Wallet module not loaded. Please refresh and try again.");
  }
});

// old modal close (harmless)
walletClose?.addEventListener("click", () => walletModal?.classList.add("hidden"));
walletModal?.addEventListener("click", (e) => {
  if (e.target === walletModal) walletModal.classList.add("hidden");
});

// ✅ Receive wallet updates from wallet.bundle.js
window.addEventListener("chainesport:wallet", (ev) => {
  const address = ev?.detail?.address || null;
  const chainId = ev?.detail?.chainId ?? null;

  // 🔑 THIS WAS MISSING
  window.connectedWalletAddress = address ? address.toLowerCase() : "";

  setWalletUI(address, chainId);

  if (address) {
    renderOpenMatches?.();
  }
});

// ✅ Initial UI sync (handles restored sessions)
setWalletUI(
  window.ChainEsportWallet?.getAddress?.() || null,
  window.ChainEsportWallet?.getChainId?.() || null
);


// Receive wallet updates from wallet.bundle.js (wallet.src.js emits this)
window.addEventListener("chainesport:wallet", (ev) => {
  const address = ev?.detail?.address || null;
  const chainId = ev?.detail?.chainId ?? null;

  walletConnected = !!address;
  window.connectedWalletAddress = address ? String(address) : "";

  // If connected, refresh tournaments list (so Create Match shows)
  if (walletConnected) {
    renderOpenMatches();
  }
});


  // ----------------------------
  // Post-connect choice modal (optional, keeps your previous behavior)
  // ----------------------------
  const postConnectModal = byId("postConnectModal");
  const choosePlayer = byId("choosePlayer");
  const chooseNode = byId("chooseNode");
  const postConnectClose = byId("postConnectClose");

  postConnectClose?.addEventListener("click", () => postConnectModal?.classList.add("hidden"));
  choosePlayer?.addEventListener("click", () => {
    postConnectModal?.classList.add("hidden");
    showTab("tournaments");
  });
  chooseNode?.addEventListener("click", () => {
    postConnectModal?.classList.add("hidden");
    showTab("node-login");
    byId("nl-connect")?.click();
  });

  // ----------------------------
  // Node Dashboard demo (kept)
  // ----------------------------
  const nlGuest = byId("nl-guest"),
    nlAuthed = byId("nl-authed"),
    nlConnect = byId("nl-connect"),
    nlAddress = byId("nl-address");
  const nlNodesOwned = byId("nl-nodes-owned"),
    nlClaimable = byId("nl-claimable"),
    nlMonthly = byId("nl-monthly"),
    nlAlltime = byId("nl-alltime");
  const nlNodeRows = byId("nl-node-rows"),
    nlPayoutRows = byId("nl-payout-rows"),
    nlClaimBtn = byId("nl-claim-btn");

  const fmt6 = (v) => (Number(v || 0) / 1e6).toFixed(2);

  async function getInvestorDataMock(addr) {
    return {
      address: addr,
      nodesOwned: 1,
      claimableUSDC: 4916000000,
      monthUSDC: 2458000000,
      nodes: [{ id: 101, active: true, uptimePct: 99.2 }],
      payouts: [
        { period: "2026-03", amount: 3000000000, tx: "0xaaaa..." },
        { period: "2026-04", amount: 3500000000, tx: "0xbbbb..." },
      ],
      allTimeOverrideUSDC: 6500000000,
    };
  }

  async function nlShowAuthed(addr) {
    nlGuest?.classList.add("hidden");
    nlAuthed?.classList.remove("hidden");
    if (nlAddress) nlAddress.textContent = addr;

    const d = await getInvestorDataMock(addr);

    if (nlNodesOwned) nlNodesOwned.textContent = String(d.nodesOwned || 0);
    if (nlClaimable) nlClaimable.textContent = fmt6(d.claimableUSDC);
    if (nlMonthly) nlMonthly.textContent = fmt6(d.monthUSDC);
    if (nlAlltime) nlAlltime.textContent = `All-time: ${fmt6(d.allTimeOverrideUSDC)} USDC`;

    if (nlNodeRows) {
      nlNodeRows.innerHTML = "";
      (d.nodes || []).forEach((n) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="py-2 pr-4">${n.id}</td>
                        <td class="py-2 pr-4">Active</td>
                        <td class="py-2 pr-4">${Number(n.uptimePct || 0).toFixed(1)}%</td>`;
        nlNodeRows.appendChild(tr);
      });
    }

    if (nlPayoutRows) {
      nlPayoutRows.innerHTML = "";
      (d.payouts || []).forEach((p) => {
        const tx = p.tx
          ? `<a class="link" target="_blank" rel="noopener" href="https://bscscan.com/tx/${p.tx}">View</a>`
          : "—";
        const tr = document.createElement("tr");
        tr.innerHTML = `<td class="py-2 pr-4">${p.period}</td>
                        <td class="py-2 pr-4">${fmt6(p.amount)}</td>
                        <td class="py-2 pr-4">${tx}</td>`;
        nlPayoutRows.appendChild(tr);
      });
    }

    if (nlClaimBtn) {
      nlClaimBtn.removeAttribute("disabled");
      nlClaimBtn.onclick = () => alert("Demo: this would call claim() on your BNB smart contract.");
    }
  }

  nlConnect?.addEventListener("click", async () => {
    const demo = "0xDEMO000000000000000000000000000000000001";
    alert("Wallet connected (demo).");
    walletConnected = true;
    window.connectedWalletAddress = demo;
    await nlShowAuthed(demo);
  });

  // ============================================================
  // SUPABASE WEB (publishable key)
  // ============================================================
  const SUPABASE_URL = "https://yigxahmfwuzwueufnybv.supabase.co";
  const SUPABASE_KEY = "sb_publishable_G_R1HahzXHLSPjZbxOxXAg_annYzsxX";

  function loadSupabaseJs() {
    return new Promise((resolve) => {
      if (window.supabase?.createClient) return resolve(true);
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      s.onload = () => resolve(true);
      document.head.appendChild(s);
    });
  }

  let sbClient = null;

  async function getSupabase() {
    if (sbClient) return sbClient;
    await loadSupabaseJs();
    if (!window.supabase?.createClient) return null;
    sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return sbClient;
  }

  function getWallet() {
    return (window.connectedWalletAddress || "").toLowerCase();
  }

  async function isRegistered(wallet) {
    // For now: if wallet is connected, treat as "registered"
    // Later you can enforce real registration in table public.users
    return !!wallet;
  }

  // ============================================================
  // TOURNAMENTS: Load Matches (REAL), JOIN, CREATE, CHAT, PROOF
  // ============================================================
  let currentMatchId = null;

  function show(el, yes) {
    if (!el) return;
    el.classList.toggle("hidden", !yes);
  }
  function setText(el, text) {
    if (!el) return;
    el.textContent = text;
  }

  async function renderOpenMatches() {
    const sb = await getSupabase();
    if (!sb) return;

    const list = byId("matches-list");
    if (!list) return;

    // show create match UI if wallet connected
    show(byId("create-match-block"), walletConnected);

    const { data, error } = await sb
      .from("matches")
      .select("*")
      .eq("status", "open")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      list.innerHTML = `<div class="text-sm text-muted">Error loading matches: ${error.message}</div>`;
      return;
    }

    const matches = data || [];
    if (matches.length === 0) {
      list.innerHTML = `<div class="text-sm text-muted">No open matches yet. Create one.</div>`;
      return;
    }

    list.innerHTML = "";
    matches.forEach((m, idx) => {
      const card = document.createElement("article");
      card.className = "card-2 p-4";

      card.innerHTML = `
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="font-bold"><span style="color:#FFD84D;">Match Nr.: ${idx + 1} — ${m.game}</span></h3>
            <p class="text-base text-[#C7D3E0]">Player wallet: ${(m.creator_wallet || "").slice(0, 8)}...</p>
            <p class="text-base text-[#C7D3E0]">Conditions: ${m.conditions}</p>
            <p class="text-base text-[#C7D3E0]">Entry Fee: ${m.entry_fee} USDC</p>
          </div>
          <button class="btn" data-join-id="${m.id}" type="button">JOIN</button>
        </div>
      `;
      list.appendChild(card);
    });
  }

  async function createMatch() {
    const sb = await getSupabase();
    if (!sb) return;

    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first.");

    const registered = await isRegistered(wallet);
    if (!registered) return alert("You must be registered as a player first.");

    const game = (byId("cm-game")?.value || "").trim();
    const conditions = (byId("cm-conditions")?.value || "").trim();
    const entry = Number(byId("cm-entry")?.value || 0);
    const date = (byId("cm-date")?.value || "").trim() || "12.04.2026";
    const time = (byId("cm-time")?.value || "").trim() || "TBC";

    if (!game || !conditions || !entry) {
      return alert("Fill Game, Conditions, and Entry Fee.");
    }

    setText(byId("cm-status"), "Creating match...");

    const { data, error } = await sb
      .from("matches")
      .insert({
        game,
        conditions: `${conditions} • Created Date: ${date} • Time: ${time}`,
        entry_fee: entry,
        creator_wallet: wallet,
        status: "open",
      })
      .select("*")
      .single();

    if (error) {
      console.error(error);
      setText(byId("cm-status"), "Error creating match.");
      return alert(error.message);
    }

    setText(byId("cm-status"), "Match created ✅");
    await renderOpenMatches();
    alert("Match created successfully!");
  }

  async function joinMatch(matchId) {
    const sb = await getSupabase();
    if (!sb) return;

    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first.");

    const registered = await isRegistered(wallet);
    if (!registered) return alert("You must be registered as a player first.");

    // Add participant
    const { error: insErr } = await sb.from("match_participants").insert({
      match_id: matchId,
      wallet_address: wallet,
      role: "opponent",
    });

    // If duplicate join, ignore
    if (insErr && !String(insErr.message || "").toLowerCase().includes("duplicate")) {
      console.error(insErr);
      return alert(insErr.message);
    }

    // Update match status
    const { error: upErr } = await sb.from("matches").update({ status: "joined" }).eq("id", matchId);
    if (upErr) {
      console.error(upErr);
      return alert(upErr.message);
    }

    currentMatchId = matchId;
    await openMyMatch(matchId);
    alert("You joined the match!");
  }

  async function openMyMatch(matchId) {
    const sb = await getSupabase();
    if (!sb) return;

    const { data: match, error } = await sb.from("matches").select("*").eq("id", matchId).single();
    if (error || !match) return alert("Match not found.");

    show(byId("my-match-block"), true);

    setText(
      byId("my-match-details"),
      `Game: ${match.game}
Conditions: ${match.conditions}
Entry Fee: ${match.entry_fee} USDC
Status: ${match.status}
Match ID: ${match.id}`
    );

    setText(byId("lock-status"), "");
    setText(byId("proof-status"), "");

    show(byId("chat-block"), false);
    show(byId("proof-block"), false);
    show(byId("confirm-result"), false);

    // clear chat box
    const chatBox = byId("chat-messages");
    if (chatBox) chatBox.innerHTML = "";
  }

  async function lockIn() {
    if (!currentMatchId) return alert("Join a match first.");

    const ok =
      byId("agree-match-1")?.checked &&
      byId("agree-match-2")?.checked &&
      byId("agree-match-3")?.checked;

    if (!ok) return alert("Please tick all disclaimers before locking in.");

    setText(byId("lock-status"), "Locked in ✅ Chat + Proof Upload unlocked.");

    show(byId("chat-block"), true);
    show(byId("proof-block"), true);

    await loadChat();
    if (!window.__chatTimer) {
      window.__chatTimer = setInterval(loadChat, 2500);
    }
  }

  async function loadChat() {
    const sb = await getSupabase();
    if (!sb || !currentMatchId) return;

    const { data, error } = await sb
      .from("match_messages")
      .select("*")
      .eq("match_id", currentMatchId)
      .order("created_at", { ascending: true });

    if (error) return;

    const box = byId("chat-messages");
    if (!box) return;

    box.innerHTML = "";
    (data || []).forEach((m) => {
      const div = document.createElement("div");
      div.style.padding = "6px 0";
      div.style.borderBottom = "1px solid rgba(255,255,255,.06)";
      div.textContent = `${(m.wallet_address || "").slice(0, 8)}: ${m.message}`;
      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  }

  async function sendChat() {
    const sb = await getSupabase();
    if (!sb || !currentMatchId) return;

    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first.");

    const msg = (byId("chat-text")?.value || "").trim();
    if (!msg) return;

    byId("chat-text").value = "";

    const { error } = await sb.from("match_messages").insert({
      match_id: currentMatchId,
      wallet_address: wallet,
      message: msg,
    });

    if (error) return alert(error.message);
    loadChat();
  }

  async function uploadProof() {
    const sb = await getSupabase();
    if (!sb || !currentMatchId) return;

    const wallet = getWallet();
    if (!wallet) return alert("Connect wallet first.");

    const fileInput = byId("proof-file");
    if (!fileInput?.files || !fileInput.files[0]) return alert("Choose an image first.");

    const file = fileInput.files[0];
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${currentMatchId}/${wallet}-${Date.now()}.${ext}`;

    setText(byId("proof-status"), "Uploading proof...");

    const { data: up, error: upErr } = await sb.storage.from("match-proofs").upload(path, file, { upsert: true });

    if (upErr) {
      console.error(upErr);
      setText(byId("proof-status"), "Upload failed.");
      return alert(upErr.message);
    }

    const { error: insErr } = await sb.from("match_proofs").insert({
      match_id: currentMatchId,
      wallet_address: wallet,
      file_path: up.path,
    });

    if (insErr) {
      console.error(insErr);
      return alert(insErr.message);
    }

    setText(byId("proof-status"), "Proof uploaded ✅ Confirm Result unlocked.");
    show(byId("confirm-result"), true);
  }

  async function confirmResult(result) {
    const sb = await getSupabase();
    if (!sb || !currentMatchId) return;

    if (result === "dispute") {
      await sb.from("matches").update({ status: "disputed" }).eq("id", currentMatchId);
      alert("Dispute opened.");
      return;
    }

    await sb.from("matches").update({ status: "awaiting_confirmation" }).eq("id", currentMatchId);
    alert(`Result submitted: ${String(result).toUpperCase()}`);
  }

  // ----------------------------
  // Event wiring
  // ----------------------------
  document.addEventListener("click", async (e) => {
    const joinBtn = e.target.closest("[data-join-id]");
    if (joinBtn) {
      const matchId = joinBtn.getAttribute("data-join-id");
      return joinMatch(matchId);
    }

    const resBtn = e.target.closest("[data-result]");
    if (resBtn) {
      return confirmResult(resBtn.getAttribute("data-result"));
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    byId("cm-create")?.addEventListener("click", createMatch);
    byId("lock-in-btn")?.addEventListener("click", lockIn);
    byId("chat-send")?.addEventListener("click", sendChat);
    byId("proof-upload")?.addEventListener("click", uploadProof);

    // If tournaments is default tab
    if ((location.hash || "#news") === "#tournaments") {
      renderOpenMatches();
    }
  });
})();
