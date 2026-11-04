(function () {
  'use strict';

  const FIT_ADDRESS = '0xBebe4ea7aA4037CeF5D0bc25a10f9dcA16120Dfa';
  const BSC_CHAIN_ID = 56;
  const MIN_FIT = ethers.utils.parseUnits('1', 18);
  const FIT_ABI = ['function balanceOf(address account) view returns (uint256)'];

  const $ = id => document.getElementById(id);
  const connectBtn = $('connectBtn');
  let activeProvider;

  function status(message, isError) {
    $('status').textContent = message;
    $('status').style.color = isError ? '#ff9999' : '';
  }
  function setFitCheck(ok, detail) {
    $('fitStatus').textContent = detail;
    $('fitMark').textContent = ok ? '✓' : '✕';
    $('fitMark').style.color = ok ? '#00c896' : '#ff7777';
  }
  function resetChecks() {
    setFitCheck(false, 'At least 1 FIT required');
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
    connectBtn.textContent = 'Checking FIT balance…';
    resetChecks();
    try {
      activeProvider = await getWalletProvider();
      const provider = new ethers.providers.Web3Provider(activeProvider, 'any');
      const network = await provider.getNetwork();
      if (network.chainId !== BSC_CHAIN_ID) {
        try {
          await activeProvider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x38' }] });
        } catch (switchError) {
          if (switchError.code === 4902) throw new Error('Please add BNB Smart Chain to your wallet, then try again.');
          throw new Error('Switch your wallet to BNB Smart Chain (chain ID 56) to check your FIT balance.');
        }
      }

      const signer = provider.getSigner();
      const address = await signer.getAddress();
      const readProvider = new ethers.providers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
      const fitContract = new ethers.Contract(FIT_ADDRESS, FIT_ABI, readProvider);

      status('Wallet connected: ' + address.slice(0, 6) + '…' + address.slice(-4) + '. Checking FIT balance…');
      const balance = await fitContract.balanceOf(address);
      const formatted = ethers.utils.formatUnits(balance, 18);
      const eligible = balance.gte(MIN_FIT);

      setFitCheck(eligible, formatted + ' FIT · Minimum required: 1 FIT');
      if (eligible) {
        $('eligiblePanel').hidden = false;
        status('The only entry requirement has been met: wallet balance is at least 1 FIT.');
      } else {
        $('deniedPanel').textContent = 'Access denied: this wallet must hold at least 1 FIT. No Network registration check is required.';
        $('deniedPanel').hidden = false;
        status('Insufficient FIT balance.', true);
      }
    } catch (error) {
      console.error('[Chess Arena]', error);
      status(error && error.message ? error.message : 'FIT balance verification failed.', true);
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