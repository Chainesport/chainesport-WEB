// assets/js/wallet-connect.js
// Real wallet connect for ChainEsport (static HTML)

const BSC_MAINNET = 56;
const BSC_TESTNET = 97;

let web3Modal;
let externalProvider;
let provider;
let signer;

function shortAddr(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

function setHiddenWalletFields(address, chainId) {
  document.querySelectorAll(".wallet-address-field").forEach(i => (i.value = address || ""));
  document.querySelectorAll(".wallet-chainid-field").forEach(i => (i.value = chainId ? String(chainId) : ""));
}

function saveSession(address, chainId) {
  localStorage.setItem("ce_wallet_address", address || "");
  localStorage.setItem("ce_wallet_chainid", chainId ? String(chainId) : "");
}

function closeWalletModalIfOpen() {
  const m = document.getElementById("walletModal");
  if (m) m.classList.add("hidden");
}

function updateTopButtonLabel(address) {
  const btn = document.getElementById("walletBtn"); // keep compatibility with your current app.js
  if (btn) btn.textContent = address ? `Connected: ${shortAddr(address)}` : "Connect Wallet";
}

async function initWeb3Modal() {
  web3Modal = new window.Web3Modal.default({
    cacheProvider: true,
    providerOptions: {
      walletconnect: {
        package: window.WalletConnectProvider.default,
        options: {
          rpc: {
            [BSC_MAINNET]: "https://bsc-dataseed.binance.org/",
            [BSC_TESTNET]: "https://data-seed-prebsc-1-s1.binance.org:8545/"
          }
        }
      }
    }
  });
}

async function connectViaModal(connectorName) {
  if (connectorName === "injected") {
    externalProvider = await web3Modal.connectTo("injected");
  } else {
    externalProvider = await web3Modal.connectTo("walletconnect");
  }

  provider = new ethers.providers.Web3Provider(externalProvider);
  signer = provider.getSigner();

  const address = await signer.getAddress();
  const network = await provider.getNetwork();

  setHiddenWalletFields(address, network.chainId);
  saveSession(address, network.chainId);
  updateTopButtonLabel(address);
  closeWalletModalIfOpen();

  externalProvider.on("accountsChanged", (accounts) => {
    const a = accounts?.[0] || "";
    setHiddenWalletFields(a, network.chainId);
    saveSession(a, network.chainId);
    updateTopButtonLabel(a);
  });

  externalProvider.on("chainChanged", async () => {
    const n = await provider.getNetwork();
    const savedAddr = localStorage.getItem("ce_wallet_address") || "";
    setHiddenWalletFields(savedAddr, n.chainId);
    saveSession(savedAddr, n.chainId);
  });
}

(function boot() {
  initWeb3Modal();

  // Restore values for forms after refresh
  const savedAddr = localStorage.getItem("ce_wallet_address") || "";
  const savedChain = localStorage.getItem("ce_wallet_chainid") || "";
  if (savedAddr) {
    setHiddenWalletFields(savedAddr, savedChain);
    updateTopButtonLabel(savedAddr);
  }

  // Bind modal buttons
  document.querySelectorAll("[data-wallet]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const which = btn.getAttribute("data-wallet");
      await connectViaModal(which);
    });
  });
})();

