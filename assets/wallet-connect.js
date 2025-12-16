(() => {
  // ------- DOM helpers -------
  const $ = (sel) => document.querySelector(sel);

  // Your existing elements
  const walletBtn = $("#walletBtn") || $("#nl-connect");
  const walletModal = $("#walletModal");
  const walletClose = $("#walletClose");
  const modalButtons = walletModal?.querySelector(".grid");

  // Optional: show connected address somewhere (add <span id="walletAddress"></span> if you want)
  const walletAddressEl = $("#walletAddress");
  const hiddenAddrFields = () => Array.from(document.querySelectorAll(".wallet-address-field"));
  const hiddenChainFields = () => Array.from(document.querySelectorAll(".wallet-chainid-field"));

  // ------- Provider discovery (EIP-6963) -------
  // Many wallets now announce themselves via these events
  const discovered = new Map(); // rdns -> { info, provider }

  function startEIP6963Discovery() {
    window.addEventListener("eip6963:announceProvider", (event) => {
      const detail = event.detail;
      if (!detail?.info?.rdns || !detail?.provider) return;
      discovered.set(detail.info.rdns, detail);
      renderWalletList(); // update modal list live
    });

    // Ask wallets to announce
    window.dispatchEvent(new Event("eip6963:requestProvider"));
  }

  // Fallback: old-school injected provider
  function getFallbackInjected() {
    const eth = window.ethereum;
    if (!eth) return [];
    // If multiple injected providers exist
    if (Array.isArray(eth.providers) && eth.providers.length) {
      return eth.providers.map((p, i) => ({
        info: { name: p?.isMetaMask ? "MetaMask" : `Injected ${i + 1}`, rdns: `injected.${i + 1}` },
        provider: p
      }));
    }
    return [{ info: { name: "Injected Wallet", rdns: "injected" }, provider: eth }];
  }

  function getDetectedProviders() {
    const list = Array.from(discovered.values());
    if (list.length) return list;
    return getFallbackInjected();
  }

  // ------- Web3Modal / WalletConnect setup -------
  let web3Modal;
  function initWeb3Modal() {
    // Requires these scripts already in index.html:
    // ethers, web3modal, walletconnect provider
    if (!window.Web3Modal || !window.WalletConnectProvider) return;

    web3Modal = new window.Web3Modal.default({
      cacheProvider: false,
      providerOptions: {
        walletconnect: {
          package: window.WalletConnectProvider.default,
          options: {
            // You can set RPCs for chains you use (example placeholders)
            // rpc: { 56: "https://bsc-dataseed.binance.org/" }
          }
        }
      }
    });
  }

  // ------- UI -------
  function openModal() {
    if (!walletModal) return;
    walletModal.classList.remove("hidden");
    walletModal.classList.add("flex");
    renderWalletList();
  }

  function closeModal() {
    if (!walletModal) return;
    walletModal.classList.add("hidden");
    walletModal.classList.remove("flex");
  }

  function renderWalletList() {
    if (!modalButtons) return;

    const detected = getDetectedProviders();

    // Clear current buttons
    modalButtons.innerHTML = "";

    // 1) Detected injected wallets (desktop extensions)
    if (detected.length) {
      detected.forEach((item) => {
        const btn = document.createElement("button");
        btn.className = "btn";
        btn.type = "button";
        btn.textContent = item.info?.name || "Browser Wallet";
        btn.addEventListener("click", async () => {
          try {
            await connectInjected(item.provider);
            closeModal();
          } catch (e) {
            console.error(e);
            alert(e?.message || "Failed to connect wallet.");
          }
        });
        modalButtons.appendChild(btn);
      });
    }

    // 2) Phone connection via WalletConnect (QR)
    if (web3Modal) {
      const wcBtn = document.createElement("button");
      wcBtn.className = "btn";
      wcBtn.type = "button";
      wcBtn.textContent = "Connect with phone (WalletConnect)";
      wcBtn.addEventListener("click", async () => {
        try {
          await connectWalletConnect();
          closeModal();
        } catch (e) {
          console.error(e);
          alert(e?.message || "WalletConnect failed.");
        }
      });
      modalButtons.appendChild(wcBtn);
    }

    // 3) If nothing detected and Web3Modal not ready: show install hint
    if (!detected.length && !web3Modal) {
      const hint = document.createElement("div");
      hint.className = "text-sm opacity-80 col-span-2 mt-2";
      hint.innerHTML =
        `No wallet detected. Install a browser wallet (MetaMask / Rabby / Coinbase Wallet), or use a mobile wallet with WalletConnect.`;
      modalButtons.appendChild(hint);
    }
  }

  // ------- Connect flows -------
  async function connectInjected(provider) {
    if (!provider?.request) throw new Error("No injected provider found.");

    // Request accounts
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const address = accounts?.[0];
    if (!address) throw new Error("No account returned.");

    // Chain id
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);

    onConnected({ address, chainId });
    return { address, chainId, provider };
  }

  async function connectWalletConnect() {
    if (!web3Modal) throw new Error("WalletConnect not available.");

    const extProvider = await web3Modal.connect(); // opens QR modal
    const ethersProvider = new window.ethers.providers.Web3Provider(extProvider);

    const signer = ethersProvider.getSigner();
    const address = await signer.getAddress();
    const network = await ethersProvider.getNetwork();

    onConnected({ address, chainId: network.chainId });
    return { address, chainId: network.chainId, provider: extProvider };
  }

  function onConnected({ address, chainId }) {
    // Update UI
    if (walletBtn) walletBtn.textContent = `${address.slice(0, 6)}…${address.slice(-4)}`;
    if (walletAddressEl) walletAddressEl.textContent = address;

    // Fill hidden form fields
    hiddenAddrFields().forEach((el) => (el.value = address));
    hiddenChainFields().forEach((el) => (el.value = String(chainId)));

    // (Optional) open your post-connect modal if you want:
    const pcm = $("#postConnectModal");
    if (pcm) {
      pcm.classList.remove("hidden");
    }
  }

  // ------- Main click handler -------
  async function handleConnectClick() {
    initWeb3Modal(); // ensure Web3Modal is ready if libs loaded
    startEIP6963Discovery();

    const detected = getDetectedProviders();

    // If exactly ONE injected wallet detected → auto-connect it
    if (detected.length === 1) {
      try {
        await connectInjected(detected[0].provider);
        return;
      } catch (e) {
        console.warn("Auto-connect failed, opening modal.", e);
        openModal();
        return;
      }
    }

    // Otherwise show modal (multiple wallets or none)
    openModal();
  }

  // ------- Wire events -------
  if (walletBtn) walletBtn.addEventListener("click", handleConnectClick);
  if (walletClose) walletClose.addEventListener("click", closeModal);
  if (walletModal) walletModal.addEventListener("click", (e) => {
    // click outside card closes
    if (e.target === walletModal) closeModal();
  });

  // Start discovery early so list is ready by the time user clicks
  startEIP6963Discovery();
  initWeb3Modal();
})();
