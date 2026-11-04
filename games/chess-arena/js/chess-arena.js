(function () {
  'use strict';

  const NETWORK_ADDRESS = '0x7f1cB4fce7cB3b6C612c4A7Dd123D3865640dC1B';
  const FIT_ADDRESS = '0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa';
  const BSC_CHAIN_ID = 56;
  const MIN_FIT = ethers.utils.parseUnits('1', 18);
  const NETWORK_ABI = ['function Owner_Exists(address owner) view returns (bool)'];
  const FIT_ABI = ['function balanceOf(address account) view returns (uint256)'];

  const $ = id => document.getElementById(id);
  const connectBtn = $('connectBtn');
  let activeProvider;

  function status(message, isError) {
    $('status').textContent = message;
    $('status').style.color = isError ? '#ff9999' : '';
  }
  function setCheck(kind, ok, detail) {
    $(kind + 'Status').textContent = detail;
    $(kind + 'Mark').textContent = ok ? '✓' : '✕';
    $(kind + 'Mark').style.color = ok ? '#00c896' : '#ff7777';
  }
  function resetChecks() {
    setCheck('owner', false, 'Waiting for wallet connection');
    setCheck('fit', false, 'At least 1 FIT required');
    $('eligiblePanel').hidden = true;
    $('deniedPanel').hidden = true;
  }

  async function getWalletProvider() {
    if (typeof window.fiSelectWalletProvider === 'function') {
      return await window.fiSelectWalletProvider();
    }
    if (window.ethereum) {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      return window.ethereum;
    }
    throw new Error('No compatible wallet found. Please open the page in a wallet browser or install a wallet.');
  }

  async function connectAndCheck() {
    connectBtn.disabled = true;
    connectBtn.textContent = 'Checking wallet…';
    resetChecks();
    try {
      activeProvider = await getWalletProvider();
      const provider = new ethers.providers.Web3Provider(activeProvider, 'any');
      let network = await provider.getNetwork();
      if (network.chainId !== BSC_CHAIN_ID) {
        try {
          await activeProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
        } catch (switchError) {
          if (switchError.code === 4902) throw new Error('Please add BNB Smart Chain to your wallet, then try again.');
          throw new Error('Switch your wallet to BNB Smart Chain (chain ID 56).');
        }
      }
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const readProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const networkContract = new ethers.Contract(NETWORK_ADDRESS, NETWORK_ABI, readProvider);
      const fitContract = new ethers.Contract(FIT_ADDRESS, FIT_ABI, readProvider);

      status('Wallet connected: ' + address.slice(0, 6) + '…' + address.slice(-4) + '. Verifying eligibility…');
      const [isOwner, balance] = await Promise.all([
        networkContract.Owner_Exists(address),
        fitContract.balanceOf(address)
      ]);
      const formatted = ethers.utils.formatUnits(balance, 18);
      const enoughFit = balance.gte(MIN_FIT);

      setCheck('owner', isOwner, isOwner ? 'Address is registered in Fly Infinity Network' : 'This address is not registered in the Network contract');
      setCheck('fit', enoughFit, formatted + ' FIT · Minimum required: 1 FIT');

      if (isOwner && enoughFit) {
        $('eligiblePanel').hidden = false;
        status('Both on-chain entry requirements passed.');
      } else {
        $('deniedPanel').textContent = !isOwner
          ? 'Access denied: this wallet address is not registered in the Fly Infinity Network contract.'
          : 'Access denied: this wallet must hold at least 1 FIT.';
        $('deniedPanel').hidden = false;
        status('Wallet connected, but entry requirements were not met.', true);
      }
    } catch (error) {
      console.error('[Chess Arena]', error);
      status(error && error.message ? error.message : 'Wallet verification failed.', true);
    } finally {
      connectBtn.disabled = false;
      connectBtn.textContent = 'Reconnect / Check Again';
    }
  }

  connectBtn.addEventListener('click', connectAndCheck);
  if (window.ethereum && window.ethereum.on) {
    window.ethereum.on('accountsChanged', resetChecks);
    window.ethereum.on('chainChanged', resetChecks);
  }
  resetChecks();
})();